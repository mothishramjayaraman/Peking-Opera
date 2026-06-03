import pytest
from fastapi.testclient import TestClient
from main import app
import numpy as np
import scipy.io.wavfile as wav
import os

# TestClient bypasses the network — tests run instantly without starting a real server
client = TestClient(app)

@pytest.fixture
def sample_wav():
    """Generates a tiny valid WAV file for testing uploads."""
    filename = "test_audio.wav"
    sr = 22050
    t = np.linspace(0, 0.5, int(sr * 0.5))
    y = 0.5 * np.sin(2 * np.pi * 440.0 * t)
    # convert float → int16 (standard WAV format)
    data = (y * 32767).astype(np.int16)
    wav.write(filename, sr, data)

    yield filename  # test runs here

    # cleanup: delete the temp file after each test
    if os.path.exists(filename):
        os.remove(filename)

def test_root_endpoint():
    """Ensure the API is alive and responding."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Singing AI Evaluation System is active" in response.json()["message"]

def test_analyze_endpoint_valid(sample_wav):
    """Test that the /analyze endpoint correctly parses a valid audio file."""
    with open(sample_wav, "rb") as f:
        response = client.post(
            "/analyze?mode=song",
            files={"file": ("test_audio.wav", f, "audio/wav")}
        )

    # valid WAV → 200 response with scores
    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert data["mode_used"] == "song"

def test_analyze_endpoint_invalid_format():
    """Security/Validation testing: Uploading an invalid file extension."""
    # Create a fake file
    with open("fake.txt", "w") as f:
        f.write("This is not an audio file")

    with open("fake.txt", "rb") as f:
        response = client.post(
            "/analyze",
            files={"file": ("fake.txt", f, "text/plain")}
        )

    os.remove("fake.txt")

    # non-audio file → API must reject with 400
    assert response.status_code == 400
    assert "Invalid audio format" in response.json()["detail"]
