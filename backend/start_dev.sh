#!/bin/bash
# Development startup script for backend with Firebase Emulator

# Set environment variables for Firebase Emulator
export FIRESTORE_EMULATOR_HOST="localhost:8080"
export FIREBASE_PROJECT_ID="demo-project"
export USE_FIREBASE_EMULATOR="true"
export GCLOUD_PROJECT="demo-project"
export GOOGLE_APPLICATION_CREDENTIALS="./emulator-service-account.json"

# Start uvicorn
echo "🔧 Starting backend with Firebase Emulator..."
uvicorn main:app --reload --port 8000
