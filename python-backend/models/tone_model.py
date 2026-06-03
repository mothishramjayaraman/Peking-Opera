import librosa
import numpy as np


class ToneMetricsModel:
    def __init__(self, sr=22050):
        self.sr = sr

    def analyze(self, y, sr=None, periodicity=None):
        if sr is None:
            sr = self.sr


        # Step 1: Separate the singing (harmonic) part from drums/noise (percussive) — we only score the singing
        y_harmonic, _ = librosa.effects.hpss(y)

        # Step 2: Extract audio features from the harmonic signal
        mfcc = librosa.feature.mfcc(y=y_harmonic, sr=sr, n_mfcc=13)   # voice texture/timbre 
        centroid = librosa.feature.spectral_centroid(y=y_harmonic, sr=sr)[0]  # how bright the tone is
        rolloff = librosa.feature.spectral_rolloff(y=y_harmonic, sr=sr, roll_percent=0.85)[0]  # upper frequency limit of energy
        flatness = librosa.feature.spectral_flatness(y=y_harmonic)[0]  # 0 = clean tone, 1 = pure noise
        rms = librosa.feature.rms(y=y_harmonic)[0]                     # loudness per frame

        # If the recording is completely silent, return all zeros
        if np.max(rms) < 1e-9:
            return {"tone_score": 0.0, "brightness": 0.0, "spectral_stability": 0.0, "hnr_score": 0.0}

        # Step 3: Build per-frame weights — louder frames matter more than quiet ones
        weights = rms / (np.max(rms) + 1e-9)

        if periodicity is not None:
            n_frames = len(weights)
            # Resize CREPE confidence values to match the frame count of RMS
            voiced_confidence = np.interp(
                np.linspace(0, 1, n_frames),
                np.linspace(0, 1, len(periodicity)),
                periodicity
            )
            # Multiply: frames where the singer is silent or unvoiced get near-zero weight
            weights = weights * voiced_confidence

        # Drop frames below 5% of peak loudness (background hiss, breath noise)
        weights[rms < (np.max(rms) * 0.05)] = 0.0
        weight_sum = weights.sum() 

        # No usable singing frames found
        if weight_sum < 1e-9:
            return {"tone_score": 0.0, "brightness": 0.0, "spectral_stability": 0.0, "hnr_score": 0.0}

        # Normalize weights so they sum to 1
        weights = weights / weight_sum 

        # Step 4: Spectral Stability — how consistent is the voice tone over time?
        mfcc_wmean = np.average(mfcc, axis=1, weights=weights)          # weighted average timbre
        mfcc_wstd = np.sqrt(np.average((mfcc - mfcc_wmean[:, None]) ** 2, axis=1, weights=weights))  # how much it varies
        avg_mfcc_std = np.mean(mfcc_wstd[1:5])  # coefficients 1–4 are most perceptually relevant (skip 0 = loudness)

        avg_flatness = np.average(flatness, weights=weights)
        noise_penalty = min(50.0, avg_flatness * 200.0)  # breathy/noisy voice loses up to 50 points

        spectral_stability = max(0.0, min(100.0, 100.0 - (avg_mfcc_std * 3.0) - noise_penalty))

        # Step 5: HNR — how clean is the voice? (high = clear, low = breathy/raspy)
        hnr_score = self._compute_hnr(y_harmonic, sr, weights)

        # Step 6: Brightness — does the voice have presence and clarity?
        avg_centroid = np.average(centroid, weights=weights)
        avg_rolloff = np.average(rolloff, weights=weights)
        centroid_score = max(0.0, min(100.0, (avg_centroid / 4000.0) * 100.0))   # 4000 Hz = bright voice ceiling
        rolloff_score = max(0.0, min(100.0, (avg_rolloff / 8000.0) * 100.0))     # 8000 Hz = rolloff ceiling
        brightness_score = (centroid_score * 0.6) + (rolloff_score * 0.4)

        # Step 7: Final tone score — weighted blend of stability, cleanliness, and brightness
        tone_score = (spectral_stability * 0.5) + (hnr_score * 0.2) + (brightness_score * 0.3)

        return {
            "tone_score": float(tone_score),
            "brightness": float(brightness_score),
            "spectral_stability": float(spectral_stability),
            "hnr_score": float(hnr_score),
        }

    def _compute_hnr(self, y_harmonic, sr, weights):
        """Computes Harmonic-to-Noise Ratio — higher score = cleaner, less breathy voice"""
        hop_length = 512
        frame_length = 2048

        # Cut audio into short overlapping windows (frames) for per-frame analysis
        frames = librosa.util.frame(y_harmonic, frame_length=frame_length, hop_length=hop_length)
        n_frames = frames.shape[1]

        # A periodic signal = harmonic voice; a random signal = noise
        F = np.fft.rfft(frames, n=2 * frame_length, axis=0)
        acf = np.fft.irfft(np.abs(F) ** 2, axis=0)[:frame_length]

        r0 = acf[0]  # total energy of the frame (zero-lag)

        # Only look for periodicity within the human singing range (65–1046 Hz)
        min_lag = max(1, int(sr / 1046))
        max_lag = min(int(sr / 65), frame_length - 1)

        r_max = np.max(acf[min_lag:max_lag + 1], axis=0)  # strongest periodic peak in vocal range

        # Noise = total energy − harmonic peak energy
        noise_energy = np.maximum(r0 - r_max, 1e-9)
        # HNR in dB: ratio of harmonic energy to noise energy (0 dB = half noise, 20 dB = very clean)
        hnr_db = np.where(
            r0 < 1e-9,
            0.0,
            10.0 * np.log10(np.maximum(r_max, 1e-9) / noise_energy)
        )
        hnr_db = np.maximum(hnr_db, 0.0)

        # Align weights to match the frame count of this function
        w = np.interp(
            np.linspace(0, 1, n_frames),
            np.linspace(0, 1, len(weights)),
            weights
        )
        w_sum = w.sum()
        if w_sum < 1e-9:
            return 0.0

        avg_hnr = np.dot(hnr_db, w) / w_sum  # weighted average HNR across all frames

        # Scale to 0–100: 20 dB = perfect score (clean professional voice)
        return float(max(0.0, min(100.0, (avg_hnr / 20.0) * 100.0)))
