"""Transcript service - Firestore operations for transcripts

IMPERATIVE SHELL: This module performs I/O operations
"""

import uuid
from datetime import datetime
from typing import Optional, List
from google.cloud import firestore

from models.transcript import TranscriptEntry
from firebase_config import get_db


async def create_transcript_entry(
    room_code: str,
    text: str,
    source: str = "manual"
) -> TranscriptEntry:
    """Create a new transcript entry

    Imperative Shell - performs Firestore write

    Args:
        room_code: Room code
        text: Transcript text
        source: Source of transcript (manual|youtube|webhook)

    Returns:
        Created TranscriptEntry object
    """
    db = get_db()

    # Generate unique entry ID
    entry_id = str(uuid.uuid4())

    # Create transcript entry (pure)
    entry = TranscriptEntry(
        entry_id=entry_id,
        room_code=room_code,
        text=text,
        timestamp=datetime.utcnow(),
        source=source,
    )

    # Write to Firestore (I/O)
    entry_ref = db.collection("transcripts").document(room_code).collection("entries").document(entry_id)
    entry_ref.set(entry.to_dict())

    return entry


async def get_transcript_entries(
    room_code: str,
    limit: int = 100
) -> List[TranscriptEntry]:
    """Get recent transcript entries for a room

    Imperative Shell - performs Firestore query

    Args:
        room_code: Room code
        limit: Maximum number of entries to return

    Returns:
        List of TranscriptEntry objects (newest first)
    """
    db = get_db()

    # Query Firestore (I/O)
    entries_ref = (
        db.collection("transcripts")
        .document(room_code)
        .collection("entries")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    entries_docs = entries_ref.stream()

    # Deserialize (pure)
    entries = [TranscriptEntry.from_dict(doc.to_dict()) for doc in entries_docs]

    return entries


async def get_latest_transcript_entry(room_code: str) -> Optional[TranscriptEntry]:
    """Get the most recent transcript entry

    Imperative Shell - performs Firestore query

    Args:
        room_code: Room code

    Returns:
        Latest TranscriptEntry or None
    """
    entries = await get_transcript_entries(room_code, limit=1)
    return entries[0] if entries else None


async def delete_transcript_entries(room_code: str) -> None:
    """Delete all transcript entries for a room

    Imperative Shell - performs Firestore deletes

    Args:
        room_code: Room code
    """
    db = get_db()

    # Delete all entries in subcollection
    entries_ref = db.collection("transcripts").document(room_code).collection("entries")

    # Batch delete
    batch = db.batch()
    for doc in entries_ref.stream():
        batch.delete(doc.reference)

    batch.commit()

    # Delete parent document
    transcript_ref = db.collection("transcripts").document(room_code)
    transcript_ref.delete()
