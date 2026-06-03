"""
Evaluation Metrics for Jingju Pitch Detection

Implements:
  - RPA  (Raw Pitch Accuracy)       — fraction of voiced frames within ±50 cents
  - RCA  (Raw Chroma Accuracy)      — same but octave-invariant
  - Pitch RMSE                      — RMS error in cents on voiced frames
  - Voicing Recall                  — voiced frame recall (detection rate)
  - Voicing Precision               — voicing false-alarm rate
  - VDE  (Voicing Decision Error)   — overall voicing decision accuracy
  - Vibrato Continuity Stability    — vibrato-specific metric
"""

import numpy as np
import librosa
import logging
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

PITCH_TOLERANCE_CENTS = 50.0    # ±50 cents = RPA tolerance (mir_eval standard)
OCTAVE_SEMITONES = 1200.0       # one octave in cents


def hz_to_cents(f0_hz: np.ndarray, ref: float = 10.0) -> np.ndarray:
    """Convert Hz to cents relative to a reference frequency."""
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(f0_hz > 0, 1200 * np.log2(f0_hz / ref), 0.0)


class PitchEvaluator:
    """
    Evaluates predicted pitch against reference annotations.

    Usage:
        evaluator = PitchEvaluator()
        metrics = evaluator.evaluate(pred_f0, pred_conf, ref_f0, ref_voiced)
    """

    def __init__(
        self,
        pitch_tolerance_cents: float = PITCH_TOLERANCE_CENTS,
        voiced_threshold: float = 0.45,
    ):
        self.tol = pitch_tolerance_cents
        self.voiced_thr = voiced_threshold

    def evaluate(
        self,
        pred_f0: np.ndarray,        # predicted f0 Hz (0 = unvoiced)
        pred_confidence: np.ndarray, # predicted confidence [0, 1]
        ref_f0: np.ndarray,          # reference f0 Hz (0 = unvoiced)
        ref_voiced: Optional[np.ndarray] = None,  # reference voiced mask
    ) -> Dict:
        """Compute all metrics. Returns a dict of scores."""
        # Align lengths
        T = min(len(pred_f0), len(ref_f0))
        pred_f0  = pred_f0[:T].astype(np.float64)
        pred_conf = pred_confidence[:T].astype(np.float64)
        ref_f0   = ref_f0[:T].astype(np.float64)

        # Voicing decisions
        pred_voiced = pred_conf >= self.voiced_thr
        if ref_voiced is not None:
            ref_v = ref_voiced[:T].astype(bool)
        else:
            ref_v = ref_f0 > 0

        # Pitch in cents
        pred_cents = hz_to_cents(pred_f0)
        ref_cents  = hz_to_cents(ref_f0)

        # ── Voicing metrics ──────────────────────────────────────────────────
        voicing_recall, voicing_precision, vde = self._voicing_metrics(
            pred_voiced, ref_v
        )

        # ── Pitch accuracy (only where both voiced) ──────────────────────────
        both_voiced = pred_voiced & ref_v
        if both_voiced.sum() < 2:
            rpa = rca = rmse = vibrato_stability = 0.0
        else:
            p_c = pred_cents[both_voiced]
            r_c = ref_cents[both_voiced]
            rpa = self._rpa(p_c, r_c)
            rca = self._rca(p_c, r_c)
            rmse = float(np.sqrt(np.mean((p_c - r_c) ** 2)))
            vibrato_stability = self._vibrato_continuity_stability(
                pred_f0, pred_conf, ref_f0
            )

        return {
            "rpa":                  round(float(rpa), 4),
            "rca":                  round(float(rca), 4),
            "pitch_rmse_cents":     round(float(rmse), 2),
            "voicing_recall":       round(float(voicing_recall), 4),
            "voicing_precision":    round(float(voicing_precision), 4),
            "voicing_decision_error": round(float(vde), 4),
            "vibrato_continuity_stability": round(float(vibrato_stability), 4),
            "n_voiced_ref":         int(ref_v.sum()),
            "n_voiced_pred":        int(pred_voiced.sum()),
            "n_both_voiced":        int(both_voiced.sum()),
        }

    def _rpa(self, pred_cents: np.ndarray, ref_cents: np.ndarray) -> float:
        """Raw Pitch Accuracy — fraction within ±50 cents."""
        diff = np.abs(pred_cents - ref_cents)
        return float(np.mean(diff <= self.tol))

    def _rca(self, pred_cents: np.ndarray, ref_cents: np.ndarray) -> float:
        """Raw Chroma Accuracy — octave-invariant RPA."""
        diff = np.abs(pred_cents - ref_cents)
        diff_mod = diff % OCTAVE_SEMITONES
        chroma_diff = np.minimum(diff_mod, OCTAVE_SEMITONES - diff_mod)
        return float(np.mean(chroma_diff <= self.tol))

    @staticmethod
    def _voicing_metrics(
        pred_voiced: np.ndarray, ref_voiced: np.ndarray
    ) -> Tuple[float, float, float]:
        """Voicing recall, precision, and decision error."""
        tp = np.sum(pred_voiced & ref_voiced)
        fp = np.sum(pred_voiced & ~ref_voiced)
        fn = np.sum(~pred_voiced & ref_voiced)
        tn = np.sum(~pred_voiced & ~ref_voiced)
        n  = len(pred_voiced)

        recall    = tp / max(tp + fn, 1)
        precision = tp / max(tp + fp, 1)
        vde       = (fp + fn) / max(n, 1)
        return float(recall), float(precision), float(vde)

    def _vibrato_continuity_stability(
        self,
        pred_f0: np.ndarray,
        pred_conf: np.ndarray,
        ref_f0: np.ndarray,
        hop_length: int = 512,
        sr: int = 22050,
    ) -> float:
        """
        Vibrato Continuity Stability: measures how smoothly the predicted contour
        tracks the reference during vibrato passages.
        """
        dt = hop_length / sr
        voiced = (pred_conf >= self.voiced_thr) & (pred_f0 > 0) & (ref_f0 > 0)
        if voiced.sum() < 20:
            return 0.0

        with np.errstate(divide="ignore", invalid="ignore"):
            pred_semi = np.where(voiced, 12 * np.log2(pred_f0 / 440.0), np.nan)
            ref_semi  = np.where(voiced, 12 * np.log2(ref_f0  / 440.0), np.nan)

        # Smoothness: auto-correlation of residual at lag ~1 vibrato cycle
        residual = pred_semi - ref_semi
        valid = ~np.isnan(residual)
        if valid.sum() < 10:
            return 0.0
        res = residual[valid]
        if np.std(res) < 1e-9:
            return 1.0
        autocorr = float(np.corrcoef(res[:-1], res[1:])[0, 1])
        return float(np.clip((autocorr + 1.0) / 2.0, 0.0, 1.0))

    def batch_evaluate(
        self,
        predictions: list,  # list of (pred_f0, pred_conf)
        references: list,   # list of (ref_f0,)
    ) -> Dict:
        """Aggregate metrics over a dataset."""
        all_metrics = [
            self.evaluate(p[0], p[1], r[0])
            for p, r in zip(predictions, references)
        ]
        aggregate = {}
        for key in all_metrics[0]:
            vals = [m[key] for m in all_metrics if isinstance(m[key], (int, float))]
            if vals:
                aggregate[key] = round(float(np.mean(vals)), 4)
        return aggregate
