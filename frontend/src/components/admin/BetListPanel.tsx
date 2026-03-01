/**
 * BetListPanel - Display and manage all bets in a room
 */

import { useState } from 'react';
import { betApi } from '@/services/api';
import type { Bet } from '@/types';

interface BetListPanelProps {
  roomCode: string;
  hostId: string;
  bets: Bet[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-text-secondary)',
  open: 'var(--color-success)',
  locked: 'var(--color-warning)',
  resolved: 'var(--color-text-muted)',
};

export default function BetListPanel({
  roomCode,
  hostId,
  bets,
}: BetListPanelProps) {
  const [closingBet, setClosingBet] = useState<string | null>(null);
  const [resolvingBet, setResolvingBet] = useState<string | null>(null);
  const [showResolveOptions, setShowResolveOptions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCloseBet = async (betId: string) => {
    setClosingBet(betId);
    setError(null);

    try {
      await betApi.lockBet(roomCode, hostId, betId);
    } catch (err: any) {
      setError(err.detail || 'Failed to close bet');
      console.error('Failed to close bet:', err);
    } finally {
      setClosingBet(null);
    }
  };

  const handleResolveBet = async (betId: string, winningOption: string) => {
    setResolvingBet(betId);
    setError(null);

    try {
      await betApi.resolveBet(roomCode, hostId, betId, winningOption);
      setShowResolveOptions(null);
    } catch (err: any) {
      setError(err.detail || 'Failed to resolve bet');
      console.error('Failed to resolve bet:', err);
    } finally {
      setResolvingBet(null);
    }
  };

  // Sort bets: pending first, then by status, then by creation time
  const sortedBets = [...bets].sort((a, b) => {
    const statusOrder = { pending: 0, open: 1, locked: 2, resolved: 3 };
    const aOrder = statusOrder[a.status] ?? 4;
    const bOrder = statusOrder[b.status] ?? 4;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // For same status, sort by creation time (betId contains timestamp)
    return a.betId.localeCompare(b.betId);
  });

  if (bets.length === 0) {
    return (
      <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
        No bets created yet. Create your first bet above.
      </p>
    );
  }

  return (
    <div>
      {error && (
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
            {error}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
        {sortedBets.map((bet) => {
          const canClose = bet.status === 'open';
          const canResolve = bet.status === 'locked';
          const isResolvingThis = resolvingBet === bet.betId;
          const showingResolveOptions = showResolveOptions === bet.betId;

          return (
            <div
              key={bet.betId}
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {/* Bet Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--spacing-sm)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', marginBottom: 'var(--spacing-xs)' }}>
                    {bet.question}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 0 }}>
                    {bet.options.length} options • {bet.pointsValue} points
                  </p>
                </div>

                {/* Status Badge */}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: STATUS_COLORS[bet.status] || 'var(--color-text-secondary)',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {bet.status}
                </span>
              </div>

              {/* Options Preview */}
              <details style={{ marginBottom: 'var(--spacing-sm)' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  View options
                </summary>
                <ul style={{ marginTop: 'var(--spacing-sm)', paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                  {bet.options.map((option, index) => (
                    <li key={index} style={{ marginBottom: 'var(--spacing-xs)' }}>
                      {option}
                    </li>
                  ))}
                </ul>
              </details>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  {canClose && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleCloseBet(bet.betId)}
                      disabled={closingBet === bet.betId}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                    >
                      {closingBet === bet.betId ? 'Closing...' : 'Close Bet'}
                    </button>
                  )}

                  {canResolve && !showingResolveOptions && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowResolveOptions(bet.betId)}
                      disabled={isResolvingThis}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', flex: 1 }}
                    >
                      Resolve Bet
                    </button>
                  )}
                </div>

                {/* Resolve Options */}
                {canResolve && showingResolveOptions && (
                  <div style={{ display: 'grid', gap: 'var(--spacing-xs)' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: 0 }}>
                      Select winning option:
                    </p>
                    {bet.options.map((option) => (
                      <button
                        key={option}
                        className="btn btn-secondary"
                        onClick={() => handleResolveBet(bet.betId, option)}
                        disabled={isResolvingThis}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem', textAlign: 'left' }}
                      >
                        {option}
                      </button>
                    ))}
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowResolveOptions(null)}
                      disabled={isResolvingThis}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Cancel
                    </button>
                    {isResolvingThis && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 0, textAlign: 'center' }}>
                        Resolving...
                      </p>
                    )}
                  </div>
                )}
              </div>

              {bet.status === 'resolved' && bet.winningOption && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-success)', marginBottom: 0, marginTop: 'var(--spacing-sm)' }}>
                  ✓ Winner: {bet.winningOption}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
