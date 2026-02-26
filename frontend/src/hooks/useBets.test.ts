/**
 * Unit tests for useBets hook
 *
 * Tests all bets subscription and array state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBets } from './useBets';
import type { Bet } from '@/types';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToBets: vi.fn(),
}));

describe('useBets', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let subscribeToBetsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    const { subscribeToBets } = require('@/services/firestore');
    subscribeToBetsMock = subscribeToBets;
    subscribeToBetsMock.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and empty bets array', () => {
      subscribeToBetsMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useBets('ABC123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.bets).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when roomCode is null', () => {
      const { result } = renderHook(() => useBets(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.bets).toEqual([]);
      expect(subscribeToBetsMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to bets on mount', () => {
      renderHook(() => useBets('ABC123'));

      expect(subscribeToBetsMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );
    });

    it('should update bets array when subscription callback is triggered', async () => {
      const mockBets: Bet[] = [
        {
          betId: 'bet-1',
          roomCode: 'ABC123',
          question: 'Question 1',
          options: ['A', 'B'],
          status: 'OPEN',
          openedAt: new Date(),
          lockedAt: null,
          resolvedAt: null,
          winningOption: null,
          pointsValue: 100,
        },
        {
          betId: 'bet-2',
          roomCode: 'ABC123',
          question: 'Question 2',
          options: ['C', 'D'],
          status: 'PENDING',
          openedAt: null,
          lockedAt: null,
          resolvedAt: null,
          winningOption: null,
          pointsValue: 100,
        },
      ];

      subscribeToBetsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback(mockBets), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      await waitFor(() => {
        expect(result.current.bets).toEqual(mockBets);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle empty bets array', async () => {
      subscribeToBetsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback([]), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      await waitFor(() => {
        expect(result.current.bets).toEqual([]);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useBets('ABC123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe and resubscribe when roomCode changes', () => {
      const { rerender } = renderHook(
        ({ code }) => useBets(code),
        { initialProps: { code: 'ABC123' } }
      );

      expect(subscribeToBetsMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );

      rerender({ code: 'XYZ789' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToBetsMock).toHaveBeenCalledWith(
        'XYZ789',
        expect.any(Function)
      );
    });
  });

  describe('Real-time updates', () => {
    it('should update when bets are added', async () => {
      let callback: ((bets: Bet[]) => void) | null = null;

      subscribeToBetsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      // Initial empty
      callback?.([]);

      await waitFor(() => {
        expect(result.current.bets).toHaveLength(0);
      });

      // Add first bet
      const bet1: Bet = {
        betId: 'bet-1',
        roomCode: 'ABC123',
        question: 'Question 1',
        options: ['A', 'B'],
        status: 'OPEN',
        openedAt: new Date(),
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      callback?.([bet1]);

      await waitFor(() => {
        expect(result.current.bets).toHaveLength(1);
        expect(result.current.bets[0].betId).toBe('bet-1');
      });

      // Add second bet
      const bet2: Bet = {
        betId: 'bet-2',
        roomCode: 'ABC123',
        question: 'Question 2',
        options: ['C', 'D'],
        status: 'PENDING',
        openedAt: null,
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      callback?.([bet1, bet2]);

      await waitFor(() => {
        expect(result.current.bets).toHaveLength(2);
      });
    });

    it('should update when bet status changes', async () => {
      let callback: ((bets: Bet[]) => void) | null = null;

      subscribeToBetsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      const bet: Bet = {
        betId: 'bet-1',
        roomCode: 'ABC123',
        question: 'Question 1',
        options: ['A', 'B'],
        status: 'PENDING',
        openedAt: null,
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      callback?.([bet]);

      await waitFor(() => {
        expect(result.current.bets[0]?.status).toBe('PENDING');
      });

      const updatedBet: Bet = { ...bet, status: 'OPEN', openedAt: new Date() };
      callback?.([updatedBet]);

      await waitFor(() => {
        expect(result.current.bets[0]?.status).toBe('OPEN');
      });
    });

    it('should update when bets are removed', async () => {
      let callback: ((bets: Bet[]) => void) | null = null;

      subscribeToBetsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      const bet1: Bet = {
        betId: 'bet-1',
        roomCode: 'ABC123',
        question: 'Question 1',
        options: ['A', 'B'],
        status: 'OPEN',
        openedAt: new Date(),
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      const bet2: Bet = {
        betId: 'bet-2',
        roomCode: 'ABC123',
        question: 'Question 2',
        options: ['C', 'D'],
        status: 'OPEN',
        openedAt: new Date(),
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      callback?.([bet1, bet2]);

      await waitFor(() => {
        expect(result.current.bets).toHaveLength(2);
      });

      // Remove one bet
      callback?.([bet1]);

      await waitFor(() => {
        expect(result.current.bets).toHaveLength(1);
        expect(result.current.bets[0].betId).toBe('bet-1');
      });
    });
  });

  describe('Loading state', () => {
    it('should set loading to false after receiving data', async () => {
      const mockBets: Bet[] = [];

      subscribeToBetsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback(mockBets), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useBets('ABC123'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should reset loading when roomCode changes', async () => {
      subscribeToBetsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback([]), 10);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ code }) => useBets(code),
        { initialProps: { code: 'ABC123' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      rerender({ code: 'XYZ789' });

      expect(result.current.loading).toBe(true);
    });
  });
});
