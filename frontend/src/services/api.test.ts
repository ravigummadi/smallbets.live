/**
 * Unit tests for API service
 *
 * Tests HTTP client error handling, network failures, and API calls
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { roomApi, betApi } from './api';
import type { CreateRoomRequest, JoinRoomRequest, PlaceBetRequest } from '@/types';

describe('API Service', () => {
  // Save original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Mock fetch before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('roomApi', () => {
    describe('createRoom', () => {
      it('should create a room successfully', async () => {
        const mockRequest: CreateRoomRequest = {
          host_nickname: 'TestHost',
          event_name: 'Test Event',
        };
        const mockResponse = {
          room_code: 'ABC123',
          host_id: 'host-123',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.createRoom(mockRequest);

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(mockRequest),
          })
        );
      });

      it('should handle 400 error with detail message', async () => {
        const mockRequest: CreateRoomRequest = {
          host_nickname: '',
          event_name: 'Test Event',
        };
        const errorDetail = 'Nickname is required';

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: errorDetail }),
        });

        await expect(roomApi.createRoom(mockRequest)).rejects.toThrow(
          'API request failed: 400'
        );
      });

      it('should handle network failure', async () => {
        const mockRequest: CreateRoomRequest = {
          host_nickname: 'TestHost',
          event_name: 'Test Event',
        };

        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        await expect(roomApi.createRoom(mockRequest)).rejects.toThrow('Network error');
      });

      it('should handle response without JSON body', async () => {
        const mockRequest: CreateRoomRequest = {
          host_nickname: 'TestHost',
          event_name: 'Test Event',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        await expect(roomApi.createRoom(mockRequest)).rejects.toThrow(
          'API request failed: 500'
        );
      });
    });

    describe('getRoom', () => {
      it('should fetch room successfully', async () => {
        const mockRoom = {
          code: 'ABC123',
          event_name: 'Test Event',
          host_id: 'host-123',
          status: 'WAITING',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockRoom,
        });

        const result = await roomApi.getRoom('ABC123');

        expect(result).toEqual(mockRoom);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms/ABC123'),
          expect.any(Object)
        );
      });

      it('should handle 404 room not found', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ detail: 'Room not found' }),
        });

        await expect(roomApi.getRoom('INVALID')).rejects.toThrow(
          'API request failed: 404'
        );
      });
    });

    describe('joinRoom', () => {
      it('should join room successfully', async () => {
        const mockRequest: JoinRoomRequest = {
          nickname: 'Player1',
        };
        const mockResponse = {
          user_id: 'user-123',
          room_code: 'ABC123',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.joinRoom('ABC123', mockRequest);

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms/ABC123/join'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(mockRequest),
          })
        );
      });

      it('should handle duplicate nickname error', async () => {
        const mockRequest: JoinRoomRequest = {
          nickname: 'ExistingPlayer',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: 'Nickname already taken' }),
        });

        await expect(roomApi.joinRoom('ABC123', mockRequest)).rejects.toThrow(
          'API request failed: 400'
        );
      });
    });

    describe('getParticipants', () => {
      it('should fetch participants successfully', async () => {
        const mockResponse = {
          participants: [
            { id: 'user-1', nickname: 'Player1', points: 1000 },
            { id: 'user-2', nickname: 'Player2', points: 1000 },
          ],
          count: 2,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.getParticipants('ABC123');

        expect(result).toEqual(mockResponse);
        expect(result.count).toBe(2);
      });
    });

    describe('getLeaderboard', () => {
      it('should fetch leaderboard successfully', async () => {
        const mockResponse = {
          leaderboard: [
            { user_id: 'user-1', nickname: 'Player1', points: 1200, rank: 1 },
            { user_id: 'user-2', nickname: 'Player2', points: 800, rank: 2 },
          ],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.getLeaderboard('ABC123');

        expect(result).toEqual(mockResponse);
        expect(result.leaderboard).toHaveLength(2);
      });
    });

    describe('startRoom', () => {
      it('should start room with host authorization', async () => {
        const mockResponse = { status: 'IN_PROGRESS' };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.startRoom('ABC123', 'host-123');

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms/ABC123/start'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-Host-Id': 'host-123',
            }),
          })
        );
      });

      it('should reject unauthorized host', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ detail: 'Not authorized' }),
        });

        await expect(roomApi.startRoom('ABC123', 'wrong-host')).rejects.toThrow(
          'API request failed: 403'
        );
      });
    });

    describe('finishRoom', () => {
      it('should finish room and return final leaderboard', async () => {
        const mockResponse = {
          status: 'FINISHED',
          leaderboard: [
            { user_id: 'user-1', nickname: 'Player1', points: 1500, rank: 1 },
          ],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await roomApi.finishRoom('ABC123', 'host-123');

        expect(result).toEqual(mockResponse);
        expect(result.status).toBe('FINISHED');
      });
    });
  });

  describe('betApi', () => {
    describe('createBet', () => {
      it('should create bet with host authorization', async () => {
        const betData = {
          question: 'Who will win?',
          options: ['Team A', 'Team B'],
          timerDuration: 60,
        };
        const mockResponse = {
          id: 'bet-123',
          room_code: 'ABC123',
          question: 'Who will win?',
          options: ['Team A', 'Team B'],
          status: 'PENDING',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await betApi.createBet('ABC123', 'host-123', betData);

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms/ABC123/bets'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-Host-Id': 'host-123',
            }),
          })
        );
      });

      it('should reject non-host bet creation', async () => {
        const betData = {
          question: 'Who will win?',
          options: ['Team A', 'Team B'],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ detail: 'Only host can create bets' }),
        });

        await expect(
          betApi.createBet('ABC123', 'non-host', betData)
        ).rejects.toThrow('API request failed: 403');
      });
    });

    describe('lockBet', () => {
      it('should lock bet successfully', async () => {
        const mockResponse = {
          id: 'bet-123',
          status: 'LOCKED',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await betApi.lockBet('ABC123', 'host-123', 'bet-123');

        expect(result).toEqual(mockResponse);
        expect(result.status).toBe('LOCKED');
      });
    });

    describe('resolveBet', () => {
      it('should resolve bet and return leaderboard', async () => {
        const mockResponse = {
          status: 'resolved',
          leaderboard: [
            { user_id: 'user-1', nickname: 'Winner', points: 1200, rank: 1 },
          ],
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await betApi.resolveBet(
          'ABC123',
          'host-123',
          'bet-123',
          'Team A'
        );

        expect(result).toEqual(mockResponse);
        expect(result.status).toBe('resolved');
      });

      it('should reject invalid winning option', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: 'Invalid winning option' }),
        });

        await expect(
          betApi.resolveBet('ABC123', 'host-123', 'bet-123', 'Invalid Option')
        ).rejects.toThrow('API request failed: 400');
      });
    });

    describe('placeBet', () => {
      it('should place bet successfully', async () => {
        const request: PlaceBetRequest = {
          bet_id: 'bet-123',
          selected_option: 'Team A',
          points: 100,
        };
        const mockResponse = {
          id: 'userbet-123',
          user_id: 'user-123',
          bet_id: 'bet-123',
          selected_option: 'Team A',
          points: 100,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await betApi.placeBet('ABC123', 'user-123', request);

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rooms/ABC123/bets/place'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-User-Id': 'user-123',
            }),
          })
        );
      });

      it('should reject bet with insufficient points', async () => {
        const request: PlaceBetRequest = {
          bet_id: 'bet-123',
          selected_option: 'Team A',
          points: 10000,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: 'Insufficient points' }),
        });

        await expect(
          betApi.placeBet('ABC123', 'user-123', request)
        ).rejects.toThrow('API request failed: 400');
      });

      it('should reject bet on locked bet', async () => {
        const request: PlaceBetRequest = {
          bet_id: 'bet-123',
          selected_option: 'Team A',
          points: 100,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ detail: 'Bet is locked' }),
        });

        await expect(
          betApi.placeBet('ABC123', 'user-123', request)
        ).rejects.toThrow('API request failed: 400');
      });
    });

    describe('getBets', () => {
      it('should fetch all bets in room', async () => {
        const mockResponse = {
          bets: [
            { id: 'bet-1', question: 'Question 1', status: 'OPEN' },
            { id: 'bet-2', question: 'Question 2', status: 'PENDING' },
          ],
          count: 2,
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await betApi.getBets('ABC123');

        expect(result).toEqual(mockResponse);
        expect(result.count).toBe(2);
      });
    });

    describe('getBet', () => {
      it('should fetch specific bet', async () => {
        const mockBet = {
          id: 'bet-123',
          question: 'Who will win?',
          options: ['Team A', 'Team B'],
          status: 'OPEN',
        };

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockBet,
        });

        const result = await betApi.getBet('ABC123', 'bet-123');

        expect(result).toEqual(mockBet);
      });

      it('should handle bet not found', async () => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: async () => ({ detail: 'Bet not found' }),
        });

        await expect(betApi.getBet('ABC123', 'invalid-bet')).rejects.toThrow(
          'API request failed: 404'
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should include Content-Type header in all requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await roomApi.getRoom('ABC123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle timeout errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('The operation was aborted')
      );

      await expect(roomApi.getRoom('ABC123')).rejects.toThrow(
        'The operation was aborted'
      );
    });

    it('should preserve custom headers while adding Content-Type', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'IN_PROGRESS' }),
      });

      await roomApi.startRoom('ABC123', 'host-123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Host-Id': 'host-123',
          }),
        })
      );
    });
  });
});
