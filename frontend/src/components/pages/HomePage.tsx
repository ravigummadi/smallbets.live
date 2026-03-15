/**
 * Home page - Entry point for users
 */

import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      navigate(`/join/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <div className="text-center mb-xl">
        <h1>SmallBets<span style={{ color: 'var(--color-accent-pink)' }}>.live</span></h1>
        <p className="text-secondary" style={{ fontWeight: 500, fontSize: '1.1rem' }}>
          Bet on anything with friends. No money, just bragging rights.
        </p>
      </div>

      <div className="card mb-lg">
        <h3 className="mb-md" style={{ fontSize: '1.125rem' }}>Join a Room</h3>
        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            placeholder="Enter room code (e.g. BLUE42)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="mb-md"
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={roomCode.length < 4}
          >
            Join Room
          </button>
        </form>
      </div>

      <div className="text-center">
        <p className="text-muted mb-md">or</p>
        <Link to="/create" className="btn btn-secondary btn-full">
          Create New Room
        </Link>
      </div>

      <div className="mt-xl text-center text-muted" style={{ fontSize: '0.875rem' }}>
        <p>No accounts needed. Virtual points only.</p>
        <p className="mt-sm">Perfect for watching awards shows, sports, and live events with friends.</p>
      </div>
    </div>
  );
}
