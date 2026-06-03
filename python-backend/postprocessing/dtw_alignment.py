"""
DTW Alignment — Score-to-Performance Alignment for Jingju
Uses Dynamic Time Warping to align a reference pitch sequence (score/template)
to a performed pitch contour.

Applications:
  - Score-to-performance alignment
  - Phoneme synchronisation
  - Pseudo-score alignment for unlabelled recordings
"""

import numpy as np
import logging
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)


def _dtw_distance(
    x: np.ndarray, y: np.ndarray, dist_fn=None
) -> Tuple[float, np.ndarray, List[Tuple[int, int]]]:
    """
    Pure-numpy DTW implementation.
    Falls back to dtaidistance if available for large sequences.

    Returns: (distance, cost_matrix, warping_path)
    """
    N, M = len(x), len(y)
    if dist_fn is None:
        dist_fn = lambda a, b: abs(a - b)

    # Cost matrix
    D = np.full((N + 1, M + 1), np.inf)
    D[0, 0] = 0.0

    for i in range(1, N + 1):
        for j in range(1, M + 1):
            cost = dist_fn(x[i - 1], y[j - 1])
            D[i, j] = cost + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])

    # Backtrack
    path = []
    i, j = N, M
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        diag = D[i - 1, j - 1]
        left = D[i, j - 1]
        up   = D[i - 1, j]
        if diag <= left and diag <= up:
            i -= 1; j -= 1
        elif left <= up:
            j -= 1
        else:
            i -= 1
    path.reverse()

    return float(D[N, M]), D[1:, 1:], path


def _dtw_fast(x: np.ndarray, y: np.ndarray) -> Tuple[float, List[Tuple[int, int]]]:
    """Uses dtaidistance for fast DTW if available."""
    try:
        from dtaidistance import dtw as dtai_dtw
        dist = dtai_dtw.distance_fast(x.astype(np.double), y.astype(np.double))
        path = dtai_dtw.warping_path(x.astype(np.double), y.astype(np.double))
        return float(dist), list(path)
    except ImportError:
        dist, _, path = _dtw_distance(x, y)
        return dist, path


class DTWAligner:
    """
    Aligns a reference pitch sequence to a performance using DTW.

    Usage:
        aligner = DTWAligner()
        aligned_ref, aligned_perf, path = aligner.align(ref_f0, perf_f0)
    """

    def __init__(
        self,
        semitone_scale: bool = True,
        voiced_only: bool = True,
        conf_threshold: float = 0.45,
    ):
        self.semitone_scale = semitone_scale
        self.voiced_only = voiced_only
        self.conf_threshold = conf_threshold

    def align(
        self,
        ref_f0: np.ndarray,
        perf_f0: np.ndarray,
        perf_confidence: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray, List[Tuple[int, int]], float]:
        """
        Align reference f0 to performance f0.

        Returns:
            aligned_ref:  reference f0 resampled to performance length
            aligned_perf: performance f0 aligned to reference
            path:         warping path [(ref_idx, perf_idx), ...]
            distance:     normalised DTW distance
        """
        ref = ref_f0.copy().astype(np.float64)
        perf = perf_f0.copy().astype(np.float64)

        # Mask unvoiced in performance
        if self.voiced_only and perf_confidence is not None:
            unvoiced = perf_confidence < self.conf_threshold
            perf[unvoiced] = np.nan

        # Convert to semitones for perceptually uniform distance
        if self.semitone_scale:
            with np.errstate(divide="ignore", invalid="ignore"):
                ref_semi  = np.where(ref  > 0, 12 * np.log2(ref  / 440.0), 0.0)
                perf_semi = np.where(perf > 0, 12 * np.log2(np.where(~np.isnan(perf), perf, 1e-6) / 440.0), 0.0)
                perf_semi = np.where(np.isnan(perf), 0.0, perf_semi)
        else:
            ref_semi = ref
            perf_semi = np.nan_to_num(perf, nan=0.0)

        dist, path = _dtw_fast(ref_semi, perf_semi)
        norm_dist = dist / max(len(path), 1)

        # Build aligned arrays
        aligned_ref  = np.array([ref_f0[p[0]]  for p in path], dtype=np.float32)
        aligned_perf = np.array([perf_f0[p[1]] for p in path], dtype=np.float32)

        logger.debug(f"DTW alignment: {len(ref_f0)} ref frames × {len(perf_f0)} perf frames → "
                     f"path length={len(path)}, dist={norm_dist:.4f}")

        return aligned_ref, aligned_perf, path, float(norm_dist)

    def pseudo_score_align(
        self,
        perf_f0: np.ndarray,
        confidence: np.ndarray,
        quantise_semitones: float = 0.5,
    ) -> np.ndarray:
        """
        Generate a pseudo-score by quantising the performance pitch contour.
        Used for semi-supervised pseudo-label generation.
        """
        voiced = (confidence >= self.conf_threshold) & (perf_f0 > 0)
        if np.sum(voiced) < 5:
            return np.zeros_like(perf_f0)

        with np.errstate(divide="ignore", invalid="ignore"):
            semi = np.where(voiced, 12 * np.log2(perf_f0 / 440.0), np.nan)

        # Quantise to nearest semitone grid
        quantised = np.round(semi / quantise_semitones) * quantise_semitones
        pseudo = np.where(voiced, 440.0 * (2.0 ** (quantised / 12.0)), 0.0)
        return pseudo.astype(np.float32)
