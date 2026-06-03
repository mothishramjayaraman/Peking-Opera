import numpy as np
import librosa
from analyzer import SingingEvaluator

def test_scale_scoring():
    evaluator = SingingEvaluator(sr=22050)
    sr = 22050
    duration_per_note = 0.5
    
    # Create a 3-note scale: C4 (261.63), D4 (293.66), E4 (329.63)
    notes = [261.63, 293.66, 329.63]
    y = np.array([])
    
    for freq in notes:
        t = np.linspace(0, duration_per_note, int(sr * duration_per_note))
        note_wave = 0.5 * np.sin(2 * np.pi * freq * t)
        y = np.concatenate([y, note_wave])
    
    print(f"Testing scale with notes: {notes}")
    results = evaluator.analyze(y, sr)
    print("Results:", results)
    
    if results['pitch_score'] > 80:
        print("SUCCESS: Pitch score is high for a perfect scale!")
    else:
        print("FAILURE: Pitch score is still too low.")

if __name__ == "__main__":
    test_scale_scoring()
