/**
 * Room page - Main betting interface
 * Supports event rooms, tournament rooms, and match rooms
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRoom } from '@/hooks/useRoom';
import { useUser } from '@/hooks/useUser';
import { useBets } from '@/hooks/useBets';
import { useUserBets } from '@/hooks/useUserBets';
import { useParticipants } from '@/hooks/useParticipants';
import AdminPanel from '@/components/admin/AdminPanel';
import { betApi, roomApi } from '@/services/api';
import type { Room, Bet, UserBet } from '@/types';

// Map template IDs to friendly names
const EVENT_TEMPLATE_NAMES: Record<string, string> = {
  'grammys-2026': 'Grammy Awards 2026',
  'oscars-2026': 'Oscars 2026',
  'superbowl-lix': 'Super Bowl LIX',
  'ipl-2026': 'IPL 2026',
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
  const [matchRooms, setMatchRooms] = useState<Room[]>([]);

  // Match room creation state
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [matchTeam1, setMatchTeam1] = useState('');
  const [matchTeam2, setMatchTeam2] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Redirect if no session for this room
  useEffect(() => {
    if (!session || session.roomCode !== code) {
      // Pass current session as context so identity is preserved
      // when navigating between tournament and match rooms
      navigate(`/join/${code}`, {
        state: session ? {
          parentUserId: session.userId,
          nickname: session.nickname,
        } : undefined,
      });
    }
  }, [session, code, navigate]);

  // Update local room when Firestore room changes
  useEffect(() => {
    if (room) {
      setLocalRoom(room);
    }
  }, [room]);

  // Load match rooms for tournaments
  useEffect(() => {
    if (localRoom?.roomType === 'tournament') {
      roomApi.getMatchRooms(localRoom.code)
        .then(res => setMatchRooms(res.matches))
        .catch(() => {});
    }
  }, [localRoom?.roomType, localRoom?.code]);

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

  const handleCreateMatchRoom = async () => {
    if (!code || !session?.hostId || !matchTeam1.trim() || !matchTeam2.trim()) return;

    setCreatingMatch(true);
    try {
      const response = await roomApi.createMatchRoom(code, session.hostId, {
        team1: matchTeam1.trim(),
        team2: matchTeam2.trim(),
        match_date_time: new Date().toISOString(),
      });

      // Navigate to join the match room, passing tournament context
      // so the host is recognized as admin in the match room
      navigate(`/join/${response.match_room_code}`, {
        state: {
          fromTournament: code,
          parentUserId: session?.userId,
          nickname: user?.nickname,
        },
      });
    } catch (err: any) {
      console.error('Failed to create match room:', err);
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleUndoBet = useCallback(async (betId: string) => {
    if (!code || !session?.hostId) return;
    try {
      await betApi.undoResolveBet(code, session.hostId, betId);
    } catch (err: any) {
      console.error('Failed to undo bet:', err);
    }
  }, [code, session?.hostId]);

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
  const isTournament = displayRoom.roomType === 'tournament';
  const isMatch = displayRoom.roomType === 'match';

  // Get event name
  const eventName = displayRoom.eventName || EVENT_TEMPLATE_NAMES[displayRoom.eventTemplate] || 'Event';

  // Filter bets by type
  const openBets = bets.filter(bet => bet.status === 'open');
  const resolvedBets = bets.filter(bet => bet.status === 'resolved');
  const tournamentBets = bets.filter(bet => bet.betType === 'tournament');
  const matchBets = bets.filter(bet => bet.betType !== 'tournament');

  // Create a map of user bets by betId
  const userBetMap = new Map<string, UserBet>();
  userBets.forEach(ub => userBetMap.set(ub.betId, ub));

  // Check if a resolved bet can be undone
  const canUndo = (bet: Bet) => {
    if (bet.status !== 'resolved' || !bet.canUndoUntil) return false;
    return new Date() < new Date(bet.canUndoUntil);
  };

  const renderBetCard = (bet: Bet) => {
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
                {bet.status === 'resolved' && bet.winningOption && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                    • Winner: {bet.winningOption}
                  </span>
                )}
                {hasPlacedBet && bet.status !== 'resolved' && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-success)', fontWeight: '600' }}>
                    • Bet placed
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {bet.status === 'resolved' && canUndo(bet) && isHost && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  onClick={(e) => { e.stopPropagation(); handleUndoBet(bet.betId); }}
                >
                  Undo
                </button>
              )}
              <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)' }}>
                {isExpanded ? '−' : '+'}
              </span>
            </div>
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
                  borderLeft: `3px solid ${bet.status === 'resolved'
                    ? (userBet.selectedOption === bet.winningOption ? 'var(--color-success)' : 'var(--color-error)')
                    : 'var(--color-success)'}`,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--spacing-md)',
                }}
              >
                <p style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                  Your bet: <strong>{userBet.selectedOption}</strong>
                  {bet.status === 'resolved' && userBet.pointsWon !== null && (
                    <span style={{ marginLeft: '0.5rem', fontWeight: '600' }}>
                      {userBet.pointsWon > 0
                        ? <span style={{ color: 'var(--color-success)' }}>Won {userBet.pointsWon} pts</span>
                        : <span style={{ color: 'var(--color-error)' }}>Lost</span>}
                    </span>
                  )}
                </p>
              </div>
            ) : bet.status === 'open' ? (
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
            ) : (
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                {bet.status === 'locked' ? 'Betting is closed' : 'Bet resolved'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container-full" style={{ paddingTop: '1rem' }}>
      {/* Breadcrumb for match rooms */}
      {isMatch && displayRoom.parentRoomCode && (
        <div className="mb-md" style={{ fontSize: '0.875rem' }}>
          <Link
            to={`/room/${displayRoom.parentRoomCode}`}
            style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            Tournament: {EVENT_TEMPLATE_NAMES[displayRoom.eventTemplate] || 'Tournament'}
          </Link>
          <span className="text-muted"> &gt; </span>
          <span>Match: {eventName}</span>
        </div>
      )}

      {/* Room Header */}
      <div className="card mb-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>
              {isTournament && 'Tournament: '}{eventName} - Room {displayRoom.code}
            </h3>
            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {displayRoom.status === 'waiting' && <span>Waiting to start</span>}
              {displayRoom.status === 'active' && (
                <>
                  <span>{isTournament ? 'Tournament in progress' : 'Event in progress'}</span>
                  <span className="badge-live">LIVE</span>
                </>
              )}
              {displayRoom.status === 'finished' && <span>{isTournament ? 'Tournament finished' : 'Event finished'}</span>}
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

      {/* Tournament Match Rooms Section */}
      {isTournament && displayRoom.status !== 'waiting' && (
        <div className="card mb-md">
          <h4 className="mb-md">Match Rooms ({matchRooms.length})</h4>
          {matchRooms.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {matchRooms.map(matchRoom => (
                <Link
                  key={matchRoom.code}
                  to={`/room/${matchRoom.code}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    color: 'inherit',
                    borderLeft: `3px solid ${matchRoom.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)'}`,
                  }}
                >
                  <span>{matchRoom.eventName || `Match ${matchRoom.code}`}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {matchRoom.status === 'active' ? 'LIVE' : matchRoom.status}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>No match rooms yet</p>
          )}

          {isHost && displayRoom.status !== 'finished' && (
            <div className="mt-md" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
              {showCreateMatch ? (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="Team 1 (e.g., RCB)"
                    value={matchTeam1}
                    onChange={(e) => setMatchTeam1(e.target.value)}
                    maxLength={30}
                  />
                  <input
                    type="text"
                    placeholder="Team 2 (e.g., MI)"
                    value={matchTeam2}
                    onChange={(e) => setMatchTeam2(e.target.value)}
                    maxLength={30}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1 }}
                      disabled={creatingMatch || !matchTeam1.trim() || !matchTeam2.trim()}
                      onClick={handleCreateMatchRoom}
                    >
                      {creatingMatch ? 'Creating...' : 'Create Match Room'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowCreateMatch(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-secondary btn-full"
                  onClick={() => setShowCreateMatch(true)}
                >
                  + Create Match Room
                </button>
              )}
            </div>
          )}
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
          {/* Tournament-level bets (only in tournament rooms) */}
          {isTournament && tournamentBets.length > 0 && (
            <div className="card mb-md">
              <h4 className="mb-md">Season Bets <span style={{ background: 'var(--color-primary)', color: '#000', padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>{tournamentBets.filter(b => b.status === 'open').length}</span></h4>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {tournamentBets.map(renderBetCard)}
              </div>
            </div>
          )}

          {/* Regular bets */}
          {betsLoading ? (
            <div className="card mb-md text-center">
              <p className="text-secondary">Loading bets...</p>
            </div>
          ) : openBets.length === 0 && (!isTournament || matchBets.length === 0) ? (
            <div className="card mb-md text-center">
              <p className="text-secondary">No open bets. Waiting for next bet...</p>
            </div>
          ) : !isTournament && openBets.length > 0 ? (
            <div className="card mb-md">
              <h4 className="mb-md">Open Bets <span style={{ background: 'var(--color-primary)', color: '#000', padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>{openBets.length}</span></h4>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {openBets.map(renderBetCard)}
              </div>
            </div>
          ) : null}

          {/* Match bets in match rooms */}
          {isMatch && matchBets.length > 0 && (
            <div className="card mb-md">
              <h4 className="mb-md">Match Bets <span style={{ background: 'var(--color-primary)', color: '#000', padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.5rem' }}>{matchBets.filter(b => b.status === 'open').length} open</span></h4>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {matchBets.map(renderBetCard)}
              </div>
            </div>
          )}
        </>
      )}

      {displayRoom.status === 'finished' && (
        <div className="card mb-md text-center">
          <h4 className="mb-md">{isTournament ? 'Tournament Finished' : 'Event Finished'}</h4>
          <p className="text-secondary">Check the leaderboard below to see final standings</p>

          {resolvedBets.length > 0 && (
            <div className="mt-md" style={{ textAlign: 'left' }}>
              <h4 className="mb-md">Results</h4>
              <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                {resolvedBets.map(renderBetCard)}
              </div>
            </div>
          )}
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
