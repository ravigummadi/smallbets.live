/**
 * BetUsersModal - Shows which users bet on which option for a given bet.
 * Users who haven't placed a bet are shown as "No bet placed".
 */

import { useEffect, useState } from 'react';
import { betApi } from '@/services/api';
import type { Bet, User, UserBet } from '@/types';

interface UserBetWithNickname extends UserBet {
  nickname: string;
}

interface BetUsersModalProps {
  bet: Bet;
  roomCode: string;
  participants: User[];
  onClose: () => void;
}

export default function BetUsersModal({
  bet,
  roomCode,
  participants,
  onClose,
}: BetUsersModalProps) {
  const [userBets, setUserBets] = useState<UserBetWithNickname[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    betApi
      .getBetUserBets(roomCode, bet.betId)
      .then((res) => {
        setUserBets(res.userBets as UserBetWithNickname[]);
      })
      .catch((err) => {
        setError(err.detail || 'Failed to load bets');
      })
      .finally(() => setLoading(false));
  }, [roomCode, bet.betId]);

  // Group user bets by selected option
  const betsByOption = new Map<string, UserBetWithNickname[]>();
  for (const option of bet.options) {
    betsByOption.set(option, []);
  }
  for (const ub of userBets) {
    const list = betsByOption.get(ub.selectedOption);
    if (list) {
      list.push(ub);
    }
  }

  // Find participants who haven't placed a bet
  const bettorIds = new Set(userBets.map((ub) => ub.userId));
  const noBetUsers = participants.filter((p) => !bettorIds.has(p.userId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 className="modal-title">Bets Placed</h4>
          <button
            className="btn btn-secondary btn-modal-close"
            onClick={onClose}
          >
            &#10005;
          </button>
        </div>

        <p className="bet-users-question">{bet.question}</p>

        {loading ? (
          <div className="text-center">
            <div className="spinner" />
            <p className="text-muted">Loading bets...</p>
          </div>
        ) : error ? (
          <p className="text-error">{error}</p>
        ) : (
          <div className="bet-users-content">
            {bet.options.map((option, index) => {
              const optionBets = betsByOption.get(option) || [];
              const isWinner =
                bet.status === 'resolved' && bet.winningOption === option;
              return (
                <div key={option} className="bet-users-option-group">
                  <div
                    className={`bet-users-option-header ${isWinner ? 'bet-users-option-header--winner' : ''}`}
                    style={{
                      borderLeftColor: `var(--color-option-${(index % 4) + 1})`,
                    }}
                  >
                    <span className="bet-users-option-name">{option}</span>
                    <span className="bet-users-option-count">
                      {optionBets.length}
                    </span>
                  </div>
                  {optionBets.length > 0 ? (
                    <div className="bet-users-list">
                      {optionBets.map((ub) => (
                        <div key={ub.userId} className="bet-users-user">
                          <span className="bet-users-nickname">
                            {ub.nickname}
                          </span>
                          {bet.status === 'resolved' &&
                            ub.pointsWon !== null && (
                              <span
                                className={
                                  ub.pointsWon > 0
                                    ? 'text-success'
                                    : 'text-error'
                                }
                              >
                                {ub.pointsWon > 0
                                  ? `+${ub.pointsWon}`
                                  : 'Lost'}
                              </span>
                            )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted bet-users-empty">No bets</p>
                  )}
                </div>
              );
            })}

            {noBetUsers.length > 0 && (
              <div className="bet-users-option-group">
                <div className="bet-users-option-header bet-users-option-header--no-bet">
                  <span className="bet-users-option-name">No bet placed</span>
                  <span className="bet-users-option-count">
                    {noBetUsers.length}
                  </span>
                </div>
                <div className="bet-users-list">
                  {noBetUsers.map((p) => (
                    <div key={p.userId} className="bet-users-user">
                      <span className="bet-users-nickname text-muted">
                        {p.nickname}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
