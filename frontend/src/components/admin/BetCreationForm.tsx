/**
 * BetCreationForm - Form for admins to create new bets
 */

import { useState, useEffect } from 'react';
import { betApi } from '@/services/api';
import { MAX_BET_OPTIONS } from '@/constants';

export interface BetFormPrefill {
  question: string;
  options: string[];
  pointsValue?: number;
  timerDuration?: number;
}

interface BetCreationFormProps {
  roomCode: string;
  hostId: string;
  onSuccess: () => void;
  prefill?: BetFormPrefill | null;
}

export default function BetCreationForm({
  roomCode,
  hostId,
  onSuccess,
  prefill,
}: BetCreationFormProps) {
  const [question, setQuestion] = useState(prefill?.question ?? '');
  const [options, setOptions] = useState(prefill?.options?.length ? [...prefill.options] : ['', '']);
  const [pointsValue, setPointsValue] = useState(prefill?.pointsValue ?? 100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update form when prefill changes (e.g., user taps a different quick-fire template)
  useEffect(() => {
    if (prefill) {
      setQuestion(prefill.question);
      setOptions([...prefill.options]);
      setPointsValue(prefill.pointsValue ?? 100);
      setError(null);
    }
  }, [prefill]);

  const handleAddOption = () => {
    if (options.length < MAX_BET_OPTIONS) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validateForm = (): string | null => {
    if (!question.trim()) {
      return 'Question is required';
    }
    if (question.length > 200) {
      return 'Question must be 200 characters or less';
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      return 'At least 2 options are required';
    }

    for (const opt of validOptions) {
      if (opt.length > 100) {
        return 'Options must be 100 characters or less';
      }
    }

    if (pointsValue < 10 || pointsValue > 1000) {
      return 'Points must be between 10 and 1000';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const validOptions = options.filter(opt => opt.trim() !== '');

      await betApi.createBet(roomCode, hostId, {
        question: question.trim(),
        options: validOptions.map(opt => opt.trim()),
        pointsValue,
        ...(prefill?.timerDuration != null && { timerDuration: prefill.timerDuration }),
      });

      setSuccess(true);
      setError(null);

      // Reset form
      setQuestion('');
      setOptions(['', '']);
      setPointsValue(100);

      // Notify parent
      onSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.detail || 'Failed to create bet');
      console.error('Failed to create bet:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Question Input */}
      <div className="mb-md">
        <label htmlFor="question" style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
          Question *
        </label>
        <input
          id="question"
          type="text"
          placeholder="e.g., Who will win Best Picture?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          style={{ width: '100%' }}
        />
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-xs)' }}>
          {question.length}/200 characters
        </p>
      </div>

      {/* Options List */}
      <div className="mb-md">
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
          Options * (minimum 2, maximum 10)
        </label>
        {options.map((option, index) => (
          <div key={index} style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            <input
              type="text"
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              maxLength={100}
              style={{ flex: 1 }}
            />
            {options.length > 2 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleRemoveOption(index)}
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
            onClick={handleAddOption}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            + Add Option
          </button>
        )}
      </div>

      {/* Points Value */}
      <div className="mb-md">
        <label htmlFor="points" style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: '600' }}>
          Points Value *
        </label>
        <input
          id="points"
          type="number"
          min={10}
          max={1000}
          value={pointsValue}
          onChange={(e) => setPointsValue(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 'var(--spacing-xs)' }}>
          Points required to place this bet (10-1000)
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div
          className="mb-md"
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: '3px solid var(--color-success)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p className="text-success" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
            ✓ Bet created successfully!
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="mb-md"
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: '3px solid var(--color-error)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <p className="text-error" style={{ marginBottom: 0, fontSize: '0.875rem' }}>
            {error}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        className="btn btn-primary btn-full"
        disabled={submitting}
      >
        {submitting ? 'Creating Bet...' : 'Create Bet'}
      </button>
    </form>
  );
}
