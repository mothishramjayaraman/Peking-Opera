"""
Semi-Supervised Learning for Jingju Pitch Detection

Pseudo-label generation + Active learning pipeline:
  1. Run trained model on unlabelled Jingju recordings
  2. Keep only high-confidence predictions as pseudo-labels
  3. Add pseudo-labelled data to training set and retrain
  4. Active learning: select most uncertain samples for manual annotation
"""

import numpy as np
import os
import json
import logging
from typing import List, Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

HIGH_CONF_THRESHOLD = 0.75    # frames above this are pseudo-labelled as voiced
LOW_CONF_THRESHOLD  = 0.35    # frames below this are pseudo-labelled as unvoiced
COVERAGE_MIN        = 0.4     # at least 40% frames must be high-confidence
UNCERTAINTY_RATIO   = 0.3     # proportion of frames in uncertainty zone


class PseudoLabeler:
    """
    Generates pseudo-labels for unlabelled Jingju recordings.

    Workflow:
        labeler = PseudoLabeler(pitch_model)
        pseudo_labels = labeler.label_files(audio_files, output_dir)
    """

    def __init__(
        self,
        pitch_model,         # VocalPitchModel instance
        high_conf: float = HIGH_CONF_THRESHOLD,
        low_conf: float  = LOW_CONF_THRESHOLD,
        min_coverage: float = COVERAGE_MIN,
    ):
        self.model = pitch_model
        self.high_conf = high_conf
        self.low_conf  = low_conf
        self.min_coverage = min_coverage

    def label_file(
        self, audio: np.ndarray, sr: int
    ) -> Optional[Dict]:
        """
        Generate pseudo-labels for a single audio array.

        Returns None if the recording is too noisy / coverage too low.
        """
        f0, confidence = self.model.predict_pitch(audio, sr)

        high_conf_ratio = float(np.mean(confidence >= self.high_conf))
        if high_conf_ratio < self.min_coverage:
            logger.debug(f"Skipping: low coverage {high_conf_ratio:.2f} < {self.min_coverage}")
            return None

        # Pseudo-label: set low-confidence frames to unvoiced (f0=0)
        f0_pseudo = f0.copy()
        f0_pseudo[confidence < self.low_conf] = 0.0

        # Binary voicing pseudo-label
        voiced_pseudo = (confidence >= self.high_conf).astype(np.float32)

        return {
            "f0":         f0_pseudo.tolist(),
            "confidence": confidence.tolist(),
            "voiced":     voiced_pseudo.tolist(),
            "coverage":   float(high_conf_ratio),
            "mean_conf":  float(np.mean(confidence)),
        }

    def label_files(
        self,
        audio_paths: List[str],
        output_dir: str,
        sr: int = 22050,
    ) -> List[str]:
        """
        Label a list of audio files. Saves JSON pseudo-label files.
        Returns list of successfully labelled file paths.
        """
        import librosa
        os.makedirs(output_dir, exist_ok=True)
        labelled = []

        for path in audio_paths:
            try:
                y, _ = librosa.load(path, sr=sr, mono=True)
                result = self.label_file(y, sr)
                if result is None:
                    continue

                out_path = os.path.join(
                    output_dir,
                    Path(path).stem + "_pseudo.json"
                )
                with open(out_path, "w") as f:
                    json.dump(result, f)

                labelled.append(path)
                logger.info(f"Pseudo-labelled: {Path(path).name} (coverage={result['coverage']:.2f})")
            except Exception as exc:
                logger.warning(f"Failed to label {path}: {exc}")

        logger.info(f"Pseudo-labelling: {len(labelled)}/{len(audio_paths)} files accepted.")
        return labelled

    def filter_by_quality(
        self, labels: List[Dict], min_mean_conf: float = 0.55
    ) -> List[Dict]:
        """Keep only pseudo-labels with high average confidence."""
        return [l for l in labels if l.get("mean_conf", 0.0) >= min_mean_conf]


class ActiveLearningPipeline:
    """
    Selects the most informative unlabelled recordings for manual annotation.

    Strategy: Core-set / uncertainty sampling —
      pick samples where the model is most uncertain (confidence near 0.5)
      across many frames (high entropy frames).
    """

    def __init__(self, uncertainty_zone: Tuple[float, float] = (0.35, 0.65)):
        self.unc_lo, self.unc_hi = uncertainty_zone

    def uncertainty_score(self, confidence: np.ndarray) -> float:
        """Fraction of frames in the uncertainty zone."""
        in_zone = (confidence >= self.unc_lo) & (confidence <= self.unc_hi)
        return float(np.mean(in_zone))

    def rank_for_annotation(
        self,
        audio_paths: List[str],
        pitch_model,
        sr: int = 22050,
        top_k: int = 20,
    ) -> List[Tuple[str, float]]:
        """
        Rank unlabelled recordings by uncertainty. Returns top_k most uncertain.
        """
        import librosa
        scores = []

        for path in audio_paths:
            try:
                y, _ = librosa.load(path, sr=sr, mono=True)
                _, conf = pitch_model.predict_pitch(y, sr)
                unc = self.uncertainty_score(conf)
                scores.append((path, unc))
            except Exception as exc:
                logger.warning(f"Failed to score {path}: {exc}")

        scores.sort(key=lambda x: x[1], reverse=True)
        logger.info(f"Active learning: top {top_k} uncertain samples selected.")
        return scores[:top_k]

    def generate_retrain_manifest(
        self,
        pseudo_label_dir: str,
        original_label_dir: Optional[str],
        output_path: str,
    ):
        """
        Create a JSON manifest combining pseudo-labels + human labels for retraining.
        """
        manifest = {"pseudo_labelled": [], "human_labelled": []}

        for p in Path(pseudo_label_dir).glob("*_pseudo.json"):
            manifest["pseudo_labelled"].append(str(p))

        if original_label_dir and os.path.exists(original_label_dir):
            for p in Path(original_label_dir).glob("*.csv"):
                manifest["human_labelled"].append(str(p))

        with open(output_path, "w") as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"Retrain manifest: {len(manifest['pseudo_labelled'])} pseudo + "
                    f"{len(manifest['human_labelled'])} human labels → {output_path}")
        return manifest
