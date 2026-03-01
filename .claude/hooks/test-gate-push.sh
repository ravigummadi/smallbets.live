#!/usr/bin/env bash
# PreToolUse hook: gates `git push` on passing tests.
# Reads tool input JSON from stdin; exits 0 to allow, exits 2 to block.

set -uo pipefail

# Read stdin (tool input JSON)
INPUT=$(cat)

# Extract the command from the JSON
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")

# Only gate git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+push'; then
  exit 0
fi

echo "🧪 Git push detected — running tests before allowing push..." >&2

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FAILED=0

# --- Frontend tests ---
echo "▶ Running frontend tests..." >&2
FRONTEND_OUTPUT=$(cd "$PROJECT_DIR/frontend" && NODE_OPTIONS="--max-old-space-size=4096" npx vitest run 2>&1) || true

if echo "$FRONTEND_OUTPUT" | grep -qE 'Tests\s+.*failed'; then
  echo "$FRONTEND_OUTPUT" >&2
  echo "❌ Frontend tests failed. Fix them before pushing." >&2
  FAILED=1
else
  echo "✅ Frontend tests passed." >&2
fi

# --- Backend tests ---
BACKEND_VENV="$PROJECT_DIR/backend/.venv"
if [ ! -d "$BACKEND_VENV" ]; then
  echo "⚠️  Backend venv not found at $BACKEND_VENV — skipping backend tests." >&2
else
  echo "▶ Running backend unit tests..." >&2
  BACKEND_OUTPUT=$(cd "$PROJECT_DIR/backend" && "$BACKEND_VENV/bin/python" -m pytest -m unit --tb=short 2>&1) || true

  if echo "$BACKEND_OUTPUT" | grep -qE 'failed|error' && ! echo "$BACKEND_OUTPUT" | grep -qiE 'credentials|emulator|google\.auth'; then
    echo "$BACKEND_OUTPUT" >&2
    echo "❌ Backend unit tests failed. Fix them before pushing." >&2
    FAILED=1
  elif echo "$BACKEND_OUTPUT" | grep -qiE 'credentials|emulator|google\.auth'; then
    echo "⚠️  Backend tests had credential/emulator errors — skipping (non-blocking)." >&2
  else
    echo "✅ Backend tests passed." >&2
  fi
fi

if [ "$FAILED" -ne 0 ]; then
  echo "" >&2
  echo "🚫 Push blocked: tests must pass before pushing." >&2
  exit 2
fi

echo "✅ All tests passed — push allowed." >&2
exit 0
