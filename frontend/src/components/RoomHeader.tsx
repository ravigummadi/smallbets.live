/**
 * RoomHeader - Room title, status, points display, and host controls
 * Extracted from RoomPage to reduce component size
 */

import type { Room, User } from '@/types';

// Map template IDs to friendly names
const EVENT_TEMPLATE_NAMES: Record<string, string> = {
  'grammys-2026': 'Grammy Awards 2026',
  'oscars-2026': 'Oscars 2026',
  'superbowl-lix': 'Super Bowl LIX',
  'ipl-2026': 'IPL 2026',
  'custom': 'Custom Event',
};

interface RoomHeaderProps {
  room: Room;
  user: User;
  isHost: boolean;
  isCoHost: boolean;
  isTournament: boolean;
  copiedRoomLink: boolean;
  onCopyRoomLink: () => void;
  onFinishRoom: () => void;
}

export default function RoomHeader({
  room,
  user,
  isHost,
  isCoHost,
  isTournament,
  copiedRoomLink,
  onCopyRoomLink,
  onFinishRoom,
}: RoomHeaderProps) {
  const eventName = room.eventName || EVENT_TEMPLATE_NAMES[room.eventTemplate] || 'Event';

  return (
    <div className="card mb-md">
      <div className="room-header-layout">
        <div>
          <h3 className="room-header-title">
            <span>{isTournament && 'Tournament: '}{eventName} - Room {room.code}</span>
            <button
              className="btn btn-secondary btn-xs btn-share"
              onClick={onCopyRoomLink}
            >
              {copiedRoomLink ? 'Copied!' : 'Share'}
            </button>
          </h3>
          <div className="room-header-status">
            {room.status === 'waiting' && <span>Waiting to start</span>}
            {room.status === 'active' && (
              <>
                <span>{isTournament ? 'Tournament in progress' : 'Event in progress'}</span>
                <span className="badge-live">LIVE</span>
              </>
            )}
            {room.status === 'finished' && <span>{isTournament ? 'Tournament finished' : 'Event finished'}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="points-display room-header-points">
            {user.points}
          </p>
          <p className="room-header-points-label">
            points
          </p>
          <p className="room-header-nickname">{user.nickname}</p>
          <span className={`room-header-role-badge ${isCoHost ? 'room-header-role-badge--cohost' : isHost ? 'room-header-role-badge--host' : ''}`}>
            {isCoHost ? 'Co-Host' : isHost ? 'Host' : 'Guest'}
          </span>
        </div>
      </div>
      {isHost && room.status === 'active' && (
        <div className="room-header-finish">
          <button
            className="btn btn-secondary btn-full room-header-finish-btn"
            onClick={onFinishRoom}
          >
            Finish {isTournament ? 'Tournament' : 'Event'}
          </button>
        </div>
      )}
    </div>
  );
}

export { EVENT_TEMPLATE_NAMES };
