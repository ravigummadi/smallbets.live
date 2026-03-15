/**
 * Room page - Main betting interface
 * Supports event rooms, tournament rooms, and match rooms
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRoom } from '@/hooks/useRoom';
import { useUser } from '@/hooks/useUser';
import { useBets } from '@/hooks/useBets';
import { useUserBets } from '@/hooks/useUserBets';
import { useParticipants } from '@/hooks/useParticipants';
import BetCreationForm from '@/components/admin/BetCreationForm';
import EditBetModal from '@/components/admin/EditBetModal';
import LiveFeedPanel from '@/components/admin/LiveFeedPanel';
import BetResolutionFeedback from '@/components/BetResolutionFeedback';
import MatchRoomDiscovery from '@/components/MatchRoomDiscovery';
import BetQueue from '@/components/BetQueue';
import AnimatedLeaderboard from '@/components/AnimatedLeaderboard';
import CricketMatchHeader from '@/components/CricketMatchHeader';
import OnboardingModal from '@/components/OnboardingModal';
import BetCard from '@/components/BetCard';
import BetUsersModal from '@/components/BetUsersModal';
import RoomHeader, { EVENT_TEMPLATE_NAMES } from '@/components/RoomHeader';
import HostActionBar from '@/components/HostActionBar';
import SessionRestoreFlow from '@/components/SessionRestoreFlow';
import { betApi, roomApi } from '@/services/api';
import type { Room, Bet, ParticipantWithLink } from '@/types';

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
  const [parentTournamentName, setParentTournamentName] = useState<string | null>(null);
  const [parentUserKey, setParentUserKey] = useState<string | null>(null);

  // Admin modal state (host only)
  const [showBetModal, setShowBetModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(true);

  // Inline bet management state (host only)
  const [closingBetId, setClosingBetId] = useState<string | null>(null);
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [viewingBetUsers, setViewingBetUsers] = useState<Bet | null>(null);

  // Participant links state (host only)
  const [participantLinks, setParticipantLinks] = useState<ParticipantWithLink[]>([]);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);

  // Resolution feedback state
  const [resolutionFeedback, setResolutionFeedback] = useState<{
    betId: string;
    won: boolean | null;
    pointsDelta: number;
  } | null>(null);
  const prevBetsRef = useRef<Map<string, Bet>>(new Map());
  const autoLockingRef = useRef<Set<string>>(new Set());

  // Compute effective host ID early so event handlers and effects can use it
  // Primary host uses hostId, co-hosts use their userId
  const effectiveHostId = session?.hostId || (
    session?.userId && localRoom?.coHostIds?.includes(session.userId) ? session.userId : undefined
  );

  // Match room creation state
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [matchTitle, setMatchTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [matchTeam1, setMatchTeam1] = useState('');
  const [matchTeam2, setMatchTeam2] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Session restoration via userKey link
  const needsRestore = userKey && code && (!session || session.roomCode !== code);

  // Redirect if no session for this room (and not on a userKey URL)
  useEffect(() => {
    if (needsRestore) return;
    if (userKey) return;
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
        .catch(err => console.error('Failed to load match rooms:', err));
    }
  }, [localRoom?.roomType, localRoom?.code]);

  // Load parent tournament name and user key for match room breadcrumb
  useEffect(() => {
    if (localRoom?.roomType !== 'match' || !localRoom.parentRoomCode) return;
    const parentCode = localRoom.parentRoomCode;
    roomApi.getRoom(parentCode)
      .then(parentRoom => setParentTournamentName(parentRoom.eventName || 'Tournament'))
      .catch(() => setParentTournamentName('Tournament'));
    if (user?.nickname) {
      roomApi.getUserKeyByNickname(parentCode, user.nickname)
        .then(res => setParentUserKey(res.userKey))
        .catch(() => {});
    }
  }, [localRoom?.roomType, localRoom?.parentRoomCode, user?.nickname]);

  // Load participant links for host/co-host
  useEffect(() => {
    const hostId = effectiveHostId;
    if (!hostId || !code) return;
    roomApi.getParticipantsWithLinks(code, hostId)
      .then((res) => setParticipantLinks(res.participants))
      .catch(err => console.error('Failed to load participant links:', err));
  }, [session?.hostId, session?.userId, localRoom?.coHostIds, code, participants.length]);

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

  const handleStartRoom = async () => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    try {
      await roomApi.startRoom(code, hostId);
      setLocalRoom(prev => prev ? { ...prev, status: 'active' } : prev);
    } catch (err) {
      console.error('Failed to start room:', err);
    }
  };

  const handleFinishRoom = async () => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    try {
      await roomApi.finishRoom(code, hostId);
      setLocalRoom(prev => prev ? { ...prev, status: 'finished' } : prev);
    } catch (err) {
      console.error('Failed to finish room:', err);
    }
  };

  const handleCloseBet = async (betId: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    setClosingBetId(betId);
    setAdminError(null);
    try {
      await betApi.lockBet(code, hostId, betId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to close bet');
    } finally {
      setClosingBetId(null);
    }
  };

  const handleToggleBettingLock = async (betId: string, locked: boolean) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    setAdminError(null);
    try {
      await betApi.toggleBettingLock(code, hostId, betId, locked);
    } catch (err: any) {
      setAdminError(err.detail || `Failed to ${locked ? 'lock' : 'unlock'} betting`);
    }
  };

  const handleResolveBet = async (betId: string, winningOption: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    setResolvingBetId(betId);
    setAdminError(null);
    try {
      await betApi.resolveBet(code, hostId, betId, winningOption);
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
    const hostId = effectiveHostId;
    if (!code || !hostId || !matchTeam1.trim() || !matchTeam2.trim()) return;
    setCreatingMatch(true);
    try {
      const response = await roomApi.createMatchRoom(code, hostId, {
        team1: matchTeam1.trim(),
        team2: matchTeam2.trim(),
        match_date_time: matchDate ? new Date(matchDate).toISOString() : new Date().toISOString(),
        title: matchTitle.trim() || undefined,
      });
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
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    try {
      await betApi.undoResolveBet(code, hostId, betId);
    } catch (err: any) {
      console.error('Failed to undo bet:', err);
    }
  }, [code, session?.hostId, session?.userId, localRoom?.coHostIds]);

  const handleTimerExpired = useCallback(async (betId: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    if (autoLockingRef.current.has(betId)) return;
    autoLockingRef.current.add(betId);
    try {
      await betApi.lockBet(code, hostId, betId);
    } catch {
      // Bet may already be locked
    } finally {
      autoLockingRef.current.delete(betId);
    }
  }, [code, session?.hostId, session?.userId, localRoom?.coHostIds]);

  // Detect bet resolutions and trigger feedback
  useEffect(() => {
    if (!bets.length) return;
    const currentMap = new Map(bets.map(b => [b.betId, b]));
    const prevMap = prevBetsRef.current;
    const ubMap = new Map(userBets.map(ub => [ub.betId, ub]));
    for (const [betId, bet] of currentMap) {
      const prev = prevMap.get(betId);
      if (prev && prev.status !== 'resolved' && bet.status === 'resolved') {
        const userBet = ubMap.get(betId);
        if (userBet) {
          const won = userBet.selectedOption === bet.winningOption;
          const pointsDelta = won ? (userBet.pointsWon ?? bet.pointsValue) : -bet.pointsValue;
          setResolutionFeedback({ betId, won, pointsDelta });
        }
      }
    }
    prevBetsRef.current = currentMap;
  }, [bets, userBets]);

  const handleDeleteBet = async (betId: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    setDeletingBetId(betId);
    setAdminError(null);
    try {
      await betApi.deleteBet(code, hostId, betId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to delete bet');
    } finally {
      setDeletingBetId(null);
    }
  };

  const handlePromoteCoHost = async (userId: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    try {
      await roomApi.addCoHost(code, hostId, userId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to promote co-host');
    }
  };

  const handleDemoteCoHost = async (userId: string) => {
    const hostId = effectiveHostId;
    if (!code || !hostId) return;
    try {
      await roomApi.removeCoHost(code, hostId, userId);
    } catch (err: any) {
      setAdminError(err.detail || 'Failed to remove co-host');
    }
  };

  const canUndo = (bet: Bet) => {
    if (bet.status !== 'resolved' || !bet.canUndoUntil) return false;
    return new Date() < new Date(bet.canUndoUntil);
  };

  // Treat as loading if we have a valid session for this room but user data hasn't
  // arrived yet. This prevents a flash of "Room not found" after session restore,
  // when useEffect for Firestore subscriptions hasn't fired yet.
  // Don't wait if room loading finished and room is null (room genuinely doesn't exist).
  const awaitingUserData = !roomLoading && localRoom && !user
    && session && session.roomCode === code;
  const stillLoading = roomLoading || userLoading || awaitingUserData;

  // Session restore must be rendered AFTER all hooks to avoid "rendered more hooks" error
  if (needsRestore) {
    return (
      <SessionRestoreFlow
        code={code!}
        userKey={userKey!}
        existingSession={session}
        onSessionRestored={saveSession}
      />
    );
  }

  if (stillLoading) {
    return (
      <div className="container container-padded-top">
        <div className="spinner" />
        <p className="text-center text-muted">Loading room...</p>
      </div>
    );
  }

  if (!localRoom || !user) {
    return (
      <div className="container container-padded-top">
        <div className="card">
          <p className="text-error">Room not found</p>
          <button className="btn btn-secondary mt-md" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const displayRoom = localRoom;
  const isCoHost = !!(session?.userId && displayRoom?.coHostIds?.includes(session.userId));
  const isHost = user.isAdmin || isCoHost;
  const isPrimaryHost = user.isAdmin;
  const isTournament = displayRoom.roomType === 'tournament';
  const isMatch = displayRoom.roomType === 'match';
  const eventName = displayRoom.eventName || EVENT_TEMPLATE_NAMES[displayRoom.eventTemplate] || 'Event';

  const openBets = bets.filter(bet => bet.status === 'open');
  const lockedBets = bets.filter(bet => bet.status === 'locked');
  const pendingBets = bets.filter(bet => bet.status === 'pending');
  const resolvedBets = bets.filter(bet => bet.status === 'resolved');
  const tournamentBets = bets.filter(bet => bet.betType === 'tournament');
  const matchBets = bets.filter(bet => bet.betType !== 'tournament');

  const userBetMap = new Map(userBets.map(ub => [ub.betId, ub]));

  const renderBetCard = (bet: Bet) => (
    <BetCard
      key={bet.betId}
      bet={bet}
      userBet={userBetMap.get(bet.betId)}
      isExpanded={expandedBets.has(bet.betId)}
      isPlacing={placingBets.has(bet.betId)}
      error={betErrors[bet.betId]}
      isHost={isHost}
      closingBetId={closingBetId}
      resolvingBetId={resolvingBetId}
      deletingBetId={deletingBetId}
      onToggleExpand={toggleBetExpanded}
      onPlaceBet={handlePlaceBet}
      onCloseBet={handleCloseBet}
      onToggleBettingLock={handleToggleBettingLock}
      onResolveBet={handleResolveBet}
      onDeleteBet={handleDeleteBet}
      onEditBet={setEditingBet}
      onUndoBet={handleUndoBet}
      onTimerExpired={handleTimerExpired}
      onViewBets={setViewingBetUsers}
      canUndo={canUndo}
    />
  );

  return (
    <div className="container-full" style={{ paddingTop: '1rem' }}>
      {/* Breadcrumb for match rooms */}
      {isMatch && displayRoom.parentRoomCode && (
        <div className="mb-md" style={{ fontSize: '0.875rem' }}>
          <Link
            to={parentUserKey
              ? `/room/${displayRoom.parentRoomCode}/u/${parentUserKey}`
              : `/join/${displayRoom.parentRoomCode}`}
            state={parentUserKey ? undefined : { nickname: user?.nickname }}
            style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
          >
            Tournament: {parentTournamentName || 'Tournament'}
          </Link>
          <span className="text-muted"> &gt; </span>
          <span>Match: {eventName}</span>
        </div>
      )}

      <RoomHeader
        room={displayRoom}
        user={user}
        isHost={isHost}
        isCoHost={isCoHost}
        isTournament={isTournament}
        copiedRoomLink={copiedRoomLink}
        onCopyRoomLink={handleCopyRoomLink}
        onFinishRoom={handleFinishRoom}
      />

      {adminError && (
        <div className="mb-md admin-error-toast">
          <p className="text-error admin-error-text">{adminError}</p>
        </div>
      )}

      {isMatch && displayRoom.matchDetails && (
        <CricketMatchHeader
          matchDetails={displayRoom.matchDetails}
          status={displayRoom.status}
          eventName={displayRoom.eventName}
        />
      )}

      {isTournament && displayRoom.status !== 'waiting' && (
        <>
          <MatchRoomDiscovery
            matchRooms={matchRooms}
            tournamentCode={displayRoom.code}
            userId={session?.userId}
            nickname={user?.nickname}
            isHost={isHost}
            onCreateMatch={isHost && displayRoom.status !== 'finished' ? () => setShowCreateMatch(true) : undefined}
          />
          {showCreateMatch && isHost && (
            <div className="card mb-md">
              <h4 className="mb-md">Create Match Room</h4>
              <div className="match-create-form">
                <input type="text" placeholder="Match Title (e.g., IPL Match 12 - Qualifier)" value={matchTitle} onChange={(e) => setMatchTitle(e.target.value)} maxLength={60} />
                <input type="date" placeholder="Match Date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} />
                <input type="text" placeholder="Team 1 (e.g., RCB)" value={matchTeam1} onChange={(e) => setMatchTeam1(e.target.value)} maxLength={30} />
                <input type="text" placeholder="Team 2 (e.g., MI)" value={matchTeam2} onChange={(e) => setMatchTeam2(e.target.value)} maxLength={30} />
                <div className="match-create-buttons">
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={creatingMatch || !matchTeam1.trim() || !matchTeam2.trim()} onClick={handleCreateMatchRoom}>
                    {creatingMatch ? 'Creating...' : 'Create Match Room'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowCreateMatch(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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
          {isHost && pendingBets.length > 0 && effectiveHostId && (
            <BetQueue pendingBets={pendingBets} roomCode={code!} hostId={effectiveHostId} />
          )}

          {isTournament && tournamentBets.length > 0 && (
            <div className="card mb-md">
              <h4 className="mb-md">Season Bets <span className="bet-count-badge">{tournamentBets.filter(b => b.status === 'open').length}</span></h4>
              <div className="bet-list">{tournamentBets.map(renderBetCard)}</div>
            </div>
          )}

          {betsLoading ? (
            <div className="card mb-md text-center"><p className="text-secondary">Loading bets...</p></div>
          ) : openBets.length === 0 && lockedBets.length === 0 && (!isTournament || matchBets.length === 0) ? (
            <div className="card mb-md text-center"><p className="text-secondary">No open bets. Waiting for next bet...</p></div>
          ) : !isTournament && openBets.length > 0 ? (
            <div className="card mb-md">
              <h4 className="mb-md">Open Bets <span className="bet-count-badge">{openBets.length}</span></h4>
              <div className="bet-list">{openBets.map(renderBetCard)}</div>
            </div>
          ) : null}

          {lockedBets.length > 0 && (
            <div className="card mb-md">
              <h4 className="mb-md">{isHost ? 'Resolve Bets' : 'Locked Bets'} <span className="bet-count-badge">{lockedBets.length}</span></h4>
              <div className="bet-list">{lockedBets.map(renderBetCard)}</div>
            </div>
          )}

          {isMatch && matchBets.length > 0 && (
            <div className="card mb-md">
              <h4 className="mb-md">Match Bets <span className="bet-count-badge">{matchBets.filter(b => b.status === 'open').length} open</span></h4>
              <div className="bet-list">{matchBets.map(renderBetCard)}</div>
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
              <div className="bet-list">{resolvedBets.map(renderBetCard)}</div>
            </div>
          )}
        </div>
      )}

      <AnimatedLeaderboard
        participants={participants}
        currentUserId={session?.userId}
        isHost={isHost}
        isPrimaryHost={isPrimaryHost}
        coHostIds={displayRoom.coHostIds || []}
        participantLinks={participantLinks}
        copiedUserId={copiedUserId}
        onCopyLink={handleCopyParticipantLink}
        onPromoteCoHost={handlePromoteCoHost}
        onDemoteCoHost={handleDemoteCoHost}
      />

      {isHost && (
        <HostActionBar
          room={displayRoom}
          isTournament={isTournament}
          openBets={openBets}
          closingBetId={closingBetId}
          onStartRoom={handleStartRoom}
          onCloseBet={handleCloseBet}
          onShowBetModal={() => setShowBetModal(true)}
          onShowFeedModal={() => setShowFeedModal(true)}
        />
      )}

      {showBetModal && effectiveHostId && (
        <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">Create New Bet</h4>
              <button className="btn btn-secondary btn-modal-close" onClick={() => setShowBetModal(false)}>&#10005;</button>
            </div>
            <BetCreationForm roomCode={code!} hostId={effectiveHostId} onSuccess={() => setShowBetModal(false)} />
          </div>
        </div>
      )}

      {showFeedModal && effectiveHostId && (
        <div className="modal-overlay" onClick={() => setShowFeedModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">Live Transcript Feed</h4>
              <button className="btn btn-secondary btn-modal-close" onClick={() => setShowFeedModal(false)}>&#10005;</button>
            </div>
            <LiveFeedPanel roomCode={code!} hostId={effectiveHostId} automationEnabled={automationEnabled} onToggleAutomation={setAutomationEnabled} />
          </div>
        </div>
      )}

      {editingBet && effectiveHostId && (
        <EditBetModal bet={editingBet} roomCode={code!} hostId={effectiveHostId} onClose={() => setEditingBet(null)} />
      )}

      {viewingBetUsers && (
        <BetUsersModal
          bet={viewingBetUsers}
          roomCode={code!}
          participants={participants}
          onClose={() => setViewingBetUsers(null)}
        />
      )}

      {resolutionFeedback && (
        <BetResolutionFeedback won={resolutionFeedback.won} pointsDelta={resolutionFeedback.pointsDelta} onDismiss={() => setResolutionFeedback(null)} />
      )}

      <OnboardingModal isHost={isHost} />
    </div>
  );
}
