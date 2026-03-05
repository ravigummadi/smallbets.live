/**
 * BetQueue - Host view for managing pre-created (pending) bets
 *
 * Shows a queue of pending bets that the host can open with a single tap
 * during a live match. Reduces hosting burden to: open next bet -> wait -> resolve.
 */

import { useState } from 'react';
import { betApi } from '@/services/api';
import type { Bet } from '@/types';

interface BetQueueProps {
  pendingBets: Bet[];
  roomCode: string;
  hostId: string;
}

export default function BetQueue({ pendingBets, roomCode, hostId }: BetQueueProps) {
  const [openingBetId, setOpeningBetId] = useState<string | null>(null);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pendingBets.length === 0) return null;

  const handleOpenBet = async (betId: string) => {
    setOpeningBetId(betId);
    setError(null);
    try {
      await betApi.openBet(roomCode, hostId, betId);
    } catch (err: any) {
      setError(err.detail || 'Failed to open bet');
    } finally {
      setOpeningBetId(null);
    }
  };

  const handleDeleteBet = async (betId: string) => {
    setDeletingBetId(betId);
    setError(null);
    try {
      await betApi.deleteBet(roomCode, hostId, betId);
    } catch (err: any) {
      setError(err.detail || 'Failed to delete bet');
    } finally {
      setDeletingBetId(null);
    }
  };

  return (
    <div className="card mb-md">
      <h4 className="mb-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Bet Queue
        <span style={{
          background: 'var(--color-warning)',
          color: '#000',
          padding: '0.125rem 0.5rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}>
          {pendingBets.length}
        </span>
      </h4>

      {error && (
        <div style={{
          padding: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-sm)',
          backgroundColor: 'var(--color-bg-elevated)',
          borderLeft: '3px solid var(--color-error)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <p className="text-error" style={{ marginBottom: 0, fontSize: '0.8rem' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {pendingBets.map((bet, index) => (
          <div
            key={bet.betId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 0.75rem',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--color-warning)',
            }}
          >
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              minWidth: '1.25rem',
            }}>
              {index + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 600,
                fontSize: '0.85rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {bet.question}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                {bet.options.length} options
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                minHeight: '32px',
                fontWeight: 700,
              }}
              onClick={() => handleOpenBet(bet.betId)}
              disabled={openingBetId === bet.betId}
            >
              {openingBetId === bet.betId ? '...' : 'Open'}
            </button>
            <button
              className="btn btn-secondary"
              style={{
                fontSize: '0.7rem',
                padding: '0.35rem 0.5rem',
                minHeight: '32px',
                color: 'var(--color-text-muted)',
              }}
              onClick={() => handleDeleteBet(bet.betId)}
              disabled={deletingBetId === bet.betId}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: 'var(--spacing-sm)', marginBottom: 0 }}>
        Tap "Open" to start each bet during the match
      </p>
    </div>
  );
}
