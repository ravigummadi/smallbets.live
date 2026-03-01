/**
 * Live Feed Panel - Admin interface for manual transcript input
 *
 * Allows admin to input key moments in real-time during live events
 */

import { useState, useEffect } from 'react';

interface TranscriptEntry {
  text: string;
  source: string;
  timestamp: string;
}

interface LiveFeedPanelProps {
  roomCode: string;
  hostId: string;
  automationEnabled: boolean;
  onToggleAutomation: (enabled: boolean) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export default function LiveFeedPanel({
  roomCode,
  hostId,
  automationEnabled,
  onToggleAutomation,
}: LiveFeedPanelProps) {
  const [transcriptText, setTranscriptText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TranscriptEntry[]>([]);

  useEffect(() => {
    fetch(`/api/rooms/${roomCode}/transcript`)
      .then((res) => res.ok ? res.json() : Promise.reject('Failed to fetch'))
      .then((data) => setHistory(data.entries || []))
      .catch(() => {/* ignore – history is best-effort */});
  }, [roomCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transcriptText.trim()) {
      setError('Please enter some text');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/rooms/${roomCode}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcriptText, source: 'manual' }),
      });

      if (!response.ok) throw new Error('Failed to submit transcript');

      const result = await response.json();
      setLastResult(result);

      // Optimistic prepend to history
      setHistory((prev) => [
        { text: transcriptText, source: 'manual', timestamp: new Date().toISOString() },
        ...prev,
      ]);

      setTranscriptText('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit transcript');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAutomation = async () => {
    try {
      await fetch(`/api/rooms/${roomCode}/automation/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Host-Id': hostId,
        },
        body: JSON.stringify({ enabled: !automationEnabled }),
      });
      onToggleAutomation(!automationEnabled);
    } catch {
      setError('Failed to toggle automation');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-md)' }}>
        <button
          className={`btn ${automationEnabled ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleToggleAutomation}
          style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: 'var(--font-size-sm)' }}
        >
          {automationEnabled ? 'Auto: ON' : 'Auto: OFF'}
        </button>
      </div>

      <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
        Type key moments as they happen on TV. Automation will trigger bet actions if patterns match.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder='e.g., "And the Grammy goes to... Beyoncé!"'
          rows={3}
          style={{ marginBottom: 'var(--spacing-md)', resize: 'vertical' }}
          disabled={submitting}
        />
        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={submitting || !transcriptText.trim()}
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>

      {error && (
        <div
          className="mt-md"
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: '3px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p className="text-error" style={{ marginBottom: 0, fontSize: 'var(--font-size-sm)' }}>
            {error}
          </p>
        </div>
      )}

      {lastResult && (
        <div
          className="mt-md"
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: `3px solid ${
              lastResult.automation.action_taken === 'ignored'
                ? 'var(--color-text-muted)'
                : 'var(--color-success)'
            }`,
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ fontSize: 'var(--font-size-sm)' }}>
            <p style={{ marginBottom: 'var(--spacing-sm)' }}>
              <strong>Action:</strong>{' '}
              <span
                style={{
                  color:
                    lastResult.automation.action_taken === 'open_bet' ||
                    lastResult.automation.action_taken === 'resolve_bet'
                      ? 'var(--color-success)'
                      : 'var(--color-text-muted)',
                }}
              >
                {lastResult.automation.action_taken}
              </span>
            </p>

            {lastResult.automation.confidence > 0 && (
              <p style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Confidence:</strong>{' '}
                {(lastResult.automation.confidence * 100).toFixed(0)}%
              </p>
            )}

            {lastResult.automation.details && (
              <p style={{ marginBottom: 0, color: 'var(--color-text-secondary)' }}>
                {lastResult.automation.details.reason ||
                  lastResult.automation.details.trigger_type}
              </p>
            )}

            {lastResult.automation.details?.winner && (
              <p style={{ marginTop: 'var(--spacing-sm)', marginBottom: 0 }}>
                <strong>Winner:</strong> {lastResult.automation.details.winner}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Transcript History */}
      {history.length > 0 && (
        <div
          className="mt-md"
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--spacing-md)',
          }}
        >
          <h5 style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
            History ({history.length})
          </h5>
          {history.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: 'var(--spacing-sm)',
                fontSize: 'var(--font-size-xs)',
                borderBottom: i < history.length - 1 ? '1px solid var(--color-border)' : undefined,
                display: 'flex',
                gap: 'var(--spacing-sm)',
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {timeAgo(entry.timestamp)}
              </span>
              <span style={{ flex: 1 }}>{entry.text}</span>
              <span
                style={{
                  fontSize: '0.625rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.source}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
