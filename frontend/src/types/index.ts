/**
 * TypeScript types for SmallBets.live frontend
 *
 * These mirror the backend Pydantic models
 */

export type RoomStatus = 'waiting' | 'active' | 'finished';
export type BetStatus = 'pending' | 'open' | 'locked' | 'resolved';
export type RoomType = 'event' | 'tournament' | 'match';
export type BetType = 'pre-match' | 'in-game' | 'tournament';

export interface MatchDetails {
  team1: string;
  team2: string;
  matchDateTime: string;
  venue?: string;
  title?: string;
}

export interface Room {
  code: string;
  eventTemplate: string;
  eventName?: string | null;
  status: RoomStatus;
  hostId: string;
  automationEnabled: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  // Tournament fields
  roomType: RoomType;
  parentRoomCode: string | null;
  participants: string[];
  matchDetails: MatchDetails | null;
  currentBetId: string | null;
  version: number;
}

export interface User {
  userId: string;
  roomCode: string;
  nickname: string;
  points: number;
  isAdmin: boolean;
  joinedAt: Date;
}

export interface RoomUser {
  id: string;
  roomCode: string;
  userId: string;
  nickname: string;
  points: number;
  joinedAt: Date;
  isHost: boolean;
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
  // Tournament fields
  betType: BetType;
  createdFrom: string;
  templateId: string | null;
  timerDuration: number;
  canUndoUntil: Date | null;
  version: number;
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
  isAdmin?: boolean;
  isHost?: boolean;
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

export interface CreateMatchRoomRequest {
  team1: string;
  team2: string;
  match_date_time: string;
  venue?: string;
  title?: string;
}

export interface CreateMatchRoomResponse {
  room_code: string;
  match_room_code: string;
  parent_room_code: string;
}

export interface JoinRoomRequest {
  nickname: string;
  parent_user_id?: string;
}

export interface JoinRoomResponse {
  user_id: string;
  host_id?: string;
  room: Room;
  user: User;
}

export interface PlaceBetRequest {
  bet_id: string;
  selected_option: string;
}

export interface CreateBetRequest {
  question: string;
  options: string[];
  pointsValue?: number;
  betType?: BetType;
  createdFrom?: string;
  templateId?: string;
  timerDuration?: number;
}
