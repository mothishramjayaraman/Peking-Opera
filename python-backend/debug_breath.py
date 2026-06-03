import numpy as np
import librosa
from models.breath_model import AdvancedBreathAnalyzer

sr = 22050
t_tone = np.linspace(0, 1.0, int(sr * 1.0))
t_noise = np.linspace(0, 0.5, int(sr * 0.5))
tone = 0.5 * np.sin(2 * np.pi * 440.0 * t_tone)
noise = 0.05 * np.random.randn(len(t_noise)) # Quiet breath
y = np.concatenate([tone, noise, tone, noise])

periodicity = np.concatenate([
    np.ones(int(sr * 1.0 / 512)),
    np.zeros(int(sr * 0.5 / 512)),
    np.ones(int(sr * 1.0 / 512)),
    np.zeros(int(sr * 0.5 / 512))
])

target_len = int(len(y) / 512) + 1
if len(periodicity) < target_len:
    periodicity = np.pad(periodicity, (0, target_len - len(periodicity)), 'edge')
else:
    periodicity = periodicity[:target_len]

model = AdvancedBreathAnalyzer(sr=sr)
log_S, delta_S, d2_S, zcr, flatness, rms = model.extract_advanced_features(y)

print(f"max rms: {np.max(rms[0])}")
print(f"min rms noise: {np.min(rms[0][int(1.1*22050/512):int(1.4*22050/512)])}")

mask = np.interp(
    np.linspace(0, 1, log_S.shape[1]),
    np.linspace(0, 1, len(periodicity)),
    periodicity
)
print(f"tonal_gate true count: {np.sum(mask < 0.35)}")
print(f"volume_gate true count: {np.sum(rms[0] > (np.max(rms[0]) * 0.02))}")
print(f"acoustic_noise_gate true count: {np.sum((zcr[0] > 0.03) & (flatness[0] > 0.001))}")

dl_probs = model.model(torch.tensor(log_S, dtype=torch.float32).unsqueeze(0).unsqueeze(0)).squeeze(0).detach().numpy()
breath_probs_interp = np.interp(
    np.linspace(0, 1, log_S.shape[1]),
    np.linspace(0, 1, len(dl_probs)),
    dl_probs
)
print(f"model_loaded: {model.model_loaded}")
print(f"dl_probs max: {np.max(breath_probs_interp)}")

breath_frames = (zcr[0] > 0.03) & (flatness[0] > 0.001) & (mask < 0.35) & (rms[0] > (np.max(rms[0]) * 0.02))
print(f"breath_frames true count: {np.sum(breath_frames)}")

result = model.analyze(y, periodicity)
print(f"events_detected: {result['events_detected']}")
