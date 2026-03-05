/**
 * HostActionBar - Sticky bottom action bar for hosts
 * Extracted from RoomPage to reduce component size
 */

import type { Room, Bet } from '@/types';

interface HostActionBarProps {
  room: Room;
  isTournament: boolean;
  openBets: Bet[];
  closingBetId: string | null;
  onStartRoom: () => void;
  onCloseBet: (betId: string) => void;
  onShowBetModal: () => void;
  onShowFeedModal: () => void;
}

export default function HostActionBar({
  room,
  isTournament,
  openBets,
  closingBetId,
  onStartRoom,
  onCloseBet,
  onShowBetModal,
  onShowFeedModal,
}: HostActionBarProps) {
  if (room.status === 'finished') return null;

  return (
    <>
      {/* Bottom spacer */}
      <div className="sticky-action-bar-spacer" />

      {/* Sticky Action Bar */}
      <div className="sticky-action-bar host-action-bar">
        {/* Context-aware next action for open bets */}
        {room.status === 'active' && openBets.length > 0 && (
          <div className="host-action-bar-row">
            <button
              className="btn btn-secondary host-action-bar-btn"
              onClick={() => onCloseBet(openBets[0].betId)}
              disabled={closingBetId === openBets[0].betId}
            >
              {closingBetId === openBets[0].betId
                ? 'Locking...'
                : `Lock: ${openBets[0].question.substring(0, 25)}${openBets[0].question.length > 25 ? '...' : ''}`}
            </button>
          </div>
        )}
        <div className="host-action-bar-row">
          {room.status === 'waiting' && (
            <button className="btn btn-primary host-action-bar-btn" onClick={onStartRoom}>
              Start {isTournament ? 'Tournament' : 'Event'}
            </button>
          )}
          {(room.status === 'waiting' || room.status === 'active') && (
            <button className="btn btn-primary host-action-bar-btn" onClick={onShowBetModal}>
              + New Bet
            </button>
          )}
          {room.status === 'active' && (
            <button className="btn btn-secondary host-action-bar-btn" onClick={onShowFeedModal}>
              Live Feed
            </button>
          )}
        </div>
      </div>
    </>
  );
}
