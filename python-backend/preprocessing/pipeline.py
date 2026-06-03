"""
Phase 1: Jingju Preprocessing Pipeline
Silero VAD → Spectral Denoising → RMS Normalization → Resampling → Segmentation

Handles: WAV file input, raw numpy array input, real-time stream chunks.
"""

import numpy as np
import torch
import librosa
import logging
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Union

logger = logging.getLogger(__name__)

TARGET_SR = 22050          # CREPE + librosa standard
FRAME_SHIFT_S = 0.01       # 10ms frames for VAD
VAD_THRESHOLD = 0.4        # Silero VAD speech probability threshold
MIN_SEGMENT_S = 0.5        # discard segments shorter than 500ms
SILENCE_PAD_S = 0.05       # 50ms silence padding around each segment


@dataclass
class AudioSegment:
    audio: np.ndarray          # normalised, denoised float32 PCM
    start_s: float             # start time in original recording
    end_s: float               # end time in original recording
    sr: int = TARGET_SR
    voiced_ratio: float = 0.0  # fraction of VAD-active frames


class SileroVAD:
    """
    Wraps the Silero VAD model (torch.hub).
    Falls back to energy-based VAD when the hub is unavailable.
    """

    def __init__(self):
        self._model = None
        self._utils = None
        self._load()

    def _load(self):
        try:
            self._model, self._utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                trust_repo=True,
            )
            logger.info("Silero VAD loaded successfully.")
        except Exception as exc:
            logger.warning(f"Silero VAD unavailable ({exc}). Using energy-based fallback.")
            self._model = None

    def get_speech_timestamps(
        self,
        y: np.ndarray,
        sr: int,
        threshold: float = VAD_THRESHOLD,
    ) -> List[dict]:
        """
        Returns list of {start: int, end: int} sample indices of voiced regions.
        """
        if self._model is not None:
            try:
                get_ts = self._utils[0]   # get_speech_timestamps utility
                audio_t = torch.tensor(y, dtype=torch.float32)
                return get_ts(
                    audio_t,
                    self._model,
                    sampling_rate=sr,
                    threshold=threshold,
                    min_speech_duration_ms=int(MIN_SEGMENT_S * 1000),
                    min_silence_duration_ms=100,
                )
            except Exception as exc:
                logger.warning(f"Silero inference failed ({exc}). Using fallback.")

        return self._energy_vad(y, sr)

    def _energy_vad(self, y: np.ndarray, sr: int) -> List[dict]:
        """Energy-based VAD fallback — frames above 8% of peak RMS are voiced."""
        hop = int(FRAME_SHIFT_S * sr)
        rms = librosa.feature.rms(y=y, hop_length=hop)[0]
        threshold = np.max(rms) * 0.08
        voiced = rms > threshold

        segments = []
        in_seg = False
        start = 0
        for i, v in enumerate(voiced):
            if v and not in_seg:
                start = i * hop
                in_seg = True
            elif not v and in_seg:
                segments.append({"start": start, "end": i * hop})
                in_seg = False
        if in_seg:
            segments.append({"start": start, "end": len(y)})
        return segments


class SpectralDenoiser:
    """
    Two-pass spectral subtraction denoiser.
    Uses noisereduce when available; falls back to librosa HPSS harmonic extraction.
    """

    def __init__(self):
        try:
            import noisereduce as nr
            self._nr = nr
            logger.info("noisereduce denoiser loaded.")
        except ImportError:
            self._nr = None
            logger.warning("noisereduce not installed. Using HPSS denoiser fallback.")

    def denoise(self, y: np.ndarray, sr: int) -> np.ndarray:
        if self._nr is not None:
            try:
                # Estimate noise from the quietest 15% of frames
                rms = librosa.feature.rms(y=y, hop_length=512)[0]
                noise_thresh = np.percentile(rms, 15)
                noise_frames = rms < noise_thresh
                hop = 512
                noise_sample = np.concatenate([
                    y[i * hop: (i + 1) * hop]
                    for i, nf in enumerate(noise_frames)
                    if nf and i * hop < len(y)
                ] or [y[:sr]])   # at least 1s of "noise"
                return self._nr.reduce_noise(
                    y=y,
                    y_noise=noise_sample,
                    sr=sr,
                    stationary=False,
                    prop_decrease=0.75,
                )
            except Exception as exc:
                logger.warning(f"noisereduce failed ({exc}). Falling back to HPSS.")

        # HPSS harmonic extraction as fallback
        y_harmonic, _ = librosa.effects.hpss(y, margin=2.0)
        return y_harmonic


def rms_normalize(y: np.ndarray, target_db: float = -20.0) -> np.ndarray:
    """Normalise to a target RMS level in dBFS."""
    rms = np.sqrt(np.mean(y ** 2))
    if rms < 1e-9:
        return y
    target_rms = 10 ** (target_db / 20.0)
    return np.clip(y * (target_rms / rms), -1.0, 1.0)


class JingjuPreprocessingPipeline:
    """
    Full preprocessing pipeline for Peking Opera audio:

    Input  → resample → denoise → VAD segment → normalise
    Output → List[AudioSegment]  (or single processed array for streaming)

    Usage:
        pipeline = JingjuPreprocessingPipeline()

        # From file
        segments = pipeline.process_file("recording.wav")

        # From array
        segments = pipeline.process_array(y, sr)

        # Streaming (per-chunk)
        chunk_out = pipeline.process_stream_chunk(chunk, sr)
    """

    def __init__(
        self,
        target_sr: int = TARGET_SR,
        denoise: bool = True,
        vad: bool = True,
        normalize: bool = True,
        target_db: float = -20.0,
        vad_threshold: float = VAD_THRESHOLD,
        min_segment_s: float = MIN_SEGMENT_S,
    ):
        self.target_sr = target_sr
        self.do_denoise = denoise
        self.do_vad = vad
        self.do_normalize = normalize
        self.target_db = target_db
        self.vad_threshold = vad_threshold
        self.min_segment_s = min_segment_s

        self.vad_model = SileroVAD() if vad else None
        self.denoiser = SpectralDenoiser() if denoise else None

        # Ring buffer for streaming (3s window)
        self._stream_buffer = np.array([], dtype=np.float32)
        self._stream_buffer_max = int(target_sr * 3)

    # ── File input ──────────────────────────────────────────────────────────────

    def process_file(self, path: str) -> List[AudioSegment]:
        """Load a WAV/MP3/FLAC file and return cleaned, segmented AudioSegments."""
        y, sr = librosa.load(path, sr=self.target_sr, mono=True)
        return self.process_array(y, sr)

    # ── Array input ─────────────────────────────────────────────────────────────

    def process_array(
        self, y: np.ndarray, sr: int
    ) -> List[AudioSegment]:
        """Process a raw audio array. Returns list of AudioSegments."""
        y = y.astype(np.float32)

        # 1. Resample if needed
        if sr != self.target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=self.target_sr)
            sr = self.target_sr

        # 2. Denoise
        if self.do_denoise:
            y = self.denoiser.denoise(y, sr)

        # 3. Silence guard
        if np.sqrt(np.mean(y ** 2)) < 1e-6:
            logger.warning("Recording is nearly silent after denoising.")
            return []

        # 4. VAD segmentation
        if self.do_vad:
            return self._segment_with_vad(y, sr)
        else:
            # No VAD — treat entire array as one segment
            y_out = rms_normalize(y, self.target_db) if self.do_normalize else y
            return [AudioSegment(audio=y_out, start_s=0.0, end_s=len(y) / sr, sr=sr, voiced_ratio=1.0)]

    # ── Stream input ────────────────────────────────────────────────────────────

    def process_stream_chunk(
        self, chunk: np.ndarray, sr: int
    ) -> Optional[np.ndarray]:
        """
        Process a single real-time stream chunk.
        Accumulates in a ring buffer; returns the cleaned chunk (no VAD segmentation).
        """
        chunk = chunk.astype(np.float32)
        if sr != self.target_sr:
            chunk = librosa.resample(chunk, orig_sr=sr, target_sr=self.target_sr)

        if self.do_denoise and len(chunk) >= 1024:
            chunk = self.denoiser.denoise(chunk, self.target_sr)

        if self.do_normalize:
            chunk = rms_normalize(chunk, self.target_db)

        # Maintain ring buffer for context
        self._stream_buffer = np.concatenate([self._stream_buffer, chunk])
        if len(self._stream_buffer) > self._stream_buffer_max:
            self._stream_buffer = self._stream_buffer[-self._stream_buffer_max:]

        return chunk

    # ── Internal helpers ────────────────────────────────────────────────────────

    def _segment_with_vad(self, y: np.ndarray, sr: int) -> List[AudioSegment]:
        """Apply Silero VAD and split audio into voiced segments."""
        timestamps = self.vad_model.get_speech_timestamps(y, sr, self.vad_threshold)

        if not timestamps:
            logger.warning("VAD found no speech. Returning whole audio as one segment.")
            y_out = rms_normalize(y, self.target_db) if self.do_normalize else y
            return [AudioSegment(audio=y_out, start_s=0.0, end_s=len(y) / sr, sr=sr, voiced_ratio=0.1)]

        pad = int(SILENCE_PAD_S * sr)
        segments: List[AudioSegment] = []

        for ts in timestamps:
            start_samp = max(0, ts["start"] - pad)
            end_samp = min(len(y), ts["end"] + pad)
            seg_y = y[start_samp:end_samp]

            duration = len(seg_y) / sr
            if duration < self.min_segment_s:
                continue

            if self.do_normalize:
                seg_y = rms_normalize(seg_y, self.target_db)

            voiced_frames = ts["end"] - ts["start"]
            total_frames = end_samp - start_samp
            voiced_ratio = voiced_frames / max(total_frames, 1)

            segments.append(AudioSegment(
                audio=seg_y,
                start_s=start_samp / sr,
                end_s=end_samp / sr,
                sr=sr,
                voiced_ratio=float(voiced_ratio),
            ))

        logger.info(f"VAD: {len(timestamps)} speech regions → {len(segments)} valid segments.")
        return segments

    def process_batch(
        self, paths: List[str]
    ) -> List[Tuple[str, List[AudioSegment]]]:
        """Batch process a list of audio files."""
        results = []
        for path in paths:
            try:
                segs = self.process_file(path)
                results.append((path, segs))
            except Exception as exc:
                logger.error(f"Failed to process {path}: {exc}")
                results.append((path, []))
        return results
