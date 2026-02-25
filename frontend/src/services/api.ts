/**
 * API service - HTTP client for backend API
 *
 * IMPERATIVE SHELL: Handles HTTP requests to backend
 */

import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  PlaceBetRequest,
  Room,
  Bet,
  User,
  UserBet,
  LeaderboardEntry,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new ApiError(
      `API request failed: ${response.status}`,
      response.status,
      error.detail
    );
  }

  return response.json();
}

// Room API
export const roomApi = {
  async createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
    return fetchApi('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getRoom(code: string): Promise<Room> {
    return fetchApi(`/api/rooms/${code}`);
  },

  async joinRoom(code: string, request: JoinRoomRequest): Promise<JoinRoomResponse> {
    return fetchApi(`/api/rooms/${code}/join`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getParticipants(code: string): Promise<{ participants: User[]; count: number }> {
    return fetchApi(`/api/rooms/${code}/participants`);
  },

  async getLeaderboard(code: string): Promise<{ leaderboard: LeaderboardEntry[] }> {
    return fetchApi(`/api/rooms/${code}/leaderboard`);
  },

  async startRoom(code: string, hostId: string): Promise<{ status: string }> {
    return fetchApi(`/api/rooms/${code}/start`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
    });
  },

  async finishRoom(code: string, hostId: string): Promise<{ status: string; leaderboard: LeaderboardEntry[] }> {
    return fetchApi(`/api/rooms/${code}/finish`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
    });
  },
};

// Bet API
export const betApi = {
  async createBet(
    roomCode: string,
    hostId: string,
    bet: { question: string; options: string[]; timerDuration?: number }
  ): Promise<Bet> {
    return fetchApi(`/api/rooms/${roomCode}/bets`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
      body: JSON.stringify(bet),
    });
  },

  async openBet(roomCode: string, hostId: string, betId: string): Promise<Bet> {
    return fetchApi(`/api/rooms/${roomCode}/bets/open`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
      body: JSON.stringify({ bet_id: betId }),
    });
  },

  async lockBet(roomCode: string, hostId: string, betId: string): Promise<Bet> {
    return fetchApi(`/api/rooms/${roomCode}/bets/lock`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
      body: JSON.stringify({ bet_id: betId }),
    });
  },

  async resolveBet(
    roomCode: string,
    hostId: string,
    betId: string,
    winningOption: string
  ): Promise<{ status: string; leaderboard: LeaderboardEntry[] }> {
    return fetchApi(`/api/rooms/${roomCode}/bets/${betId}/resolve`, {
      method: 'POST',
      headers: { 'X-Host-Id': hostId },
      body: JSON.stringify({ winning_option: winningOption }),
    });
  },

  async placeBet(
    roomCode: string,
    userId: string,
    request: PlaceBetRequest
  ): Promise<UserBet> {
    return fetchApi(`/api/rooms/${roomCode}/bets/place`, {
      method: 'POST',
      headers: { 'X-User-Id': userId },
      body: JSON.stringify(request),
    });
  },

  async getBets(roomCode: string): Promise<{ bets: Bet[]; count: number }> {
    return fetchApi(`/api/rooms/${roomCode}/bets`);
  },

  async getBet(roomCode: string, betId: string): Promise<Bet> {
    return fetchApi(`/api/rooms/${roomCode}/bets/${betId}`);
  },
};
