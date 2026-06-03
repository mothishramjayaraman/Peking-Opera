import pytest
import numpy as np
from models.breath_model import AdvancedBreathAnalyzer

# fixture: shared model instance reused across all breath tests
@pytest.fixture
def breath_model():
    return AdvancedBreathAnalyzer(sr=22050)

def test_breath_model_initialization(breath_model):
    """Test if model initializes correctly (with or without weights)"""
    assert breath_model.sr == 22050

def test_no_breath_detected(breath_model):
    """
    Test a continuous, pure sine wave.
    It should have high tonal periodicity everywhere,
    so no breaths should be detected.
    """
    sr = 22050
    t = np.linspace(0, 3.0, int(sr * 3.0))
    # Pure tone — no silent gaps anywhere
    y = 0.5 * np.sin(2 * np.pi * 440.0 * t)

    # High periodicity means it's a solid pitched note everywhere
    periodicity = np.ones(int(sr * 3.0 / 512) + 1)

    result = breath_model.analyze(y, periodicity)

    # continuous tone → no breath events
    assert result["events_detected"] == 0
    assert result["breath_score"] == 0

def test_breaths_detected(breath_model):
    """
    Test an audio signal with alternating tone and noisy gaps.
    The noisy gaps should trigger the breath detector.
    """
    sr = 22050

    # pattern: 1s singing → 0.5s breath noise → 1s singing → 0.5s breath noise
    t_tone = np.linspace(0, 1.0, int(sr * 1.0))
    t_noise = np.linspace(0, 0.5, int(sr * 0.5))

    tone = 0.5 * np.sin(2 * np.pi * 440.0 * t_tone)
    noise = 0.05 * np.random.randn(len(t_noise)) # Quiet breath

    y = np.concatenate([tone, noise, tone, noise])

    # Mock periodicity: 1.0 during tone, 0.0 during noise
    periodicity = np.concatenate([
        np.ones(int(sr * 1.0 / 512)),
        np.zeros(int(sr * 0.5 / 512)),
        np.ones(int(sr * 1.0 / 512)),
        np.zeros(int(sr * 0.5 / 512))
    ])

    # Fix length mismatch just in case due to rounding
    target_len = int(len(y) / 512) + 1
    if len(periodicity) < target_len:
        periodicity = np.pad(periodicity, (0, target_len - len(periodicity)), 'edge')
    else:
        periodicity = periodicity[:target_len]

    # Mock the model_loaded flag so it tests the heuristic fallback, since white noise is rejected by the real ML model
    breath_model.model_loaded = False
    result = breath_model.analyze(y, periodicity)

    # We should detect at least 1-2 events
    assert result["events_detected"] >= 1

    # Score should be > 0
    assert result["breath_score"] > 0
