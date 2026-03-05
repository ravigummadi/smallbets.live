/**
 * OnboardingModal - First-time user experience
 *
 * Shows a brief welcome modal for first-time users explaining:
 * - Starting points
 * - How betting works
 * - What to expect
 *
 * For hosts, shows a host-specific guide.
 * Dismissed permanently via localStorage.
 */

import { useState } from 'react';

interface OnboardingModalProps {
  isHost: boolean;
}

const ONBOARDING_KEY = 'smallbets_onboarding_seen';
const HOST_GUIDE_KEY = 'smallbets_host_guide_seen';

export default function OnboardingModal({ isHost }: OnboardingModalProps) {
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );
  const [showHostGuide, setShowHostGuide] = useState(
    () => isHost && !localStorage.getItem(HOST_GUIDE_KEY)
  );

  const dismissWelcome = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowWelcome(false);
  };

  const dismissHostGuide = () => {
    localStorage.setItem(HOST_GUIDE_KEY, '1');
    setShowHostGuide(false);
  };

  if (showWelcome) {
    return (
      <div className="modal-overlay" onClick={dismissWelcome}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: 'var(--spacing-sm)',
              lineHeight: 1,
            }}>
              1000
            </div>
            <p style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 'var(--spacing-xs)' }}>
              Welcome to SmallBets!
            </p>
            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
              You start with 1,000 points
            </p>
          </div>

          <div style={{ display: 'grid', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>1</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Bet opens</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  Pick your answer before time runs out. Each bet costs 100 points.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>2</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Winners split the pot</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  If you pick right, you share the total pot with other winners.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>3</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Climb the leaderboard</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  Compete with friends for the top spot!
                </p>
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={dismissWelcome}
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  if (showHostGuide && isHost) {
    return (
      <div className="modal-overlay" onClick={dismissHostGuide}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <h4 style={{ marginBottom: 'var(--spacing-md)', textAlign: 'center' }}>Host Guide</h4>

          <div style={{ display: 'grid', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>1.</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Create bets</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  Tap "+ New Bet" to create questions. Use cricket templates for quick setup, or add to the queue for later.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>2.</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Lock when ready</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  Bets auto-lock when the timer expires, or tap "Lock" to close early.
                </p>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'start',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>3.</span>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.125rem', fontSize: '0.9rem' }}>Resolve with one tap</p>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                  Tap the winning option to resolve. You have 10 seconds to undo if needed.
                </p>
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={dismissHostGuide}
          >
            Start Hosting
          </button>
        </div>
      </div>
    );
  }

  return null;
}
