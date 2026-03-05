/**
 * Admin Panel - Admin controls and monitoring
 */

import { useState, useEffect } from 'react';
import LiveFeedPanel from './LiveFeedPanel';
import BetCreationForm, { type BetFormPrefill } from './BetCreationForm';
import BetListPanel from './BetListPanel';
import QuickFireTemplates from './QuickFireTemplates';
import { roomApi } from '@/services/api';
import { useBets } from '@/hooks/useBets';
import type { Room, ParticipantWithLink } from '@/types';
import type { QuickFireTemplate } from '@/data/cricketQuickFireTemplates';

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
  const [betPrefill, setBetPrefill] = useState<BetFormPrefill | null>(null);

  const handleCloseModal = () => {
    setShowModal(false);
    setBetPrefill(null);
  };

  const handleQuickFire = (template: QuickFireTemplate) => {
    setBetPrefill({
      question: template.question,
      options: [...template.options],
      pointsValue: template.pointsValue,
      timerDuration: template.timerDuration,
    });
    setShowModal(true);
  };
  const { bets, loading: betsLoading } = useBets(room.code);

  // Participant links state
  const [participantsWithLinks, setParticipantsWithLinks] = useState<ParticipantWithLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);

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

  // Load participants with links when section is shown
  useEffect(() => {
    if (!showParticipants) return;

    setLinksLoading(true);
    setLinksError(null);

    roomApi.getParticipantsWithLinks(room.code, hostId)
      .then((res) => {
        setParticipantsWithLinks(res.participants);
      })
      .catch((err: any) => {
        if (err.status === 403) {
          setLinksError('Not authorized to view participant links.');
        } else {
          setLinksError('Failed to load participant links.');
        }
      })
      .finally(() => {
        setLinksLoading(false);
      });
  }, [showParticipants, room.code, hostId]);

  const handleCopyLink = async (participant: ParticipantWithLink) => {
    const link = `${window.location.origin}/room/${room.code}/u/${participant.userKey}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedUserId(participant.userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUserId(participant.userId);
      setTimeout(() => setCopiedUserId(null), 2000);
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
            onClick={() => { handleCloseModal(); setShowModal(true); }}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            + Create New Bet
          </button>
        )}
      </div>

      {/* Cricket Quick-Fire Templates */}
      {(room.status === 'waiting' || room.status === 'active') && (
        <QuickFireTemplates onSelect={handleQuickFire} />
      )}

      {/* Participant Links Section */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowParticipants(!showParticipants)}
        >
          <h4 style={{ marginBottom: 0 }}>Participant Links</h4>
          <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)' }}>
            {showParticipants ? '\u2212' : '+'}
          </span>
        </div>

        {showParticipants && (
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            {linksLoading ? (
              <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                Loading participant links...
              </p>
            ) : linksError ? (
              <p className="text-error" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                {linksError}
              </p>
            ) : participantsWithLinks.length === 0 ? (
              <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                No participants yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {participantsWithLinks.map((participant) => (
                  <div
                    key={participant.userId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--color-bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: '500' }}>{participant.nickname}</span>
                      <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        {participant.points} pts
                      </span>
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        minHeight: 'auto',
                      }}
                      onClick={() => handleCopyLink(participant)}
                    >
                      {copiedUserId === participant.userId ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Bet Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h4 style={{ marginBottom: 0 }}>
                {betPrefill ? 'Quick-Fire Bet' : 'Create New Bet'}
              </h4>
              <button
                className="btn btn-secondary"
                onClick={handleCloseModal}
                style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
              >
                ✕
              </button>
            </div>
            <BetCreationForm
              roomCode={room.code}
              hostId={hostId}
              onSuccess={handleCloseModal}
              prefill={betPrefill}
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
