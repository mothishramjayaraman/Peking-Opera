import pytest
import numpy as np
from analyzer import SingingEvaluator

# fixture: shared evaluator reused across all expression tests
@pytest.fixture
def evaluator():
    return SingingEvaluator(sr=22050)

def test_expression_exercise_mode(evaluator):
    """
    In 'exercise' mode, expression measures dynamic consistency.
    A steady volume should score high.
    """
    sr = 22050
    t = np.linspace(0, 2.0, int(sr * 2.0))
    # Steady sine wave — constant volume throughout
    y_steady = 0.5 * np.sin(2 * np.pi * 440.0 * t)

    score = evaluator.calculate_expression_metrics(y_steady, sr, mode="exercise")

    # exercise mode rewards stability → steady wave should score high
    assert score > 80.0

def test_expression_song_mode_flat(evaluator):
    """
    In 'song' mode, expression measures dynamic contrast.
    A steady volume has zero contrast, so it should score poorly.
    """
    sr = 22050
    t = np.linspace(0, 2.0, int(sr * 2.0))
    # Steady sine wave — no loud/soft variation
    y_steady = 0.5 * np.sin(2 * np.pi * 440.0 * t)

    score = evaluator.calculate_expression_metrics(y_steady, sr, mode="song")

    # song mode rewards contrast → flat volume should score low
    assert score < 20.0

def test_expression_song_mode_dynamic(evaluator):
    """
    In 'song' mode, varying volume (dynamics) should score highly.
    """
    sr = 22050
    t = np.linspace(0, 2.0, int(sr * 2.0))
    # envelope grows from 0.1 → 1.0 — simulates a crescendo
    envelope = np.linspace(0.1, 1.0, len(t))
    y_dynamic = envelope * np.sin(2 * np.pi * 440.0 * t)

    score = evaluator.calculate_expression_metrics(y_dynamic, sr, mode="song")

    # High contrast expected due to crescendo
    assert score > 40.0
