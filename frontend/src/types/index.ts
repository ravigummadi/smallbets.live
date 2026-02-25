/**
 * TypeScript types for SmallBets.live frontend
 *
 * These mirror the backend Pydantic models
 */

export type RoomStatus = 'waiting' | 'active' | 'finished';
export type BetStatus = 'pending' | 'open' | 'locked' | 'resolved';

export interface Room {
  code: string;
  eventTemplate: string;
  eventName?: string | null;
  status: RoomStatus;
  hostId: string;
  automationEnabled: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface User {
  userId: string;
  roomCode: string;
  nickname: string;
  points: number;
  isAdmin: boolean;
  joinedAt: Date;
}

export interface Bet {
  betId: string;
  roomCode: string;
  question: string;
  options: string[];
  status: BetStatus;
  openedAt: Date | null;
  lockedAt: Date | null;
  resolvedAt: Date | null;
  winningOption: string | null;
  pointsValue: number;
}

export interface UserBet {
  userId: string;
  betId: string;
  roomCode: string;
  selectedOption: string;
  placedAt: Date;
  pointsWon: number | null;
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  points: number;
  rank: number;
  isAdmin: boolean;
}

export interface TranscriptEntry {
  entryId: string;
  roomCode: string;
  text: string;
  timestamp: Date;
  source: string;
}

// API request/response types
export interface CreateRoomRequest {
  event_template: string;
  event_name?: string;
  host_nickname: string;
}

export interface CreateRoomResponse {
  room_code: string;
  host_id: string;
  user_id: string;
}

export interface JoinRoomRequest {
  nickname: string;
}

export interface JoinRoomResponse {
  user_id: string;
  room: Room;
  user: User;
}

export interface PlaceBetRequest {
  bet_id: string;
  selected_option: string;
}
