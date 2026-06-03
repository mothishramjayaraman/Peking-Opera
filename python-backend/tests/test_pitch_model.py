import pytest
import numpy as np
import torch
from models.pitch_model import VocalPitchModel

# fixture: model runs on CPU (no GPU needed for tests)
@pytest.fixture
def pitch_model():
    return VocalPitchModel(device='cpu')

def test_pitch_model_initialization(pitch_model):
    # confirm device is set correctly
    assert pitch_model.device == 'cpu'

def test_predict_pitch_sine(pitch_model):
    """Test pitch prediction on a pure 440Hz sine wave."""
    sr = 22050
    t = np.linspace(0, 2.0, int(sr * 2.0))
    # 440Hz = note A4 — a standard reference pitch
    y = 0.5 * np.sin(2 * np.pi * 440.0 * t)

    # We mock torchcrepe.predict if we don't want to run the heavy model,
    # but let's assume we can run it for a short clip
    f0, periodicity = pitch_model.predict_pitch(y, sr)

    # Verify shape — both arrays must be same length and non-empty
    assert len(f0) > 0
    assert len(f0) == len(periodicity)

    # Verify the predicted frequency is very close to 440Hz (allowing some tolerance)
    # only use high-confidence frames (periodicity > 0.8) for the check
    valid_f0 = f0[periodicity > 0.8]
    if len(valid_f0) > 0:
        avg_f0 = np.mean(valid_f0)
        # ±10Hz tolerance around 440Hz
        assert 430.0 < avg_f0 < 450.0
