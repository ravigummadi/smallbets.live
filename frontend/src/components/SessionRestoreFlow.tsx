/**
 * SessionRestoreFlow - Session restoration via userKey link
 * Extracted from RoomPage to reduce component size
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/services/api';
import type { User } from '@/types';

interface SessionRestoreFlowProps {
  code: string;
  userKey: string;
  existingSession: { userId: string; roomCode: string; hostId?: string; nickname?: string } | null;
  onSessionRestored: (session: { userId: string; roomCode: string; hostId?: string; nickname: string }) => void;
}

export default function SessionRestoreFlow({
  code,
  userKey,
  existingSession,
  onSessionRestored,
}: SessionRestoreFlowProps) {
  const navigate = useNavigate();
  const [restoreUser, setRestoreUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    roomApi.getUserByKey(code, userKey)
      .then((userData) => {
        const hasConflictingSession = existingSession && existingSession.roomCode !== code;
        if (hasConflictingSession) {
          setRestoreUser(userData);
          setShowModal(true);
        } else {
          onSessionRestored({
            userId: userData.userId,
            roomCode: code,
            hostId: userData.isAdmin ? userData.userId : undefined,
            nickname: userData.nickname,
          });
        }
      })
      .catch((err: any) => {
        if (err.status === 429) {
          setError('Too many requests. Please try again later.');
        } else if (err.status === 404) {
          setError('This link is invalid or the user was not found.');
        } else if (err.status === 400) {
          setError('Invalid link format.');
        } else {
          setError('Failed to restore session. Please try again.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userKey, code]);

  const handleConfirmRestore = () => {
    if (!restoreUser) return;
    onSessionRestored({
      userId: restoreUser.userId,
      roomCode: code,
      hostId: restoreUser.isAdmin ? restoreUser.userId : undefined,
      nickname: restoreUser.nickname,
    });
    setShowModal(false);
    setRestoreUser(null);
  };

  const handleCancelRestore = () => {
    setShowModal(false);
    setRestoreUser(null);
    if (existingSession && existingSession.roomCode === code) {
      // Already have a session for this room, just stay
    } else {
      navigate(`/join/${code}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="spinner" />
        <p className="text-center text-muted">Restoring session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="card text-center">
          <p className="text-error">{error}</p>
          <button
            className="btn btn-secondary mt-md"
            onClick={() => navigate(`/join/${code}`)}
          >
            Join Room Instead
          </button>
        </div>
      </div>
    );
  }

  if (showModal && restoreUser) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="card">
          <h3 className="mb-md">Restore Session</h3>
          <p className="mb-md">
            Continue as <strong>{restoreUser.nickname}</strong>? You have{' '}
            <strong>{restoreUser.points}</strong> points.
          </p>
          <div className="session-restore-buttons">
            <button className="btn btn-primary session-restore-btn" onClick={handleConfirmRestore}>
              Continue as {restoreUser.nickname}
            </button>
            <button className="btn btn-secondary session-restore-btn" onClick={handleCancelRestore}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Still loading/processing
  return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <div className="spinner" />
    </div>
  );
}
