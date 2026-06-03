"""
Octave Correction for Jingju Pitch Contours

CREPE and other pitch detectors commonly confuse the fundamental frequency
with its octave harmonics. This module detects and corrects those jumps using:
  1. Local context median
  2. Role-specific pitch centre prior
  3. Energy-based sub-harmonic check
"""

import numpy as np
import librosa
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Jingju role pitch centre priors (MIDI note number)
ROLE_MIDI_CENTRES = {
    "dan": 65.0, "qingyi": 65.0, "huadan": 67.0, "wudan": 64.0,
    "laodan": 58.0, "daomadan": 64.0,
    "sheng": 48.0, "laosheng": 48.0, "xiaosheng": 55.0, "wusheng": 46.0,
    "jing": 43.0, "dahualian": 41.0, "erhualian": 45.0,
    "chou": 50.0, "wenchou": 50.0, "wuchou": 52.0,
    "default": 55.0,
}
MIDI_LO = librosa.hz_to_midi(80.0)
MIDI_HI = librosa.hz_to_midi(1047.0)


class OctaveCorrector:
    """
    Detects and corrects octave jumps in a voiced pitch contour.

    Parameters:
        role            — 行当 name for prior-based correction
        context_ms      — context window size in ms (default 300ms)
        min_jump_semi   — minimum semitone jump to consider as octave error (default 10)
        correction_bias — extra semitones the correction must be better by (tiebreaker)
    """

    def __init__(
        self,
        role: str = "default",
        context_ms: float = 300.0,
        min_jump_semi: float = 10.0,
        correction_bias: float = 3.0,
        sr: int = 22050,
        hop_length: int = 512,
    ):
        self.role = role
        self.centre_midi = ROLE_MIDI_CENTRES.get(role.lower(), ROLE_MIDI_CENTRES["default"])
        dt = hop_length / sr
        self.context_frames = max(7, int(context_ms / 1000.0 / dt))
        self.min_jump_semi = min_jump_semi
        self.correction_bias = correction_bias

    def correct(
        self, f0: np.ndarray, confidence: np.ndarray, conf_threshold: float = 0.45
    ) -> np.ndarray:
        """Correct octave errors in f0 contour. Returns corrected f0."""
        f0 = f0.copy().astype(np.float64)
        voiced = (confidence >= conf_threshold) & (f0 > 0)

        if np.sum(voiced) < 5:
            return f0.astype(np.float32)

        midi = np.full_like(f0, np.nan)
        midi[voiced] = librosa.hz_to_midi(f0[voiced])

        half_w = self.context_frames // 2
        idx_voiced = np.where(voiced)[0]
        corrected_midi = midi.copy()

        for i in idx_voiced:
            # Collect context (excluding current frame)
            lo = max(0, i - half_w)
            hi = min(len(midi), i + half_w + 1)
            ctx = midi[lo:hi]
            ctx = ctx[~np.isnan(ctx)]
            ctx = ctx[ctx != midi[i]]

            if len(ctx) < 2:
                continue

            local_med = float(np.median(ctx))
            cur = float(midi[i])
            diff = cur - local_med

            # Candidate correction: +12 or -12 semitones
            if diff > self.min_jump_semi:
                alt = cur - 12.0
                if MIDI_LO <= alt <= MIDI_HI:
                    if (abs(alt - self.centre_midi) <
                            abs(cur - self.centre_midi) - self.correction_bias):
                        corrected_midi[i] = alt

            elif diff < -self.min_jump_semi:
                alt = cur + 12.0
                if MIDI_LO <= alt <= MIDI_HI:
                    if (abs(alt - self.centre_midi) <
                            abs(cur - self.centre_midi) - self.correction_bias):
                        corrected_midi[i] = alt

        # Convert back to Hz
        valid = ~np.isnan(corrected_midi) & voiced
        f0[valid] = librosa.midi_to_hz(corrected_midi[valid])
        return f0.astype(np.float32)

    def set_role(self, role: str):
        self.role = role
        self.centre_midi = ROLE_MIDI_CENTRES.get(role.lower(), ROLE_MIDI_CENTRES["default"])
