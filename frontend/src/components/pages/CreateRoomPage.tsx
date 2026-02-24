/**
 * Create Room page - Host creates a new room
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/services/api';
import { useSession } from '@/hooks/useSession';

const EVENT_TEMPLATES = [
  { id: 'grammys-2026', name: 'Grammy Awards 2026' },
  { id: 'oscars-2026', name: 'Oscars 2026' },
  { id: 'superbowl-lix', name: 'Super Bowl LIX' },
  { id: 'custom', name: 'Custom Event' },
];

export default function CreateRoomPage() {
  const [nickname, setNickname] = useState('');
  const [eventTemplate, setEventTemplate] = useState('grammys-2026');
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { saveSession } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (eventTemplate === 'custom' && !eventName.trim()) {
      setError('Please enter a name for your custom event');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create room via API
      const response = await roomApi.createRoom({
        event_template: eventTemplate,
        event_name: eventTemplate === 'custom' ? eventName.trim() : undefined,
        host_nickname: nickname.trim(),
      });

      // Save session
      saveSession({
        userId: response.user_id,
        roomCode: response.room_code,
        hostId: response.host_id,
      });

      // Navigate to room
      navigate(`/room/${response.room_code}`);
    } catch (err: any) {
      setError(err.detail || 'Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <h2 className="mb-lg">Create a Room</h2>

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
          <h4 className="mb-md">Event Template</h4>
          <select
            value={eventTemplate}
            onChange={(e) => setEventTemplate(e.target.value)}
            className="mb-md"
          >
            {EVENT_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Pre-configured bets for popular events
          </p>
        </div>

        {eventTemplate === 'custom' && (
          <div className="card mb-lg">
            <h4 className="mb-md">Event Name</h4>
            <input
              type="text"
              placeholder="Enter your event name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              maxLength={50}
              className="mb-md"
            />
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Give your custom event a name (e.g., "Family Game Night", "March Madness 2026")
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
          disabled={loading || !nickname.trim() || (eventTemplate === 'custom' && !eventName.trim())}
        >
          {loading ? 'Creating Room...' : 'Create Room'}
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
