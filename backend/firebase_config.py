"""Firebase configuration and initialization

IMPERATIVE SHELL: This module handles Firebase Admin SDK initialization
"""

import os
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        # Check if running in production (Cloud Run) or local dev
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        if credentials_path and os.path.exists(credentials_path):
            # Local development with service account key
            cred = credentials.Certificate(credentials_path)
            _app = firebase_admin.initialize_app(cred)
        else:
            # Production (Cloud Run) - use default credentials
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
