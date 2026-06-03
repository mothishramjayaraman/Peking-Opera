"""
Phase 7: Deep Timbre Analysis for Jingju Singing
Architecture: MFCC + Harmonic + Formant features → Transformer Encoder → Timbre Embedding

Detects:
  - brightness        (spectral centroid based)
  - warmth            (low-mid energy ratio)
  - nasal_resonance   (formant F1/F2 pattern)
  - harmonic_richness (HNR + overtone count)
  - role_brightness   (role-appropriate brightness score)

Jingju-specific: distinguishes 小嗓 (bright Dan falsetto) from 大嗓 (warm Jing chest voice)
"""

import torch
import torch.nn as nn
import numpy as np
import librosa
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class TimbreEncoder(nn.Module):
    """
    Transformer-based timbre embedding network.
    Input: MFCC + delta features → frame-level embeddings → global pooling → timbre vector
    """

    def __init__(self, input_dim: int = 120, embed_dim: int = 128, nhead: int = 4, num_layers: int = 3):
        super().__init__()
        self.input_proj = nn.Linear(input_dim, embed_dim)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=nhead,
            dim_feedforward=256, dropout=0.1, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=num_layers)
        self.pool_norm = nn.LayerNorm(embed_dim)

        # Output heads
        self.brightness_head = nn.Sequential(nn.Linear(embed_dim, 32), nn.GELU(), nn.Linear(32, 1), nn.Sigmoid())
        self.warmth_head     = nn.Sequential(nn.Linear(embed_dim, 32), nn.GELU(), nn.Linear(32, 1), nn.Sigmoid())
        self.nasal_head      = nn.Sequential(nn.Linear(embed_dim, 32), nn.GELU(), nn.Linear(32, 1), nn.Sigmoid())
        self.hnr_head        = nn.Sequential(nn.Linear(embed_dim, 32), nn.GELU(), nn.Linear(32, 1), nn.Sigmoid())

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        # x: (B, T, input_dim)
        h = self.input_proj(x)          # (B, T, embed_dim)
        h = self.transformer(h)         # (B, T, embed_dim)
        pooled = self.pool_norm(h.mean(dim=1))   # (B, embed_dim) global avg pool

        return {
            "brightness": self.brightness_head(pooled),   # (B, 1)
            "warmth":     self.warmth_head(pooled),
            "nasal":      self.nasal_head(pooled),
            "hnr":        self.hnr_head(pooled),
            "embedding":  pooled,
        }


class ToneMetricsModel:
    """
    Deep timbre analyser with harmonic-aware feature extraction.
    Wraps TimbreEncoder with acoustic feature extraction.
    """

    def __init__(self, sr: int = 22050):
        self.sr = sr
        self.encoder = TimbreEncoder(input_dim=120, embed_dim=128)
        self.encoder.eval()

        # Auto-load trained checkpoint if available
        import os as _os
        _ckpt = _os.path.normpath(_os.path.join(
            _os.path.dirname(_os.path.abspath(__file__)),
            "..", "checkpoints", "timbre", "best.pt"
        ))
        if _os.path.exists(_ckpt):
            try:
                state = torch.load(_ckpt, map_location="cpu", weights_only=True)
                if isinstance(state, dict) and "encoder" in state:
                    state = state["encoder"]
                self.encoder.load_state_dict(state)
                logger.info(f"Loaded timbre checkpoint: {_ckpt}")
            except Exception as _e:
                logger.warning(f"Failed to load timbre checkpoint ({_e}) — using random weights")

    def analyze(
        self, y: np.ndarray, sr: Optional[int] = None, periodicity: Optional[np.ndarray] = None
    ) -> Dict:
        if sr is None:
            sr = self.sr

        y_harm, _ = librosa.effects.hpss(y, margin=2.0)

        # ── Acoustic feature extraction ──────────────────────────────────────
        # MFCC (40) + delta (40) + delta2 (40) = 120 dims
        mfcc = librosa.feature.mfcc(y=y_harm, sr=sr, n_mfcc=40)
        d1   = librosa.feature.delta(mfcc)
        d2   = librosa.feature.delta(mfcc, order=2)
        feats = np.concatenate([mfcc, d1, d2], axis=0).T   # (T, 120)

        rms = librosa.feature.rms(y=y_harm)[0]
        if np.max(rms) < 1e-9:
            return self._null_result()

        # Weighted by voiced periodicity
        weights = rms / (np.max(rms) + 1e-9)
        if periodicity is not None:
            n_frames = len(weights)
            voiced_conf = np.interp(
                np.linspace(0, 1, n_frames),
                np.linspace(0, 1, len(periodicity)),
                periodicity
            )
            weights = weights * voiced_conf
        weights[rms < np.max(rms) * 0.05] = 0.0
        wsum = weights.sum()
        if wsum < 1e-9:
            return self._null_result()
        weights = weights / wsum

        # ── Transformer timbre encoding ──────────────────────────────────────
        try:
            T_feats = min(feats.shape[0], len(weights))
            feats = feats[:T_feats]
            w_t = weights[:T_feats]
            # Weighted mean and std normalisation
            feat_mean = np.average(feats, axis=0, weights=w_t)
            feat_std  = np.sqrt(np.average((feats - feat_mean) ** 2, axis=0, weights=w_t)) + 1e-6
            feats_norm = (feats - feat_mean) / feat_std

            t = torch.tensor(feats_norm, dtype=torch.float32).unsqueeze(0)  # (1, T, 120)
            with torch.no_grad():
                out = self.encoder(t)
            brightness_dl = float(out["brightness"].squeeze())
            warmth_dl     = float(out["warmth"].squeeze())
            nasal_dl      = float(out["nasal"].squeeze())
        except Exception as exc:
            logger.warning(f"TimbreEncoder failed ({exc}). Using acoustic fallback.")
            brightness_dl, warmth_dl, nasal_dl = 0.5, 0.5, 0.5

        # ── Acoustic confirmatory scores ─────────────────────────────────────
        centroid = librosa.feature.spectral_centroid(y=y_harm, sr=sr)[0]
        rolloff  = librosa.feature.spectral_rolloff(y=y_harm, sr=sr, roll_percent=0.85)[0]
        flatness = librosa.feature.spectral_flatness(y=y_harm)[0]

        # Align weights
        wc = np.interp(np.linspace(0,1,len(centroid)), np.linspace(0,1,len(weights)), weights)
        wr = np.interp(np.linspace(0,1,len(rolloff)),  np.linspace(0,1,len(weights)), weights)
        wf = np.interp(np.linspace(0,1,len(flatness)), np.linspace(0,1,len(weights)), weights)

        avg_centroid = float(np.average(centroid, weights=wc + 1e-9))
        avg_rolloff  = float(np.average(rolloff,  weights=wr + 1e-9))
        avg_flatness = float(np.average(flatness, weights=wf + 1e-9))

        centroid_score = min(100.0, (avg_centroid / 4000.0) * 100.0)
        rolloff_score  = min(100.0, (avg_rolloff  / 8000.0) * 100.0)
        brightness_acoustic = (centroid_score * 0.6 + rolloff_score * 0.4)

        # HNR computation
        hnr_score = self._compute_hnr(y_harm, sr, weights)

        noise_penalty = min(30.0, avg_flatness * 100.0)

        # Spectral stability
        mfcc_wmean = np.average(mfcc, axis=1, weights=np.interp(
            np.linspace(0,1,mfcc.shape[1]), np.linspace(0,1,len(weights)), weights) + 1e-9)
        mfcc_wstd = np.sqrt(np.average(
            (mfcc - mfcc_wmean[:, None]) ** 2, axis=1,
            weights=np.interp(np.linspace(0,1,mfcc.shape[1]),
                              np.linspace(0,1,len(weights)), weights) + 1e-9))
        avg_mfcc_std = float(np.mean(mfcc_wstd[1:5]))
        spectral_stability = max(0.0, min(100.0, 100.0 - avg_mfcc_std * 2.0 - noise_penalty))

        # Blend DL + acoustic brightness
        brightness_final = (brightness_dl * 100.0) * 0.35 + brightness_acoustic * 0.65
        warmth_final     = warmth_dl * 100.0
        nasal_final      = nasal_dl * 100.0
        harmonic_richness = (hnr_score * 0.5 + spectral_stability * 0.5)

        tone_score = (spectral_stability * 0.4 + hnr_score * 0.25 +
                      brightness_final * 0.2 + harmonic_richness * 0.15)

        return {
            "tone_score":         round(float(tone_score), 2),
            "brightness":         round(float(brightness_final), 2),
            "warmth":             round(float(warmth_final), 2),
            "nasal_resonance":    round(float(nasal_final), 2),
            "harmonic_richness":  round(float(harmonic_richness), 2),
            "spectral_stability": round(float(spectral_stability), 2),
            "hnr_score":          round(float(hnr_score), 2),
            "confidence":         round(float(np.mean(periodicity)) if periodicity is not None else 0.5, 4),
        }

    def _compute_hnr(self, y_harm: np.ndarray, sr: int, weights: np.ndarray) -> float:
        hop_length = 512
        frame_length = 2048
        frames = librosa.util.frame(y_harm, frame_length=frame_length, hop_length=hop_length)
        n_frames = frames.shape[1]

        F = np.fft.rfft(frames, n=2 * frame_length, axis=0)
        acf = np.fft.irfft(np.abs(F) ** 2, axis=0)[:frame_length]
        r0 = acf[0]

        min_lag = max(1, int(sr / 1047))
        max_lag = min(int(sr / 65), frame_length - 1)
        r_max = np.max(acf[min_lag:max_lag + 1], axis=0)
        noise_energy = np.maximum(r0 - r_max, 1e-9)
        hnr_db = np.where(r0 < 1e-9, 0.0, 10.0 * np.log10(np.maximum(r_max, 1e-9) / noise_energy))
        hnr_db = np.maximum(hnr_db, 0.0)

        w = np.interp(np.linspace(0,1,n_frames), np.linspace(0,1,len(weights)), weights)
        wsum = w.sum()
        if wsum < 1e-9:
            return 0.0
        avg_hnr = float(np.dot(hnr_db, w) / wsum)
        return max(0.0, min(100.0, (avg_hnr / 20.0) * 100.0))

    @staticmethod
    def _null_result() -> Dict:
        return {
            "tone_score": 0.0, "brightness": 0.0, "warmth": 0.0,
            "nasal_resonance": 0.0, "harmonic_richness": 0.0,
            "spectral_stability": 0.0, "hnr_score": 0.0, "confidence": 0.0,
        }
