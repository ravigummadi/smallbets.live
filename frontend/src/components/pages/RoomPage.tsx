/**
 * Room page - Main betting interface
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRoom } from '@/hooks/useRoom';
import { useUser } from '@/hooks/useUser';
import { useBets } from '@/hooks/useBets';
import { useUserBets } from '@/hooks/useUserBets';
import { useParticipants } from '@/hooks/useParticipants';
import AdminPanel from '@/components/admin/AdminPanel';
import { betApi } from '@/services/api';
import type { Room, Bet, UserBet } from '@/types';

// Map template IDs to friendly names
const EVENT_TEMPLATE_NAMES: Record<string, string> = {
  'grammys-2026': 'Grammy Awards 2026',
  'oscars-2026': 'Oscars 2026',
  'superbowl-lix': 'Super Bowl LIX',
  'custom': 'Custom Event',
};

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { room, loading: roomLoading } = useRoom(code || null);
  const { user, loading: userLoading } = useUser(session?.userId || null);
  const { bets, loading: betsLoading } = useBets(code || null);
  const { userBets } = useUserBets(session?.userId || null, code || null);
  const { participants } = useParticipants(code || null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [localRoom, setLocalRoom] = useState<Room | null>(room);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());
  const [placingBets, setPlacingBets] = useState<Set<string>>(new Set());
  const [betErrors, setBetErrors] = useState<Record<string, string>>({});

  // Redirect if no session
  useEffect(() => {
    if (!session || session.roomCode !== code) {
      navigate(`/join/${code}`);
    }
  }, [session, code, navigate]);

  // Update local room when Firestore room changes
  useEffect(() => {
    if (room) {
      setLocalRoom(room);
    }
  }, [room]);

  const toggleBetExpanded = (betId: string) => {
    const newExpanded = new Set(expandedBets);
    if (newExpanded.has(betId)) {
      newExpanded.delete(betId);
    } else {
      newExpanded.add(betId);
    }
    setExpandedBets(newExpanded);
  };

  const handlePlaceBet = async (betId: string, option: string) => {
    if (!code || !session?.userId) return;

    setPlacingBets(new Set(placingBets).add(betId));
    setBetErrors({ ...betErrors, [betId]: '' });

    try {
      await betApi.placeBet(code, session.userId, {
        bet_id: betId,
        selected_option: option,
      });

      // Clear error on success
      const newErrors = { ...betErrors };
      delete newErrors[betId];
      setBetErrors(newErrors);
    } catch (err: any) {
      setBetErrors({ ...betErrors, [betId]: err.detail || 'Failed to place bet' });
      console.error('Failed to place bet:', err);
    } finally {
      const newPlacing = new Set(placingBets);
      newPlacing.delete(betId);
      setPlacingBets(newPlacing);
    }
  };

  if (roomLoading || userLoading) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="spinner" />
        <p className="text-center text-muted">Loading room...</p>
      </div>
    );
  }

  if (!localRoom || !user) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="card">
          <p className="text-error">Room not found</p>
          <button
            className="btn btn-secondary mt-md"
            onClick={() => navigate('/')}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isHost = user.isAdmin;
  const displayRoom = localRoom;

  // Get event name (custom or from template)
  const eventName = displayRoom.eventName || EVENT_TEMPLATE_NAMES[displayRoom.eventTemplate] || 'Event';

  // Filter open bets
  const openBets = bets.filter(bet => bet.status === 'open');

  // Create a map of user bets by betId for quick lookup
  const userBetMap = new Map<string, UserBet>();
  userBets.forEach(ub => userBetMap.set(ub.betId, ub));

  return (
    <div className="container-full" style={{ paddingTop: '1rem' }}>
      {/* Room Header */}
      <div className="card mb-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>
              {eventName} - Room {displayRoom.code}
            </h3>
            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {displayRoom.status === 'waiting' && <span>Waiting to start</span>}
              {displayRoom.status === 'active' && (
                <>
                  <span>Event in progress</span>
                  <span className="badge-live">LIVE</span>
                </>
              )}
              {displayRoom.status === 'finished' && <span>Event finished</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="points-display" style={{ marginBottom: '0.25rem' }}>
              {user.points}
            </p>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 0 }}>
              points
            </p>
          </div>
        </div>
        {isHost && (
          <div className="mt-md" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-secondary btn-full"
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              {showAdminPanel ? 'Hide Admin Panel' : 'Show Admin Panel'}
            </button>
          </div>
        )}
      </div>

      {/* Admin Panel (host only) */}
      {isHost && showAdminPanel && session?.hostId && (
        <div className="mb-md">
          <AdminPanel
            room={displayRoom}
            hostId={session.hostId}
            onRoomUpdate={setLocalRoom}
          />
        </div>
      )}

      {/* Main Content */}
      {displayRoom.status === 'waiting' && (
        <div className="card mb-md text-center">
          <h4 className="mb-md">Waiting for event to start</h4>
          <p className="text-secondary mb-md">
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </p>
        </div>
      )}

      {displayRoom.status === 'active' && (
        <>
          {betsLoading ? (
            <div className="card mb-md text-center">
              <p className="text-secondary">Loading bets...</p>
            </div>
          ) : openBets.length === 0 ? (
            <div className="card mb-md text-center">
              <p className="text-secondary">No open bets. Waiting for next bet...</p>
            </div>
          ) : (
            <div className="card mb-md">
              <h4 className="mb-md">Open Bets <span style={{ background: 'var(--color-primary)', color: '#000', padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>{openBets.length}</span></h4>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {openBets.map((bet) => {
                  const isExpanded = expandedBets.has(bet.betId);
                  const userBet = userBetMap.get(bet.betId);
                  const hasPlacedBet = !!userBet;
                  const isPlacing = placingBets.has(bet.betId);
                  const error = betErrors[bet.betId];

                  return (
                    <div
                      key={bet.betId}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Bet Header */}
                      <div
                        style={{
                          padding: 'var(--spacing-md)',
                          cursor: 'pointer',
                          backgroundColor: isExpanded ? 'var(--color-bg-elevated)' : 'transparent',
                        }}
                        onClick={() => toggleBetExpanded(bet.betId)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: '600', marginBottom: 'var(--spacing-xs)' }}>
                              {bet.question}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 0 }}>
                              {bet.options.length} options • {bet.pointsValue} points
                              {hasPlacedBet && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--color-success)', fontWeight: '600' }}>
                                  • ✓ Bet placed
                                </span>
                              )}
                            </p>
                          </div>
                          <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)' }}>
                            {isExpanded ? '−' : '+'}
                          </span>
                        </div>
                      </div>

                      {/* Bet Content (collapsible) */}
                      {isExpanded && (
                        <div style={{ padding: 'var(--spacing-md)', paddingTop: 0 }}>
                          {hasPlacedBet ? (
                            <div
                              style={{
                                padding: 'var(--spacing-md)',
                                backgroundColor: 'var(--color-bg-elevated)',
                                borderLeft: '3px solid var(--color-success)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: 'var(--spacing-md)',
                              }}
                            >
                              <p className="text-success" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                                ✓ Your bet: <strong>{userBet.selectedOption}</strong>
                              </p>
                            </div>
                          ) : (
                            <>
                              {error && (
                                <div
                                  style={{
                                    padding: 'var(--spacing-md)',
                                    backgroundColor: 'var(--color-bg-elevated)',
                                    borderLeft: '3px solid var(--color-error)',
                                    borderRadius: 'var(--radius-sm)',
                                    marginBottom: 'var(--spacing-md)',
                                  }}
                                >
                                  <p className="text-error" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                                    {error}
                                  </p>
                                </div>
                              )}

                              <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {bet.options.map((option) => (
                                  <button
                                    key={option}
                                    className="btn btn-secondary"
                                    style={{
                                      textAlign: 'left',
                                      padding: '1rem',
                                      borderLeft: '3px solid var(--color-primary)',
                                    }}
                                    disabled={isPlacing}
                                    onClick={() => handlePlaceBet(bet.betId, option)}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>

                              {isPlacing && (
                                <p className="text-secondary mt-md" style={{ fontSize: '0.875rem', textAlign: 'center' }}>
                                  Placing bet...
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {displayRoom.status === 'finished' && (
        <div className="card mb-md text-center">
          <h4 className="mb-md">Event Finished</h4>
          <p className="text-secondary">Check the leaderboard below to see final standings</p>
        </div>
      )}

      {/* Participants List */}
      <div className="card">
        <h4 className="mb-md">Participants ({participants.length})</h4>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {participants
            .sort((a, b) => b.points - a.points)
            .map((participant, index) => (
              <div
                key={participant.userId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {index < 3 ? (
                    <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', marginRight: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{index + 1}</span>
                  )}
                  {participant.nickname}
                  {participant.isAdmin && (
                    <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                      (Host)
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: '600' }}>{participant.points}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
