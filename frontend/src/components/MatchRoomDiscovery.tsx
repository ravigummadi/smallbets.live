/**
 * MatchRoomDiscovery - Tournament match room listing with join functionality
 *
 * Shows all match rooms in a tournament with teams, date, status,
 * and direct "Join Match" buttons for participants.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '@/services/api';
import CollapsibleSection from '@/components/CollapsibleSection';
import type { Room } from '@/types';

interface MatchRoomDiscoveryProps {
  matchRooms: Room[];
  tournamentCode: string;
  userId?: string;
  nickname?: string;
  isHost: boolean;
  onCreateMatch?: () => void;
}

export default function MatchRoomDiscovery({
  matchRooms,
  tournamentCode,
  userId,
  nickname,
  isHost,
  onCreateMatch,
}: MatchRoomDiscoveryProps) {
  const navigate = useNavigate();
  const [navigatingCode, setNavigatingCode] = useState<string | null>(null);

  const handleGoToMatch = async (matchRoom: Room) => {
    if (!nickname) {
      navigate(`/join/${matchRoom.code}`, {
        state: { fromTournament: tournamentCode, parentUserId: userId, nickname },
      });
      return;
    }
    setNavigatingCode(matchRoom.code);
    try {
      const res = await roomApi.getUserKeyByNickname(matchRoom.code, nickname);
      navigate(`/room/${matchRoom.code}/u/${res.userKey}`);
    } catch {
      // User not in this match room yet — send to join
      navigate(`/join/${matchRoom.code}`, {
        state: { fromTournament: tournamentCode, parentUserId: userId, nickname },
      });
    } finally {
      setNavigatingCode(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="badge-live" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
            LIVE
          </span>
        );
      case 'finished':
        return (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            background: 'rgba(161, 161, 170, 0.15)',
            color: 'var(--color-text-muted)',
          }}>
            FINISHED
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            background: 'rgba(234, 179, 8, 0.15)',
            color: 'var(--color-warning)',
          }}>
            UPCOMING
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Sort: active first, then upcoming, then finished
  const sortedRooms = [...matchRooms].sort((a, b) => {
    const order: Record<string, number> = { active: 0, waiting: 1, finished: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  return (
    <CollapsibleSection title="Matches" badge={matchRooms.length}>
      {sortedRooms.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {sortedRooms.map(matchRoom => {
            const teams = matchRoom.matchDetails;
            const title = matchRoom.eventName || (teams ? `${teams.team1} vs ${teams.team2}` : `Match ${matchRoom.code}`);
            const isNavigating = navigatingCode === matchRoom.code;

            return (
              <div
                key={matchRoom.code}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `3px solid ${matchRoom.status === 'active' ? 'var(--color-success)' : matchRoom.status === 'finished' ? 'var(--color-text-muted)' : 'var(--color-warning)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{title}</div>
                    {teams && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{teams.team1}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>vs</span>
                        <span style={{ fontWeight: 600 }}>{teams.team2}</span>
                      </div>
                    )}
                    {teams?.matchDateTime && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {formatDate(teams.matchDateTime)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    {getStatusBadge(matchRoom.status)}
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                      {matchRoom.code}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn ${matchRoom.status === 'finished' ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.75rem', minHeight: '36px' }}
                    disabled={isNavigating}
                    onClick={() => handleGoToMatch(matchRoom)}
                  >
                    {isNavigating ? 'Loading...' : matchRoom.status === 'active' ? 'Go to Match' : matchRoom.status === 'finished' ? 'View Results' : 'Join Match'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
          No matches yet. {isHost ? 'Create the first match!' : 'The host will create matches soon.'}
        </p>
      )}

      {isHost && onCreateMatch && (
        <div className="mt-md" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={onCreateMatch}
          >
            + Create Match Room
          </button>
        </div>
      )}
    </CollapsibleSection>
  );
}
