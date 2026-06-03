import requests
import numpy as np
import scipy.io.wavfile as wav
import os
import time

def generate_mock_audio(filename, duration=5.0, freq=440.0, sr=22050, mode='stable_vibrato'):
    """
    Generate complex .wav files for testing.
    'stable_vibrato': Constant center pitch with 5Hz oscillation (Should have HIGH TSI and HIGH Vibrato)
    'drifting': Pitch drifting over time (Should have LOW TSI)
    """
    t = np.linspace(0, duration, int(sr * duration))
    dt = 1.0 / sr
    
    if mode == 'stable_vibrato':
        # 5Hz vibrato with +/- 10Hz swing
        vibrato_freqs = freq + 10.0 * np.sin(2 * np.pi * 5.0 * t)
        # Integrate frequency to get phase
        phase = 2 * np.pi * np.cumsum(vibrato_freqs) * dt
        from scipy.signal import sawtooth
        data = 0.5 * sawtooth(phase)
        data += 0.01 * np.random.randn(len(t))
        print(f"Generating Corrected Stable Vibrato (FM) audio")
    elif mode == 'drifting':
        # Linear drift from freq to freq + 20
        drift_freqs = np.linspace(freq, freq + 20, len(t))
        phase = 2 * np.pi * np.cumsum(drift_freqs) * dt
        from scipy.signal import sawtooth
        data = 0.5 * sawtooth(phase)
        data += 0.01 * np.random.randn(len(t))
        print(f"Generating Corrected Drifting Pitch (FM) audio")
    else:
        from scipy.signal import sawtooth
        data = 0.5 * sawtooth(2 * np.pi * freq * t)
        data += 0.01 * np.random.randn(len(t))


    
    data = (data * 32767).astype(np.int16)
    wav.write(filename, sr, data)

def test_analyze_endpoint():
    url = "http://localhost:8000/analyze"
    test_files = [
        ("stable_vibrato.wav", "stable_vibrato"),
        ("drifting.wav", "drifting")
    ]
    
    for filename, mode in test_files:
        generate_mock_audio(filename, mode=mode)
        try:
            with open(filename, 'rb') as f:
                print(f"\n--- Testing Mode: {mode} ---")
                response = requests.post(url, files={'file': (filename, f, 'audio/wav')})
                if response.status_code == 200:
                    print("Response:", response.json())
                else:
                    print(f"Error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Connection error: {e}")
        finally:
            if os.path.exists(filename):
                os.remove(filename)


if __name__ == "__main__":
    # Note: This test requires the FastAPI server to be running in another process.
    # To run the server: python main.py
    # To run this test: python test_api.py
    test_analyze_endpoint()
