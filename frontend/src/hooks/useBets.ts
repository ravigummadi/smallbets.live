/**
 * useBets hook - Real-time bets list synchronization
 *
 * IMPERATIVE SHELL: Manages Firestore listener lifecycle
 */

import { useState, useEffect } from 'react';
import { subscribeToBets } from '@/services/firestore';
import type { Bet } from '@/types';

export function useBets(roomCode: string | null) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setBets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to bets updates (I/O)
    const unsubscribe = subscribeToBets(roomCode, (updatedBets) => {
      setBets(updatedBets);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [roomCode]);

  return { bets, loading, error };
}
