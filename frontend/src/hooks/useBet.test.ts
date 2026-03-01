/**
 * Unit tests for useBet hook
 *
 * Tests single bet subscription and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBet } from './useBet';
import type { Bet } from '@/types';
import { subscribeToBet } from '@/services/firestore';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToBet: vi.fn(),
}));

const subscribeToBetMock = vi.mocked(subscribeToBet);

describe('useBet', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    subscribeToBetMock.mockReturnValue(mockUnsubscribe as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and null bet', () => {
      subscribeToBetMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useBet('bet-123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.bet).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when betId is null', () => {
      const { result } = renderHook(() => useBet(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.bet).toBeNull();
      expect(subscribeToBetMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to bet on mount', () => {
      renderHook(() => useBet('bet-123'));

      expect(subscribeToBetMock).toHaveBeenCalledWith(
        'bet-123',
        expect.any(Function)
      );
    });

    it('should update bet state when subscription callback is triggered', async () => {
      const mockBet: Bet = {
        betId: 'bet-123',
        roomCode: 'ABC123',
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        status: 'OPEN',
        openedAt: new Date(),
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      subscribeToBetMock.mockImplementation((betId, callback) => {
        setTimeout(() => callback(mockBet), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBet('bet-123'));

      await waitFor(() => {
        expect(result.current.bet).toEqual(mockBet);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useBet('bet-123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Real-time updates', () => {
    it('should update when bet status changes', async () => {
      let callback: ((bet: Bet | null) => void) | null = null;

      subscribeToBetMock.mockImplementation((betId, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBet('bet-123'));

      const initialBet: Bet = {
        betId: 'bet-123',
        roomCode: 'ABC123',
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        status: 'PENDING',
        openedAt: null,
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      callback?.(initialBet);

      await waitFor(() => {
        expect(result.current.bet?.status).toBe('PENDING');
      });

      // Open bet
      const openBet: Bet = {
        ...initialBet,
        status: 'OPEN',
        openedAt: new Date(),
      };
      callback?.(openBet);

      await waitFor(() => {
        expect(result.current.bet?.status).toBe('OPEN');
        expect(result.current.bet?.openedAt).toBeDefined();
      });

      // Lock bet
      const lockedBet: Bet = {
        ...openBet,
        status: 'LOCKED',
        lockedAt: new Date(),
      };
      callback?.(lockedBet);

      await waitFor(() => {
        expect(result.current.bet?.status).toBe('LOCKED');
        expect(result.current.bet?.lockedAt).toBeDefined();
      });

      // Resolve bet
      const resolvedBet: Bet = {
        ...lockedBet,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        winningOption: 'Team A',
      };
      callback?.(resolvedBet);

      await waitFor(() => {
        expect(result.current.bet?.status).toBe('RESOLVED');
        expect(result.current.bet?.winningOption).toBe('Team A');
      });
    });
  });
});
