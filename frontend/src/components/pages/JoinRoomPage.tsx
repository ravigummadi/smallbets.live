/**
 * Join Room page - User joins an existing room
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { roomApi } from '@/services/api';
import { useSession } from '@/hooks/useSession';

interface LocationState {
  fromTournament?: string;
  parentUserId?: string;
  nickname?: string;
}

export default function JoinRoomPage() {
  const { code } = useParams<{ code?: string }>();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  const [roomCode, setRoomCode] = useState(code?.toUpperCase() || '');
  const [nickname, setNickname] = useState(locationState?.nickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [validating, setValidating] = useState(false);
  const navigate = useNavigate();
  const { saveSession } = useSession();

  useEffect(() => {
    if (code) {
      setRoomCode(code.toUpperCase());
    }
  }, [code]);

  // Eagerly validate room exists when code is provided via URL
  useEffect(() => {
    if (!code || code.length < 4 || code.length > 6) return;

    setValidating(true);
    setRoomNotFound(false);
    setError(null);

    roomApi.getRoom(code.toUpperCase())
      .then(() => {
        setValidating(false);
      })
      .catch((err: any) => {
        setValidating(false);
        if (err.status === 404) {
          setRoomNotFound(true);
        }
      });
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (roomCode.length < 4 || roomCode.length > 6) {
      setError('Room code must be 4-6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Join room via API, passing parent context if navigating from tournament
      const joinRequest: { nickname: string; parent_user_id?: string } = {
        nickname: nickname.trim(),
      };
      if (locationState?.parentUserId) {
        joinRequest.parent_user_id = locationState.parentUserId;
      }

      const response = await roomApi.joinRoom(roomCode, joinRequest);

      // Save session - include hostId if the backend recognized us as host
      const sessionData: { userId: string; roomCode: string; hostId?: string; nickname?: string } = {
        userId: response.user_id,
        roomCode: roomCode,
        nickname: nickname.trim(),
      };
      if (response.host_id) {
        sessionData.hostId = response.host_id;
      }
      saveSession(sessionData);

      // Navigate to unique user URL so the user has a bookmarkable/shareable link
      if (response.user_key) {
        navigate(`/room/${roomCode}/u/${response.user_key}`);
      } else {
        navigate(`/room/${roomCode}`);
      }
    } catch (err: any) {
      if (err.status === 404) {
        setRoomNotFound(true);
      } else {
        setError(err.detail || 'Failed to join room. Please try again.');
      }
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="container page-container">
        <h2 className="mb-lg" style={{ letterSpacing: '-0.01em' }}>Join a Room</h2>
        <div className="card mb-lg">
          <p className="text-muted">Checking room...</p>
        </div>
      </div>
    );
  }

  if (roomNotFound) {
    return (
      <div className="container page-container">
        <h2 className="mb-lg" style={{ letterSpacing: '-0.01em' }}>Room Not Found</h2>

        <div className="card mb-lg" style={{ borderColor: 'var(--color-error)' }}>
          <p className="text-error" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Room &ldquo;{roomCode}&rdquo; doesn&apos;t exist
          </p>
          <p className="text-muted">
            The room code may be incorrect, or the room may have been closed.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-full btn-lg mb-md"
          onClick={() => navigate('/create')}
        >
          Create a New Room
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-full"
          onClick={() => {
            setRoomNotFound(false);
            setRoomCode('');
            setError(null);
          }}
        >
          Try a Different Code
        </button>

        <div className="mt-md text-center">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-container">
      <h2 className="mb-lg" style={{ letterSpacing: '-0.01em' }}>Join a Room</h2>

      <form onSubmit={handleSubmit}>
        <div className="card mb-lg">
          <h4 className="mb-md">Room Code</h4>
          <input
            type="text"
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="mb-md"
            autoFocus={!code}
          />
        </div>

        <div className="card mb-lg">
          <h4 className="mb-md">Your Nickname</h4>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="mb-md"
            autoFocus={!!code}
          />
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            This is how other players will see you
          </p>
        </div>

        {error && (
          <div className="card mb-lg" style={{ borderColor: 'var(--color-error)' }}>
            <p className="text-error">{error}</p>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading || !nickname.trim() || roomCode.length < 4}
        >
          {loading ? 'Joining Room...' : 'Join Room'}
        </button>

        <div className="mt-md text-center">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
