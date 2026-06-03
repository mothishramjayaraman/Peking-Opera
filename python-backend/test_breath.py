import os
import glob
from analyzer import SingingEvaluator

def find_breath():
    ev = SingingEvaluator()
    search_path = r"C:\Users\mothi\Desktop\operaa\AI SINGING APPLICATION\train datasets\vibrato\VocalSet\FULL\male9\excerpts\**\*.wav"
    files = glob.glob(search_path, recursive=True)
    
    for f in files[:5]:
        print(f"Testing {os.path.basename(f)}...")
        try:
            res = ev.analyze(f, mode='song')
            score = res.get('breath_score', 0)
            print(f"  --> Breath Score: {score}")
            if score > 0:
                print(f"\nFOUND! Use this path: {f}")
                return
        except Exception as e:
            pass
            
if __name__ == "__main__":
    find_breath()
