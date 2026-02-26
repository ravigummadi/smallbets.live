/**
 * Unit tests for Firestore service
 *
 * Tests Firestore subscription helpers and timestamp conversion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import * as firestoreService from './firestore';

// Mock firebase config
vi.mock('@/config/firebase', () => ({
  db: {},
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
    Timestamp: actual.Timestamp,
  };
});

describe('Firestore Service', () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let onSnapshotMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    onSnapshotMock = vi.fn().mockReturnValue(mockUnsubscribe);

    // Reset module to get fresh mock
    const { onSnapshot } = require('firebase/firestore');
    onSnapshot.mockImplementation(onSnapshotMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribeToRoom', () => {
    it('should subscribe to room and return data', () => {
      const callback = vi.fn();
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'oscars-2026',
        eventName: 'Oscars 2026',
        status: 'WAITING',
        hostId: 'host-123',
        automationEnabled: true,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.now(),
      };

      // Setup mock to call callback immediately with data
      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      const unsubscribe = firestoreService.subscribeToRoom('ABC123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ABC123',
          eventName: 'Oscars 2026',
          status: 'WAITING',
        })
      );
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should call callback with null when room does not exist', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => false,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('INVALID', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle missing optional fields with defaults', () => {
      const callback = vi.fn();
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'custom',
        status: 'WAITING',
        hostId: 'host-123',
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.now(),
        // Missing: eventName, automationEnabled
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('ABC123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: null,
          automationEnabled: true,
        })
      );
    });

    it('should convert Firestore timestamps to Date objects', () => {
      const callback = vi.fn();
      const now = Timestamp.now();
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        createdAt: now,
        expiresAt: now,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('ABC123', callback);

      const callArg = callback.mock.calls[0][0];
      expect(callArg.createdAt).toBeInstanceOf(Date);
      expect(callArg.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('subscribeToUser', () => {
    it('should subscribe to user and return data', () => {
      const callback = vi.fn();
      const mockUserData = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        isAdmin: false,
        joinedAt: Timestamp.now(),
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockUserData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUser('user-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          nickname: 'Player1',
          points: 1000,
        })
      );
    });

    it('should call callback with null when user does not exist', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => false,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUser('invalid-user', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle missing isAdmin field with default false', () => {
      const callback = vi.fn();
      const mockUserData = {
        userId: 'user-123',
        roomCode: 'ABC123',
        nickname: 'Player1',
        points: 1000,
        joinedAt: Timestamp.now(),
        // Missing: isAdmin
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockUserData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUser('user-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          isAdmin: false,
        })
      );
    });
  });

  describe('subscribeToBet', () => {
    it('should subscribe to bet and return data', () => {
      const callback = vi.fn();
      const mockBetData = {
        betId: 'bet-123',
        roomCode: 'ABC123',
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        status: 'OPEN',
        openedAt: Timestamp.now(),
        lockedAt: null,
        resolvedAt: null,
        winningOption: null,
        pointsValue: 100,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockBetData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToBet('bet-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          betId: 'bet-123',
          question: 'Who will win?',
          status: 'OPEN',
        })
      );
    });

    it('should handle null timestamps correctly', () => {
      const callback = vi.fn();
      const mockBetData = {
        betId: 'bet-123',
        roomCode: 'ABC123',
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        status: 'PENDING',
        openedAt: null,
        lockedAt: null,
        resolvedAt: null,
        pointsValue: 100,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockBetData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToBet('bet-123', callback);

      const callArg = callback.mock.calls[0][0];
      expect(callArg.openedAt).toBeNull();
      expect(callArg.lockedAt).toBeNull();
      expect(callArg.resolvedAt).toBeNull();
    });

    it('should handle missing optional fields with defaults', () => {
      const callback = vi.fn();
      const mockBetData = {
        betId: 'bet-123',
        roomCode: 'ABC123',
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        status: 'PENDING',
        // Missing: winningOption, pointsValue
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockBetData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToBet('bet-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          winningOption: null,
          pointsValue: 100,
        })
      );
    });
  });

  describe('subscribeToBets', () => {
    it('should subscribe to all bets in room', () => {
      const callback = vi.fn();
      const mockBets = [
        {
          betId: 'bet-1',
          roomCode: 'ABC123',
          question: 'Question 1',
          options: ['A', 'B'],
          status: 'OPEN',
          openedAt: Timestamp.now(),
          pointsValue: 100,
        },
        {
          betId: 'bet-2',
          roomCode: 'ABC123',
          question: 'Question 2',
          options: ['C', 'D'],
          status: 'PENDING',
          pointsValue: 100,
        },
      ];

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: mockBets.map((data) => ({
            data: () => data,
          })),
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToBets('ABC123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ betId: 'bet-1' }),
          expect.objectContaining({ betId: 'bet-2' }),
        ])
      );
    });

    it('should handle empty bet list', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: [],
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToBets('ABC123', callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('subscribeToParticipants', () => {
    it('should subscribe to all participants in room', () => {
      const callback = vi.fn();
      const mockUsers = [
        {
          userId: 'user-1',
          roomCode: 'ABC123',
          nickname: 'Player1',
          points: 1000,
          isAdmin: false,
          joinedAt: Timestamp.now(),
        },
        {
          userId: 'user-2',
          roomCode: 'ABC123',
          nickname: 'Player2',
          points: 1200,
          isAdmin: false,
          joinedAt: Timestamp.now(),
        },
      ];

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: mockUsers.map((data) => ({
            data: () => data,
          })),
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToParticipants('ABC123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', nickname: 'Player1' }),
          expect.objectContaining({ userId: 'user-2', nickname: 'Player2' }),
        ])
      );
    });

    it('should handle empty participants list', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: [],
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToParticipants('ABC123', callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('subscribeToUserBet', () => {
    it('should subscribe to user bet and return data', () => {
      const callback = vi.fn();
      const mockUserBetData = {
        userId: 'user-123',
        betId: 'bet-123',
        roomCode: 'ABC123',
        selectedOption: 'Team A',
        placedAt: Timestamp.now(),
        pointsWon: null,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockUserBetData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUserBet('user-123', 'bet-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          betId: 'bet-123',
          selectedOption: 'Team A',
        })
      );
    });

    it('should call callback with null when user bet does not exist', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => false,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUserBet('user-123', 'bet-123', callback);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('should handle missing pointsWon with default null', () => {
      const callback = vi.fn();
      const mockUserBetData = {
        userId: 'user-123',
        betId: 'bet-123',
        roomCode: 'ABC123',
        selectedOption: 'Team A',
        placedAt: Timestamp.now(),
        // Missing: pointsWon
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockUserBetData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUserBet('user-123', 'bet-123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          pointsWon: null,
        })
      );
    });
  });

  describe('subscribeToUserBets', () => {
    it('should subscribe to all user bets in room', () => {
      const callback = vi.fn();
      const mockUserBets = [
        {
          userId: 'user-123',
          betId: 'bet-1',
          roomCode: 'ABC123',
          selectedOption: 'Team A',
          placedAt: Timestamp.now(),
          pointsWon: 200,
        },
        {
          userId: 'user-123',
          betId: 'bet-2',
          roomCode: 'ABC123',
          selectedOption: 'Team B',
          placedAt: Timestamp.now(),
          pointsWon: null,
        },
      ];

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: mockUserBets.map((data) => ({
            data: () => data,
          })),
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUserBets('user-123', 'ABC123', callback);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ betId: 'bet-1', pointsWon: 200 }),
          expect.objectContaining({ betId: 'bet-2', pointsWon: null }),
        ])
      );
    });

    it('should handle empty user bets list', () => {
      const callback = vi.fn();

      onSnapshotMock.mockImplementation((query, callback) => {
        callback({
          docs: [],
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToUserBets('user-123', 'ABC123', callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('Timestamp conversion', () => {
    it('should handle Firestore Timestamp objects', () => {
      const callback = vi.fn();
      const timestamp = Timestamp.now();
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        createdAt: timestamp,
        expiresAt: timestamp,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('ABC123', callback);

      const result = callback.mock.calls[0][0];
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle objects with toDate method', () => {
      const callback = vi.fn();
      const mockDate = new Date('2024-01-01');
      const timestampLike = {
        toDate: () => mockDate,
      };
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        createdAt: timestampLike,
        expiresAt: timestampLike,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('ABC123', callback);

      const result = callback.mock.calls[0][0];
      expect(result.createdAt).toEqual(mockDate);
    });

    it('should handle plain date strings', () => {
      const callback = vi.fn();
      const dateString = '2024-01-01T00:00:00.000Z';
      const mockRoomData = {
        code: 'ABC123',
        eventTemplate: 'oscars-2026',
        status: 'WAITING',
        hostId: 'host-123',
        createdAt: dateString,
        expiresAt: dateString,
      };

      onSnapshotMock.mockImplementation((ref, callback) => {
        callback({
          exists: () => true,
          data: () => mockRoomData,
        });
        return mockUnsubscribe;
      });

      firestoreService.subscribeToRoom('ABC123', callback);

      const result = callback.mock.calls[0][0];
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Subscription lifecycle', () => {
    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      onSnapshotMock.mockReturnValue(mockUnsubscribe);

      const unsubscribe = firestoreService.subscribeToRoom('ABC123', callback);

      expect(unsubscribe).toBe(mockUnsubscribe);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribing from updates', () => {
      const callback = vi.fn();
      onSnapshotMock.mockReturnValue(mockUnsubscribe);

      const unsubscribe = firestoreService.subscribeToRoom('ABC123', callback);
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
