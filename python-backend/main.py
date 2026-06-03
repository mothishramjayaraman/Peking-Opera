import os
import shutil
import tempfile
import numpy as np
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from analyzer import SingingEvaluator
import uvicorn
import logging

# New hybrid modules
from preprocessing.pipeline import JingjuPreprocessingPipeline
from evaluation.metrics import PitchEvaluator
from visualization.plotter import JingjuVisualizer


def _to_python(obj):
    """Recursively convert numpy scalars/arrays to native Python types."""
    if isinstance(obj, dict):
        return {k: _to_python(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_python(v) for v in obj]
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Singing AI Evaluation API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the evaluator and new hybrid services
evaluator   = SingingEvaluator()
preprocessor = JingjuPreprocessingPipeline(denoise=True, vad=False, normalize=True)
pitch_eval   = PitchEvaluator()
visualizer   = JingjuVisualizer()

@app.get("/")
async def root():
    return {"message": "Singing AI Evaluation System is active. Use POST /analyze to evaluate audio."}

# analyse analyse
@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...), mode: str = "song"):
    """
    Endpoint to analyze a .wav audio file and compute vocal metrics.
    :param mode: 'song' or 'exercise'
    """
    # Check file extension
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.webm')):
        raise HTTPException(status_code=400, detail="Invalid audio format. Please upload a .wav, .mp3, or .webm file.")

    # Create a temporary file to store the uploaded audio
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_audio:
            shutil.copyfileobj(file.file, temp_audio)
            temp_path = temp_audio.name
            
        logger.info(f"Analyzing audio file: {file.filename}")
        
        # Analyze the audio
        results = evaluator.analyze(temp_path, mode=mode)
        
        # Clean up the temporary file
        os.unlink(temp_path)
        
        return _to_python(results)

    except Exception as e:
        logger.exception("Error analyzing audio")
        # Attempt to cleanup if something went wrong
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.unlink(temp_path)
        
        detail = str(e)
        if "backend" in detail.lower() or "audioread" in detail.lower():
            detail = "Audio decoding failed. This usually means ffmpeg is missing on the server. Please install ffmpeg."
            
        raise HTTPException(status_code=500, detail=detail)

@app.post("/pitch-contour")
async def pitch_contour(
    file: UploadFile = File(...),
    role: str = Query(default="default"),
):
    """
    Returns frame-level pitch contour + confidence for Jingju singing.
    Uses the full hybrid pipeline: CREPE → BiLSTM → FT-GAN → Octave correction.
    """
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".flac", ".webm")):
        raise HTTPException(status_code=400, detail="Invalid audio format.")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        y, sr = librosa.load(temp_path, sr=22050, mono=True)
        os.unlink(temp_path)

        from models.pitch_model import VocalPitchModel
        model = VocalPitchModel(role=role)
        f0, confidence = model.predict_pitch(y, sr)

        hop = max(1, len(f0) // 500)
        return _to_python({
            "f0_contour":    [round(float(v), 2) for v in f0[::hop]],
            "confidence":    [round(float(v), 4) for v in confidence[::hop]],
            "hop_factor":    hop,
            "n_frames":      len(f0),
            "duration_s":    round(len(y) / sr, 3),
            "role":          role,
        })
    except Exception as e:
        logger.exception("Error in /pitch-contour")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ornaments")
async def detect_ornaments(file: UploadFile = File(...)):
    """Detect Jingju vocal ornaments: glide (滑音), turn (回滑音), grace note (装饰音), etc."""
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".flac", ".webm")):
        raise HTTPException(status_code=400, detail="Invalid audio format.")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        y, sr = librosa.load(temp_path, sr=22050, mono=True)
        os.unlink(temp_path)

        from models.pitch_model import VocalPitchModel
        from models.ornament_model import OrnamentDetector
        pitch_model = VocalPitchModel()
        f0, conf = pitch_model.predict_pitch(y, sr)
        detector = OrnamentDetector(sr=sr)
        events = detector.detect(f0, conf)
        return _to_python(detector.summarize(events))
    except Exception as e:
        logger.exception("Error in /ornaments")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/visualize")
async def visualize_pitch(
    file: UploadFile = File(...),
    role: str = Query(default="default"),
):
    """Returns a PNG image of the full pitch analysis visualization."""
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".flac", ".webm")):
        raise HTTPException(status_code=400, detail="Invalid audio format.")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        y, sr = librosa.load(temp_path, sr=22050, mono=True)
        os.unlink(temp_path)

        from models.pitch_model import VocalPitchModel
        model = VocalPitchModel(role=role)
        f0, conf = model.predict_pitch(y, sr)
        png_bytes = visualizer.plot_pitch_contour(y, f0, conf, role=role, title=f"Jingju Pitch — {role}")
        return Response(content=png_bytes, media_type="image/png")
    except Exception as e:
        logger.exception("Error in /visualize")
        raise HTTPException(status_code=500, detail=str(e))


def _estimate_voice_type(mean_hz: float, min_hz: float, max_hz: float) -> str:
    """
    Rough 京剧 行当 estimate from tessitura centre and range.
    Dan (旦): female/falsetto roles — high mean Hz
    Sheng (生): male civil/martial roles — mid Hz
    Jing (净): painted-face roles — low, powerful Hz
    Chou (丑): clown roles — mid-low Hz, wide range
    """
    # Dan (旦): qingyi/huadan range C4–G5, mean typically 300–550 Hz
    if mean_hz > 300:
        return "dan"
    # Xiaosheng (小生) uses heavy falsetto, overlaps with dan in pitch
    # Laosheng (老生): G2–D4, mean typically 180–260 Hz
    if mean_hz > 200:
        # Wide top range = xiaosheng (uses 小嗓), otherwise laosheng
        return "sheng"
    # Jing (净/花脸): E2–A3, mean typically 100–175 Hz, narrow range
    if mean_hz > 120:
        # Mid-low with wide range = wusheng; narrow = laosheng lower end
        return "sheng" if max_hz > 300 else "jing"
    # Deep jing or bass-jing
    return "jing"


@app.post("/fach-analyze")
async def fach_analyze(file: UploadFile = File(...)):
    """
    Dedicated endpoint for Fach/voice-type classification.
    Returns pitch range statistics and an estimated voice type.
    The caller (Next.js API) then enriches with Groq LLM for the final Fach label.
    """
    if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.flac', '.webm')):
        raise HTTPException(status_code=400, detail="Invalid audio format.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        import librosa
        import numpy as np

        y, sr = librosa.load(temp_path, sr=22050)
        os.unlink(temp_path)

        # Silence guard
        if np.mean(librosa.feature.rms(y=y)[0]) < 0.001:
            raise HTTPException(status_code=422, detail="Recording is too quiet.")

        y_norm = evaluator._normalize_audio(y)
        f0, confidence = evaluator.pitch_model.predict_pitch(y_norm, sr)

        voiced = f0[confidence > 0.5]
        if len(voiced) < 15:
            raise HTTPException(status_code=422, detail="Not enough voiced frames detected.")

        mean_hz  = float(np.mean(voiced))
        min_hz   = float(np.percentile(voiced, 5))
        max_hz   = float(np.percentile(voiced, 95))
        p25_hz   = float(np.percentile(voiced, 25))
        p75_hz   = float(np.percentile(voiced, 75))

        voice_type = _estimate_voice_type(mean_hz, min_hz, max_hz)

        # Downsample contour for transport
        hop = max(1, len(f0) // 200)
        f0_ds   = f0[::hop]
        conf_ds = confidence[::hop]
        f0_contour = [
            round(float(hz), 2) if float(c) > 0.5 else 0.0
            for hz, c in zip(f0_ds, conf_ds)
        ]

        return _to_python({
            "mean_hz":    round(mean_hz, 2),
            "min_hz":     round(min_hz, 2),
            "max_hz":     round(max_hz, 2),
            "p25_hz":     round(p25_hz, 2),
            "p75_hz":     round(p75_hz, 2),
            "estimated_voice_type": voice_type,
            "f0_contour": f0_contour,
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in /fach-analyze")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
