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
  const navigate = useNavigate();
  const { saveSession } = useSession();

  useEffect(() => {
    if (code) {
      setRoomCode(code.toUpperCase());
    }
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

      // Navigate to room
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      if (err.status === 404) {
        setError(`Room "${roomCode}" not found`);
      } else {
        setError(err.detail || 'Failed to join room. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <h2 className="mb-lg" style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}>Join a Room</h2>

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
