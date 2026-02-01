# SmallBets.live

Real-time micro-betting platform for friends watching live events together.

## Project Structure

```
smallbets.live/
├── frontend/          # React + TypeScript + Vite
├── backend/           # FastAPI + Python
├── templates/         # Event templates (JSON)
├── SPEC.md           # Product specification
├── CLAUDE.md         # Project context
└── ARCHITECTURE.md   # Architecture documentation
```

## Quick Start

### Backend
```bash
cd backend
uv venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
uv pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Firebase SDK
- **Backend**: FastAPI, Python 3.11+, Firebase Admin SDK
- **Database**: Google Cloud Firestore
- **Hosting**: Firebase Hosting
- **Deployment**: Google Cloud Run (backend), Firebase Hosting (frontend)

## Development

See [SPEC.md](./SPEC.md) for implementation plan and [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture patterns and review workflow.

## Target MVP

- Grammy Awards 2026 (Feb 2, 2026)
- Basic automation with manual fallback
- 2-week development timeline
