/**
 * Unit tests for useUser hook
 *
 * Tests user state management and loading states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from './useUser';
import type { User } from '@/types';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToUser: vi.fn(),
}));

describe('useUser', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let subscribeToUserMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    const { subscribeToUser } = require('@/services/firestore');
    subscribeToUserMock = subscribeToUser;
    subscribeToUserMock.mockReturnValue(mockUnsubscribe);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and null user', () => {
      subscribeToUserMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useUser('user-123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when userId is null', () => {
      const { result } = renderHook(() => useUser(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(subscribeToUserMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to user on mount', () => {
      renderHook(() => useUser('user-123'));

      expect(subscribeToUserMock).toHaveBeenCalledWith(
        'user-123',
        expect.any(Function)
      );
    });

    it('should update user state when subscription callback is triggered', async () => {
      const mockUser: User = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      subscribeToUserMock.mockImplementation((userId, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUser('user-123'));

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle user not found (null callback)', async () => {
      subscribeToUserMock.mockImplementation((userId, callback) => {
        setTimeout(() => callback(null), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUser('invalid-user'));

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useUser('user-123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe and resubscribe when userId changes', async () => {
      const { rerender } = renderHook(
        ({ id }) => useUser(id),
        { initialProps: { id: 'user-123' } }
      );

      expect(subscribeToUserMock).toHaveBeenCalledWith(
        'user-123',
        expect.any(Function)
      );

      rerender({ id: 'user-456' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToUserMock).toHaveBeenCalledWith(
        'user-456',
        expect.any(Function)
      );
    });
  });

  describe('Real-time updates', () => {
    it('should update when user points change', async () => {
      let callback: ((user: User | null) => void) | null = null;

      subscribeToUserMock.mockImplementation((userId, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUser('user-123'));

      const initialUser: User = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.(initialUser);

      await waitFor(() => {
        expect(result.current.user?.points).toBe(1000);
      });

      const updatedUser: User = { ...initialUser, points: 1200 };
      callback?.(updatedUser);

      await waitFor(() => {
        expect(result.current.user?.points).toBe(1200);
      });
    });

    it('should handle admin status changes', async () => {
      let callback: ((user: User | null) => void) | null = null;

      subscribeToUserMock.mockImplementation((userId, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUser('user-123'));

      const initialUser: User = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      callback?.(initialUser);

      await waitFor(() => {
        expect(result.current.user?.isAdmin).toBe(false);
      });

      const updatedUser: User = { ...initialUser, isAdmin: true };
      callback?.(updatedUser);

      await waitFor(() => {
        expect(result.current.user?.isAdmin).toBe(true);
      });
    });
  });

  describe('Loading state', () => {
    it('should set loading to false after receiving data', async () => {
      const mockUser: User = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      subscribeToUserMock.mockImplementation((userId, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useUser('user-123'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should reset loading when userId changes', async () => {
      const mockUser: User = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: new Date(),
      };

      subscribeToUserMock.mockImplementation((userId, callback) => {
        setTimeout(() => callback(mockUser), 10);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ id }) => useUser(id),
        { initialProps: { id: 'user-123' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      rerender({ id: 'user-456' });

      expect(result.current.loading).toBe(true);
    });
  });
});
