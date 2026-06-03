import pytest
import numpy as np
import librosa
from models.tone_model import ToneMetricsModel

# fixture: shared model instance reused across all tone tests
@pytest.fixture
def tone_model():
    # Initialize with standard sampling rate
    return ToneMetricsModel(sr=22050)

def generate_sine_wave(freq, duration, sr=22050, vibrato=False, noise_level=0.0):
    """Utility to generate synthetic audio for testing"""
    t = np.linspace(0, duration, int(sr * duration))
    if vibrato:
        # wobble the frequency ±5Hz at 5Hz rate to simulate vibrato
        freqs = freq + 5.0 * np.sin(2 * np.pi * 5.0 * t)
        phase = 2 * np.pi * np.cumsum(freqs) / sr
        y = 0.5 * np.sin(phase)
    else:
        y = 0.5 * np.sin(2 * np.pi * freq * t)

    if noise_level > 0:
        # add random noise on top of the clean tone
        y += noise_level * np.random.randn(len(t))

    return y

def test_initialization(tone_model):
    """Test if model initializes properly with default parameters."""
    assert tone_model.sr == 22050

def test_analyze_silence(tone_model):
    """
    Test how the model handles pure silence.
    The RMS logic should detect no active frames and return zero scores.
    """
    # Create 2 seconds of pure silence
    y_silent = np.zeros(int(22050 * 2.0))
    result = tone_model.analyze(y_silent)

    # silence → all scores must be zero
    assert result["tone_score"] == 0.0
    assert result["brightness"] == 0.0
    assert result["spectral_stability"] == 0.0

def test_analyze_steady_tone(tone_model):
    """
    Test how the model analyzes a steady, pure sine wave.
    A pure sine wave should have high consistency.
    """
    # Generate 2 seconds of 440Hz A4 note
    y_steady = generate_sine_wave(440.0, 2.0)
    result = tone_model.analyze(y_steady)

    # A steady computer-generated wave should be very consistent
    assert result["spectral_stability"] > 70.0
    # 440Hz is mid-low freq so brightness pulls tone_score below 70
    assert result["tone_score"] > 50.0
    # A pure low frequency sine wave is typically low brightness
    assert isinstance(result["brightness"], float)

def test_analyze_noisy_tone(tone_model):
    """
    Test how the model handles a very noisy, inconsistent signal.
    It should score lower on consistency compared to a steady tone.
    """
    y_steady = generate_sine_wave(440.0, 2.0)
    y_noisy = generate_sine_wave(440.0, 2.0, noise_level=0.5)

    result_steady = tone_model.analyze(y_steady)
    result_noisy = tone_model.analyze(y_noisy)

    # The noisy signal should have lower tone consistency
    assert result_noisy["spectral_stability"] < result_steady["spectral_stability"]

def test_brightness_differences(tone_model):
    """
    Test if the model correctly differentiates between a dark tone and bright tone.
    """
    # Dark tone (low frequency, no harmonics)
    y_dark = generate_sine_wave(200.0, 2.0)

    # Bright tone (high frequency)
    y_bright = generate_sine_wave(1500.0, 2.0)

    result_dark = tone_model.analyze(y_dark)
    result_bright = tone_model.analyze(y_bright)

    # higher frequency → higher spectral centroid → higher brightness score
    assert result_bright["brightness"] > result_dark["brightness"]
