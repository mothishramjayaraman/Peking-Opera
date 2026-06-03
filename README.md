# SingingAI v2

A comprehensive AI-powered vocal training application with real-time voice analysis, personalized learning paths, and achievement tracking.

---

### Executive Summary

SingingAI v2 represents a major leap forward in AI-driven vocal pedagogy, combining state-of-the-art voice analysis with a highly personalized and gamified learning experience. Leveraging OpenAI, Groq (Llama 3), and Google Gemini, the platform provides instantaneous, high-fidelity feedback on pitch, tone, and breath control.

---

## Features

- **Advanced Voice Analysis** - 10-metric real-time feedback (pitch, tone, vibrato, breathing, expression, recording quality, etc.)
- **Dual-Mode Analysis** - Context-aware scoring for songs (artistic) vs exercises (technical stability)
- **Email Confirmation** - Automated welcome emails via EmailJS integration
- **Security Hardening** - Strict password validation (8+ characters, uppercase, lowercase, numbers, special characters)
- **Multi-Auth Support** - Email/password + Google OAuth 2.0 integration
- **Learning Paths** - 6 different learning paths (Structured, Intensive, Performance, Adaptive, Competitive, Flexible)
- **3-Phase System** - Progressive learning from Foundation to Performance
- **24 Exercises** - 8 exercises per phase with target metrics for focused training
- **Streak Tracking** - Dynamic 7-day performance tracking with effective streak computation
- **Song Library** - 10+ songs with lyrics and backing tracks
- **AI Practice Routines** - Dynamic routines weighted by learning path
- **Performance Mode** - Virtual stage simulator with AI-generated audience reactions (Google Gemini)
- **Dashboard** - Comprehensive stats, 7-day metrics, and performance integration
- **Generative Feedback** - Groq LLM-powered coaching with detected mistakes & technical strengths
- **Glassmorphism UI** - Modern dropdowns and premium aesthetics

#### Database Setup & Migration

1. **Configure Environment**: Set your `DATABASE_URL` in `.env`.
2. **Run Migration**:
   - **Windows**: `.\migrate.ps1`
   - **Cross-platform**: `npm run db:migrate`
3. **Seed Data**: `npm run db:seed` (Required for exercises).

#### Running Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run check        # TypeScript type checking
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with initial data
```

## Architecture & Tech Stack

### System Design

SingingAI v2 follows a multi-tier architecture:

- **Frontend**: React 18 with Vite, Tailwind CSS for premium aesthetics, and Framer Motion for micro-animations.
- **Backend**: Express.js server with Drizzle ORM and Passport.js for secure authentication.

### AI Engine

Integrated support for high-performance AI models:

- **OpenAI**: Uses `whisper-1` for high-accuracy vocal transcription and `gpt-4o` for stylistic and technical vocal analysis.
- **Groq**: Leverages `whisper-large-v3` for near-instant transcription and `llama-3.3-70b-versatile` for rapid performance evaluation.
- **Google Gemini**: Utilizes `gemini-1.5-flash-latest` for audience reaction generation and multimodal audio feedback.
- **Hybrid Fallback**: Intelligent error handling that ensures a smooth user experience—if one API is down or hits a limit, the others take over!

### AI Model Optimizations

#### **Advanced Acoustic Analysis**

- **Selective Audio Normalization**: RMS-normalization (-20 dBFS) applied intelligently for pitch/tone/vibrato; raw signal preserved for breath and expression metrics
- **Silent Recording Detection**: Early exit with RMS < 0.001 for instant feedback
- **Recording Quality Estimation**: Three-signal assessment combining voiced ratio, SNR score, and CREPE confidence (0-1 normalized)

#### **Pitch & Tone Analysis**

- **Dynamic Sensitivity Logic**: Exercise mode uses tight thresholds (0.3) for precision; song mode relaxed (0.7) for artistic flexibility
- **Segmented Pitch Analysis**: Splits contours on detected jumps for per-segment stability analysis
- **Dual Scoring**: `pitch_score` (overall accuracy, 0.7x multiplier) + `tsi` (Tone Stability Index, 0.4x multiplier)
- **Adaptive Filtering**: Kernel size 3 for exercises, 7 for songs

#### **Expression & Dynamics**

- **Coefficient of Variation (CV)**: Exercise mode rewards steady volume; song mode rewards dynamic contrast
- **MFCC-Based Timbre Analysis**: 13 MFCC coefficients across active frames for emotional coloring detection

#### **Specialized Models**

- **VocalPitchModel**: CREPE-based pitch detection with CPU optimization (tiny model) and GPU fallback
- **VibratoMetricsModel**: FFT-based vibrato extraction (3-9 Hz), calculates rate, extent (cents), and consistency
- **BreathConformer**: CNN + Transformer architecture for acoustic event detection with 2x MaxPool and 2-layer Transformer (4 heads)
- **AdvancedBreathAnalyzer**: Multi-feature fusion (mel-spectrograms, deltas, ZCR, spectral flatness, RMS) with intelligent fallback and VAD-gating
- **ToneMetricsModel**: Harmonic-to-Noise Ratio (HNR) + spectral centroid brightness measurement

#### **10-Metric Vocal Analysis**

Comprehensive performance evaluation:

1. **Pitch Accuracy** - Note hitting precision
2. **Tone Stability (TSI)** - Vocal smoothness and consistency
3. **Breathing Consistency** - Breath control and placement
4. **Vibrato Quality** - Rate, extent, and consistency (3-9 Hz)
5. **Expression/Dynamics** - Emotional variation and contrast
6. **Recording Quality** - SNR and clarity estimate
7. **Overall Score** - Weighted composite
8. **Performance Score** - Stage presence simulation
9. **Audience Feedback** - AI-generated reactions
10. **Coaching Feedback** - Actionable LLM suggestions

### Core Technologies

- **UI/UX**: Radix UI, Lucide Icons, Shadcn-inspired components, Glassmorphism effects.
- **State Management**: TanStack Query (React Query) for efficient data fetching.
- **Email Delivery**: EmailJS for client-side automated notifications.
- **Performance**: Groq SDK for near-instant AI inference.
- **Audio Processing**: Librosa, SciPy, NumPy for signal processing; FastAPI for Python backend.
- **Deep Learning**: PyTorch, TorchCREPE for pitch detection and model inference.
- **ORM**: Drizzle ORM with type-safe schema generation.
- **Validation**: Zod for runtime schema validation.
- **Testing**: Pytest for Python backend testing.

## Project Structure

```
singingAI-v2/
├── client/src/          # Frontend React application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and helpers
├── server/              # Backend Express application
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Data access layer
│   ├── auth.ts          # Authentication logic
│   └── *.ts             # Services and utilities
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database schema
└── migrations/          # Database migrations
```

## Learning Paths & Progression

The curriculum is structured around a **3-Phase System**:

1. **Foundation**: Build strength with essential techniques (breathing, basic pitch).
2. **Technique & Expression**: Develop emotional resonance and advanced skills.
3. **Performance & Confidence**: Master stage presence and microphone technique.

#### Specialized Paths (with Dynamic Routine Weighting)

- **Structured Progressive** (40% warmup, 35% technique, 25% performance): Logical, step-by-step path for beginners.
- **Intensive Bootcamp** (25% warmup, 55% technique, 20% performance): Fast-paced, high-commitment daily practice.
- **Performance-First** (30% warmup, 40% technique, 30% performance): Rapid climb to stage-readiness and repertoire building.
- **Adaptive** (Balanced 33/33/33): AI-Adaptive recommendations based on your unique vocal profile.
- **Competitive** (Random allocation): Challenge-focused with community comparisons.
- **Flexible Explorer** (Custom): Full control to choose your own vocal journey.

## Database Schema

#### Core Tables

- **users** - User profiles with OAuth support, learning path selection, streak tracking
  - New fields: `google_id`, `email`, `learning_path`, `last_practice_date`, `bootcamp_start_date`
- **exercises** - Exercise definitions with target metrics
  - New field: `target_metrics` (JSONB array of focus areas)
- **exercise_progress** - User exercise completion with detailed scores
- **voice_analysis** - AI analysis results (10 metrics)
- **songs** - Song library with metadata
- **practice_routines** - AI-generated routines with dynamic weighting by path
- **performances** - Performance records with reactions and stage effects
  - Fields: `performanceScore`, `audienceReactions` (JSONB), `stageEffects`, `performedAt`

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/singingai

# AI Providers
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
GOOGLE_GEMINI_API_KEY=AIza...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Server
PORT=3000

# EmailJS (Configured in client/src/lib/email.ts)
# SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY
```

## Email Confirmation Setup (EmailJS)

SingingAI uses **EmailJS** to send welcome and confirmation emails directly from the client.

To configure your own:

1. Create an account at [emailjs.com](https://www.emailjs.com/).
2. Create a "Welcome Message" template.
3. Update the credentials in [email.ts](file:///d:/SingingAI/updates/singingAI%2031-03-2026/client/src/lib/email.ts):
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_TEMPLATE_ID`
   - `EMAILJS_PUBLIC_KEY`

## Security Standards

- **Password Requirements**:
  - Minimum 8 characters
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (e.g., !@#$%^&\*)
- **Authentication**: Secure password hashing and Passport.js session management.

## API Endpoints & Improvements

### Audio Analysis

- **POST /api/analyze-audio** - Two-tier analysis: Python backend (acoustic signals) + Groq LLM (qualitative coaching)
  - Returns: 10 vocal metrics, generative feedback, detected mistakes, technical strengths

### Performance Tracking

- **GET /api/performances** - Retrieve user performance history
- **POST /api/performances** - Create performance records with audience reactions

### Dashboard

- **GET /api/dashboard** - Comprehensive metrics with effective streak computation
  - Features: 7-day statistics, performance integration, week stats calculation

### Generative AI

- **POST /api/generate-reactions** - Google Gemini integration for audience feedback
  - Returns: warmth, authenticity, encouraging feedback

### Authentication

- **POST /api/auth/google/callback** - Google OAuth 2.0 flow with new user detection
  - Features: duplicate account prevention, persistent Google ID storage

### Exercises

- **GET /api/exercises** - Target metrics association per exercise
  - Dynamic categorization by exercise type

## Testing & Verification

Comprehensive testing has been performed to ensure system stability and security.

### Test Results

- **Authentication**: Verified registration, login, OAuth, and secure password hashing.
- **Data Integrity**: Confirmed critical database columns and schema updates.
- **Audio Analysis**: Validated all 10 metrics across song and exercise modes.
- **Feature Flow**: Successfully validated learning path selection, milestone tracking, and AI feedback loops.
- **Performance Tracking**: Verified effective streak computation and 7-day metrics.

### Running Tests

**Frontend/Node.js:**

```bash
npm run check        # TypeScript type checking
npm run build        # Production build verification
npx tsx verify-cols.ts # Database schema verification
```

**Python Backend (pytest):**

```bash
# Install test dependencies
pip install pytest

# Run all tests
pytest python-backend/

# Run specific test file
pytest python-backend/test_api.py
pytest python-backend/test_modes.py
pytest python-backend/test_scale.py

# Run with verbose output
pytest python-backend/ -v

# Run with coverage report
pytest python-backend/ --cov
```

**Test Coverage:**

- `test_api.py` - FastAPI endpoint validation
- `test_modes.py` - Song mode vs exercise mode analysis
- `test_scale.py` - Pitch detection and scale analysis

## Frontend Enhancements

### Performance Mode

- Real-time audio capture and streaming
- Display of all 10 vocal metrics with progress indicators
- Simulated audience reactions and stage effects
- Performance history tracking

### Analysis Dashboard

- Comprehensive metric cards (pitch, tone, breathing, vibrato, expression)
- Recording quality indicator
- Generative feedback sections
- Detected mistakes and strengths highlights
- Detailed metric explanations

### Components

- **Score Display**: Normalized 0-100 visualization with progress rings
- **Waveform Visualizer**: Real-time audio visualization during recording
- **Exercise Cards**: Target metrics highlighting per exercise
- **Practice Routine Cards**: Dynamic weighting by learning path

## Recent Updates Summary (v2.1+)

| Update                | Impact                 | Module                 |
| --------------------- | ---------------------- | ---------------------- |
| Dual-mode analysis    | Context-aware scoring  | Python backend         |
| 10-metric system      | Comprehensive feedback | All audio models       |
| Groq + Whisper        | AI-powered coaching    | groq.js                |
| Google OAuth          | Multi-auth support     | auth/google/\*         |
| Performance mode      | Gamified experience    | perform/page.js        |
| Target metrics        | Focused training       | schema.js              |
| Learning paths        | Personalized curricula | 001_learning_paths.sql |
| 7-day tracking        | Progress monitoring    | dashboard/route.js     |
| Quality estimation    | Confidence scoring     | analyzer.py            |
| Breath detection (DL) | Advanced AED           | breath_model.py        |

## Final Summary & Roadmap

SingingAI v2 is ready for production, offering a sophisticated blend of AI and pedagogy.

**Future Roadmap**:

- **AI Voice Synthesis**: Personalized vocal examples.
- **Community Features**: Peer review and social challenges.
- **Advanced VR**: Immersive virtual stage environments.

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## Acknowledgments

- OpenAI for voice analysis capabilities
- Groq for fast AI inference
- Google for Gemini AI
- Radix UI for accessible components
- Drizzle ORM for type-safe database access

---
