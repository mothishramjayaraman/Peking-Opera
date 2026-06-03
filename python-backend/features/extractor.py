"""
Phase 2: Unified Feature Extractor for Jingju Pitch Intelligence
Combines: Mel Spectrogram + CQT + Harmonic Spectrogram + MFCC + Spectral Centroid + HNR
All features are aligned to the same time axis and concatenated into a unified tensor.
"""

import numpy as np
import librosa
import torch
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# ── Constants tuned for Jingju/Peking Opera ──────────────────────────────────
SR = 22050
HOP_LENGTH = 512          # ~23ms frames
N_FFT = 2048
N_MELS = 80               # Mel bands
N_CQT_BINS = 84           # 7 octaves × 12 bins/octave  (A1–A7 covers all roles)
N_MFCC = 40               # higher-order MFCC for timbre detail
FMIN = 80.0               # below lowest Jingju bass (E2=82Hz)
FMAX = 1047.0             # above highest Qingyi Dan (C6=1046Hz)
N_HARMONICS = 8           # harmonics to extract for harmonic spectrogram

FEATURE_DIM = N_MELS + N_CQT_BINS + N_MELS + N_MFCC + 1 + 1  # 207 total channels
# breakdown: mel(80) + cqt(84) + harmonic_mel(80) + mfcc(40) + centroid(1) + hnr_proxy(1)


@dataclass
class FeatureTensor:
    """Holds all extracted features aligned to the same time axis."""
    mel: np.ndarray               # (N_MELS, T)
    cqt: np.ndarray               # (N_CQT_BINS, T)
    harmonic_mel: np.ndarray      # (N_MELS, T)  — harmonic-only mel
    mfcc: np.ndarray              # (N_MFCC, T)
    spectral_centroid: np.ndarray # (1, T)
    hnr_proxy: np.ndarray         # (1, T)  — log harmonic energy ratio
    unified: np.ndarray           # (FEATURE_DIM, T) — all concatenated
    n_frames: int
    sr: int

    def to_torch(self, device: str = "cpu") -> torch.Tensor:
        """Returns (1, FEATURE_DIM, T) tensor for model input."""
        return torch.tensor(self.unified, dtype=torch.float32).unsqueeze(0).to(device)

    def get_window(self, start_frame: int, end_frame: int) -> "FeatureTensor":
        """Slice a time window from all feature matrices."""
        s, e = start_frame, end_frame
        return FeatureTensor(
            mel=self.mel[:, s:e],
            cqt=self.cqt[:, s:e],
            harmonic_mel=self.harmonic_mel[:, s:e],
            mfcc=self.mfcc[:, s:e],
            spectral_centroid=self.spectral_centroid[:, s:e],
            hnr_proxy=self.hnr_proxy[:, s:e],
            unified=self.unified[:, s:e],
            n_frames=e - s,
            sr=self.sr,
        )


class JingjuFeatureExtractor:
    """
    Extracts and combines all features needed by the shared encoder and downstream models.

    All features are:
    - Log-scaled where appropriate
    - Normalised per-feature (zero mean, unit variance across time)
    - Aligned to the same hop_length grid
    """

    def __init__(
        self,
        sr: int = SR,
        hop_length: int = HOP_LENGTH,
        n_fft: int = N_FFT,
        n_mels: int = N_MELS,
        n_cqt_bins: int = N_CQT_BINS,
        n_mfcc: int = N_MFCC,
        fmin: float = FMIN,
        fmax: float = FMAX,
    ):
        self.sr = sr
        self.hop_length = hop_length
        self.n_fft = n_fft
        self.n_mels = n_mels
        self.n_cqt_bins = n_cqt_bins
        self.n_mfcc = n_mfcc
        self.fmin = fmin
        self.fmax = fmax

    # ── Public API ──────────────────────────────────────────────────────────────

    def extract(self, y: np.ndarray, sr: Optional[int] = None) -> FeatureTensor:
        """Extract all features from a preprocessed audio array."""
        if sr is None:
            sr = self.sr
        if sr != self.sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=self.sr)
            sr = self.sr

        y = y.astype(np.float32)

        mel = self._mel_spectrogram(y)
        cqt = self._cqt(y)
        harmonic_mel = self._harmonic_mel(y)
        mfcc = self._mfcc(y)
        centroid = self._spectral_centroid(y)
        hnr = self._hnr_proxy(y)

        # Align all to shortest time axis
        T = min(mel.shape[1], cqt.shape[1], harmonic_mel.shape[1],
                mfcc.shape[1], centroid.shape[1], hnr.shape[1])

        mel = mel[:, :T]
        cqt = cqt[:, :T]
        harmonic_mel = harmonic_mel[:, :T]
        mfcc = mfcc[:, :T]
        centroid = centroid[:, :T]
        hnr = hnr[:, :T]

        # Normalise each feature independently (z-score per frequency bin)
        mel = self._znorm(mel)
        cqt = self._znorm(cqt)
        harmonic_mel = self._znorm(harmonic_mel)
        mfcc = self._znorm(mfcc)
        centroid = self._znorm(centroid)
        hnr = self._znorm(hnr)

        unified = np.concatenate([mel, cqt, harmonic_mel, mfcc, centroid, hnr], axis=0)

        return FeatureTensor(
            mel=mel,
            cqt=cqt,
            harmonic_mel=harmonic_mel,
            mfcc=mfcc,
            spectral_centroid=centroid,
            hnr_proxy=hnr,
            unified=unified,
            n_frames=T,
            sr=sr,
        )

    # ── Individual feature extractors ───────────────────────────────────────────

    def _mel_spectrogram(self, y: np.ndarray) -> np.ndarray:
        """Log-power Mel spectrogram — captures overall tonal energy distribution."""
        S = librosa.feature.melspectrogram(
            y=y, sr=self.sr, n_fft=self.n_fft,
            hop_length=self.hop_length, n_mels=self.n_mels,
            fmin=self.fmin, fmax=self.fmax, power=2.0,
        )
        return librosa.power_to_db(S, ref=np.max)   # (N_MELS, T)

    def _cqt(self, y: np.ndarray) -> np.ndarray:
        """
        Constant-Q Transform — logarithmically spaced frequency bins match
        musical pitch intervals; much better than FFT for pitch detection.
        """
        C = librosa.cqt(
            y=y, sr=self.sr, hop_length=self.hop_length,
            fmin=librosa.midi_to_hz(21),   # A0
            n_bins=self.n_cqt_bins,
            bins_per_octave=12,
        )
        return librosa.amplitude_to_db(np.abs(C), ref=np.max)  # (N_CQT_BINS, T)

    def _harmonic_mel(self, y: np.ndarray) -> np.ndarray:
        """
        Mel spectrogram computed on the harmonic-only signal (HPSS).
        Isolates singing from percussive accompaniment/noise.
        """
        y_harm, _ = librosa.effects.hpss(y, margin=2.0)
        S = librosa.feature.melspectrogram(
            y=y_harm, sr=self.sr, n_fft=self.n_fft,
            hop_length=self.hop_length, n_mels=self.n_mels,
            fmin=self.fmin, fmax=self.fmax, power=2.0,
        )
        return librosa.power_to_db(S, ref=np.max)   # (N_MELS, T)

    def _mfcc(self, y: np.ndarray) -> np.ndarray:
        """
        MFCC with delta and delta-delta — captures timbre, formants, and
        temporal dynamics of vocal tract resonance (critical for role classification).
        """
        mfcc = librosa.feature.mfcc(
            y=y, sr=self.sr, n_mfcc=self.n_mfcc,
            n_fft=self.n_fft, hop_length=self.hop_length,
        )
        delta = librosa.feature.delta(mfcc)
        delta2 = librosa.feature.delta(mfcc, order=2)
        # Stack: each coefficient + velocity + acceleration
        # Return only n_mfcc rows (delta/delta2 are fused below in unified)
        # For unified we just use the base MFCC; deltas go into expression model
        return mfcc   # (N_MFCC, T)

    def extract_mfcc_with_deltas(self, y: np.ndarray) -> np.ndarray:
        """Returns (3*N_MFCC, T) stacked MFCC + delta + delta2 for timbre/expression."""
        mfcc = librosa.feature.mfcc(y=y, sr=self.sr, n_mfcc=self.n_mfcc,
                                     n_fft=self.n_fft, hop_length=self.hop_length)
        d1 = librosa.feature.delta(mfcc)
        d2 = librosa.feature.delta(mfcc, order=2)
        return np.concatenate([mfcc, d1, d2], axis=0)

    def _spectral_centroid(self, y: np.ndarray) -> np.ndarray:
        """
        Spectral centroid (Hz) → log-normalised.
        Acts as a scalar brightness indicator — higher = brighter/more forward resonance.
        Important for distinguishing Dan (bright 小嗓) from Jing (dark 大嗓).
        """
        c = librosa.feature.spectral_centroid(
            y=y, sr=self.sr, n_fft=self.n_fft, hop_length=self.hop_length
        )[0]
        log_c = np.log1p(c)
        return log_c[np.newaxis, :]   # (1, T)

    def _hnr_proxy(self, y: np.ndarray) -> np.ndarray:
        """
        Log ratio of harmonic-to-total spectral energy as a per-frame proxy for HNR.
        Useful for detecting breathy/noisy frames that should be down-weighted.
        """
        y_harm, y_perc = librosa.effects.hpss(y, margin=2.0)
        rms_harm = librosa.feature.rms(y=y_harm, hop_length=self.hop_length)[0]
        rms_total = librosa.feature.rms(y=y, hop_length=self.hop_length)[0] + 1e-9
        ratio = rms_harm / rms_total
        return np.log1p(ratio)[np.newaxis, :]  # (1, T)

    # ── Utility ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _znorm(x: np.ndarray, eps: float = 1e-6) -> np.ndarray:
        """Z-score normalisation along the time axis (axis=1)."""
        mu = x.mean(axis=1, keepdims=True)
        sigma = x.std(axis=1, keepdims=True) + eps
        return (x - mu) / sigma

    def frames_to_time(self, n_frames: int) -> np.ndarray:
        """Convert frame indices to time in seconds."""
        return librosa.frames_to_time(
            np.arange(n_frames), sr=self.sr, hop_length=self.hop_length
        )
