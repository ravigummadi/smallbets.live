/**
 * Unit tests for useParticipants hook
 *
 * Tests room participants subscription and count tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useParticipants } from './useParticipants';
import type { User } from '@/types';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToParticipants: vi.fn(),
}));

describe('useParticipants', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let subscribeToParticipantsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    const { subscribeToParticipants } = require('@/services/firestore');
    subscribeToParticipantsMock = subscribeToParticipants;
    subscribeToParticipantsMock.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and empty participants array', () => {
      subscribeToParticipantsMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useParticipants('ABC123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.participants).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when roomCode is null', () => {
      const { result } = renderHook(() => useParticipants(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.participants).toEqual([]);
      expect(subscribeToParticipantsMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to participants on mount', () => {
      renderHook(() => useParticipants('ABC123'));

      expect(subscribeToParticipantsMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );
    });

    it('should update participants array when subscription callback is triggered', async () => {
      const mockParticipants: User[] = [
        {
          userId: 'user-1',
          roomCode: 'ABC123',
          nickname: 'Player1',
          points: 1000,
          isAdmin: false,
          joinedAt: new Date(),
        },
        {
          userId: 'user-2',
          roomCode: 'ABC123',
          nickname: 'Player2',
          points: 1200,
          isAdmin: false,
          joinedAt: new Date(),
        },
      ];

      subscribeToParticipantsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback(mockParticipants), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      await waitFor(() => {
        expect(result.current.participants).toEqual(mockParticipants);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle empty participants array', async () => {
      subscribeToParticipantsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback([]), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      await waitFor(() => {
        expect(result.current.participants).toEqual([]);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useParticipants('ABC123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe and resubscribe when roomCode changes', () => {
      const { rerender } = renderHook(
        ({ code }) => useParticipants(code),
        { initialProps: { code: 'ABC123' } }
      );

      expect(subscribeToParticipantsMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );

      rerender({ code: 'XYZ789' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToParticipantsMock).toHaveBeenCalledWith(
        'XYZ789',
        expect.any(Function)
      );
    });
  });

  describe('Real-time updates', () => {
    it('should update when new participants join', async () => {
      let callback: ((participants: User[]) => void) | null = null;

      subscribeToParticipantsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      // Initial host only
      const host: User = {
        userId: 'host-1',
        roomCode: 'ABC123',
        nickname: 'Host',
        points: 1000,
        isAdmin: true,
        joinedAt: new Date(),
      };

      callback?.([host]);

      await waitFor(() => {
        expect(result.current.participants).toHaveLength(1);
      });

      // Player joins
      const player: User = {
        userId: 'user-2',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.([host, player]);

      await waitFor(() => {
        expect(result.current.participants).toHaveLength(2);
        expect(result.current.participants[1].nickname).toBe('Player1');
      });
    });

    it('should update when participant points change', async () => {
      let callback: ((participants: User[]) => void) | null = null;

      subscribeToParticipantsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      const participant: User = {
        userId: 'user-1',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.([participant]);

      await waitFor(() => {
        expect(result.current.participants[0]?.points).toBe(1000);
      });

      const updatedParticipant: User = { ...participant, points: 1200 };
      callback?.([updatedParticipant]);

      await waitFor(() => {
        expect(result.current.participants[0]?.points).toBe(1200);
      });
    });

    it('should update when participants leave', async () => {
      let callback: ((participants: User[]) => void) | null = null;

      subscribeToParticipantsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      const participant1: User = {
        userId: 'user-1',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      const participant2: User = {
        userId: 'user-2',
        roomCode: 'ABC123',
        nickname: 'Player2',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.([participant1, participant2]);

      await waitFor(() => {
        expect(result.current.participants).toHaveLength(2);
      });

      // One participant leaves
      callback?.([participant1]);

      await waitFor(() => {
        expect(result.current.participants).toHaveLength(1);
        expect(result.current.participants[0].userId).toBe('user-1');
      });
    });

    it('should track admin status changes', async () => {
      let callback: ((participants: User[]) => void) | null = null;

      subscribeToParticipantsMock.mockImplementation((roomCode, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      const participant: User = {
        userId: 'user-1',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.([participant]);

      await waitFor(() => {
        expect(result.current.participants[0]?.isAdmin).toBe(false);
      });

      const promotedParticipant: User = { ...participant, isAdmin: true };
      callback?.([promotedParticipant]);

      await waitFor(() => {
        expect(result.current.participants[0]?.isAdmin).toBe(true);
      });
    });
  });

  describe('Loading state', () => {
    it('should set loading to false after receiving data', async () => {
      subscribeToParticipantsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback([]), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useParticipants('ABC123'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should reset loading when roomCode changes', async () => {
      subscribeToParticipantsMock.mockImplementation((roomCode, callback) => {
        setTimeout(() => callback([]), 10);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ code }) => useParticipants(code),
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
