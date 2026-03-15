/**
 * Create Room page - Host creates a new room or tournament
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/services/api';
import { useSession } from '@/hooks/useSession';

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
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { saveSession } = useSession();

  const templates = isTournament ? TOURNAMENT_TEMPLATES : CEREMONY_TEMPLATES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (eventTemplate === 'custom' && !eventName.trim()) {
      setError(isTournament ? 'Please enter a tournament name' : 'Please enter a name for your custom event');
      return;
    }

    if (isTournament && !eventName.trim()) {
      setError('Please enter a tournament name');
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
          event_name: eventTemplate === 'custom' ? eventName.trim() : undefined,
          host_nickname: nickname.trim(),
        });
      }

      saveSession({
        userId: response.user_id,
        roomCode: response.room_code,
        hostId: response.host_id,
        nickname: nickname.trim(),
      });

      // Navigate to unique user URL so the host has a bookmarkable/shareable link
      if (response.user_key) {
        navigate(`/room/${response.room_code}/u/${response.user_key}`);
      } else {
        navigate(`/room/${response.room_code}`);
      }
    } catch (err: any) {
      setError(err.detail || 'Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
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
                setEventName('');
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
                setEventName('');
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
            onChange={(e) => setEventTemplate(e.target.value)}
            className="mb-md"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {(eventTemplate === 'custom' || isTournament) && (
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
                : 'Give your custom event a name (e.g., "Family Game Night", "March Madness 2026")'}
            </p>
          </div>
        )}

        {error && (
          <div className="card mb-lg" style={{ borderColor: 'var(--color-error)' }}>
            <p className="text-error">{error}</p>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full btn-lg"
          disabled={loading || !nickname.trim() || ((eventTemplate === 'custom' || isTournament) && !eventName.trim())}
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
