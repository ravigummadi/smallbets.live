/**
 * BetCard - Individual bet card with header, options, and admin controls
 * Extracted from RoomPage to reduce component size
 */

import { useState, useEffect } from 'react';
import BetTimer from '@/components/BetTimer';
import type { Bet, UserBet } from '@/types';

interface BetCardProps {
  bet: Bet;
  userBet?: UserBet;
  isExpanded: boolean;
  isPlacing: boolean;
  error?: string;
  isHost: boolean;
  closingBetId: string | null;
  resolvingBetId: string | null;
  deletingBetId: string | null;
  onToggleExpand: (betId: string) => void;
  onPlaceBet: (betId: string, option: string) => void;
  onCloseBet: (betId: string) => void;
  onResolveBet: (betId: string, winningOption: string) => void;
  onDeleteBet: (betId: string) => void;
  onEditBet: (bet: Bet) => void;
  onUndoBet: (betId: string) => void;
  onTimerExpired?: (betId: string) => void;
  onViewBets: (bet: Bet) => void;
  canUndo: (bet: Bet) => boolean;
}

export default function BetCard({
  bet,
  userBet,
  isExpanded,
  isPlacing,
  error,
  isHost,
  closingBetId,
  resolvingBetId,
  deletingBetId,
  onToggleExpand,
  onPlaceBet,
  onCloseBet,
  onResolveBet,
  onDeleteBet,
  onEditBet,
  onUndoBet,
  onTimerExpired,
  onViewBets,
  canUndo,
}: BetCardProps) {
  const hasPlacedBet = !!userBet;
  const [isChanging, setIsChanging] = useState(false);

  // Close "change" UI when the bet selection updates (async operation completed)
  useEffect(() => {
    if (isChanging && userBet) setIsChanging(false);
  }, [userBet?.selectedOption]);

  return (
    <div className="bet-card">
      {/* Bet Header */}
      <div
        className={`bet-card-header ${isExpanded ? 'bet-card-header--expanded' : ''}`}
        onClick={() => onToggleExpand(bet.betId)}
      >
        <div className="bet-card-header-layout">
          <div className="bet-card-header-content">
            <p className="bet-card-question">
              {bet.question}
            </p>
            <p className="bet-card-meta">
              {bet.options.length} options &bull; {bet.pointsValue} points
              {bet.status === 'resolved' && bet.winningOption && (
                <span className="bet-card-winner">
                  &bull; Winner: {bet.winningOption}
                </span>
              )}
              {hasPlacedBet && bet.status !== 'resolved' && (
                <span className="bet-card-placed">
                  &bull; Bet placed
                </span>
              )}
            </p>
          </div>
          <div className="bet-card-actions">
            {bet.status === 'open' && bet.openedAt && bet.timerDuration > 0 && (
              <BetTimer
                openedAt={bet.openedAt}
                timerDuration={bet.timerDuration}
                status={bet.status}
                onExpired={isHost && onTimerExpired ? () => onTimerExpired(bet.betId) : undefined}
              />
            )}
            {bet.status === 'resolved' && canUndo(bet) && isHost && (
              <button
                className="btn btn-secondary btn-xs"
                onClick={(e) => { e.stopPropagation(); onUndoBet(bet.betId); }}
              >
                Undo
              </button>
            )}
            <span className="bet-card-expand-icon">
              {isExpanded ? '\u2212' : '+'}
            </span>
          </div>
        </div>
      </div>

      {/* Bet Content (collapsible) */}
      {isExpanded && (
        <div className="bet-card-body">
          {hasPlacedBet ? (
            <div className={`bet-card-user-bet ${
              bet.status === 'resolved'
                ? (userBet.selectedOption === bet.winningOption ? 'bet-card-user-bet--won' : 'bet-card-user-bet--lost')
                : ''
            }`}>
              <p className="bet-card-user-bet-text">
                Your bet: <strong>{userBet.selectedOption}</strong>
                {bet.status === 'resolved' && userBet.pointsWon !== null && (
                  <span className="bet-card-result">
                    {userBet.pointsWon > 0
                      ? <span className="text-success">Won {userBet.pointsWon} pts</span>
                      : <span className="text-error">Lost</span>}
                  </span>
                )}
                {bet.status === 'open' && !isChanging && (
                  <button
                    className="btn-link bet-card-change-btn"
                    onClick={() => setIsChanging(true)}
                  >
                    Change
                  </button>
                )}
              </p>
              {isChanging && bet.status === 'open' && (
                <>
                  {error && (
                    <div className="bet-card-error">
                      <p className="text-error bet-card-error-text">{error}</p>
                    </div>
                  )}
                  <div className="bet-card-options">
                    {bet.options.map((option) => (
                      <button
                        key={option}
                        className={`btn btn-secondary bet-card-option ${option === userBet.selectedOption ? 'bet-card-option--selected' : ''}`}
                        disabled={isPlacing || option === userBet.selectedOption}
                        onClick={() => onPlaceBet(bet.betId, option)}
                      >
                        {option}{option === userBet.selectedOption ? ' (current)' : ''}
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn-link bet-card-change-btn"
                    onClick={() => setIsChanging(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          ) : bet.status === 'open' ? (
            <>
              {error && (
                <div className="bet-card-error">
                  <p className="text-error bet-card-error-text">
                    {error}
                  </p>
                </div>
              )}

              <div className="bet-card-options">
                {bet.options.map((option) => (
                  <button
                    key={option}
                    className="btn btn-secondary bet-card-option"
                    disabled={isPlacing}
                    onClick={() => onPlaceBet(bet.betId, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {isPlacing && (
                <p className="bet-card-placing">
                  Placing bet...
                </p>
              )}
            </>
          ) : (
            <p className="text-muted bet-card-closed-text">
              {bet.status === 'locked' ? 'Betting is closed' : 'Bet resolved'}
            </p>
          )}

          {/* View all bets button */}
          {(bet.status !== 'pending') && (
            <button
              className="btn btn-secondary btn-xs bet-card-view-bets"
              onClick={(e) => { e.stopPropagation(); onViewBets(bet); }}
            >
              View All Bets
            </button>
          )}

          {/* Inline admin controls (host only) */}
          {isHost && (bet.status === 'open' || bet.status === 'locked') && (
            <div className="bet-card-admin">
              {bet.status === 'open' && (
                <div className="bet-card-admin-open">
                  <button
                    className="btn btn-secondary btn-full bet-card-close-btn"
                    onClick={(e) => { e.stopPropagation(); onCloseBet(bet.betId); }}
                    disabled={closingBetId === bet.betId}
                  >
                    {closingBetId === bet.betId ? 'Closing...' : 'Close Bet'}
                  </button>
                  <div className="bet-card-admin-row">
                    <button
                      className="btn btn-secondary bet-card-admin-btn"
                      onClick={(e) => { e.stopPropagation(); onEditBet(bet); }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger bet-card-admin-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteBet(bet.betId); }}
                      disabled={deletingBetId === bet.betId}
                    >
                      {deletingBetId === bet.betId ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
              {bet.status === 'locked' && (
                <div onClick={(e) => e.stopPropagation()}>
                  <p className="bet-card-resolve-label">
                    Tap the winner:
                  </p>
                  <div className="bet-card-resolve-options">
                    {bet.options.map((option) => (
                      <button
                        key={option}
                        className="quick-resolve-btn"
                        onClick={() => onResolveBet(bet.betId, option)}
                        disabled={resolvingBetId === bet.betId}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {resolvingBetId === bet.betId && (
                    <p className="bet-card-resolving">
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
}
