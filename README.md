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

## Features

- **Single Event Rooms**: Create/join rooms for ceremonies (Oscars, Grammys, Super Bowl)
- **Tournament Mode**: Multi-match tournaments (IPL, T20 World Cup) with aggregate leaderboard
- **Cricket Quick-Fire Templates**: One-tap bet creation for live cricket matches
- **Real-time Sync**: All participants see live updates via Firestore listeners
- **Session Restoration**: Unique user links for rejoining without accounts
- **Animated Leaderboard**: Position changes, point deltas, and medal rankings
- **Host Tools**: Auto-lock on timer, one-tap resolve, bet queue, sticky action bar
- **Bet Resolution Feedback**: Win/loss animations with confetti and point overlays
- **Onboarding**: First-time user guide and host tutorial
- **Cricket Theming**: IPL team colors, match headers, cricket-specific UI

See [CLAUDE.md](./CLAUDE.md) for architectural context, [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture documentation, and [specs/AUDIT-quality-review.md](./specs/AUDIT-quality-review.md) for the quality audit and improvement plan.

## Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.11+** with `uv` installed ([Install uv](https://github.com/astral-sh/uv))
- **Java 21+** for Firebase emulators: `brew install openjdk@21` (macOS) or [Download Java 21](https://adoptium.net/)
- **Firebase CLI** for emulators: `npm install -g firebase-tools`

### Step 1: Clone and Navigate
```bash
git clone https://github.com/ravigummadi/smallbets.live.git
cd smallbets.live
```

### Step 2: Start Firebase Emulators

**Open terminal #1:**
```bash
# Start Firebase emulators (no Firebase account needed!)
firebase emulators:start --project demo-project
```

You should see:
```
✔  firestore: Emulator started at http://127.0.0.1:8080
✔  firestore: Emulator UI running at http://127.0.0.1:4000
```

🎯 **Leave this terminal running** - this is your local Firebase database

### Step 3: Backend Setup

**Open terminal #2:**
```bash
cd backend

# Create virtual environment
uv venv

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Start the backend (using startup script with correct env vars)
./start_dev.sh
```

You should see:
```
🔧 Using Firebase Emulator for local development
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ Backend running at http://localhost:8000
📚 API docs at http://localhost:8000/docs

### Step 4: Frontend Setup

**Open terminal #3:**
```bash
cd frontend

# Install dependencies
npm install

# Create .env file (uses emulator by default)
cp .env.example .env

# Start the frontend
npm run dev
```

You should see:
```
🔧 Using Firebase Emulator for local development
  ➜  Local:   http://localhost:5173/
```

✅ Frontend running at http://localhost:5173

### Step 5: Test the App

1. Open http://localhost:5173 in your browser
2. Click **"Create New Room"**
3. Enter a nickname (e.g., "Alice")
4. Select **"Grammy Awards 2026"** template
5. Click **"Create Room"**
6. You should see the room page with 1000 points
7. Use the sticky action bar at the bottom to control the event (host only)

**Test with multiple users:**
- Open http://localhost:5173 in an incognito/private window
- Click **"Join Room"**
- Enter the room code from step 6
- Enter a different nickname (e.g., "Bob")
- Both users should see each other in the participants list

### Common Issues

**"vite: command not found"**
- Solution: Run `npm install` in the frontend directory first

**"No virtual environment found"**
- Solution: Run `uv venv` in the backend directory, then activate it with `source .venv/bin/activate`

**"File ./service-account-key.json was not found"**
- Solution: You forgot to start Firebase emulators! Run `firebase emulators:start --project demo-project` in terminal #1
- Note: The backend requires `emulator-service-account.json` (included in repo) to initialize Firebase Admin SDK, even when using emulators

**"firebase: command not found"**
- Solution: Install Firebase CLI: `npm install -g firebase-tools`

**"Java version before 21" or Java-related errors**
- Solution: Firebase emulators require Java 21+. Install with `brew install openjdk@21` (macOS) or download from [Adoptium](https://adoptium.net/)

**"Module not found" errors**
- Backend: Run `uv pip install -r requirements.txt` (after activating venv)
- Frontend: Run `npm install`

**"Connection refused to localhost:8080"**
- Solution: Firebase emulators are not running. Start them with `firebase emulators:start --project demo-project`

**"Could not reach Cloud Firestore backend" or credential errors**
- Solution: Environment variables must be set BEFORE Python starts. Always use `./start_dev.sh` script (don't run `uvicorn` directly)
- The script sets `FIRESTORE_EMULATOR_HOST` and other variables before starting the server

**Port already in use**
- Firestore emulator (8080): Change port in `firebase.json`
- Backend (8000): Change `API_PORT` in backend/.env
- Frontend (5173): Vite will automatically prompt you to use a different port

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Firebase SDK
- **Backend**: FastAPI, Python 3.11+, Firebase Admin SDK
- **Database**: Google Cloud Firestore
- **Hosting**: Firebase Hosting
- **Deployment**: Google Cloud Run (backend), Firebase Hosting (frontend)

## Development

See [SPEC.md](./SPEC.md) for implementation plan and [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture patterns and review workflow.

## Target Events

- **T20 World Cup Final**: March 11-12, 2026
- **IPL 2026**: March 28 onwards
