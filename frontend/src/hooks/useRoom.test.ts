/**
 * Unit tests for useRoom hook
 *
 * Tests Firestore subscription lifecycle and cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRoom } from './useRoom';
import { subscribeToRoom } from '@/services/firestore';
import type { Room } from '@/types';

// Mock firestore service
vi.mock('@/services/firestore', () => ({
  subscribeToRoom: vi.fn(),
}));

const subscribeToRoomMock = vi.mocked(subscribeToRoom);

describe('useRoom', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    subscribeToRoomMock.mockReturnValue(mockUnsubscribe as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should start with loading true and null room', () => {
      subscribeToRoomMock.mockImplementation(() => mockUnsubscribe);

      const { result } = renderHook(() => useRoom('ABC123'));

      expect(result.current.loading).toBe(true);
      expect(result.current.room).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should not subscribe when roomCode is null', () => {
      const { result } = renderHook(() => useRoom(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.room).toBeNull();
      expect(subscribeToRoomMock).not.toHaveBeenCalled();
    });

    it('should not subscribe when roomCode is empty string', () => {
      const { result } = renderHook(() => useRoom(''));

      expect(result.current.loading).toBe(false);
      expect(result.current.room).toBeNull();
      expect(subscribeToRoomMock).not.toHaveBeenCalled();
    });
  });

  describe('Subscription lifecycle', () => {
    it('should subscribe to room on mount', () => {
      renderHook(() => useRoom('ABC123'));

      expect(subscribeToRoomMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );
    });

    it('should update room state when subscription callback is triggered', async () => {
      const mockRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      subscribeToRoomMock.mockImplementation((code, callback) => {
        // Simulate async callback
        setTimeout(() => callback(mockRoom), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useRoom('ABC123'));

      await waitFor(() => {
        expect(result.current.room).toEqual(mockRoom);
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle room not found (null callback)', async () => {
      subscribeToRoomMock.mockImplementation((code, callback) => {
        setTimeout(() => callback(null), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useRoom('INVALID'));

      await waitFor(() => {
        expect(result.current.room).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() => useRoom('ABC123'));

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should unsubscribe and resubscribe when roomCode changes', async () => {
      const { rerender } = renderHook(
        ({ code }) => useRoom(code),
        { initialProps: { code: 'ABC123' } }
      );

      expect(subscribeToRoomMock).toHaveBeenCalledWith(
        'ABC123',
        expect.any(Function)
      );

      // Change roomCode
      rerender({ code: 'XYZ789' });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToRoomMock).toHaveBeenCalledWith(
        'XYZ789',
        expect.any(Function)
      );
    });

    it('should unsubscribe when roomCode changes to null', () => {
      const { rerender } = renderHook(
        ({ code }) => useRoom(code),
        { initialProps: { code: 'ABC123' } }
      );

      expect(subscribeToRoomMock).toHaveBeenCalledTimes(1);

      rerender({ code: null });

      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(subscribeToRoomMock).toHaveBeenCalledTimes(1); // No new subscription
    });
  });

  describe('Real-time updates', () => {
    it('should update when room status changes', async () => {
      let callback: ((room: Room | null) => void) | null = null;

      subscribeToRoomMock.mockImplementation((code, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useRoom('ABC123'));

      // Initial room data
      const initialRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      callback?.(initialRoom);

      await waitFor(() => {
        expect(result.current.room?.status).toBe('WAITING');
      });

      // Update room status
      const updatedRoom: Room = { ...initialRoom, status: 'IN_PROGRESS' };
      callback?.(updatedRoom);

      await waitFor(() => {
        expect(result.current.room?.status).toBe('IN_PROGRESS');
      });
    });

    it('should handle multiple rapid updates', async () => {
      let callback: ((room: Room | null) => void) | null = null;

      subscribeToRoomMock.mockImplementation((code, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useRoom('ABC123'));

      const baseRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      // Simulate rapid updates
      callback?.({ ...baseRoom, status: 'WAITING' });
      callback?.({ ...baseRoom, status: 'IN_PROGRESS' });
      callback?.({ ...baseRoom, status: 'FINISHED' });

      await waitFor(() => {
        expect(result.current.room?.status).toBe('FINISHED');
      });
    });
  });

  describe('Loading state', () => {
    it('should set loading to true when subscribing', () => {
      const { result } = renderHook(() => useRoom('ABC123'));

      expect(result.current.loading).toBe(true);
    });

    it('should set loading to false after receiving data', async () => {
      const mockRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      subscribeToRoomMock.mockImplementation((code, callback) => {
        setTimeout(() => callback(mockRoom), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useRoom('ABC123'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should reset loading when roomCode changes', async () => {
      const mockRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      subscribeToRoomMock.mockImplementation((code, callback) => {
        setTimeout(() => callback(mockRoom), 10);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ code }) => useRoom(code),
        { initialProps: { code: 'ABC123' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Change room code
      rerender({ code: 'XYZ789' });

      // Should be loading again
      expect(result.current.loading).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should reset error state when subscribing to new room', async () => {
      const { result, rerender } = renderHook(
        ({ code }) => useRoom(code),
        { initialProps: { code: 'ABC123' } }
      );

      // Change room code (error should be reset)
      rerender({ code: 'XYZ789' });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should clear room state when switching to null roomCode', async () => {
      const mockRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      subscribeToRoomMock.mockImplementation((code, callback) => {
        setTimeout(() => callback(mockRoom), 0);
        return mockUnsubscribe;
      });

      const { result, rerender } = renderHook(
        ({ code }) => useRoom(code),
        { initialProps: { code: 'ABC123' } }
      );

      await waitFor(() => {
        expect(result.current.room).toEqual(mockRoom);
      });

      // Switch to null roomCode
      rerender({ code: null });

      expect(result.current.room).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Memory leaks prevention', () => {
    it('should not update state after unmount', async () => {
      let callback: ((room: Room | null) => void) | null = null;

      subscribeToRoomMock.mockImplementation((code, cb) => {
        callback = cb;
        return mockUnsubscribe;
      });

      const { unmount } = renderHook(() => useRoom('ABC123'));

      unmount();

      const mockRoom: Room = {
        code: 'ABC123',
        eventName: 'Test Event',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: new Date(),
        expiresAt: new Date(),
      };

      // This should not cause errors (state updates after unmount)
      expect(() => callback?.(mockRoom)).not.toThrow();
    });
  });
});
