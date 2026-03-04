/**
 * EditBetModal - Modal for editing an open bet
 *
 * Allows host to modify question, options, and points value.
 * Warns that editing resets all existing votes and refunds points.
 */

import { useState } from 'react';
import { betApi } from '@/services/api';
import { MAX_BET_OPTIONS } from '@/constants';
import type { Bet } from '@/types';

interface EditBetModalProps {
  bet: Bet;
  roomCode: string;
  hostId: string;
  onClose: () => void;
}

export default function EditBetModal({
  bet,
  roomCode,
  hostId,
  onClose,
}: EditBetModalProps) {
  const [question, setQuestion] = useState(bet.question);
  const [options, setOptions] = useState<string[]>([...bet.options]);
  const [pointsValue, setPointsValue] = useState(bet.pointsValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const validOptions = options.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        setError('At least 2 options are required');
        setSubmitting(false);
        return;
      }
      await betApi.editBet(roomCode, hostId, bet.betId, {
        question: question.trim(),
        options: validOptions.map(opt => opt.trim()),
        pointsValue,
      });
      onClose();
    } catch (err: any) {
      setError(err.detail || 'Failed to edit bet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <h4 style={{ marginBottom: 0 }}>Edit Bet</h4>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.875rem', padding: '0.25rem 0.75rem', minHeight: 'auto' }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)', marginBottom: 'var(--spacing-md)' }}>
          Editing will reset all existing votes and refund points to users.
        </p>

        {error && (
          <p className="text-error" style={{ fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>
            {error}
          </p>
        )}

        <div className="mb-md">
          <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
            Question *
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            style={{ width: '100%' }}
          />
        </div>
        <div className="mb-md">
          <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
            Options * (minimum 2)
          </label>
          {options.map((option, index) => (
            <div key={index} style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <input
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[index] = e.target.value;
                  setOptions(newOptions);
                }}
                maxLength={100}
                style={{ flex: 1 }}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setOptions(options.filter((_, i) => i !== index))}
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {options.length < MAX_BET_OPTIONS && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOptions([...options, ''])}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              + Add Option
            </button>
          )}
        </div>
        <div className="mb-md">
          <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
            Points Value *
          </label>
          <input
            type="number"
            min={10}
            max={1000}
            value={pointsValue}
            onChange={(e) => setPointsValue(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        <button
          className="btn btn-primary btn-full"
          onClick={handleSubmit}
          disabled={submitting || !question.trim()}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
