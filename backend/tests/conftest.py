"""
Pytest configuration and fixtures for SmallBets.live tests

This file provides shared fixtures for:
- Firebase Emulator lifecycle management
- Test database cleanup
- Mock data generation
"""

import os
import pytest
from typing import Generator
import subprocess
import time
import socket


def is_port_open(host: str, port: int) -> bool:
    """Check if a port is open"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex((host, port))
    sock.close()
    return result == 0


@pytest.fixture(scope="session")
def firebase_emulator() -> Generator[None, None, None]:
    """
    Start Firebase emulators for the entire test session.

    This fixture starts the emulators once at the beginning of the test session
    and stops them at the end. All tests share the same emulator instance.
    """
    # Set emulator host before starting
    os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "emulator-service-account.json"
    )

    # Check if emulator is already running
    if is_port_open("localhost", 8080):
        print("Firebase emulator already running on port 8080")
        yield
        return

    print("Starting Firebase emulators...")

    # Start emulators
    emulator_process = subprocess.Popen(
        ["firebase", "emulators:start", "--project", "demo-test"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    )

    # Wait for emulators to be ready
    max_attempts = 30
    for attempt in range(max_attempts):
        if is_port_open("localhost", 8080):
            print(f"Firebase emulators ready after {attempt + 1} attempts")
            break
        time.sleep(1)
    else:
        emulator_process.kill()
        raise RuntimeError("Firebase emulators failed to start within 30 seconds")

    yield

    # Cleanup: stop emulators
    print("Stopping Firebase emulators...")
    emulator_process.terminate()
    emulator_process.wait(timeout=10)


@pytest.fixture(scope="function")
def clean_firestore(firebase_emulator):
    """
    Clean Firestore data before each test.

    This fixture depends on firebase_emulator and runs before each test function.
    It clears all Firestore data to ensure test isolation.
    """
    # Import here to avoid issues when emulator is not running
    from firebase_admin import firestore
    from firebase_config import initialize_firebase

    db = initialize_firebase()

    # Clear all collections (you may want to add more as your schema grows)
    collections = ['rooms', 'users', 'bets', 'user_bets', 'transcripts']

    for collection_name in collections:
        collection_ref = db.collection(collection_name)
        docs = collection_ref.stream()
        for doc in docs:
            doc.reference.delete()

    yield db


@pytest.fixture
def sample_room_data():
    """Sample room data for testing"""
    return {
        "code": "TEST123",
        "host_id": "host-user-id",
        "event_name": "Test Event 2025",
        "status": "waiting",
        "created_at": None,  # Will be set by Firestore
    }


@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return {
        "id": "test-user-id",
        "nickname": "TestUser",
        "room_code": "TEST123",
        "points": 1000,
        "is_host": False,
        "joined_at": None,  # Will be set by Firestore
    }


@pytest.fixture
def sample_bet_data():
    """Sample bet data for testing"""
    return {
        "id": "test-bet-id",
        "room_code": "TEST123",
        "question": "Who will win Best Picture?",
        "options": ["Movie A", "Movie B", "Movie C"],
        "status": "pending",
        "created_at": None,  # Will be set by Firestore
    }
