#!/bin/bash
# Firebase Emulator Setup Script for Tests
# Starts Firebase emulators and waits for readiness

set -e

echo "Starting Firebase emulators for testing..."

# Start emulators in background
firebase emulators:start --project demo-test &
EMULATOR_PID=$!

# Wait for emulators to be ready (check Firestore port)
echo "Waiting for emulators to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if nc -z localhost 8080 2>/dev/null; then
        echo "Firebase emulators are ready!"
        exit 0
    fi
    attempt=$((attempt + 1))
    echo "Attempt $attempt/$max_attempts - waiting..."
    sleep 1
done

echo "ERROR: Firebase emulators failed to start within 30 seconds"
kill $EMULATOR_PID 2>/dev/null || true
exit 1
