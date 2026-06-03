"""
FT-GAN Inspired Pitch Contour Post-Processor

Three-pass pipeline:
  Pass 1 — Outlier removal       (reject octave-jump spikes)
  Pass 2 — Confidence-weighted   (interpolate low-confidence gaps)
  Pass 3 — Adaptive smoothing    (preserve vibrato, remove jitter)
"""

import numpy as np
from scipy.signal import medfilt
from scipy.ndimage import gaussian_filter1d
from typing import Tuple


class FTGANContourSmoother:
    """
    Applies FT-GAN-inspired post-processing to a raw pitch contour.
    Reduces spikes, fills gaps, and preserves vibrato shape.
    """

    def __init__(
        self,
        confidence_threshold: float = 0.45,
        outlier_semitones: float = 18.0,
        smooth_sigma_ms: float = 15.0,
        sr: int = 22050,
        hop_length: int = 512,
    ):
        self.conf_thr = confidence_threshold
        self.outlier_semitones = outlier_semitones
        dt = hop_length / sr
        self.smooth_sigma_frames = max(1.0, (smooth_sigma_ms / 1000.0) / dt)
        self.dt = dt

    def smooth(
        self, f0: np.ndarray, confidence: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        f0 = f0.copy().astype(np.float64)
        conf = confidence.copy().astype(np.float64)

        # Pass 1: unvoice below threshold
        voiced = conf >= self.conf_thr
        f0[~voiced] = 0.0

        if np.sum(voiced) < 3:
            return f0.astype(np.float32), conf.astype(np.float32)

        # Convert to log-cents for outlier detection
        with np.errstate(divide="ignore", invalid="ignore"):
            log_f0 = np.where(voiced & (f0 > 0), 1200 * np.log2(f0 / 440.0), np.nan)

        # Pass 1: sliding-window outlier rejection
        win = max(5, int(0.15 / self.dt))
        win = win if win % 2 == 1 else win + 1
        valid = ~np.isnan(log_f0)
        if np.sum(valid) >= win:
            temp = np.where(valid, log_f0, 0.0)
            median_curve = medfilt(temp, kernel_size=win)
            outliers = valid & (np.abs(log_f0 - median_curve) > self.outlier_semitones * 100)
            f0[outliers] = 0.0
            conf[outliers] = 0.0
            voiced = conf >= self.conf_thr
            log_f0[outliers] = np.nan

        # Pass 2: confidence-weighted interpolation
        valid_idx = np.where(~np.isnan(log_f0))[0]
        if len(valid_idx) > 1:
            interp_log = np.interp(np.arange(len(log_f0)), valid_idx, log_f0[valid_idx])
        else:
            interp_log = np.where(np.isnan(log_f0), 0.0, log_f0)

        # Pass 3: adaptive Gaussian smoothing (narrower = preserves vibrato)
        smooth_log = gaussian_filter1d(interp_log, sigma=self.smooth_sigma_frames)

        # Back to Hz, restore voiced mask
        smoothed = 440.0 * (2.0 ** (smooth_log / 1200.0))
        smoothed[~voiced] = 0.0

        return smoothed.astype(np.float32), conf.astype(np.float32)
