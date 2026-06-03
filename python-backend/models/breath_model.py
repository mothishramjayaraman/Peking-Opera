import torch
import torch.nn as nn
import librosa
import numpy as np
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# MODEL ARCHITECTURE: BreathConformer
# =============================================================================
# This is a hybrid deep learning model that combines two powerful architectures:
#   1. CNN (Convolutional Neural Network) — extracts LOCAL spectral patterns
#      (the "texture" of a breath sound in a small time-frequency window)
#   2. Transformer Encoder — captures GLOBAL temporal context
#      (breaths occur in musical gaps, so surrounding context matters)
#
# =============================================================================


#Raw audio → CNN → Projection → Transformer → Output 

class BreathConformer(nn.Module):
    def __init__(self, input_dim=128):
        super(BreathConformer, self).__init__()

        # STAGE 1: CNN BLOCK initialiseer
        self.cnn = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),   ## Extract local breath/audio patterns using 16 learned 3×3 filters while keeping output size unchanged
            nn.BatchNorm2d(16),#Normalize 16 channels.
            nn.ReLU(),## Replaces negative values with 0 and keeps positive values unchanged.
            nn.MaxPool2d(2),  #Downsamples.                            
            nn.Conv2d(16, 32, kernel_size=3, padding=1),  # Learn 32 higher-level filters
            nn.BatchNorm2d(32),#Normalize 32 channels.
            nn.ReLU(),
            nn.MaxPool2d(2)                                # 64 mel bins → 32
        )

        # STAGE 2: PROJECTION LAYER
        self.projection = nn.Linear(1024, 32)#compresses the features

        # STAGE 3: TRANSFORMER ENCODER
        self.encoder_layer = nn.TransformerEncoderLayer(d_model=32, nhead=4, batch_first=True)#Learns contextual relationships across timesteps using multi-head self-attention
        self.transformer = nn.TransformerEncoder(self.encoder_layer, num_layers=2)#show the tranformer as two layer

        # STAGE 4: CLASSIFICATION HEAD
        self.fc = nn.Linear(32, 1)#Breath probability.32 input and one score 

    #how data moves through the model 
    def forward(self, x):
        #b = batch size,c = channels,m = mel bins,t = time
        b, c, m, t = x.shape#Get dimensions.

        x = self.cnn(x) #CNN extracts local breath patterns.

        x = x.view(b, -1, x.shape[3]) #Flatten channels + mel bins.

        x = x.permute(0, 2, 1)#Rearrange dimensions.

        x = self.projection(x) #Compress features.

        x = self.transformer(x) #Transformer learns context.

        out = torch.sigmoid(self.fc(x)) #breath probability like 0 - 1

        return out.squeeze(-1) #Remove extra dimension.


#advance breath using checks 
class AdvancedBreathAnalyzer:
    """
    Professional Acoustic Event Detection (AED) for vocal breathing.
    Meets Requirements #1, #2, #4, and #5.
    """
    def __init__(self, sr=22050):
        self.sr = sr
        self.model = BreathConformer()
        import os
        weight_path = os.path.join(os.path.dirname(__file__), 'breath_conformer.pt')
        self.model_loaded = False
        if os.path.exists(weight_path):
            # Using weights_only=True for safety as recommended in modern PyTorch
            self.model.load_state_dict(torch.load(weight_path, map_location="cpu", weights_only=True))
            logger.info("Loaded pre-trained weights for BreathConformer.")
            self.model_loaded = True
        else:
            logger.warning("No pre-trained weights found for BreathConformer. Using heuristic fallback.")

        logger.info("AdvancedBreathAnalyzer initialized with AED + VAD-Gating.")

    def extract_advanced_features(self, y):
        """Requirement #2: Log-Mel Spectrograms + Delta Features"""

        
        S = librosa.feature.melspectrogram(y=y, sr=self.sr, n_mels=128)
        log_S = librosa.power_to_db(S, ref=np.max)

       
        # Deltas capture the 'attack' of the breath
        delta_S = librosa.feature.delta(log_S)
        delta2_S = librosa.feature.delta(log_S, order=2)

        
        # Requirement #5: Multi-Feature Fusion (ZCR, Flatness, RMS)
        zcr = librosa.feature.zero_crossing_rate(y)
        flatness = librosa.feature.spectral_flatness(y=y)
        rms = librosa.feature.rms(y=y)

        return log_S, delta_S, delta2_S, zcr, flatness, rms

    def analyze(self, y, periodicity):
        # Step 1: No normalization — keeps original volume for accurate quietness scoring
        log_S, delta_S, d2_S, zcr, flatness, rms = self.extract_advanced_features(y)

        # Step 2: Run BreathConformer; interpolate output back to full frame count
        input_tensor = torch.tensor(log_S, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
        self.model.eval()
        with torch.no_grad():
            dl_probs = self.model(input_tensor).squeeze(0).numpy()
        breath_probs_interp = np.interp(
            np.linspace(0, 1, log_S.shape[1]),
            np.linspace(0, 1, len(dl_probs)),
            dl_probs
        )

        # Step 3: VAD gate — ignore frames where the voice is actively singing (periodicity >= 0.35)
        mask = np.interp(
            np.linspace(0, 1, log_S.shape[1]),
            np.linspace(0, 1, len(periodicity)),
            periodicity
        )
        tonal_gate = mask < 0.35
        volume_gate = rms[0] > (np.max(rms[0]) * 0.02)
        acoustic_noise_gate = (zcr[0] > 0.03) & (flatness[0] > 0.001)

        # Step 4: Mark breath frames; fall back to ZCR+flatness heuristic if model is unconfident or missing
        dl_gate = breath_probs_interp > 0.5
        if not self.model_loaded or np.max(breath_probs_interp) < 0.1:
            breath_frames = acoustic_noise_gate & tonal_gate & volume_gate
        else:
            breath_frames = dl_gate & tonal_gate & volume_gate

        # Step 5: Count events — require at least 3 consecutive frames (~60ms) to filter false positives
        events = 0
        active_duration = 0
        min_frames = 3
        for frame in breath_frames:
            if frame:
                active_duration += 1
            else:
                if active_duration >= min_frames:
                    events += 1
                active_duration = 0
        if active_duration >= min_frames:
            events += 1

        # Step 6: Score on 3 axes — Quietness (40%), Consistency (40%), Efficiency (20%).
        # If only 1 breath detected, redistribute: Quietness 66.7% + Efficiency 33.3%.
        if events == 0:
            score = 0
        else:
            # Quietness: ratio of breath volume to singing volume (lower = better)
            breath_rms = np.mean(rms[0][breath_frames])
            singing_rms = np.mean(rms[0][~breath_frames]) if np.sum(~breath_frames) > 0 else 0.01
            quietness_ratio = breath_rms / (singing_rms + 1e-6)
            quietness_score = max(0, min(100, 100 - (quietness_ratio * 150)))

            # Consistency: measure intervals between breaths
            intervals = []
            last_event_end = 0
            in_breath = False
            for i, frame in enumerate(breath_frames):
                if frame and not in_breath:
                    intervals.append(i - last_event_end)
                    in_breath = True
                elif not frame and in_breath:
                    last_event_end = i
                    in_breath = False

            # Efficiency: optimal breath duration is 0.2s–0.6s
            avg_duration = (np.sum(breath_frames) * (512 / 22050)) / events
            if 0.2 <= avg_duration <= 0.6:
                efficiency_score = 100
            else:
                efficiency_score = max(0, 100 - abs(avg_duration - 0.4) * 50)

            if len(intervals) > 1:
                consistency = 1.0 - (np.std(intervals) / (np.mean(intervals) + 1e-6))
                consistency_score = max(0, min(100, consistency * 100))
                score = (quietness_score * 0.4) + (consistency_score * 0.4) + (efficiency_score * 0.2)
            else:
                score = (quietness_score * 0.667) + (efficiency_score * 0.333)

        return {
            "breath_score": round(float(score), 2),
            "events_detected": int(events),
            "technical_summary": "Objective Acoustic Evaluation: Quietness, Consistency, and Efficiency" if events > 0 else "No breaths detected"
        }
