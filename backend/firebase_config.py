"""Firebase configuration and initialization

IMPERATIVE SHELL: This module handles Firebase Admin SDK initialization
"""

import os
from typing import Optional

# Import firebase_admin
import firebase_admin
from firebase_admin import credentials, firestore

# Global Firebase app instance
_app: Optional[firebase_admin.App] = None
_db: Optional[firestore.Client] = None


def initialize_firebase() -> firestore.Client:
    """Initialize Firebase Admin SDK

    Imperative Shell - performs I/O (reads credentials, initializes SDK)

    Returns:
        Firestore client instance
    """
    global _app, _db

    if _db is not None:
        return _db

    # Check if using emulator (set via environment variable)
    emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        if emulator_host:
            # Local development with emulator
            print(f"🔧 Using Firebase Emulator at {emulator_host}")

            # Try to load credentials from file if available
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                _app = firebase_admin.initialize_app(cred)
            else:
                # No credentials file - will fail
                # Emulator needs SOME credential to init, even if it doesn't use it
                raise RuntimeError(
                    "GOOGLE_APPLICATION_CREDENTIALS must be set when using emulators. "
                    "Use the dummy file: export GOOGLE_APPLICATION_CREDENTIALS=./emulator-service-account.json"
                )
        else:
            # Production - credentials required
            print("🚀 Using production Firebase")
            _app = firebase_admin.initialize_app()

    _db = firestore.client()
    return _db


def get_db() -> firestore.Client:
    """Get Firestore database client

    Imperative Shell - returns initialized database client

    Returns:
        Firestore client instance

    Raises:
        RuntimeError if Firebase not initialized
    """
    if _db is None:
        return initialize_firebase()
    return _db
