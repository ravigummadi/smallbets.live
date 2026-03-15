/**
 * AnimatedLeaderboard - Leaderboard with position change animations
 *
 * After bet resolution, shows position changes sliding up/down,
 * points delta (+200 / -100), and auto-shows for 3 seconds.
 */

import { useState, useEffect, useRef } from 'react';
import type { User, ParticipantWithLink } from '@/types';

interface AnimatedLeaderboardProps {
  participants: User[];
  currentUserId?: string;
  isHost: boolean;
  participantLinks?: ParticipantWithLink[];
  copiedUserId: string | null;
  onCopyLink?: (participant: ParticipantWithLink) => void;
}

interface RankedParticipant extends User {
  rank: number;
  prevRank: number | null;
  pointsDelta: number | null;
}

export default function AnimatedLeaderboard({
  participants,
  currentUserId,
  isHost,
  participantLinks = [],
  copiedUserId,
  onCopyLink,
}: AnimatedLeaderboardProps) {
  const prevParticipantsRef = useRef<Map<string, { rank: number; points: number }>>(new Map());
  const [rankedParticipants, setRankedParticipants] = useState<RankedParticipant[]>([]);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const sorted = [...participants].sort((a, b) => b.points - a.points);
    const prevMap = prevParticipantsRef.current;

    const ranked: RankedParticipant[] = sorted.map((p, index) => {
      const rank = index + 1;
      const prev = prevMap.get(p.userId);
      const prevRank = prev ? prev.rank : null;
      const pointsDelta = prev ? p.points - prev.points : null;

      return { ...p, rank, prevRank, pointsDelta };
    });

    // Detect if any positions or points changed
    const hasChanges = ranked.some(p => p.prevRank !== null && (p.prevRank !== p.rank || (p.pointsDelta !== null && p.pointsDelta !== 0)));

    setRankedParticipants(ranked);

    if (hasChanges) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 2000);
    }

    // Update previous state
    const newMap = new Map<string, { rank: number; points: number }>();
    sorted.forEach((p, index) => {
      newMap.set(p.userId, { rank: index + 1, points: p.points });
    });
    prevParticipantsRef.current = newMap;
  }, [participants]);

  const getRankChange = (p: RankedParticipant) => {
    if (p.prevRank === null || p.prevRank === p.rank) return null;
    const diff = p.prevRank - p.rank;
    if (diff > 0) return { direction: 'up' as const, amount: diff };
    return { direction: 'down' as const, amount: Math.abs(diff) };
  };

  return (
    <div className="card">
      <h4 className="mb-md">Leaderboard ({participants.length})</h4>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {rankedParticipants.map((participant) => {
          const linkData = participantLinks.find(p => p.userId === participant.userId);
          const rankChange = getRankChange(participant);
          const isCurrentUser = participant.userId === currentUserId;

          return (
            <div
              key={participant.userId}
              className={animating && rankChange ? 'leaderboard-slide' : ''}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                backgroundColor: isCurrentUser ? 'rgba(20, 184, 166, 0.1)' : 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-md)',
                border: isCurrentUser ? '1px solid rgba(20, 184, 166, 0.25)' : 'none',
                transition: 'transform 0.5s ease, background-color 0.3s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {participant.rank <= 3 ? (
                  <span className={`rank-badge rank-${participant.rank}`}>{participant.rank}</span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    marginRight: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                  }}>
                    {participant.rank}
                  </span>
                )}
                <span>
                  {participant.nickname}
                  {participant.isAdmin && (
                    <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                      (Host)
                    </span>
                  )}
                  {isCurrentUser && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--color-primary)' }}>
                      You
                    </span>
                  )}
                </span>
                {/* Rank change indicator */}
                {animating && rankChange && (
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: rankChange.direction === 'up' ? 'var(--color-success)' : 'var(--color-error)',
                    animation: 'resolution-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    {rankChange.direction === 'up' ? `+${rankChange.amount}` : `-${rankChange.amount}`}
                  </span>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '600' }}>{participant.points}</span>
                {/* Points delta */}
                {animating && participant.pointsDelta !== null && participant.pointsDelta !== 0 && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: participant.pointsDelta > 0 ? 'var(--color-success)' : 'var(--color-error)',
                    animation: 'resolution-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    {participant.pointsDelta > 0 ? `+${participant.pointsDelta}` : participant.pointsDelta}
                  </span>
                )}
                {isHost && linkData && onCopyLink && (
                  <button
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.4rem',
                      minHeight: 'auto',
                      lineHeight: '1.2',
                    }}
                    onClick={() => onCopyLink(linkData)}
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
  );
}
