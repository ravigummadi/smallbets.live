/**
 * Unit tests for useMyRooms hook
 *
 * Tests localStorage persistence, room saving, removal, and expiry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMyRooms, SavedRoom } from './useMyRooms';

const STORAGE_KEY = 'smallbets_my_rooms';

function makeRoom(overrides: Partial<SavedRoom> = {}): SavedRoom {
  return {
    roomCode: 'ABCD',
    userKey: 'key12345',
    hostLink: 'http://localhost/room/ABCD/u/key12345',
    joinLink: 'http://localhost/join/ABCD',
    eventName: 'Test Event',
    isTournament: false,
    isHost: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('useMyRooms', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return empty array when no rooms saved', () => {
    const { result } = renderHook(() => useMyRooms());
    expect(result.current.rooms).toEqual([]);
  });

  it('should load rooms from localStorage on mount', () => {
    const room = makeRoom();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([room]));

    const { result } = renderHook(() => useMyRooms());
    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].roomCode).toBe('ABCD');
  });

  it('should save a room and persist to localStorage', () => {
    const { result } = renderHook(() => useMyRooms());
    const room = makeRoom();

    act(() => {
      result.current.saveRoom(room);
    });

    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].roomCode).toBe('ABCD');

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it('should replace existing room with same code', () => {
    const { result } = renderHook(() => useMyRooms());

    act(() => {
      result.current.saveRoom(makeRoom({ eventName: 'Original' }));
    });
    act(() => {
      result.current.saveRoom(makeRoom({ eventName: 'Updated' }));
    });

    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].eventName).toBe('Updated');
  });

  it('should prepend new rooms (most recent first)', () => {
    const { result } = renderHook(() => useMyRooms());

    act(() => {
      result.current.saveRoom(makeRoom({ roomCode: 'AAAA', eventName: 'First' }));
    });
    act(() => {
      result.current.saveRoom(makeRoom({ roomCode: 'BBBB', eventName: 'Second' }));
    });

    expect(result.current.rooms[0].roomCode).toBe('BBBB');
    expect(result.current.rooms[1].roomCode).toBe('AAAA');
  });

  it('should remove a room by code', () => {
    const { result } = renderHook(() => useMyRooms());

    act(() => {
      result.current.saveRoom(makeRoom({ roomCode: 'AAAA' }));
      result.current.saveRoom(makeRoom({ roomCode: 'BBBB' }));
    });
    act(() => {
      result.current.removeRoom('AAAA');
    });

    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].roomCode).toBe('BBBB');

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it('should filter out rooms older than 30 days on load', () => {
    const oldRoom = makeRoom({
      roomCode: 'OLD1',
      createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    const recentRoom = makeRoom({
      roomCode: 'NEW1',
      createdAt: Date.now(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([oldRoom, recentRoom]));

    const { result } = renderHook(() => useMyRooms());
    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].roomCode).toBe('NEW1');
  });

  it('should limit to 20 rooms max', () => {
    const { result } = renderHook(() => useMyRooms());

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.saveRoom(makeRoom({ roomCode: `RM${String(i).padStart(2, '0')}` }));
      }
    });

    expect(result.current.rooms.length).toBeLessThanOrEqual(20);
  });

  it('should handle corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');

    const { result } = renderHook(() => useMyRooms());
    expect(result.current.rooms).toEqual([]);
  });
});
