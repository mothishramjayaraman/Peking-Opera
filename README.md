# SingSmart AI — Peking Opera Vocal Coach 🎭

An AI-powered vocal training application for **Peking Opera (京剧 Jīngjù)** singing, with real-time voice analysis, personalized learning paths, and AI-generated coaching feedback.

**🌐 Live App:** [https://peking-opera-ten.vercel.app](https://peking-opera-ten.vercel.app)

---

## Executive Summary

SingSmart AI combines deep-learning acoustic analysis with LLM-powered pedagogy to teach the vocal art of Peking Opera. A custom Python DSP backend (CREPE pitch detection, conformer-based breath analysis, FFT vibrato extraction) scores each recording across 10+ metrics, while Groq's Llama 3.3 generates personalized, score-grounded coaching in the voice of a master 京剧 teacher — covering 气息 (breath support), 咬字 (articulation), 归韵 (vowel resolution), 拖腔 (melismatic phrasing), and 韵味 (aesthetic flavor).

---

## Live Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (free tier)                                     │
│  ├─ Next.js 16 App Router frontend (React 19)           │
│  └─ Next.js API routes (serverless)                     │
│         │                        │                      │
│         ▼                        ▼                      │
│  ┌─────────────────┐   ┌──────────────────────────┐    │
│  │ Neon Postgres   │   │ AI Providers             │    │
│  │ (via Vercel     │   │ ├─ Groq (Llama 3.3 +     │    │
│  │  Storage)       │   │ │   Whisper large-v3)    │    │
│  └─────────────────┘   │ ├─ OpenAI (fallback)     │    │
│                        │ └─ Google Gemini         │    │
│                        │     (audience reactions) │    │
│                        └──────────────────────────┘    │
│         │                                               │
│         ▼                                               │
│  ┌───────────────────────────────────────────────┐     │
│  │ Hugging Face Spaces (free tier, Docker)       │     │
│  │ FastAPI DSP backend — CREPE pitch, breath     │     │
│  │ conformer, vibrato, timbre, ornament models   │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

| Component | Service | Notes |
|-----------|---------|-------|
| Frontend + API | [Vercel](https://peking-opera-ten.vercel.app) | Next.js 16, auto-deploys from `main` |
| Database | Neon Postgres | Drizzle ORM, 0.5 GB free tier |
| Acoustic analysis | [Hugging Face Spaces](https://mothishram-singingai-backend.hf.space) | Docker, CPU, sleeps after 48h idle |
| Transcription + coaching | Groq | `whisper-large-v3` + `llama-3.3-70b-versatile` |
| Audience reactions | Google Gemini | Performance Mode |

---

## Features

- **Peking Opera Voice Analysis** — 10+ metric feedback: pitch accuracy (pentatonic 宫商角徵羽), Tone Stability Index, true tone score, tone brightness, HNR, breath score, vibrato (rate/depth/stability), 韵味 expression score, ornament (装饰音) detection, and recording quality
- **Role-Aware Coaching (行当)** — feedback contextualized for 旦 (Dàn), 生 (Shēng), 净 (Jìng), and 丑 (Chǒu) voice types
- **Fach Classifier** — voice classification from a recording sample
- **Dual-Mode Analysis** — context-aware scoring for songs (artistic) vs exercises (technical stability)
- **Learning Paths** — 6 paths (Structured, Intensive Bootcamp, Performance-First, Adaptive, Competitive, Flexible) with dynamic routine weighting
- **3-Phase Curriculum** — Foundation → Technique & Expression → Performance & Confidence, 48 exercises with target metrics
- **Song Library** — Peking Opera repertoire with lyrics and backing tracks
- **AI Practice Routines** — generated routines weighted by learning path
- **Performance Mode** — virtual stage with Gemini-generated audience reactions
- **Dashboard** — streak tracking, 7-day metrics, performance history
- **Bilingual UI** — English / 中文 toggle with glassmorphism design
- **Multi-Auth** — email/password (hardened validation) + Google OAuth 2.0

---

## AI Engine

### Acoustic Models (Python backend)

- **VocalPitchModel** — CREPE-based pitch detection (torchcrepe) with trained refinement checkpoint
- **VibratoMetricsModel** — FFT-based vibrato extraction (3–9 Hz): rate, extent (cents), consistency
- **BreathConformer / AdvancedBreathAnalyzer** — CNN + Transformer acoustic event detection with multi-feature fusion (mel-spectrograms, deltas, ZCR, spectral flatness, RMS) and VAD gating
- **ToneMetricsModel** — Harmonic-to-Noise Ratio + spectral centroid brightness
- **OrnamentDetector** — 装饰音 classification from trained checkpoint
- **ExpressionAnalyzer** — timbral richness, phrase arc, and dynamics scoring

### LLM Pipeline (Node/Vercel)

1. Recording → Python backend → acoustic metric scores
2. Recording → Groq Whisper → transcription
3. Metrics + transcription + exercise context → Llama 3.3 → JSON coaching (suggestions, detected mistakes, technical strengths, holistic feedback)
4. Hybrid fallback: if the Python backend is unreachable, LLM-only analysis continues; if Groq fails, a metrics-based fallback responds

---

## Project Structure

```
├── app/                   # Next.js App Router
│   ├── (dashboard)/       # Dashboard, practice, perform, analysis, songs...
│   ├── api/               # Serverless API routes (auth, analyze-audio, ...)
│   └── auth/              # Login / onboarding pages
├── components/            # Reusable UI components (Radix / shadcn-inspired)
├── server/                # DB client, storage layer, auth, Groq/OpenAI clients
├── shared/schema.js       # Drizzle ORM schema (single source of truth)
├── migrations/            # Drizzle migrations
└── python-backend/        # FastAPI DSP service (deployed to HF Spaces)
    ├── main.py            # API: GET /  |  POST /analyze?mode=song|exercise
    ├── analyzer.py        # SingingEvaluator orchestration
    ├── models/            # PyTorch model definitions + weights
    └── checkpoints/       # Trained checkpoints (best.pt per model)
```

---

## Running Locally

### 1. Next.js app

```bash
npm install
cp .env.example .env   # fill in your keys
npm run db:push        # create schema in your Postgres
npm run db:seed        # seed exercises + songs
npm run dev            # http://localhost:3000
```

### 2. Python backend (optional — real acoustic scores)

```bash
cd python-backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```

Set `PYTHON_BACKEND_URL=http://localhost:8000` in `.env` (defaults to this when unset). Without it, the app falls back to LLM-only analysis and numeric scores read 0.

---

## Environment Variables

```env
# Database (Neon / any Postgres)
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# AI Providers
GROQ_API_KEY=gsk_...            # transcription + coaching (free tier)
OPENAI_API_KEY=sk-...           # optional fallback
GOOGLE_GEMINI_API_KEY=AIza...   # audience reactions

# Python DSP backend
PYTHON_BACKEND_URL=https://<your-space>.hf.space

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CALLBACK_URL=https://<your-domain>/api/auth/google/callback
```

---

## Deployment

The app deploys entirely on free tiers. See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for the full walkthrough:

1. **Vercel** — import the GitHub repo, add the environment variables above, deploy
2. **Neon Postgres** — create via Vercel Storage → Neon integration, then `npm run db:push && npm run db:seed` against it
3. **Hugging Face Spaces** — Docker Space serving `python-backend/` on port 7860 (CPU-only torch + torchaudio from the PyTorch CPU index)
4. **Google Console** — add `<domain>/api/auth/google/callback` to authorized redirect URIs

Pushes to `main` auto-deploy on Vercel.

### Free-tier limits worth knowing

- **HF Space sleeps after 48h idle** — first analysis after sleep takes ~1–2 min to wake
- **Analysis latency** — ~5–15 s per recording on the free 2 vCPU tier
- **Neon** — 0.5 GB storage, 100 compute-hours/month

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm start            # Production server
npm run db:push      # Push Drizzle schema to database
npm run db:migrate   # Run SQL migrations
npm run db:seed      # Seed exercises + songs
npm test             # Jest tests
```

**Python backend tests:**

```bash
pytest python-backend/ -v
```

---

## Database Schema

- **users** — profiles, OAuth (`google_id`), learning path, streaks, bootcamp dates
- **exercises** — 48 exercises across 3 phases with `target_metrics` (JSONB)
- **exercise_progress** — completion records with per-metric scores
- **voice_analysis** — full analysis results
- **songs** — repertoire with lyrics and backing tracks
- **practice_routines** — AI-generated, path-weighted routines
- **performances** — Performance Mode records with `audienceReactions` (JSONB)

---

## Security

- Password policy: 8+ chars with uppercase, lowercase, number, special character
- Hashed credentials, signed session cookies
- All secrets via environment variables — never committed

---

## Acknowledgments

- Groq for near-instant Whisper transcription and Llama 3.3 inference
- CREPE / torchcrepe for pitch detection
- Google Gemini for generative audience reactions
- Radix UI, Drizzle ORM, Neon, Vercel, and Hugging Face for the free-tier infrastructure
