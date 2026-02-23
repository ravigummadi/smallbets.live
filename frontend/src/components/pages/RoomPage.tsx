/**
 * Room page - Main betting interface
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRoom } from '@/hooks/useRoom';
import { useUser } from '@/hooks/useUser';
import { useBet } from '@/hooks/useBet';
import { useParticipants } from '@/hooks/useParticipants';
import AdminPanel from '@/components/admin/AdminPanel';
import { betApi } from '@/services/api';
import type { Room } from '@/types';

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { room, loading: roomLoading } = useRoom(code || null);
  const { user, loading: userLoading } = useUser(session?.userId || null);
  const { bet, loading: betLoading } = useBet(room?.currentBetId || null);
  const { participants } = useParticipants(code || null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [localRoom, setLocalRoom] = useState<Room | null>(room);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [placingBet, setPlacingBet] = useState(false);
  const [betError, setBetError] = useState<string | null>(null);
  const [betSuccess, setBetSuccess] = useState(false);

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

  // Reset bet state when current bet changes
  useEffect(() => {
    setSelectedOption(null);
    setBetError(null);
    setBetSuccess(false);
  }, [bet?.betId]);

  const handlePlaceBet = async (option: string) => {
    if (!code || !session?.userId || !bet) return;

    setPlacingBet(true);
    setBetError(null);

    try {
      await betApi.placeBet(code, session.userId, {
        bet_id: bet.betId,
        selected_option: option,
      });

      setSelectedOption(option);
      setBetSuccess(true);
      setBetError(null);
    } catch (err: any) {
      setBetError(err.detail || 'Failed to place bet');
      console.error('Failed to place bet:', err);
    } finally {
      setPlacingBet(false);
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

  return (
    <div className="container-full" style={{ paddingTop: '1rem' }}>
      {/* Room Header */}
      <div className="card mb-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>Room {displayRoom.code}</h3>
            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 0 }}>
              {displayRoom.status === 'waiting' && 'Waiting to start'}
              {displayRoom.status === 'active' && 'Event in progress'}
              {displayRoom.status === 'finished' && 'Event finished'}
            </p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.25rem' }}>
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
            currentBet={bet}
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

      {displayRoom.status === 'active' && !bet && (
        <div className="card mb-md text-center">
          <p className="text-secondary">Waiting for next bet...</p>
        </div>
      )}

      {displayRoom.status === 'active' && bet && (
        <div className="card mb-md">
          <h3 className="mb-md">{bet.question}</h3>
          <p className="text-secondary mb-md" style={{ fontSize: '0.875rem' }}>
            Status: {bet.status}
          </p>

          {/* Success message */}
          {betSuccess && selectedOption && (
            <div
              className="mb-md"
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-bg-elevated)',
                borderLeft: '3px solid var(--color-success)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <p className="text-success" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                ✓ Bet placed on: {selectedOption}
              </p>
            </div>
          )}

          {/* Error message */}
          {betError && (
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
                {betError}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {bet.options.map((option) => {
              const isSelected = selectedOption === option;
              const isDisabled = bet.status !== 'open' || placingBet || selectedOption !== null;

              return (
                <button
                  key={option}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    textAlign: 'left',
                    padding: '1rem',
                    opacity: isDisabled && !isSelected ? 0.5 : 1,
                  }}
                  disabled={isDisabled}
                  onClick={() => handlePlaceBet(option)}
                >
                  {isSelected && '✓ '}
                  {option}
                </button>
              );
            })}
          </div>

          {placingBet && (
            <p className="text-secondary mt-md" style={{ fontSize: '0.875rem', textAlign: 'center' }}>
              Placing bet...
            </p>
          )}
        </div>
      )}

      {/* Participants List */}
      <div className="card">
        <h4 className="mb-md">Participants ({participants.length})</h4>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {participants
            .sort((a, b) => b.points - a.points)
            .map((participant) => (
              <div
                key={participant.userId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span>
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
