import librosa
import numpy as np
from scipy.signal import medfilt
import logging

# ── Hybrid AI models (Phase 4–9) ─────────────────────────────────────────────
from models.pitch_model import VocalPitchModel
from models.vibrato_model import VibratoMetricsModel
from models.breath_model import AdvancedBreathAnalyzer
from models.timbre_model import ToneMetricsModel
from models.ornament_model import OrnamentDetector
from models.expression_model import ExpressionAnalyzer

# ── Preprocessing + features (Phase 1–2) ─────────────────────────────────────
from preprocessing.pipeline import JingjuPreprocessingPipeline
from features.extractor import JingjuFeatureExtractor

# ── Post-processing (Phase 5) ─────────────────────────────────────────────────
from postprocessing.smoothing import FTGANContourSmoother
from postprocessing.octave_correction import OctaveCorrector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SingingEvaluator:
    """
    Singing evaluation using acoustic signal processing.
    Now includes 'song' and 'exercise' modes for contextual accuracy.
    OPTIMIZED: Includes caching for repeated file analyses.
    """

    def __init__(self, sr=22050, role="default"):
        self.sr = sr
        self.role = role
        self._analysis_cache = {}  # Cache analyses by file path hash

        # Preprocessing pipeline (Phase 1)
        self.preprocessor = JingjuPreprocessingPipeline(
            target_sr=sr, denoise=True, vad=False, normalize=True
        )
        self.feature_extractor = JingjuFeatureExtractor(sr=sr)

        # Hybrid AI models (Phase 4–9)
        self.pitch_model   = VocalPitchModel(role=role)
        self.vibrato_model = VibratoMetricsModel(sr, hop_length=512)
        self.breath_model  = AdvancedBreathAnalyzer(sr)
        self.tone_model    = ToneMetricsModel(sr)
        self.ornament_detector = OrnamentDetector(sr=sr)
        self.expression_analyzer = ExpressionAnalyzer(sr=sr)

        # Post-processing (Phase 5)
        self.smoother  = FTGANContourSmoother(sr=sr)
        self.oct_corrector = OctaveCorrector(role=role, sr=sr)

    def analyze(self, file_path_or_y, mode="chinese_opera", sr=None):
        """
        Main analysis entry point with caching support.
        :param mode: 'chinese_opera' for Peking Opera repertoire/exercises (default),
                     'opera' for Italian/Western operatic performances,
                     'song' for general melodic performances,
                     'exercise' for scales/long tones.
        """
        # Check cache for file-based analysis
        cache_key = None
        if isinstance(file_path_or_y, str):
            import hashlib
            cache_key = hashlib.md5(f"{file_path_or_y}_{mode}".encode()).hexdigest()
            if cache_key in self._analysis_cache:
                logger.info(f"Cache hit for {file_path_or_y}")
                return self._analysis_cache[cache_key]
        
        # Accept either a file path (string) or a raw audio array
        if isinstance(file_path_or_y, str):
            logger.info(f"Loading audio from {file_path_or_y}")
            y, sr = librosa.load(file_path_or_y, sr=self.sr)
        else:
            y = file_path_or_y
            sr = sr or self.sr

        # Truncate to a maximum of 30 seconds to avoid excessively long analysis times
        max_duration_seconds = 30
        if len(y) > sr * max_duration_seconds:
            logger.info(f"Audio length exceeds {max_duration_seconds}s. Truncating to improve analysis speed.")
            y = y[:sr * max_duration_seconds]

        # Silence check — if the whole recording is nearly silent, skip analysis
        rms_total = librosa.feature.rms(y=y)[0]
        if np.mean(rms_total) < 0.001:
            result = {"note": "Silent recording detected.", "overall_score": 0}
            if cache_key:
                self._analysis_cache[cache_key] = result
            return result

        # Normalize loudness for pitch/tone/vibrato
        y_norm = self._normalize_audio(y)

        # Run all analyses with hybrid pipeline (optimized for batch processing)
        pitch_score, tsi, f0, confidence = self.calculate_pitch_metrics(y_norm, sr, mode)

        # Vibrato with Transformer refinement (Phase 5)
        vibrato_results = self.vibrato_model.analyze(f0, confidence)
        vibrato_score = vibrato_results["score"]

        # Breath (Phase 6)
        breath_results = self.calculate_breath_metrics(y, confidence)
        breath_score = breath_results["breath_score"]

        # Timbre with deep encoder (Phase 7)
        tone_results = self.tone_model.analyze(y_norm, sr, periodicity=confidence)
        true_tone_score = tone_results["tone_score"]
        tone_brightness = tone_results["brightness"]
        tone_hnr = tone_results["hnr_score"]

        # Ornamentation detection (Phase 8)
        ornament_events = self.ornament_detector.detect(f0, confidence)
        ornament_summary = self.ornament_detector.summarize(ornament_events)
        ornament_score = min(100.0, float(ornament_summary.get("ornaments_detected", 0)) * 20.0)

        # Expression with multi-modal fusion (Phase 9)
        expr_results = self.expression_analyzer.analyze(
            y, sr=sr, f0=f0, confidence=confidence,
            vibrato_results=vibrato_results,
            timbre_results=tone_results,
            mode=mode,
        )
        expression_score = expr_results["expression_score"]

        recording_quality = self._estimate_recording_quality(y, sr, confidence)

        # Combine individual scores into one overall score using different weights per mode
        if mode == "exercise":
            # Exercise: prioritize pitch accuracy and breath control (technical skills)
            overall_score = (pitch_score * 0.25) + (tsi * 0.1) + (true_tone_score * 0.15) + (breath_score * 0.2) + (expression_score * 0.1) + (vibrato_score * 0.1) + (ornament_score * 0.1)
        elif mode == "chinese_opera":
            # Peking Opera: pitch (tonal language) and expression (韵味) are paramount
            # Breath (qi/丹田) is critical; tone clarity for role type; vibrato de-emphasized, ornaments rewarded
            overall_score = (pitch_score * 0.30) + (tsi * 0.15) + (true_tone_score * 0.15) + (breath_score * 0.20) + (expression_score * 0.05) + (vibrato_score * 0.05) + (ornament_score * 0.10)
        elif mode == "opera":
            # Italian opera: elevated vibrato and tone weights; vibrato and resonance are central
            overall_score = (pitch_score * 0.25) + (tsi * 0.10) + (true_tone_score * 0.15) + (breath_score * 0.20) + (expression_score * 0.10) + (vibrato_score * 0.10) + (ornament_score * 0.10)
        else:
            # Song: prioritize pitch + expression (artistic performance)
            overall_score = (pitch_score * 0.30) + (tsi * 0.05) + (true_tone_score * 0.10) + (breath_score * 0.2) + (expression_score * 0.15) + (vibrato_score * 0.1) + (ornament_score * 0.1)

        # Downsample f0 contour to max 200 points for transport over HTTP
        hop = max(1, len(f0) // 200)
        f0_ds = f0[::hop]
        conf_ds = confidence[::hop]
        f0_contour = [
            round(float(hz), 2) if float(c) > 0.5 else 0.0
            for hz, c in zip(f0_ds, conf_ds)
        ]

        # Pitch range statistics for passaggio / Fach analysis
        voiced_f0 = f0[confidence > 0.5]
        if len(voiced_f0) > 10:
            pitch_range = {
                "mean_hz":  round(float(np.mean(voiced_f0)), 2),
                "min_hz":   round(float(np.percentile(voiced_f0, 5)), 2),
                "max_hz":   round(float(np.percentile(voiced_f0, 95)), 2),
                "p25_hz":   round(float(np.percentile(voiced_f0, 25)), 2),
                "p75_hz":   round(float(np.percentile(voiced_f0, 75)), 2),
            }
        else:
            pitch_range = {}

        # Return all scores
        result = {
            "mode_used":          mode,
            "recording_quality":  recording_quality,
            "pitch_score":        round(pitch_score, 2),
            "tsi":                round(tsi, 2),
            "true_tone_score":    round(true_tone_score, 2),
            "tone_brightness":    round(tone_brightness, 2),
            "tone_hnr":           round(tone_hnr, 2),
            "expression_score":   round(expression_score, 2),
            "vibrato_score":      round(vibrato_score, 2),
            "vibrato_rate_hz":    vibrato_results.get("vibrato_rate_hz", 0.0),
            "vibrato_depth_cents":vibrato_results.get("vibrato_depth_cents", 0.0),
            "vibrato_stability":  vibrato_results.get("vibrato_stability", 0.0),
            "breath_score":       round(breath_score, 2),
            "ornament_score":     round(ornament_score, 2),
            "overall_score":      round(overall_score, 2),
            "f0_contour":         f0_contour,
            "pitch_range":        pitch_range,
            "ornaments":          ornament_summary,
            "emotion":            expr_results.get("emotion", "neutral"),
            "emotional_intensity":expr_results.get("intensity", 0.0),
        }
        
        # Cache result if it was from a file
        if cache_key:
            self._analysis_cache[cache_key] = result
        
        return result

    def _normalize_audio(self, y, target_db=-20.0):
        """
        RMS normalization to a target loudness level (-20 dBFS default).
        Preserves dynamic range between loud and quiet moments, unlike peak
        normalization which can amplify background hiss to the same level as singing.
        """
        rms = np.sqrt(np.mean(y ** 2))   # compute current loudness
        if rms < 1e-9:
            return y                      # skip if silent
        target_rms = 10 ** (target_db / 20.0)              # convert -20 dB to a linear scale value
        return np.clip(y * (target_rms / rms), -1.0, 1.0)  # scale and clip to valid audio range

    def _estimate_recording_quality(self, y, sr, confidence):
        """
        Estimates how trustworthy the analysis results are, as a value in [0, 1].
        Three independent signals:
          - voiced_ratio:    fraction of frames CREPE confidently tracked (pitch clarity)
          - snr_score:       active RMS vs noise floor (recording cleanliness)
          - mean_confidence: average CREPE periodicity (stronger than binary voiced ratio)
        """
        rms = librosa.feature.rms(y=y)[0]
        active_frames = rms > (np.max(rms) * 0.1)   # frames loud enough to be singing (not silence)

        # 1. Voiced ratio — fraction of audio where the singer is clearly singing
        voiced_ratio = float(np.mean(confidence > 0.5))

        # 2. SNR (Signal-to-Noise Ratio) — how loud the singing is compared to background noise
        noise_floor = np.percentile(rms, 10) + 1e-9           # quietest 10% ≈ background noise level
        active_rms = float(np.mean(rms[active_frames])) if np.any(active_frames) else 1e-9
        snr_db = 20.0 * np.log10(active_rms / noise_floor)    # dB difference between singing and noise
        snr_score = float(max(0.0, min(1.0, snr_db / 40.0)))  # 0 dB → score 0, 40 dB → score 1

        # 3. Average CREPE confidence — overall certainty of pitch detection
        mean_confidence = float(np.mean(confidence))

        # Blend all three into one quality score (0 = bad recording, 1 = clean recording)
        quality = (voiced_ratio * 0.35) + (snr_score * 0.35) + (mean_confidence * 0.30)
        return round(float(quality), 2)

    def _pentatonic_proximity_score(self, voiced_f0):
        """
        Scores how closely voiced pitches land on pentatonic scale degrees (宫商角徵羽).
        Tries all 12 possible roots and picks the best fit — rewards correct pentatonic
        intonation, the melodic foundation of all 京剧 singing.
        Ornamental 花腔 passages that intentionally leave the grid are handled by
        the 35% blend weight in calculate_pitch_metrics, not by a hard penalty here.
        """
        PENTA = np.array([0, 2, 4, 7, 9])   # 宫商角徵羽 intervals in semitones

        midi_pcs = librosa.hz_to_midi(voiced_f0) % 12   # reduce to pitch class 0–11

        best_avg_dist = float('inf')
        for root in range(12):
            scale_pcs = (PENTA + root) % 12
            # Vectorized distance from every frame to every scale note: shape (N, 5)
            dists = np.abs(midi_pcs[:, None] - scale_pcs[None, :])
            dists = np.minimum(dists, 12 - dists)   # wraparound (0 and 11 are 1 apart)
            avg_dist = float(np.mean(dists.min(axis=1)))
            if avg_dist < best_avg_dist:
                best_avg_dist = avg_dist

        # 0 semitones deviation → 100; 2+ semitones average deviation → 0
        return float(max(0.0, 100.0 * (1.0 - best_avg_dist / 2.0)))

    def calculate_pitch_metrics(self, y, sr, mode):
        # Use pretrained CREPE model for pitch estimation
        f0, confidence = self.pitch_model.predict_pitch(y, sr)

        if f0 is None or np.sum(confidence > 0.5) < 10:
            return 0.0, 0.0, f0, confidence

        voiced_f0 = f0[confidence > 0.5]
        midi_voiced = librosa.hz_to_midi(voiced_f0)

        # Peking Opera: moderate threshold — tonal language means pitch naturally shifts between characters
        if mode == "exercise":
            jump_threshold = 0.3
        elif mode == "chinese_opera":
            jump_threshold = 0.6   # tonal inflections are legitimate pitch movement, not errors
        elif mode == "opera":
            jump_threshold = 0.5
        else:
            jump_threshold = 0.7

        diffs = np.abs(np.diff(midi_voiced))
        jumps = np.where(diffs > jump_threshold)[0]

        # Split the pitch track into individual note segments at each jump
        segments = np.split(voiced_f0, jumps + 1)

        stds = []
        for seg in segments:
            kernel = 3 if mode == "exercise" else 7
            if len(seg) < kernel:
                continue
            smooth_seg = medfilt(librosa.hz_to_midi(seg), kernel_size=kernel)
            stds.append(np.std(smooth_seg) * 100)

        if not stds:
            return 0.0, 0.0, f0, confidence

        avg_std_cents = np.mean(stds)
        tsi = max(0.0, 100.0 - (avg_std_cents * 0.4))
        pitch_score = max(0.0, 100.0 - (avg_std_cents * 0.7))

        if mode == "chinese_opera":
            # Blend stability score with pentatonic proximity (宫商角徵羽 fidelity).
            # 35% weight: enough to reward good pentatonic intonation without
            # crushing ornamental 花腔 passages that legitimately use non-scale tones.
            penta_score = self._pentatonic_proximity_score(voiced_f0)
            pitch_score = pitch_score * 0.65 + penta_score * 0.35
            tsi = tsi * 0.65 + penta_score * 0.35

        return float(pitch_score), float(tsi), f0, confidence

    def calculate_vibrato_metrics(self, f0, confidence):
        results = self.vibrato_model.analyze(f0, confidence)
        return results["score"]

    def calculate_breath_metrics(self, y, confidence):
        # Use our advanced AED (Acoustic Event Detection) model
        results = self.breath_model.analyze(y, confidence)
        return results

    def calculate_expression_metrics(self, y, sr, mode):
        rms = librosa.feature.rms(y=y)[0]   # loudness of each audio frame
        if len(rms) == 0:
            return 0.0

        # Keep only frames where the singer is actually singing (above 10% of peak loudness)
        active_indices = rms > (np.max(rms) * 0.1)
        active_rms = rms[active_indices]
        if len(active_rms) == 0:
            return 0.0

        # CV (Coefficient of Variation) = std / mean — measures how much the volume varies
        cv_volume = np.std(active_rms) / (np.mean(active_rms) + 1e-6)

        if mode == "exercise":
            # For exercises: steady volume is the goal, so low CV = high score
            score = max(0.0, 100.0 - (cv_volume * 100.0))
            return float(score)

        # Peking Opera 韵味: timbral character shifts + 二黄/西皮 phrase-peak contrast
        if mode == "chinese_opera":
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            active_mfccs = mfccs[:, active_indices]

            # Timbral shift score — role-type shifts (旦/生/净) produce larger MFCC std
            # Threshold raised vs. generic: std < 8 = monotone, > 35 = rich 韵味
            mfcc_std = float(np.mean(np.std(active_mfccs, axis=1))) if active_mfccs.shape[1] > 0 else 0.0
            timbre_score = max(0.0, min(100.0, (mfcc_std - 8.0) * 3.6))

            # Phrase-peak contrast — 二黄/西皮 lines build to a peak then resolve
            # Ratio of 90th-pct RMS to median RMS: 1.0 = flat, 3.0+ = dramatic arc
            peak_contrast = float(np.percentile(active_rms, 90)) / (float(np.median(active_rms)) + 1e-9)
            peak_score = max(0.0, min(100.0, (peak_contrast - 1.0) * 50.0))

            # Volume dynamics — broader CV target than exercise but tighter than pop
            vol_score = max(0.0, min(100.0, (cv_volume - 0.10) * 167.0))

            # 韵味 = 40% timbral richness + 35% dramatic phrase arc + 25% volume dynamics
            return float(timbre_score * 0.40 + peak_score * 0.35 + vol_score * 0.25)

        # For songs: measure both volume dynamics AND timbre (tone color) changes
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)  #  coefficients describing voice texture
        active_mfccs = mfccs[:, active_indices]               # only keep singing frames

        # How much does the voice texture change over time? High std = more emotional variation
        if active_mfccs.shape[1] > 0:
            mfcc_std = np.mean(np.std(active_mfccs, axis=1))
        else:
            mfcc_std = 0.0

        # Map volume variation to 0–100 (CV below 0.05 = flat, above 0.55 = expressive)
        vol_score = max(0.0, min(100.0, (cv_volume - 0.05) * 200.0))

        # Map timbre variation to 0–100 (std below 5 = robotic, above 30 = very emotional)
        timbre_score = max(0.0, min(100.0, (mfcc_std - 5.0) * 4.0))

        # Final expression = 50% volume dynamics + 50% timbre changes
        final_score = (vol_score * 0.5) + (timbre_score * 0.5)
        return float(final_score)


# --- Example Usage ---
if __name__ == "__main__":
    evaluator = SingingEvaluator()
    # To analyze a song:
    # print(evaluator.analyze('path/to/song.wav', mode="song"))
    # To analyze a scale/exercise:
    # print(evaluator.analyze('path/to/exercise.wav', mode="exercise"))
