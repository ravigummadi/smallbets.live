/**
 * Admin Panel - Admin controls and monitoring
 */

import { useState } from 'react';
import LiveFeedPanel from './LiveFeedPanel';
import BetCreationForm from './BetCreationForm';
import BetListPanel from './BetListPanel';
import { roomApi } from '@/services/api';
import { useBets } from '@/hooks/useBets';
import type { Room } from '@/types';

interface AdminPanelProps {
  room: Room;
  hostId: string;
  onRoomUpdate: (room: Room) => void;
}

export default function AdminPanel({
  room,
  hostId,
  onRoomUpdate,
}: AdminPanelProps) {
  const [automationEnabled, setAutomationEnabled] = useState(room.automationEnabled);
  const [showBetCreationForm, setShowBetCreationForm] = useState(false);
  const { bets, loading: betsLoading } = useBets(room.code);

  const handleToggleAutomation = (enabled: boolean) => {
    setAutomationEnabled(enabled);
    onRoomUpdate({ ...room, automationEnabled: enabled });
  };

  const handleStartRoom = async () => {
    try {
      await roomApi.startRoom(room.code, hostId);
      onRoomUpdate({ ...room, status: 'active' });
    } catch (err) {
      console.error('Failed to start room:', err);
    }
  };

  const handleFinishRoom = async () => {
    try {
      await roomApi.finishRoom(room.code, hostId);
      onRoomUpdate({ ...room, status: 'finished' });
    } catch (err) {
      console.error('Failed to finish room:', err);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
      {/* Room Controls */}
      <div className="card">
        <h4 className="mb-md">Room Controls</h4>

        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {room.status === 'waiting' && (
            <button className="btn btn-primary" onClick={handleStartRoom}>
              Start Event
            </button>
          )}

          {room.status === 'active' && (
            <button className="btn btn-secondary" onClick={handleFinishRoom}>
              Finish Event
            </button>
          )}

          {room.status === 'finished' && (
            <p className="text-secondary" style={{ marginBottom: 0 }}>
              Event finished
            </p>
          )}
        </div>
      </div>

      {/* Bet Creation */}
      {(room.status === 'waiting' || room.status === 'active') && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
            <h4 style={{ marginBottom: 0 }}>Create New Bet</h4>
            <button
              className="btn btn-secondary"
              onClick={() => setShowBetCreationForm(!showBetCreationForm)}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              {showBetCreationForm ? 'Hide Form' : 'Show Form'}
            </button>
          </div>

          {showBetCreationForm && (
            <BetCreationForm
              roomCode={room.code}
              hostId={hostId}
              onSuccess={() => {
                setShowBetCreationForm(false);
              }}
            />
          )}
        </div>
      )}

      {/* Bet Management */}
      <div className="card">
        <h4 className="mb-md">Bet Management ({betsLoading ? '...' : bets.length})</h4>
        {betsLoading ? (
          <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
            Loading bets...
          </p>
        ) : (
          <BetListPanel
            roomCode={room.code}
            hostId={hostId}
            bets={bets}
          />
        )}
      </div>

      {/* Live Feed Panel (only show when event is active) */}
      {room.status === 'active' && (
        <LiveFeedPanel
          roomCode={room.code}
          hostId={hostId}
          automationEnabled={automationEnabled}
          onToggleAutomation={handleToggleAutomation}
        />
      )}
    </div>
  );
}
