/**
 * Join Room page - User joins an existing room
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomApi } from '@/services/api';
import { useSession } from '@/hooks/useSession';

export default function JoinRoomPage() {
  const { code } = useParams<{ code?: string }>();
  const [roomCode, setRoomCode] = useState(code?.toUpperCase() || '');
  const [nickname, setNickname] = useState('');
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

    if (roomCode.length !== 4) {
      setError('Room code must be 4 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Join room via API
      const response = await roomApi.joinRoom(roomCode, {
        nickname: nickname.trim(),
      });

      // Save session
      saveSession({
        userId: response.user_id,
        roomCode: roomCode,
      });

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
            placeholder="Enter 4-character code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={4}
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
          disabled={loading || !nickname.trim() || roomCode.length !== 4}
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
