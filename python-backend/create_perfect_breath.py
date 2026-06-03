import numpy as np
import librosa
import soundfile as sf
import os

input_file = r"C:\Users\mothi\Desktop\operaa\AI SINGING APPLICATION\train datasets\vibrato\VocalSet\FULL\male9\scales\vibrato\m9_scales_vibrato_a.wav"
y, sr = librosa.load(input_file, sr=22050)

# Create a perfect, quiet "Dantian" breath
breath_duration = int(0.4 * sr) # 0.4 seconds (optimal efficiency)
noise = np.random.normal(0, 1, breath_duration).astype(np.float32)

from scipy.signal import butter, filtfilt
b, a = butter(N=4, Wn=[1000/(sr/2), 6000/(sr/2)], btype="bandpass")
inhale_sound = filtfilt(b, a, noise)

envelope = np.hanning(breath_duration)
# Make it extremely quiet (proper Dantian breath)
inhale_sound = inhale_sound * envelope * 0.005  

midpoint = len(y) // 2
y_test = y.copy()
y_test[midpoint:midpoint+breath_duration] = 0.0
y_test[midpoint:midpoint+breath_duration] += inhale_sound

# Also add a second breath to test Consistency
midpoint_2 = int(len(y) * 0.8)
y_test[midpoint_2:midpoint_2+breath_duration] = 0.0
y_test[midpoint_2:midpoint_2+breath_duration] += inhale_sound

output_path = r"C:\Users\mothi\Desktop\perfect_dantian_breath.wav"
sf.write(output_path, y_test, sr)
print(f"File created: {output_path}")

# Test the analyzer right away
from analyzer import SingingEvaluator
ev = SingingEvaluator()
res = ev.analyze(output_path, mode='song')
print("NEW BREATH SCORE:", res['breath_score'])
