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
  const [showModal, setShowModal] = useState(false);
  const [showFeedModal, setShowFeedModal] = useState(false);
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
      {/* Toolbar Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
      }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          {room.status === 'waiting' && (
            <button className="btn btn-primary" onClick={handleStartRoom}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              Start Event
            </button>
          )}
          {room.status === 'active' && (
            <>
              <button className="btn btn-secondary" onClick={handleFinishRoom}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                Finish Event
              </button>
              <button className="btn btn-primary" onClick={() => setShowFeedModal(true)}
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                Live Feed
              </button>
            </>
          )}
          {room.status === 'finished' && (
            <span className="text-secondary" style={{ fontSize: '0.875rem' }}>
              Event finished
            </span>
          )}
        </div>

        {(room.status === 'waiting' || room.status === 'active') && (
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            + Create New Bet
          </button>
        )}
      </div>

      {/* Create Bet Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>Create New Bet</h4>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <BetCreationForm
              roomCode={room.code}
              hostId={hostId}
              onSuccess={() => setShowModal(false)}
            />
          </div>
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

      {/* Live Feed Modal */}
      {showFeedModal && (
        <div className="modal-overlay" onClick={() => setShowFeedModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>Live Transcript Feed</h4>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFeedModal(false)}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <LiveFeedPanel
              roomCode={room.code}
              hostId={hostId}
              automationEnabled={automationEnabled}
              onToggleAutomation={handleToggleAutomation}
            />
          </div>
        </div>
      )}
    </div>
  );
}
