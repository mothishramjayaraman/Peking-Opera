import pytest
import numpy as np
from models.vibrato_model import VibratoMetricsModel

# fixture: reusable model instance shared across both vibrato tests
@pytest.fixture
def vibrato_model():
    return VibratoMetricsModel(sr=22050, hop_length=512)

def test_no_vibrato(vibrato_model):
    """
    Test a perfectly flat F0 contour (no vibrato).
    """
    sr = 22050
    # 2 seconds of pure 440Hz — no pitch wobble at all
    f0 = np.ones(int(sr * 2.0 / 512)) * 440.0
    confidence = np.ones(len(f0))

    result = vibrato_model.analyze(f0, confidence)

    # flat pitch → all vibrato metrics must be zero
    assert result["rate"] == 0
    assert result["extent"] == 0
    assert result["score"] == 0

def test_perfect_vibrato(vibrato_model):
    """
    Test an ideal vibrato (6Hz modulation, 50 cents extent).
    """
    sr = 22050
    hop = 512
    dt = hop / sr          # time step between each frame
    t = np.arange(0, 2.0, dt)

    # 440 Hz base frequency
    # To get ~50 cents extent, we modulate by ~1.029 (since 2^(50/1200) ≈ 1.0293)
    # 440 * 1.0293 ≈ 452.8Hz. Amplitude of modulation = 12.8Hz

    base_freq = 440.0
    modulation_amp = 12.8   # Hz swing above and below 440
    vibrato_rate = 6.0      # standard singing vibrato rate

    # f0 wobbles 6 times per second around 440Hz
    f0 = base_freq + modulation_amp * np.sin(2 * np.pi * vibrato_rate * t)
    confidence = np.ones(len(f0))

    vibrato_model.model_loaded = False
    result = vibrato_model.analyze(f0, confidence)

    # Check rate is roughly 6 Hz
    assert 5.0 <= result["rate"] <= 7.0

    # Check extent is captured (median filtering causes some widening in peak-to-peak calc)
    assert 85.0 <= result["extent"] <= 150.0

    # Since it's a perfect 6Hz wave, score should be reasonable despite median filter artifacts
    assert result["score"] > 60.0
