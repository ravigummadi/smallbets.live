/**
 * Room Created confirmation page
 * Shows share options after creating a room or tournament
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function RoomCreatedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedJoin, setCopiedJoin] = useState(false);

  const roomCode = searchParams.get('code') || '';
  const userKey = searchParams.get('uk') || '';
  const eventName = searchParams.get('name') || '';
  const isTournament = searchParams.get('type') === 'tournament';

  const origin = window.location.origin;
  const hostLink = `${origin}/room/${roomCode}/u/${userKey}`;
  const joinLink = `${origin}/join/${roomCode}`;

  // Redirect if missing params
  useEffect(() => {
    if (!roomCode || !userKey) {
      navigate('/', { replace: true });
    }
  }, [roomCode, userKey, navigate]);

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Join ${eventName || 'my room'} on SmallBets.live`,
        text: `Join my ${isTournament ? 'tournament' : 'room'} on SmallBets.live! Code: ${roomCode}`,
        url: joinLink,
      });
    } catch {
      // User cancelled share
    }
  };

  const mailtoLink = `mailto:?subject=${encodeURIComponent(
    `Your SmallBets.live ${isTournament ? 'Tournament' : 'Room'} Link`
  )}&body=${encodeURIComponent(
    `Here's your host link for "${eventName || roomCode}" on SmallBets.live:\n\n` +
    `Host link (for you): ${hostLink}\n\n` +
    `Share this link with friends to join: ${joinLink}\n\n` +
    `Room code: ${roomCode}`
  )}`;

  if (!roomCode || !userKey) return null;

  return (
    <div className="container page-container">
      <div className="text-center mb-lg">
        <div className="room-created-icon">&#10003;</div>
        <h2 style={{ marginBottom: '0.5rem' }}>
          {isTournament ? 'Tournament Created!' : 'Room Created!'}
        </h2>
        <p className="text-secondary" style={{ marginBottom: 0 }}>
          {eventName || `Room ${roomCode}`}
        </p>
      </div>

      {/* Host Link */}
      <div className="card mb-lg">
        <h4 className="mb-sm">Your Host Link</h4>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          This is your personal link to manage the room. Save it!
        </p>
        <div className="room-created-link-box mb-sm">
          <code className="room-created-link-text">{hostLink}</code>
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={() => copyToClipboard(hostLink, setCopiedHost)}
        >
          {copiedHost ? 'Copied!' : 'Copy Host Link'}
        </button>
      </div>

      {/* Share with Friends */}
      <div className="card mb-lg">
        <h4 className="mb-sm">Share with Friends</h4>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Send this join link so others can enter your room.
        </p>
        <div className="room-created-link-box mb-sm">
          <span className="room-created-room-code">{roomCode}</span>
          <code className="room-created-link-text">{joinLink}</code>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={() => copyToClipboard(joinLink, setCopiedJoin)}
          >
            {copiedJoin ? 'Copied!' : 'Copy Join Link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={handleNativeShare}
            >
              Share...
            </button>
          )}
        </div>
      </div>

      {/* Email yourself */}
      <div className="card mb-lg">
        <h4 className="mb-sm">Email Yourself a Copy</h4>
        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
          Opens your email app with the links pre-filled. We never see or store your email.
        </p>
        <a
          href={mailtoLink}
          className="btn btn-secondary btn-full"
          style={{ textDecoration: 'none' }}
        >
          Open Email App
        </a>
      </div>

      {/* Go to Room */}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={() => navigate(`/room/${roomCode}/u/${userKey}`)}
      >
        Go to Room &rsaquo;
      </button>
    </div>
  );
}
