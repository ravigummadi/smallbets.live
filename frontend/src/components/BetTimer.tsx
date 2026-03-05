/**
 * BetTimer - Countdown timer for open bets with urgency effects
 *
 * Features:
 * - Displays remaining seconds countdown
 * - Last 10s: turns red, pulses
 * - Last 5s: larger text, faster pulse
 * - Timer expiry: triggers auto-lock callback, vibration on mobile
 */

import { useState, useEffect, useRef } from 'react';

interface BetTimerProps {
  openedAt: Date | null;
  timerDuration: number;
  status: string;
  onExpired?: () => void;
}

export default function BetTimer({ openedAt, timerDuration, status, onExpired }: BetTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const expiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    expiredRef.current = false;

    if (status !== 'open' || !openedAt || !timerDuration) {
      setSecondsLeft(null);
      return;
    }

    const calculate = () => {
      const elapsed = (Date.now() - new Date(openedAt).getTime()) / 1000;
      const remaining = Math.max(0, Math.ceil(timerDuration - elapsed));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        // Vibrate on mobile if supported
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        onExpired?.();
      }
    };

    calculate();
    intervalRef.current = setInterval(calculate, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [openedAt, timerDuration, status, onExpired]);

  if (secondsLeft === null || status !== 'open') return null;

  const isUrgent = secondsLeft <= 10;
  const isCritical = secondsLeft <= 5;
  const isExpired = secondsLeft <= 0;

  const timerClass = [
    'bet-timer',
    isUrgent ? 'bet-timer--urgent' : '',
    isCritical ? 'bet-timer--critical' : '',
    isExpired ? 'bet-timer--expired' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={timerClass}>
      <span className="bet-timer__value">{secondsLeft}s</span>
    </div>
  );
}
