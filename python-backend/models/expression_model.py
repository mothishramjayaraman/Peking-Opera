"""
Phase 9: Expression & Emotion Detection for Jingju Singing
Architecture: Shared encoder fusion (pitch + vibrato + timbre + timing) → Transformer head

Detects:
  - tension, softness, aggression, sadness, joyfulness (Jingju emotional states)
  - emotional_intensity (0–1)
  - confidence

Uses multi-modal fusion — NOT pitch alone.
Jingju expression is encoded in: 韵味 (yùnwèi) — the tonal, timbral, and rhythmic character
specific to each 行当 role type.
"""

import torch
import torch.nn as nn
import numpy as np
import librosa
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

JINGJU_EMOTIONS = ["neutral", "tension", "softness", "aggression", "sadness", "joyfulness"]
EMOTION_IDX = {e: i for i, e in enumerate(JINGJU_EMOTIONS)}
N_EMOTIONS = len(JINGJU_EMOTIONS)


class MultiModalFusionHead(nn.Module):
    """
    Fuses pitch, vibrato, timbre, and timing features into an expression embedding.
    Input: concatenated multi-modal feature vector (B, T, fusion_dim)
    Output: (emotion logits, intensity)
    """

    def __init__(self, fusion_dim: int = 64, embed_dim: int = 128, n_emotions: int = N_EMOTIONS):
        super().__init__()
        self.proj = nn.Linear(fusion_dim, embed_dim)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=4, dim_feedforward=256,
            dropout=0.1, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=2)
        self.pool_norm = nn.LayerNorm(embed_dim)

        self.emotion_head    = nn.Sequential(nn.Linear(embed_dim, 64), nn.GELU(), nn.Linear(64, n_emotions))
        self.intensity_head  = nn.Sequential(nn.Linear(embed_dim, 32), nn.GELU(), nn.Linear(32, 1), nn.Sigmoid())

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        # x: (B, T, fusion_dim)
        h = self.proj(x)
        h = self.transformer(h)
        pooled = self.pool_norm(h.mean(dim=1))   # (B, embed_dim)
        return self.emotion_head(pooled), self.intensity_head(pooled)


class ExpressionAnalyzer:
    """
    Multi-modal expression analyser for Jingju singing.

    Fuses:
      - Pitch variation (contour dynamics, phrase-level arcs)
      - Vibrato behaviour (rate, depth, consistency)
      - Timbre (brightness, warmth, nasal resonance)
      - Timing (dynamic variation, phrase energy arc)

    Does NOT use pitch alone — consistent with Phase 9 requirements.
    """

    def __init__(self, sr: int = 22050, hop_length: int = 512):
        self.sr = sr
        self.hop_length = hop_length
        self.model = MultiModalFusionHead(fusion_dim=64)
        self.model.eval()

        # Auto-load trained checkpoint if available
        import os as _os
        _ckpt = _os.path.normpath(_os.path.join(
            _os.path.dirname(_os.path.abspath(__file__)),
            "..", "checkpoints", "expression", "best.pt"
        ))
        if _os.path.exists(_ckpt):
            try:
                state = torch.load(_ckpt, map_location="cpu", weights_only=True)
                if isinstance(state, dict) and "model" in state:
                    state = state["model"]
                self.model.load_state_dict(state)
                logger.info(f"Loaded expression checkpoint: {_ckpt}")
            except Exception as _e:
                logger.warning(f"Failed to load expression checkpoint ({_e}) — using random weights")

    def analyze(
        self,
        y: np.ndarray,
        sr: Optional[int] = None,
        f0: Optional[np.ndarray] = None,
        confidence: Optional[np.ndarray] = None,
        vibrato_results: Optional[Dict] = None,
        timbre_results: Optional[Dict] = None,
        mode: str = "chinese_opera",
    ) -> Dict:
        if sr is None:
            sr = self.sr

        # ── Multi-modal feature extraction ──────────────────────────────────
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)[0]
        if np.max(rms) < 1e-9:
            return self._null_result()

        active_mask = rms > (np.max(rms) * 0.05)
        active_rms = rms[active_mask]
        if len(active_rms) == 0:
            return self._null_result()

        # 1. Volume dynamics (韵味 phrase contrast)
        cv_volume = float(np.std(active_rms) / (np.mean(active_rms) + 1e-6))
        peak_contrast = float(np.percentile(active_rms, 90) / (np.median(active_rms) + 1e-9))

        # 2. Pitch variation (if f0 provided)
        pitch_variation = 0.0
        pitch_arc_score = 0.0
        if f0 is not None and confidence is not None:
            voiced = (confidence >= 0.45) & (f0 > 0)
            if np.sum(voiced) > 10:
                voiced_midi = librosa.hz_to_midi(f0[voiced].astype(np.float64))
                pitch_variation = float(np.std(voiced_midi))
                # Phrase arc: does pitch build and resolve?
                n_phrases = max(1, int(len(voiced_midi) / 50))
                phrase_peaks = [np.max(voiced_midi[i*50:(i+1)*50]) for i in range(n_phrases)]
                pitch_arc_score = float(np.std(phrase_peaks)) if len(phrase_peaks) > 1 else 0.0

        # 3. Vibrato contribution
        vib_rate = float(vibrato_results.get("vibrato_rate_hz", 0.0)) if vibrato_results else 0.0
        vib_depth = float(vibrato_results.get("vibrato_depth_cents", 0.0)) if vibrato_results else 0.0
        vib_stab = float(vibrato_results.get("vibrato_stability", 0.0)) if vibrato_results else 0.0

        # 4. Timbre contribution
        brightness = float(timbre_results.get("brightness", 50.0)) / 100.0 if timbre_results else 0.5
        warmth = float(timbre_results.get("warmth", 50.0)) / 100.0 if timbre_results else 0.5
        nasal  = float(timbre_results.get("nasal_resonance", 50.0)) / 100.0 if timbre_results else 0.5

        # 5. MFCC timbre variation
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        active_mfcc = mfcc[:, active_mask] if mfcc.shape[1] > 0 else mfcc
        mfcc_std = float(np.mean(np.std(active_mfcc, axis=1))) if active_mfcc.shape[1] > 1 else 0.0

        # ── Fusion vector ────────────────────────────────────────────────────
        # 64-dim fusion: [vol_dynamics, peak_contrast, pitch_var, pitch_arc,
        #                  vib_rate_n, vib_depth_n, vib_stab,
        #                  brightness, warmth, nasal, mfcc_std_n, ...padding]
        vib_rate_n  = np.clip(vib_rate / 9.5, 0.0, 1.0)
        vib_depth_n = np.clip(vib_depth / 100.0, 0.0, 1.0)
        pitch_var_n = np.clip(pitch_variation / 24.0, 0.0, 1.0)
        pitch_arc_n = np.clip(pitch_arc_score / 12.0, 0.0, 1.0)
        mfcc_std_n  = np.clip(mfcc_std / 30.0, 0.0, 1.0)
        cv_vol_n    = np.clip(cv_volume / 1.0, 0.0, 1.0)
        peak_c_n    = np.clip((peak_contrast - 1.0) / 4.0, 0.0, 1.0)

        base = np.array([
            cv_vol_n, peak_c_n, pitch_var_n, pitch_arc_n,
            vib_rate_n, vib_depth_n, vib_stab,
            brightness, warmth, nasal, mfcc_std_n,
        ], dtype=np.float32)
        # Pad to 64 dims
        fusion_vec = np.pad(base, (0, 64 - len(base)), mode="constant")

        # ── DL inference ────────────────────────────────────────────────────
        try:
            t = torch.tensor(fusion_vec, dtype=torch.float32).unsqueeze(0).unsqueeze(0)  # (1,1,64)
            with torch.no_grad():
                emotion_logits, intensity = self.model(t)
            emotion_probs = torch.softmax(emotion_logits, dim=-1).squeeze(0).numpy()
            top_idx = int(np.argmax(emotion_probs))
            emotion_name = JINGJU_EMOTIONS[top_idx]
            emotion_conf = float(emotion_probs[top_idx])
            intensity_val = float(intensity.squeeze())
        except Exception as exc:
            logger.warning(f"ExpressionModel DL failed ({exc}). Using heuristic.")
            emotion_name, emotion_conf, intensity_val = self._heuristic_emotion(
                cv_vol_n, pitch_var_n, brightness, warmth)

        # ── Acoustic expression score (for compatibility with analyzer.py) ──
        if mode == "exercise":
            score = max(0.0, 100.0 - cv_volume * 100.0)
        elif mode == "chinese_opera":
            timbre_score  = max(0.0, min(100.0, (mfcc_std - 8.0) * 3.6))
            peak_score    = max(0.0, min(100.0, (peak_contrast - 1.0) * 50.0))
            vol_score     = max(0.0, min(100.0, (cv_volume - 0.10) * 167.0))
            score = timbre_score * 0.40 + peak_score * 0.35 + vol_score * 0.25
        else:
            vol_score    = max(0.0, min(100.0, (cv_volume - 0.05) * 200.0))
            timbre_score = max(0.0, min(100.0, (mfcc_std - 5.0) * 4.0))
            score = vol_score * 0.5 + timbre_score * 0.5

        return {
            "expression_score":   round(float(score), 2),
            "emotion":            emotion_name,
            "intensity":          round(float(intensity_val), 4),
            "confidence":         round(float(emotion_conf), 4),
            "pitch_variation":    round(float(pitch_variation), 2),
            "volume_dynamics":    round(float(cv_volume), 4),
            "peak_contrast":      round(float(peak_contrast), 4),
        }

    @staticmethod
    def _heuristic_emotion(
        cv_vol: float, pitch_var: float, brightness: float, warmth: float
    ) -> Tuple[str, float, float]:
        """Rule-based fallback when DL model fails."""
        intensity = float(np.clip((cv_vol + pitch_var) / 2.0, 0.0, 1.0))
        if cv_vol > 0.6 and pitch_var > 0.6:
            return "tension", 0.55, intensity
        if warmth > 0.7 and cv_vol < 0.3:
            return "softness", 0.50, intensity
        if brightness > 0.7 and cv_vol > 0.5:
            return "joyfulness", 0.50, intensity
        return "neutral", 0.50, intensity

    @staticmethod
    def _null_result() -> Dict:
        return {
            "expression_score": 0.0, "emotion": "neutral",
            "intensity": 0.0, "confidence": 0.0,
            "pitch_variation": 0.0, "volume_dynamics": 0.0, "peak_contrast": 0.0,
        }
