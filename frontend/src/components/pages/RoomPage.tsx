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
import BetCreationForm from '@/components/admin/BetCreationForm';
import LiveFeedPanel from '@/components/admin/LiveFeedPanel';
import { betApi, roomApi } from '@/services/api';
import type { Room, Bet, UserBet, User, ParticipantWithLink } from '@/types';

// Map template IDs to friendly names
const EVENT_TEMPLATE_NAMES: Record<string, string> = {
  'grammys-2026': 'Grammy Awards 2026',
  'oscars-2026': 'Oscars 2026',
  'superbowl-lix': 'Super Bowl LIX',
  'ipl-2026': 'IPL 2026',
  'custom': 'Custom Event',
};

export default function RoomPage() {
  const { code, userKey } = useParams<{ code: string; userKey?: string }>();
  const navigate = useNavigate();
  const { session, saveSession } = useSession();
  const { room, loading: roomLoading } = useRoom(code || null);
  const { user, loading: userLoading } = useUser(session?.userId || null);
  const { bets, loading: betsLoading } = useBets(code || null);
  const { userBets } = useUserBets(session?.userId || null, code || null);
  const { participants } = useParticipants(code || null);
  const [localRoom, setLocalRoom] = useState<Room | null>(room);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());
  const [placingBets, setPlacingBets] = useState<Set<string>>(new Set());
  const [betErrors, setBetErrors] = useState<Record<string, string>>({});
  const [matchRooms, setMatchRooms] = useState<Room[]>([]);

  // Admin modal state (host only)
  const [showBetModal, setShowBetModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(true);

  // Inline bet management state (host only)
  const [closingBetId, setClosingBetId] = useState<string | null>(null);
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
  const [showResolveOptions, setShowResolveOptions] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editPointsValue, setEditPointsValue] = useState(100);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Participant links state (host only)
  const [participantLinks, setParticipantLinks] = useState<ParticipantWithLink[]>([]);
  const [linksLoaded, setLinksLoaded] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  // Session restoration state
  const [restoreUser, setRestoreUser] = useState<User | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Match room creation state
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [matchTitle, setMatchTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTeam1, setMatchTeam1] = useState('');
  const [matchTeam2, setMatchTeam2] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Session restoration via userKey link
  // Only trigger restoration if we don't already have a matching session
  const needsRestore = userKey && code && (!session || session.roomCode !== code);

  useEffect(() => {
    if (!needsRestore) return;

    setRestoreLoading(true);
    setRestoreError(null);

    roomApi.getUserByKey(code!, userKey!)
      .then((userData) => {
        // Check if there's an existing session for a DIFFERENT room
        const hasConflictingSession = session && session.roomCode !== code;
        if (hasConflictingSession) {
          // Show confirmation before replacing existing session
          setRestoreUser(userData);
          setShowRestoreModal(true);
        } else {
          // No conflicting session — auto-restore immediately
          saveSession({
            userId: userData.userId,
            roomCode: code!,
            hostId: userData.isAdmin ? userData.userId : undefined,
            nickname: userData.nickname,
          });
        }
      })
      .catch((err: any) => {
        if (err.status === 429) {
          setRestoreError('Too many requests. Please try again later.');
        } else if (err.status === 404) {
          setRestoreError('This link is invalid or the user was not found.');
        } else if (err.status === 400) {
          setRestoreError('Invalid link format.');
        } else {
          setRestoreError('Failed to restore session. Please try again.');
        }
      })
      .finally(() => {
        setRestoreLoading(false);
      });
  }, [needsRestore, userKey, code]);

  const handleConfirmRestore = () => {
    if (!restoreUser || !code) return;

    saveSession({
      userId: restoreUser.userId,
      roomCode: code,
      hostId: restoreUser.isAdmin ? restoreUser.userId : undefined,
      nickname: restoreUser.nickname,
    });

    setShowRestoreModal(false);
    setRestoreUser(null);
    // Stay on /u/:userKey URL - the session is now restored and the page will render normally
  };

  const handleCancelRestore = () => {
    setShowRestoreModal(false);
    setRestoreUser(null);
    if (session && session.roomCode === code) {
      // Already have a session for this room, just stay
    } else {
      navigate(`/join/${code}`, { replace: true });
    }
  };

  // Show restore modal/loading/error when restoration is needed
  if (needsRestore) {
    if (restoreLoading) {
      return (
        <div className="container" style={{ paddingTop: '3rem' }}>
          <div className="spinner" />
          <p className="text-center text-muted">Restoring session...</p>
        </div>
      );
    }

    if (restoreError) {
      return (
        <div className="container" style={{ paddingTop: '3rem' }}>
          <div className="card text-center">
            <p className="text-error">{restoreError}</p>
            <button
              className="btn btn-secondary mt-md"
              onClick={() => navigate(`/join/${code}`)}
            >
              Join Room Instead
            </button>
          </div>
        </div>
      );
    }

    if (showRestoreModal && restoreUser) {
      return (
        <div className="container" style={{ paddingTop: '3rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Restore Session</h3>
            <p style={{ marginBottom: 'var(--spacing-md)' }}>
              Continue as <strong>{restoreUser.nickname}</strong>? You have{' '}
              <strong>{restoreUser.points}</strong> points.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmRestore}>
                Continue as {restoreUser.nickname}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancelRestore}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Still loading/processing, show spinner
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Redirect if no session for this room (and not on a userKey URL)
  useEffect(() => {
    if (userKey) return; // userKey URLs handle their own auth via restoration
    if (!session || session.roomCode !== code) {
      navigate(`/join/${code}`, {
        state: session ? {
          parentUserId: session.userId,
          nickname: session.nickname,
        } : undefined,
      });
    }
  }, [session, code, navigate, userKey]);

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

  // Load participant links for host (for Copy Link buttons)
  // Re-fetch when participant count changes to pick up new joiners
  useEffect(() => {
    if (!session?.hostId || !code) return;

    roomApi.getParticipantsWithLinks(code, session.hostId)
      .then((res) => {
        setParticipantLinks(res.participants);
        setLinksLoaded(true);
      })
      .catch(() => {
        setLinksLoaded(true);
      });
  }, [session?.hostId, code, participants.length]);

  const handleCopyRoomLink = async () => {
    if (!code) return;
    const link = `${window.location.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedRoomLink(true);
    setTimeout(() => setCopiedRoomLink(false), 2000);
  };

  const handleCopyParticipantLink = async (participant: ParticipantWithLink) => {
    if (!code) return;
    const link = `${window.location.origin}/room/${code}/u/${participant.userKey}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedUserId(participant.userId);
    setTimeout(() => setCopiedUserId(null), 2000);
  };

  // Admin actions (host only)
  const handleStartRoom = async () => {
    if (!code || !session?.hostId) return;
    try {
      await roomApi.startRoom(code, session.hostId);
      setLocalRoom(prev => prev ? { ...prev, status: 'active' } : prev);
    } catch (err) {
      console.error('Failed to start room:', err);
    }
  };

  const handleFinishRoom = async () => {
    if (!code || !session?.hostId) return;
    try {
      await roomApi.finishRoom(code, session.hostId);
      setLocalRoom(prev => prev ? { ...prev, status: 'finished' } : prev);
    } catch (err) {
      console.error('Failed to finish room:', err);
    }
  };

  const handleCloseBet = async (betId: string) => {
    if (!code || !session?.hostId) return;
    setClosingBetId(betId);
    setAdminError(null);
    try {
      await betApi.lockBet(code, session.hostId, betId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to close bet');
    } finally {
      setClosingBetId(null);
    }
  };

  const handleResolveBet = async (betId: string, winningOption: string) => {
    if (!code || !session?.hostId) return;
    setResolvingBetId(betId);
    setAdminError(null);
    try {
      await betApi.resolveBet(code, session.hostId, betId, winningOption);
      setShowResolveOptions(null);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to resolve bet');
    } finally {
      setResolvingBetId(null);
    }
  };

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
        match_date_time: matchDate ? new Date(matchDate).toISOString() : new Date().toISOString(),
        title: matchTitle.trim() || undefined,
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

  const handleDeleteBet = async (betId: string) => {
    if (!code || !session?.hostId) return;
    setDeletingBetId(betId);
    setAdminError(null);
    try {
      await betApi.deleteBet(code, session.hostId, betId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to delete bet');
    } finally {
      setDeletingBetId(null);
    }
  };

  const startEditBet = (bet: Bet) => {
    setEditingBet(bet);
    setEditQuestion(bet.question);
    setEditOptions([...bet.options]);
    setEditPointsValue(bet.pointsValue);
  };

  const handleEditBet = async () => {
    if (!code || !session?.hostId || !editingBet) return;
    setEditSubmitting(true);
    setAdminError(null);
    try {
      const validOptions = editOptions.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        setAdminError('At least 2 options are required');
        setEditSubmitting(false);
        return;
      }
      await betApi.editBet(code, session.hostId, editingBet.betId, {
        question: editQuestion.trim(),
        options: validOptions.map(opt => opt.trim()),
        pointsValue: editPointsValue,
      });
      setEditingBet(null);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to edit bet');
    } finally {
      setEditSubmitting(false);
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

            {/* Inline admin controls (host only) */}
            {isHost && (bet.status === 'open' || bet.status === 'locked') && (
              <div style={{
                marginTop: 'var(--spacing-md)',
                paddingTop: 'var(--spacing-sm)',
                borderTop: '1px solid var(--color-border)',
              }}>
                {bet.status === 'open' && (
                  <div style={{ display: 'grid', gap: 'var(--spacing-xs)' }}>
                    <button
                      className="btn btn-secondary btn-full"
                      onClick={(e) => { e.stopPropagation(); handleCloseBet(bet.betId); }}
                      disabled={closingBetId === bet.betId}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      {closingBetId === bet.betId ? 'Closing...' : 'Close Bet'}
                    </button>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={(e) => { e.stopPropagation(); startEditBet(bet); }}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handleDeleteBet(bet.betId); }}
                        disabled={deletingBetId === bet.betId}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1, color: 'var(--color-error)' }}
                      >
                        {deletingBetId === bet.betId ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
                {bet.status === 'locked' && showResolveOptions !== bet.betId && (
                  <button
                    className="btn btn-primary btn-full"
                    onClick={(e) => { e.stopPropagation(); setShowResolveOptions(bet.betId); }}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    Resolve Bet
                  </button>
                )}
                {bet.status === 'locked' && showResolveOptions === bet.betId && (
                  <div style={{ display: 'grid', gap: 'var(--spacing-xs)' }} onClick={(e) => e.stopPropagation()}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: 0 }}>
                      Select winner:
                    </p>
                    {bet.options.map((option) => (
                      <button
                        key={option}
                        className="btn btn-secondary"
                        onClick={() => handleResolveBet(bet.betId, option)}
                        disabled={resolvingBetId === bet.betId}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', textAlign: 'left' }}
                      >
                        {option}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowResolveOptions(null)}
                      disabled={resolvingBetId === bet.betId}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    {resolvingBetId === bet.betId && (
                      <p className="text-secondary" style={{ fontSize: '0.875rem', textAlign: 'center', marginBottom: 0 }}>
                        Resolving...
                      </p>
                    )}
                  </div>
                )}
              </div>
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
            <h3 style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{isTournament && 'Tournament: '}{eventName} - Room {displayRoom.code}</span>
              <button
                className="btn btn-secondary"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.4rem',
                  minHeight: 'auto',
                  lineHeight: '1.2',
                  fontWeight: 500,
                }}
                onClick={handleCopyRoomLink}
              >
                {copiedRoomLink ? 'Copied!' : 'Share'}
              </button>
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
            <span
              style={{
                display: 'inline-block',
                marginTop: '0.35rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background: isHost ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isHost ? '#fff' : 'var(--color-text-muted)',
                border: isHost ? 'none' : '1px solid var(--color-border)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {isHost ? 'Host' : 'Guest'}
            </span>
          </div>
        </div>
        {isHost && displayRoom.status === 'active' && (
          <div className="mt-md" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-secondary btn-full"
              onClick={handleFinishRoom}
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              Finish {isTournament ? 'Tournament' : 'Event'}
            </button>
          </div>
        )}
      </div>

      {/* Admin error toast */}
      {adminError && (
        <div
          className="mb-md"
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: '3px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p className="text-error" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
            {adminError}
          </p>
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
                  <div>
                    <span>{matchRoom.matchDetails?.title || matchRoom.eventName || `Match ${matchRoom.code}`}</span>
                    {matchRoom.matchDetails?.matchDateTime && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                        {new Date(matchRoom.matchDetails.matchDateTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
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
                    placeholder="Match Title (e.g., IPL Match 12 - Qualifier)"
                    value={matchTitle}
                    onChange={(e) => setMatchTitle(e.target.value)}
                    maxLength={60}
                  />
                  <input
                    type="date"
                    placeholder="Match Date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                  />
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
            .map((participant, index) => {
              const linkData = participantLinks.find(p => p.userId === participant.userId);
              return (
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '600' }}>{participant.points}</span>
                    {isHost && linkData && (
                      <button
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.4rem',
                          minHeight: 'auto',
                          lineHeight: '1.2',
                        }}
                        onClick={() => handleCopyParticipantLink(linkData)}
                      >
                        {copiedUserId === participant.userId ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Bottom spacer for sticky action bar */}
      {isHost && displayRoom.status !== 'finished' && (
        <div style={{ height: '70px' }} />
      )}

      {/* Sticky Action Bar (host only) */}
      {isHost && displayRoom.status !== 'finished' && (
        <div className="sticky-action-bar">
          {displayRoom.status === 'waiting' && (
            <button className="btn btn-primary" onClick={handleStartRoom}
              style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 1rem' }}>
              Start {isTournament ? 'Tournament' : 'Event'}
            </button>
          )}
          {(displayRoom.status === 'waiting' || displayRoom.status === 'active') && (
            <button className="btn btn-primary" onClick={() => setShowBetModal(true)}
              style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 1rem' }}>
              + New Bet
            </button>
          )}
          {displayRoom.status === 'active' && (
            <button className="btn btn-secondary" onClick={() => setShowFeedModal(true)}
              style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 1rem' }}>
              Live Feed
            </button>
          )}
        </div>
      )}

      {/* Create Bet Modal */}
      {showBetModal && session?.hostId && (
        <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>Create New Bet</h4>
              <button
                className="btn btn-secondary"
                onClick={() => setShowBetModal(false)}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <BetCreationForm
              roomCode={code!}
              hostId={session.hostId}
              onSuccess={() => setShowBetModal(false)}
            />
          </div>
        </div>
      )}

      {/* Live Feed Modal */}
      {showFeedModal && session?.hostId && (
        <div className="modal-overlay" onClick={() => setShowFeedModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>Live Transcript Feed</h4>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFeedModal(false)}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <LiveFeedPanel
              roomCode={code!}
              hostId={session.hostId}
              automationEnabled={automationEnabled}
              onToggleAutomation={setAutomationEnabled}
            />
          </div>
        </div>
      )}

      {/* Edit Bet Modal */}
      {editingBet && (
        <div className="modal-overlay" onClick={() => setEditingBet(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>Edit Bet</h4>
              <button
                className="btn btn-secondary"
                onClick={() => setEditingBet(null)}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', marginBottom: 'var(--spacing-md)' }}>
              Editing will reset all existing votes and refund points to users.
            </p>
            <div className="mb-md">
              <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
                Question *
              </label>
              <input
                type="text"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                maxLength={200}
                style={{ width: '100%' }}
              />
            </div>
            <div className="mb-md">
              <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
                Options * (minimum 2)
              </label>
              {editOptions.map((option, index) => (
                <div key={index} style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                  <input
                    type="text"
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...editOptions];
                      newOptions[index] = e.target.value;
                      setEditOptions(newOptions);
                    }}
                    maxLength={100}
                    style={{ flex: 1 }}
                  />
                  {editOptions.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditOptions(editOptions.filter((_, i) => i !== index))}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {editOptions.length < 10 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditOptions([...editOptions, ''])}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  + Add Option
                </button>
              )}
            </div>
            <div className="mb-md">
              <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
                Points Value *
              </label>
              <input
                type="number"
                min={10}
                max={1000}
                value={editPointsValue}
                onChange={(e) => setEditPointsValue(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              onClick={handleEditBet}
              disabled={editSubmitting || !editQuestion.trim()}
            >
              {editSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
