"""
Phase 8: Ornamentation Detection for Jingju Singing
Architecture: Pitch contour derivatives → Transformer/BiLSTM classifier

Detects:
  - glide (滑音)       — continuous pitch slide between notes
  - turn (回滑音)      — up-then-down or down-then-up ornament
  - grace_note (装饰音) — quick pitch prefix before main note
  - trill (颤音)       — rapid alternation between two pitches
  - melisma (花腔)     — multiple notes per syllable

Output per ornament:
  { ornament_type, start_time, end_time, confidence }
"""

import torch
import torch.nn as nn
import numpy as np
import librosa
import logging
from dataclasses import dataclass
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

ORNAMENT_TYPES = ["none", "glide", "turn", "grace_note", "trill", "melisma"]
ORNAMENT_IDX = {o: i for i, o in enumerate(ORNAMENT_TYPES)}
N_ORNAMENT_CLASSES = len(ORNAMENT_TYPES)

MIN_ORNAMENT_FRAMES = 3     # ~70ms minimum ornament duration
MAX_GLIDE_SEMITONES = 12.0  # maximum pitch change for a glide
GRACE_NOTE_MAX_S = 0.15     # grace note is < 150ms


@dataclass
class OrnamentEvent:
    ornament_type: str
    start_time: float
    end_time: float
    confidence: float
    pitch_range_semitones: float = 0.0


class OrnamentClassifier(nn.Module):
    """
    BiLSTM + Transformer classifier for pitch contour derivative features.
    Input: (B, T, input_dim) — pitch derivative + curvature + acceleration features
    Output: (B, T, N_ORNAMENT_CLASSES) — per-frame ornament logits
    """

    def __init__(self, input_dim: int = 5, hidden_dim: int = 64, num_classes: int = N_ORNAMENT_CLASSES):
        super().__init__()
        self.bilstm = nn.LSTM(
            input_size=input_dim, hidden_size=hidden_dim,
            num_layers=2, batch_first=True, bidirectional=True, dropout=0.1
        )
        self.norm = nn.LayerNorm(hidden_dim * 2)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim * 2, nhead=4, dim_feedforward=128,
            dropout=0.1, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(enc_layer, num_layers=1)
        self.head = nn.Sequential(
            nn.Linear(hidden_dim * 2, 32),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x, _ = self.bilstm(x)
        x = self.norm(x)
        x = self.transformer(x)
        return self.head(x)   # (B, T, N_ORNAMENT_CLASSES)


class OrnamentDetector:
    """
    Detects Jingju vocal ornaments from a pitch contour.

    Usage:
        detector = OrnamentDetector()
        events = detector.detect(f0, confidence, sr=22050, hop_length=512)
    """

    def __init__(self, sr: int = 22050, hop_length: int = 512):
        self.sr = sr
        self.hop_length = hop_length
        self.dt = hop_length / sr
        self.classifier = OrnamentClassifier()
        self.classifier.eval()

        # Auto-load trained checkpoint if available
        import os as _os
        _ckpt = _os.path.normpath(_os.path.join(
            _os.path.dirname(_os.path.abspath(__file__)),
            "..", "checkpoints", "ornament", "best.pt"
        ))
        if _os.path.exists(_ckpt):
            try:
                state = torch.load(_ckpt, map_location="cpu", weights_only=True)
                self.classifier.load_state_dict(state)
                logger.info(f"Loaded ornament checkpoint: {_ckpt}")
            except Exception as _e:
                logger.warning(f"Failed to load ornament checkpoint ({_e}) — using random weights")

    def detect(
        self,
        f0: np.ndarray,
        confidence: np.ndarray,
        conf_threshold: float = 0.45,
    ) -> List[OrnamentEvent]:
        """Detect all ornament events in a pitch contour."""
        voiced = (confidence >= conf_threshold) & (f0 > 0)
        if np.sum(voiced) < MIN_ORNAMENT_FRAMES:
            return []

        # Convert to semitones relative to median
        f0_safe = np.where(voiced, f0, np.nan)
        with np.errstate(divide="ignore", invalid="ignore"):
            semitones = np.where(f0_safe > 0, 12.0 * np.log2(f0_safe / (np.nanmedian(f0_safe) + 1e-6)), np.nan)

        # Interpolate NaN gaps
        idx = np.arange(len(semitones))
        valid = ~np.isnan(semitones)
        semi_interp = np.interp(idx, idx[valid], semitones[valid]) if valid.sum() > 1 else np.zeros_like(semitones)

        # Extract derivative features
        features = self._extract_contour_features(semi_interp, confidence)

        # Model inference
        t = torch.tensor(features, dtype=torch.float32).unsqueeze(0)   # (1, T, 5)
        with torch.no_grad():
            logits = self.classifier(t)   # (1, T, N_CLASSES)
            probs = torch.softmax(logits, dim=-1).squeeze(0).numpy()   # (T, N_CLASSES)

        # Decode into events
        frame_labels = np.argmax(probs, axis=1)         # (T,)
        frame_confs  = np.max(probs, axis=1)            # (T,)

        events = self._decode_events(
            frame_labels, frame_confs, semi_interp, voiced
        )
        return events

    def _extract_contour_features(
        self, semi: np.ndarray, confidence: np.ndarray
    ) -> np.ndarray:
        """
        5-dim per-frame feature vector:
          [slope, curvature, speed (abs slope), confidence, smoothed_slope]
        """
        T = len(semi)
        slope = np.gradient(semi)
        curvature = np.gradient(slope)
        speed = np.abs(slope)

        # Smooth slope for turn detection
        from scipy.ndimage import gaussian_filter1d
        smooth_slope = gaussian_filter1d(slope, sigma=2.0)

        # Align confidence
        c = np.interp(np.linspace(0,1,T), np.linspace(0,1,len(confidence)), confidence)

        feats = np.stack([slope, curvature, speed, c, smooth_slope], axis=-1)
        return feats.astype(np.float32)

    def _decode_events(
        self,
        labels: np.ndarray,
        confs: np.ndarray,
        semi: np.ndarray,
        voiced: np.ndarray,
    ) -> List[OrnamentEvent]:
        """Merge consecutive same-label frames into ornament events."""
        events: List[OrnamentEvent] = []
        T = len(labels)
        i = 0

        while i < T:
            lbl = labels[i]
            if lbl == 0:   # "none"
                i += 1
                continue

            # Find run end
            j = i
            while j < T and labels[j] == lbl:
                j += 1

            run_len = j - i
            if run_len < MIN_ORNAMENT_FRAMES:
                i = j
                continue

            avg_conf = float(np.mean(confs[i:j]))
            if avg_conf < 0.35:
                i = j
                continue

            start_t = float(i * self.dt)
            end_t   = float(j * self.dt)
            pitch_range = float(np.nanmax(semi[i:j]) - np.nanmin(semi[i:j]))
            orn_name = ORNAMENT_TYPES[int(lbl)]

            # Reclassify grace notes by duration
            if orn_name == "grace_note" and (end_t - start_t) > GRACE_NOTE_MAX_S:
                orn_name = "glide"

            events.append(OrnamentEvent(
                ornament_type=orn_name,
                start_time=round(start_t, 3),
                end_time=round(end_t, 3),
                confidence=round(avg_conf, 4),
                pitch_range_semitones=round(pitch_range, 2),
            ))
            i = j

        return events

    def summarize(self, events: List[OrnamentEvent]) -> Dict:
        """Return a summary dict of detected ornaments."""
        if not events:
            return {"ornaments_detected": 0, "types": {}, "events": []}

        type_counts: Dict[str, int] = {}
        for e in events:
            type_counts[e.ornament_type] = type_counts.get(e.ornament_type, 0) + 1

        return {
            "ornaments_detected": len(events),
            "types": type_counts,
            "events": [
                {
                    "ornament_type": e.ornament_type,
                    "start_time": e.start_time,
                    "end_time": e.end_time,
                    "confidence": e.confidence,
                    "pitch_range_semitones": e.pitch_range_semitones,
                }
                for e in events
            ],
        }
