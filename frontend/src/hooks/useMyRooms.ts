/**
 * useMyRooms hook - Persist created/joined rooms in localStorage
 * so hosts can recover their links if they forget them.
 */

import { useState, useCallback } from 'react';

export interface SavedRoom {
  roomCode: string;
  userKey: string;
  hostLink: string;
  joinLink: string;
  eventName: string;
  isTournament: boolean;
  isHost: boolean;
  createdAt: number; // timestamp
}

const STORAGE_KEY = 'smallbets_my_rooms';
const MAX_ROOMS = 20;

function loadRooms(): SavedRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rooms: SavedRoom[] = JSON.parse(raw);
    // Filter out rooms older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return rooms.filter((r) => r.createdAt > cutoff);
  } catch {
    return [];
  }
}

function persistRooms(rooms: SavedRoom[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms.slice(0, MAX_ROOMS)));
}

export function useMyRooms() {
  const [rooms, setRooms] = useState<SavedRoom[]>(loadRooms);

  const saveRoom = useCallback((room: SavedRoom) => {
    // Write to localStorage synchronously before any navigation can unmount the component
    const currentRooms = loadRooms();
    const filtered = currentRooms.filter((r) => r.roomCode !== room.roomCode);
    const updated = [room, ...filtered].slice(0, MAX_ROOMS);
    persistRooms(updated);
    setRooms(updated);
  }, []);

  const removeRoom = useCallback((roomCode: string) => {
    const currentRooms = loadRooms();
    const updated = currentRooms.filter((r) => r.roomCode !== roomCode);
    persistRooms(updated);
    setRooms(updated);
  }, []);

  return { rooms, saveRoom, removeRoom };
}
