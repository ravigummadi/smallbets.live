/**
 * Firestore service - Real-time database operations
 *
 * IMPERATIVE SHELL: Handles Firestore real-time listeners
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Room, User, Bet, UserBet, LeaderboardEntry } from '@/types';

/**
 * Convert Firestore Timestamp to Date
 */
function timestampToDate(timestamp: any): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date(timestamp);
}

/**
 * Subscribe to room updates
 */
export function subscribeToRoom(
  roomCode: string,
  callback: (room: Room | null) => void
): Unsubscribe {
  const roomRef = doc(db, 'rooms', roomCode);

  return onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    const room: Room = {
      code: data.code,
      eventTemplate: data.eventTemplate,
      eventName: data.eventName ?? null,
      status: data.status,
      currentBetId: data.currentBetId ?? null,
      hostId: data.hostId,
      automationEnabled: data.automationEnabled ?? true,
      createdAt: timestampToDate(data.createdAt),
      expiresAt: timestampToDate(data.expiresAt),
    };

    callback(room);
  });
}

/**
 * Subscribe to user updates
 */
export function subscribeToUser(
  userId: string,
  callback: (user: User | null) => void
): Unsubscribe {
  const userRef = doc(db, 'users', userId);

  return onSnapshot(userRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    const user: User = {
      userId: data.userId,
      roomCode: data.roomCode,
      nickname: data.nickname,
      points: data.points,
      isAdmin: data.isAdmin ?? false,
      joinedAt: timestampToDate(data.joinedAt),
    };

    callback(user);
  });
}

/**
 * Subscribe to bet updates
 */
export function subscribeToBet(
  betId: string,
  callback: (bet: Bet | null) => void
): Unsubscribe {
  const betRef = doc(db, 'bets', betId);

  return onSnapshot(betRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    const bet: Bet = {
      betId: data.betId,
      roomCode: data.roomCode,
      question: data.question,
      options: data.options,
      status: data.status,
      openedAt: data.openedAt ? timestampToDate(data.openedAt) : null,
      lockedAt: data.lockedAt ? timestampToDate(data.lockedAt) : null,
      resolvedAt: data.resolvedAt ? timestampToDate(data.resolvedAt) : null,
      winningOption: data.winningOption ?? null,
      timerDuration: data.timerDuration ?? 60,
    };

    callback(bet);
  });
}

/**
 * Subscribe to all participants in a room
 */
export function subscribeToParticipants(
  roomCode: string,
  callback: (users: User[]) => void
): Unsubscribe {
  const usersQuery = query(
    collection(db, 'users'),
    where('roomCode', '==', roomCode)
  );

  return onSnapshot(usersQuery, (snapshot) => {
    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        userId: data.userId,
        roomCode: data.roomCode,
        nickname: data.nickname,
        points: data.points,
        isAdmin: data.isAdmin ?? false,
        joinedAt: timestampToDate(data.joinedAt),
      };
    });

    callback(users);
  });
}

/**
 * Subscribe to user's bet for a specific bet
 */
export function subscribeToUserBet(
  userId: string,
  betId: string,
  callback: (userBet: UserBet | null) => void
): Unsubscribe {
  const userBetRef = doc(db, 'userBets', `${betId}_${userId}`);

  return onSnapshot(userBetRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.data();
    const userBet: UserBet = {
      userId: data.userId,
      betId: data.betId,
      roomCode: data.roomCode,
      selectedOption: data.selectedOption,
      placedAt: timestampToDate(data.placedAt),
      pointsWon: data.pointsWon ?? null,
    };

    callback(userBet);
  });
}
