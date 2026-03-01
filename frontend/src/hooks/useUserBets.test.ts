/**
 * Unit tests for useUserBets hook
 *
 * Tests user's bets filtering and subscription management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserBets } from './useUserBets';
import { subscribeToUserBets } from '@/services/firestore';
import type { UserBet } from '@/types';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToUserBets: vi.fn(),
}));

const subscribeToUserBetsMock = vi.mocked(subscribeToUserBets);

describe('useUserBets', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    subscribeToUserBetsMock.mockReturnValue(mockUnsubscribe as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and empty userBets array', () => {
      subscribeToUserBetsMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.userBets).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when userId is null', () => {
      const { result } = renderHook(() => useUserBets(null, 'ABC123'));

      expect(result.current.loading).toBe(false);
      expect(result.current.userBets).toEqual([]);
      expect(subscribeToUserBetsMock).not.toHaveBeenCalled();
    });

    it('should not subscribe when roomCode is null', () => {
      const { result } = renderHook(() => useUserBets('user-123', null));

      expect(result.current.loading).toBe(false);
      expect(result.current.userBets).toEqual([]);
      expect(subscribeToUserBetsMock).not.toHaveBeenCalled();
    });

    it('should not subscribe when both userId and roomCode are null', () => {
      const { result } = renderHook(() => useUserBets(null, null));

      expect(result.current.loading).toBe(false);
      expect(result.current.userBets).toEqual([]);
      expect(subscribeToUserBetsMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to user bets on mount', () => {
      renderHook(() => useUserBets('user-123', 'ABC123'));

      expect(subscribeToUserBetsMock).toHaveBeenCalledWith(
        'user-123',
        'ABC123',
        expect.any(Function)
      );
    });

    it('should update userBets array when subscription callback is triggered', async () => {
      const mockUserBets: UserBet[] = [
        {
          userId: 'user-123',
          betId: 'bet-1',
          roomCode: 'ABC123',
          selectedOption: 'Team A',
          placedAt: new Date(),
          pointsWon: null,
        },
        {
          userId: 'user-123',
          betId: 'bet-2',
          roomCode: 'ABC123',
          selectedOption: 'Team B',
          placedAt: new Date(),
          pointsWon: 200,
        },
      ];

      subscribeToUserBetsMock.mockImplementation((userId, roomCode, callback) => {
        setTimeout(() => callback(mockUserBets), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      await waitFor(() => {
        expect(result.current.userBets).toEqual(mockUserBets);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle empty userBets array', async () => {
      subscribeToUserBetsMock.mockImplementation((userId, roomCode, callback) => {
        setTimeout(() => callback([]), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      await waitFor(() => {
        expect(result.current.userBets).toEqual([]);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useUserBets('user-123', 'ABC123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe and resubscribe when userId changes', () => {
      const { rerender } = renderHook(
        ({ userId, roomCode }) => useUserBets(userId, roomCode),
        { initialProps: { userId: 'user-123', roomCode: 'ABC123' } }
      );

      expect(subscribeToUserBetsMock).toHaveBeenCalledWith(
        'user-123',
        'ABC123',
        expect.any(Function)
      );

      rerender({ userId: 'user-456', roomCode: 'ABC123' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToUserBetsMock).toHaveBeenCalledWith(
        'user-456',
        'ABC123',
        expect.any(Function)
      );
    });

    it('should unsubscribe and resubscribe when roomCode changes', () => {
      const { rerender } = renderHook(
        ({ userId, roomCode }) => useUserBets(userId, roomCode),
        { initialProps: { userId: 'user-123', roomCode: 'ABC123' } }
      );

      expect(subscribeToUserBetsMock).toHaveBeenCalledWith(
        'user-123',
        'ABC123',
        expect.any(Function)
      );

      rerender({ userId: 'user-123', roomCode: 'XYZ789' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToUserBetsMock).toHaveBeenCalledWith(
        'user-123',
        'XYZ789',
        expect.any(Function)
      );
    });
  });

  describe('Real-time updates', () => {
    it('should update when new bets are placed', async () => {
      let callback: ((userBets: UserBet[]) => void) | null = null;

      subscribeToUserBetsMock.mockImplementation((userId, roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      // Initial empty
      callback?.([]);

      await waitFor(() => {
        expect(result.current.userBets).toHaveLength(0);
      });

      // Add first bet
      const userBet1: UserBet = {
        userId: 'user-123',
        betId: 'bet-1',
        roomCode: 'ABC123',
        selectedOption: 'Team A',
        placedAt: new Date(),
        pointsWon: null,
      };

      callback?.([userBet1]);

      await waitFor(() => {
        expect(result.current.userBets).toHaveLength(1);
        expect(result.current.userBets[0].betId).toBe('bet-1');
      });

      // Add second bet
      const userBet2: UserBet = {
        userId: 'user-123',
        betId: 'bet-2',
        roomCode: 'ABC123',
        selectedOption: 'Team B',
        placedAt: new Date(),
        pointsWon: null,
      };

      callback?.([userBet1, userBet2]);

      await waitFor(() => {
        expect(result.current.userBets).toHaveLength(2);
      });
    });

    it('should update when bet is resolved and pointsWon is updated', async () => {
      let callback: ((userBets: UserBet[]) => void) | null = null;

      subscribeToUserBetsMock.mockImplementation((userId, roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      const userBet: UserBet = {
        userId: 'user-123',
        betId: 'bet-1',
        roomCode: 'ABC123',
        selectedOption: 'Team A',
        placedAt: new Date(),
        pointsWon: null,
      };

      callback?.([userBet]);

      await waitFor(() => {
        expect(result.current.userBets[0]?.pointsWon).toBeNull();
      });

      // Update with points won
      const updatedBet: UserBet = { ...userBet, pointsWon: 200 };
      callback?.([updatedBet]);

      await waitFor(() => {
        expect(result.current.userBets[0]?.pointsWon).toBe(200);
      });
    });
  });

  describe('Loading state', () => {
    it('should set loading to false after receiving data', async () => {
      subscribeToUserBetsMock.mockImplementation((userId, roomCode, callback) => {
        setTimeout(() => callback([]), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUserBets('user-123', 'ABC123'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should reset loading when parameters change', async () => {
      subscribeToUserBetsMock.mockImplementation((userId, roomCode, callback) => {
        setTimeout(() => callback([]), 10);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ userId, roomCode }) => useUserBets(userId, roomCode),
        { initialProps: { userId: 'user-123', roomCode: 'ABC123' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      rerender({ userId: 'user-456', roomCode: 'ABC123' });

      expect(result.current.loading).toBe(true);
    });
  });
});
