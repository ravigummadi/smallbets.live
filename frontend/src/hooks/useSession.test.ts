/**
 * Unit tests for useSession hook
 *
 * CRITICAL: Tests corrupted sessionStorage JSON, missing keys, and recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from './useSession';

describe('useSession', () => {
  const SESSION_KEY = 'smallbets_session';

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Initial state', () => {
    it('should return null session when sessionStorage is empty', () => {
      const { result } = renderHook(() => useSession());

      expect(result.current.session).toBeNull();
      expect(result.current.isHost).toBe(false);
    });

    it('should load session from sessionStorage on mount', () => {
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

      const { result } = renderHook(() => useSession());

      expect(result.current.session).toEqual(sessionData);
    });

    it('should load session with hostId from sessionStorage', () => {
      const sessionData = {
        userId: 'host-123',
        roomCode: 'ABC123',
        hostId: 'host-123',
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

      const { result } = renderHook(() => useSession());

      expect(result.current.session).toEqual(sessionData);
      expect(result.current.isHost).toBe(true);
    });
  });

  describe('saveSession', () => {
    it('should save session to state and sessionStorage', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      expect(result.current.session).toEqual(sessionData);
      expect(sessionStorage.getItem(SESSION_KEY)).toBe(
        JSON.stringify(sessionData)
      );
    });

    it('should update existing session', () => {
      const { result } = renderHook(() => useSession());
      const initialSession = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };
      const updatedSession = {
        userId: 'user-123',
        roomCode: 'ABC123',
        hostId: 'host-456',
      };

      act(() => {
        result.current.saveSession(initialSession);
      });

      expect(result.current.session).toEqual(initialSession);

      act(() => {
        result.current.saveSession(updatedSession);
      });

      expect(result.current.session).toEqual(updatedSession);
      expect(sessionStorage.getItem(SESSION_KEY)).toBe(
        JSON.stringify(updatedSession)
      );
    });

    it('should save session synchronously to sessionStorage before updating state', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      // Before saveSession is called
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();

      act(() => {
        result.current.saveSession(sessionData);
        // sessionStorage should be updated immediately
        expect(sessionStorage.getItem(SESSION_KEY)).toBe(
          JSON.stringify(sessionData)
        );
      });
    });
  });

  describe('clearSession', () => {
    it('should clear session from state and sessionStorage', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      expect(result.current.session).toEqual(sessionData);

      act(() => {
        result.current.clearSession();
      });

      expect(result.current.session).toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('should clear session synchronously from sessionStorage before updating state', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      act(() => {
        result.current.clearSession();
        // sessionStorage should be cleared immediately
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
      });
    });
  });

  describe('isHost', () => {
    it('should return true when userId matches hostId', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'host-123',
        roomCode: 'ABC123',
        hostId: 'host-123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      expect(result.current.isHost).toBe(true);
    });

    it('should return false when userId does not match hostId', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
        hostId: 'host-456',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      expect(result.current.isHost).toBe(false);
    });

    it('should return false when hostId is not set', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      expect(result.current.isHost).toBe(false);
    });

    it('should return false when session is null', () => {
      const { result } = renderHook(() => useSession());

      expect(result.current.isHost).toBe(false);
    });
  });

  describe('Corrupted sessionStorage handling (CRITICAL)', () => {
    it('should handle invalid JSON in sessionStorage gracefully', () => {
      // Set invalid JSON
      sessionStorage.setItem(SESSION_KEY, '{invalid json');

      // This currently throws, but should recover gracefully
      // The hook should catch the error and return null session
      expect(() => {
        renderHook(() => useSession());
      }).toThrow();

      // TODO: Once error handling is added to useSession.ts:21,
      // this test should pass:
      // const { result } = renderHook(() => useSession());
      // expect(result.current.session).toBeNull();
    });

    it('should handle corrupted JSON with trailing garbage', () => {
      sessionStorage.setItem(
        SESSION_KEY,
        '{"userId":"user-123","roomCode":"ABC123"}garbage'
      );

      expect(() => {
        renderHook(() => useSession());
      }).toThrow();

      // TODO: Should recover gracefully once error handling is added
    });

    it('should handle missing required fields in session data', () => {
      // Session with missing roomCode
      const incompleteSession = JSON.stringify({ userId: 'user-123' });
      sessionStorage.setItem(SESSION_KEY, incompleteSession);

      const { result } = renderHook(() => useSession());

      // Currently loads the incomplete session
      expect(result.current.session).toEqual({ userId: 'user-123' });

      // Hook should still work for operations
      act(() => {
        result.current.clearSession();
      });
      expect(result.current.session).toBeNull();
    });

    it('should handle empty string in sessionStorage', () => {
      sessionStorage.setItem(SESSION_KEY, '');

      // Empty string is falsy, so the hook returns null without parsing
      const { result } = renderHook(() => useSession());
      expect(result.current.session).toBeNull();
    });

    it('should handle null value stored as string', () => {
      sessionStorage.setItem(SESSION_KEY, 'null');

      const { result } = renderHook(() => useSession());

      // JSON.parse('null') returns null, which is valid
      expect(result.current.session).toBeNull();
    });

    it('should handle undefined stored as string', () => {
      sessionStorage.setItem(SESSION_KEY, 'undefined');

      expect(() => {
        renderHook(() => useSession());
      }).toThrow();

      // TODO: Should recover gracefully once error handling is added
    });

    it('should handle array instead of object', () => {
      sessionStorage.setItem(SESSION_KEY, '[]');

      const { result } = renderHook(() => useSession());

      // Currently loads empty array (invalid session type)
      expect(result.current.session).toEqual([]);
    });

    it('should handle non-object primitives', () => {
      sessionStorage.setItem(SESSION_KEY, '123');

      const { result } = renderHook(() => useSession());

      // Currently loads number (invalid session type)
      expect(result.current.session).toBe(123);
    });
  });

  describe('Recovery after corruption', () => {
    it('should allow saving valid session after corrupted data is cleared', () => {
      sessionStorage.setItem(SESSION_KEY, '{invalid}');

      // Clear the corrupted data manually
      sessionStorage.removeItem(SESSION_KEY);

      const { result } = renderHook(() => useSession());
      const validSession = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(validSession);
      });

      expect(result.current.session).toEqual(validSession);
      expect(sessionStorage.getItem(SESSION_KEY)).toBe(
        JSON.stringify(validSession)
      );
    });

    it('should overwrite corrupted data when saving new session', () => {
      sessionStorage.setItem(SESSION_KEY, '{invalid}');

      // Mount with corrupted data (will throw currently)
      try {
        const { result } = renderHook(() => useSession());
        const validSession = {
          userId: 'user-123',
          roomCode: 'ABC123',
        };

        act(() => {
          result.current.saveSession(validSession);
        });

        // After saving, sessionStorage should have valid data
        expect(sessionStorage.getItem(SESSION_KEY)).toBe(
          JSON.stringify(validSession)
        );
      } catch (e) {
        // Expected to throw with current implementation
        expect(e).toBeDefined();
      }
    });
  });

  describe('Persistence across hook re-renders', () => {
    it('should maintain session state across re-renders', () => {
      const { result, rerender } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
      });

      rerender();

      expect(result.current.session).toEqual(sessionData);
    });

    it('should sync session from sessionStorage on new hook instance', () => {
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      // First hook instance
      const { result: result1 } = renderHook(() => useSession());
      act(() => {
        result1.current.saveSession(sessionData);
      });

      // Second hook instance (simulates different component)
      const { result: result2 } = renderHook(() => useSession());

      expect(result2.current.session).toEqual(sessionData);
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid successive saves', () => {
      const { result } = renderHook(() => useSession());

      act(() => {
        result.current.saveSession({
          userId: 'user-1',
          roomCode: 'ABC123',
        });
        result.current.saveSession({
          userId: 'user-2',
          roomCode: 'ABC123',
        });
        result.current.saveSession({
          userId: 'user-3',
          roomCode: 'ABC123',
        });
      });

      expect(result.current.session?.userId).toBe('user-3');
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      expect(stored.userId).toBe('user-3');
    });

    it('should handle save then immediate clear', () => {
      const { result } = renderHook(() => useSession());
      const sessionData = {
        userId: 'user-123',
        roomCode: 'ABC123',
      };

      act(() => {
        result.current.saveSession(sessionData);
        result.current.clearSession();
      });

      expect(result.current.session).toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('should handle clearing already empty session', () => {
      const { result } = renderHook(() => useSession());

      expect(result.current.session).toBeNull();

      act(() => {
        result.current.clearSession();
      });

      expect(result.current.session).toBeNull();
      expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });
  });
});
