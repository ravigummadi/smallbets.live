/**
 * Home page - Entry point for users
 * Redesigned with hero section, feature cards, and how-it-works
 */

import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyRooms } from '@/hooks/useMyRooms';

export default function HomePage() {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();
  const { rooms: myRooms, removeRoom } = useMyRooms();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      navigate(`/join/${roomCode.toUpperCase()}`);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="container hero-content">
          <div className="hero-icon">🎲</div>
          <h1 className="hero-title">
            SmallBets<span className="hero-title-accent">.live</span>
          </h1>
          <p className="hero-subtitle">
            Bet on anything with friends while watching live events.
            No money, no accounts &mdash; just bragging rights.
          </p>

          <div className="hero-actions">
            <form onSubmit={handleJoinRoom} className="hero-join-form">
              <input
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="hero-input"
              />
              <button
                type="submit"
                className="btn btn-outline-light"
                disabled={roomCode.length < 4}
              >
                Join &rsaquo;
              </button>
            </form>
            <Link to="/create" className="btn btn-outline-light btn-lg hero-create-btn">
              Create New Room &rsaquo;
            </Link>
          </div>

          <div
            className="scroll-hint"
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span>How It Works</span>
            <span className="scroll-hint-chevron">&#8964;</span>
          </div>
        </div>
      </section>

      {/* My Rooms */}
      {myRooms.length > 0 && (
        <section className="container my-rooms-section">
          <h2 className="section-title">My Rooms</h2>
          <div className="my-rooms-list">
            {myRooms.map((room) => (
              <div key={room.roomCode} className="my-room-card">
                <div className="my-room-info">
                  <div className="my-room-name">
                    {room.eventName}
                    {room.isTournament && (
                      <span className="my-room-badge">Tournament</span>
                    )}
                    {room.isHost && (
                      <span className="my-room-badge my-room-badge--host">Host</span>
                    )}
                  </div>
                  <div className="my-room-code">Code: {room.roomCode}</div>
                </div>
                <div className="my-room-actions">
                  <Link
                    to={`/room/${room.roomCode}/u/${room.userKey}`}
                    className="btn btn-primary btn-xs"
                  >
                    Open
                  </Link>
                  <button
                    className="btn btn-secondary btn-xs"
                    onClick={() => removeRoom(room.roomCode)}
                    title="Remove from list"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How It Works */}
      <section id="how-it-works" className="container how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h4 className="step-title">Create or Join</h4>
            <p className="step-desc">
              Create a room for any live event, or join a friend's room with a short code.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h4 className="step-title">Place Your Bets</h4>
            <p className="step-desc">
              Predict outcomes in real-time &mdash; who wins Best Picture, the next touchdown, or the Gatorade color.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h4 className="step-title">Win Bragging Rights</h4>
            <p className="step-desc">
              See live leaderboards update instantly. No money involved &mdash; just virtual points and glory.
            </p>
          </div>
        </div>
      </section>

      {/* Event Templates */}
      <section className="container events-section">
        <h2 className="section-title">Built For Any Event</h2>
        <div className="events-grid">
          <div className="event-card">
            <span className="event-icon">🏆</span>
            <span className="event-name">Award Shows</span>
            <span className="event-detail">Oscars, Grammys, Emmys</span>
          </div>
          <div className="event-card">
            <span className="event-icon">🏈</span>
            <span className="event-name">Sports</span>
            <span className="event-detail">Super Bowl, World Cup, IPL</span>
          </div>
          <div className="event-card">
            <span className="event-icon">🎤</span>
            <span className="event-name">Live Shows</span>
            <span className="event-detail">Reality TV, Debates, Concerts</span>
          </div>
          <div className="event-card">
            <span className="event-icon">🎯</span>
            <span className="event-name">Anything</span>
            <span className="event-detail">Custom events, game nights</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container cta-section">
        <div className="cta-card">
          <h3>Ready to play?</h3>
          <p className="text-secondary">No signup required. Just create a room and share the code.</p>
          <Link to="/create" className="btn btn-primary btn-lg">
            Get Started &rsaquo;
          </Link>
        </div>
      </section>
    </div>
  );
}
