"""
Phase 5: Vibrato Analysis for Jingju Singing
Architecture: Pitch contour → detrend → Transformer refinement → modulation analysis

Detects:
  - vibrato_rate_hz    (5–9 Hz for Jingju)
  - vibrato_depth_cents
  - vibrato_stability  (0–1)
  - confidence         (0–1)

Jingju vibrato is restrained and stylised compared to Italian opera —
the model specifically handles short melismatic ornaments vs true vibrato.
"""

import numpy as np
import torch
import torch.nn as nn
from scipy.signal import medfilt, butter, filtfilt
from scipy.ndimage import gaussian_filter1d
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

VIBRATO_RATE_MIN = 4.5   # Hz — below this = tremolo or note change, not vibrato
VIBRATO_RATE_MAX = 9.5   # Hz — above this = flutter or instability
VIBRATO_RATE_TARGET = 6.5  # Hz — Jingju stylistic centre
VIBRATO_DEPTH_MIN = 10.0   # cents — below this = pitch inaccuracy, not vibrato
VIBRATO_DEPTH_TARGET = 30.0  # cents — typical Jingju vibrato extent


# ── Transformer-based vibrato contour smoother ────────────────────────────────

class VibratoTransformerRefinement(nn.Module):
    """
    Small Transformer encoder that smooths the detrended pitch contour before
    spectral analysis. This removes high-frequency noise from measurement artefacts
    while preserving genuine vibrato oscillation structure.
    """

    def __init__(self, d_model: int = 64, nhead: int = 4, num_layers: int = 2):
        super().__init__()
        self.input_proj = nn.Linear(1, d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=128,
            dropout=0.1, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=num_layers)
        self.output_proj = nn.Linear(d_model, 1)

    def forward(self, contour: torch.Tensor) -> torch.Tensor:
        # contour: (1, T, 1)
        x = self.input_proj(contour)        # (1, T, d_model)
        x = self.transformer(x)             # (1, T, d_model)
        return self.output_proj(x)          # (1, T, 1)


# ── Vibrato feature analyser ──────────────────────────────────────────────────

class VibratoMetricsModel:
    """
    Hybrid vibrato analyser for Peking Opera.

    Pipeline:
      1. Detrend pitch (remove phrase-level glides and sustains)
      2. Transformer smoothing (remove jitter, keep vibrato)
      3. Band-pass filter at vibrato rate range (4.5–9.5 Hz)
      4. FFT spectral analysis of modulation
      5. Compute rate, depth, stability, confidence
    """

    def __init__(self, sr: int = 22050, hop_length: int = 512):
        self.sr = sr
        self.hop_length = hop_length
        self.dt = hop_length / sr

        self.transformer = VibratoTransformerRefinement()
        self.transformer.eval()
        self.model_loaded = False

        # Auto-load trained checkpoint if available
        import os as _os
        _ckpt = _os.path.normpath(_os.path.join(
            _os.path.dirname(_os.path.abspath(__file__)),
            "..", "checkpoints", "vibrato", "best.pt"
        ))
        if _os.path.exists(_ckpt):
            try:
                state = torch.load(_ckpt, map_location="cpu", weights_only=True)
                if isinstance(state, dict) and "transformer" in state:
                    state = state["transformer"]
                self.transformer.load_state_dict(state)
                self.model_loaded = True
                logger.info(f"Loaded vibrato checkpoint: {_ckpt}")
            except Exception as _e:
                logger.warning(f"Failed to load vibrato checkpoint ({_e}) — using random weights")

    def analyze(
        self, f0: np.ndarray, confidence: np.ndarray, threshold: float = 0.45
    ) -> Dict:
        """
        Analyse vibrato in a pitch contour.

        Returns dict with keys:
            score, rate, extent, stability, confidence, vibrato_detected (bool)
        """
        # 1. Mask unvoiced frames
        f0_clean = f0.copy().astype(np.float64)
        f0_clean[confidence < threshold] = np.nan

        voiced_count = int(np.sum(~np.isnan(f0_clean)))
        if voiced_count < 20:
            return self._null_result()

        # 2. Interpolate gaps for continuous analysis
        idx = np.arange(len(f0_clean))
        valid = ~np.isnan(f0_clean)
        f0_interp = np.interp(idx, idx[valid], f0_clean[valid])

        # 3. Convert to cents (relative to 440 Hz reference)
        cents = 1200 * np.log2(np.maximum(f0_interp, 1e-6) / 440.0)

        # 4. Detrend — remove long-term pitch trend (median filter, 200ms window)
        trend_win = max(5, int(0.20 / self.dt))
        trend_win = trend_win if trend_win % 2 == 1 else trend_win + 1
        trend = medfilt(cents, kernel_size=trend_win)
        modulation = cents - trend   # vibrato oscillation in cents

        # 5. Transformer refinement (removes frame-level jitter)
        modulation_refined = self._transformer_smooth(modulation)

        # 6. Band-pass filter at vibrato rate band (4.5–9.5 Hz)
        modulation_bp = self._bandpass(modulation_refined)

        # 7. Spectral analysis
        n = len(modulation_bp)
        freqs = np.fft.rfftfreq(n, d=self.dt)
        fft_mag = np.abs(np.fft.rfft(modulation_bp))

        vibrato_mask = (freqs >= VIBRATO_RATE_MIN) & (freqs <= VIBRATO_RATE_MAX)
        if not np.any(vibrato_mask):
            return self._null_result()

        vib_freqs = freqs[vibrato_mask]
        vib_mags = fft_mag[vibrato_mask]

        # 8. Check vibrato energy dominance
        total_energy = np.sum(fft_mag ** 2) + 1e-12
        vib_energy = np.sum(vib_mags ** 2)
        if vib_energy / total_energy < 0.12:
            return self._null_result()

        # 9. Peak rate and depth
        peak_idx = np.argmax(vib_mags)
        rate = float(vib_freqs[peak_idx])
        peak_mag = float(vib_mags[peak_idx])
        depth_cents = float(4.0 * peak_mag / n)   # peak-to-peak amplitude

        if depth_cents < VIBRATO_DEPTH_MIN:
            return self._null_result()

        # 10. Stability — how peaked is the vibrato spectrum?
        mean_vib_mag = np.mean(vib_mags)
        peak_to_mean = peak_mag / (mean_vib_mag + 1e-9)
        n_vib_bins = np.sum(vibrato_mask)
        stability = float(np.clip((peak_to_mean - 1.0) / max(n_vib_bins - 1.0, 1), 0.0, 1.0))

        # 11. Scoring — Jingju-tuned
        rate_score = max(0.0, 1.0 - abs(rate - VIBRATO_RATE_TARGET) / 3.5)
        depth_score = min(1.0, depth_cents / VIBRATO_DEPTH_TARGET)
        final_score = (rate_score * 0.4 + depth_score * 0.4 + stability * 0.2) * 100.0

        # 12. Vibrato confidence — based on energy dominance
        vib_confidence = float(np.clip(vib_energy / total_energy * 3.0, 0.0, 1.0))

        return {
            "score": round(final_score, 2),
            "rate": round(rate, 2),
            "extent": round(depth_cents, 2),
            "stability": round(stability, 4),
            "confidence": round(vib_confidence, 4),
            "vibrato_detected": True,
            "vibrato_rate_hz": round(rate, 2),
            "vibrato_depth_cents": round(depth_cents, 2),
            "vibrato_stability": round(stability, 4),
        }

    def _transformer_smooth(self, modulation: np.ndarray) -> np.ndarray:
        """Run Transformer refinement on modulation contour. Falls back to Gaussian."""
        if not self.model_loaded:
            return gaussian_filter1d(modulation, sigma=1)

        try:
            # Z-normalize matching train.py logic to prevent domain shift
            mod_std = np.std(modulation)
            if mod_std < 1e-6:
                return modulation

            mod_norm = (modulation / mod_std).astype(np.float32)

            t = torch.tensor(mod_norm).unsqueeze(0).unsqueeze(-1)
            with torch.no_grad():
                out = self.transformer(t)

            out_np = out.squeeze().numpy().astype(np.float64)
            # Denormalize
            return out_np * mod_std
        except Exception:
            # Fallback: gentle Gaussian smoothing
            return gaussian_filter1d(modulation, sigma=1.5)

    def _bandpass(self, signal: np.ndarray) -> np.ndarray:
        """Butterworth band-pass filter at vibrato rate range."""
        nyq = 0.5 / self.dt
        low = VIBRATO_RATE_MIN / nyq
        high = VIBRATO_RATE_MAX / nyq
        # Clamp to valid range
        low = max(0.001, min(low, 0.99))
        high = max(0.001, min(high, 0.99))
        if low >= high:
            return signal
        try:
            b, a = butter(N=4, Wn=[low, high], btype="bandpass")
            return filtfilt(b, a, signal)
        except Exception:
            return signal

    @staticmethod
    def _null_result() -> Dict:
        return {
            "score": 0.0,
            "rate": 0.0,
            "extent": 0.0,
            "stability": 0.0,
            "confidence": 0.0,
            "vibrato_detected": False,
            "vibrato_rate_hz": 0.0,
            "vibrato_depth_cents": 0.0,
            "vibrato_stability": 0.0,
        }
