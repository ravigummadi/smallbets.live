/**
 * useUserBets hook - Real-time user bets synchronization
 *
 * IMPERATIVE SHELL: Manages Firestore listener lifecycle
 */

import { useState, useEffect } from 'react';
import { subscribeToUserBets } from '@/services/firestore';
import type { UserBet } from '@/types';

export function useUserBets(userId: string | null, roomCode: string | null) {
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !roomCode) {
      setUserBets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to user bets updates (I/O)
    const unsubscribe = subscribeToUserBets(userId, roomCode, (updatedUserBets) => {
      setUserBets(updatedUserBets);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [userId, roomCode]);

  return { userBets, loading, error };
}
