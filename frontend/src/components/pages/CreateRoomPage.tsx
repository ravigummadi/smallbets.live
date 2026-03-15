/**
 * Create Room page - Host creates a new room or tournament
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/services/api';
import { useSession } from '@/hooks/useSession';
import { useMyRooms } from '@/hooks/useMyRooms';

const CEREMONY_TEMPLATES = [
  { id: 'grammys-2026', name: 'Grammy Awards 2026' },
  { id: 'oscars-2026', name: 'Oscars 2026' },
  { id: 'superbowl-lix', name: 'Super Bowl LIX' },
  { id: 'custom', name: 'Custom Event' },
];

const TOURNAMENT_TEMPLATES = [
  { id: 'ipl-2026', name: 'IPL 2026' },
  { id: 'custom', name: 'Custom Tournament' },
];

export default function CreateRoomPage() {
  const [nickname, setNickname] = useState('');
  const [isTournament, setIsTournament] = useState(false);
  const [eventTemplate, setEventTemplate] = useState('grammys-2026');
  const [eventName, setEventName] = useState('Grammy Awards 2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { saveSession } = useSession();
  const { saveRoom } = useMyRooms();

  const templates = isTournament ? TOURNAMENT_TEMPLATES : CEREMONY_TEMPLATES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (!eventName.trim()) {
      setError(isTournament ? 'Please enter a tournament name' : 'Please enter an event name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let response;

      if (isTournament) {
        // Create tournament room (6-char code, no expiry)
        response = await roomApi.createTournament({
          event_template: eventTemplate,
          event_name: eventName.trim() || undefined,
          host_nickname: nickname.trim(),
        });
      } else {
        // Create regular event room (4-char code, 24h expiry)
        response = await roomApi.createRoom({
          event_template: eventTemplate,
          event_name: eventName.trim() || undefined,
          host_nickname: nickname.trim(),
        });
      }

      saveSession({
        userId: response.user_id,
        roomCode: response.room_code,
        hostId: response.host_id,
        nickname: nickname.trim(),
      });

      const displayName = eventName.trim() || templates.find((t) => t.id === eventTemplate)?.name || eventTemplate;

      // Save to localStorage for "My Rooms" recovery
      if (response.user_key) {
        saveRoom({
          roomCode: response.room_code,
          userKey: response.user_key,
          hostLink: `${window.location.origin}/room/${response.room_code}/u/${response.user_key}`,
          joinLink: `${window.location.origin}/join/${response.room_code}`,
          eventName: displayName,
          isTournament,
          isHost: true,
          createdAt: Date.now(),
        });
      }

      // Navigate to confirmation page with share options
      if (response.user_key) {
        const params = new URLSearchParams({
          code: response.room_code,
          uk: response.user_key,
          name: displayName,
          ...(isTournament ? { type: 'tournament' } : {}),
        });
        navigate(`/room-created?${params.toString()}`);
      } else {
        navigate(`/room/${response.room_code}`);
      }
    } catch (err: any) {
      setError(err.detail || 'Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="container page-container">
      <h2 className="mb-lg" style={{ letterSpacing: '-0.01em' }}>
        {isTournament ? 'Create Tournament' : 'Create a Room'}
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="card mb-lg">
          <h4 className="mb-md">Your Nickname</h4>
          <input
            type="text"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="mb-md"
            autoFocus
          />
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            This is how other players will see you
          </p>
        </div>

        <div className="card mb-lg">
          <h4 className="mb-md">Event Type</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn btn-full ${!isTournament ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setIsTournament(false);
                setEventTemplate(CEREMONY_TEMPLATES[0].id);
                setEventName(CEREMONY_TEMPLATES[0].name);
              }}
            >
              Single Event
            </button>
            <button
              type="button"
              className={`btn btn-full ${isTournament ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setIsTournament(true);
                setEventTemplate(TOURNAMENT_TEMPLATES[0].id);
                setEventName(TOURNAMENT_TEMPLATES[0].name);
              }}
            >
              Tournament
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {isTournament
              ? 'Multi-match tournament with season-long and per-match betting'
              : 'Single ceremony or event with pre-configured bets'}
          </p>
        </div>

        <div className="card mb-lg">
          <h4 className="mb-md">{isTournament ? 'Tournament Template' : 'Event Template'}</h4>
          <select
            value={eventTemplate}
            onChange={(e) => {
              const id = e.target.value;
              setEventTemplate(id);
              if (id !== 'custom') {
                const name = templates.find((t) => t.id === id)?.name || '';
                setEventName(name);
              } else {
                setEventName('');
              }
            }}
            className="mb-md"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="card mb-lg">
          <h4 className="mb-md">{isTournament ? 'Tournament Name' : 'Event Name'}</h4>
          <input
            type="text"
            placeholder={isTournament ? 'e.g., IPL 2026 Friends League' : 'Enter your event name'}
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            maxLength={50}
            className="mb-md"
          />
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            {isTournament
              ? 'Give your tournament a name to share with friends'
              : 'Name your event (pre-filled from template, feel free to customize)'}
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
          disabled={loading || !nickname.trim() || !eventName.trim()}
        >
          {loading
            ? (isTournament ? 'Creating Tournament...' : 'Creating Room...')
            : (isTournament ? 'Create Tournament' : 'Create Room')
          }
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
