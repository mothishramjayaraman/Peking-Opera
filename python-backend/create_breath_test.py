import numpy as np
import librosa
import soundfile as sf

# Load a clean VocalSet file
input_file = r"C:\Users\mothi\Desktop\operaa\AI SINGING APPLICATION\train datasets\vibrato\VocalSet\FULL\male9\scales\vibrato\m9_scales_vibrato_a.wav"
y, sr = librosa.load(input_file, sr=22050)

# Create a realistic "breath" sound (high-frequency white noise shaped with an envelope)
breath_duration = int(0.5 * sr) # half a second breath
noise = np.random.normal(0, 1, breath_duration).astype(np.float32)

# Apply a bandpass filter to make the noise sound like an inhale (air rushing)
from scipy.signal import butter, filtfilt
b, a = butter(N=4, Wn=[1000/(sr/2), 8000/(sr/2)], btype="bandpass")
inhale_sound = filtfilt(b, a, noise)

# Envelope to make it fade in and out like a real breath
envelope = np.hanning(breath_duration)
inhale_sound = inhale_sound * envelope * 0.15  # Scale volume

# Inject the breath right in the middle of the audio
midpoint = len(y) // 2
# Silence the original audio for half a second
y_test = y.copy()
y_test[midpoint:midpoint+breath_duration] = 0.0
# Add the breath
y_test[midpoint:midpoint+breath_duration] += inhale_sound

# Save it to the Desktop
output_path = r"C:\Users\mothi\Desktop\breath_test_audio.wav"
sf.write(output_path, y_test, sr)
print(f"Test file created at: {output_path}")
