/**
 * BetResolutionFeedback - Visual feedback overlay when a bet resolves
 *
 * Winners see: green flash + confetti + "+X points" animation
 * Losers see: red flash + "-X points" animation
 * Non-participants see: brief neutral notification
 */

import { useEffect, useState } from 'react';

interface BetResolutionFeedbackProps {
  won: boolean | null; // null = didn't participate
  pointsDelta: number; // positive for wins, negative for losses
  onDismiss: () => void;
}

const CONFETTI_COLORS = [
  'var(--color-primary)',
  'var(--color-accent-blue)',
  'var(--color-warning)',
  'var(--color-error)',
  'var(--color-accent-warm)',
];

export default function BetResolutionFeedback({
  won,
  pointsDelta,
  onDismiss,
}: BetResolutionFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out
    }, 2500);

    // Vibrate on result
    if (navigator.vibrate) {
      if (won) {
        navigator.vibrate([50, 30, 50, 30, 100]);
      } else if (won === false) {
        navigator.vibrate(150);
      }
    }

    return () => clearTimeout(timer);
  }, [onDismiss, won]);

  if (won === null) return null;

  const overlayClass = [
    'resolution-overlay',
    won ? 'resolution-overlay--won' : 'resolution-overlay--lost',
    visible ? 'resolution-overlay--visible' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={overlayClass}>
      {won && <div className="confetti-container" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            }}
          />
        ))}
      </div>}
      <div className="resolution-content">
        <div className={`resolution-icon ${won ? 'resolution-icon--won' : 'resolution-icon--lost'}`}>
          {won ? '\u2713' : '\u2717'}
        </div>
        <div className={`resolution-points ${won ? 'resolution-points--won' : 'resolution-points--lost'}`}>
          {pointsDelta > 0 ? `+${pointsDelta}` : pointsDelta} pts
        </div>
        <div className="resolution-label">
          {won ? 'You won!' : 'Better luck next time'}
        </div>
      </div>
    </div>
  );
}
