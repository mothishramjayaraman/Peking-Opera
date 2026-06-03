import pytest
import numpy as np
from analyzer import SingingEvaluator

def test_analyzer_integration():
    """
    Test the full AI analyzer pipeline.
    This ensures that Tone, Pitch, Breath, and Vibrato models
    integrate correctly and return a comprehensive response.
    """
    # 1-second 440Hz sine wave — simplest valid singing input
    sr = 22050
    t = np.linspace(0, 1.0, int(sr * 1.0))
    y = 0.5 * np.sin(2 * np.pi * 440.0 * t)

    # We test the pure pipeline
    evaluator = SingingEvaluator(sr=sr)
    result = evaluator.analyze(y, mode="song", sr=sr)


    # all 5 score keys must exist in the response
# assert ==> to check whether something is true.

    assert "overall_score" in result
    assert "pitch_score" in result
    assert "true_tone_score" in result
    assert "breath_score" in result
    assert "vibrato_score" in result

    # A generated sine wave should have perfect pitch consistency
    assert result["pitch_score"] > 0
