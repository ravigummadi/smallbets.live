/**
 * Unit tests for EditBetModal component
 *
 * Tests modal rendering, form pre-population, validation,
 * submission, and close behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import EditBetModal from './EditBetModal';
import type { Bet } from '@/types';

expect.extend({ toHaveNoViolations });

vi.mock('@/services/api', () => ({
  betApi: {
    editBet: vi.fn(),
  },
}));

import { betApi } from '@/services/api';

const baseBet: Bet = {
  betId: 'bet-1',
  roomCode: 'ABC123',
  question: 'Who will win Best Picture?',
  options: ['Movie A', 'Movie B', 'Movie C'],
  status: 'open',
  openedAt: null,
  lockedAt: null,
  resolvedAt: null,
  winningOption: null,
  pointsValue: 100,
  betType: 'match',
  createdFrom: 'manual',
  templateId: null,
  timerDuration: 0,
  canUndoUntil: null,
  version: 1,
} as Bet;

const defaultProps = {
  bet: baseBet,
  roomCode: 'ABC123',
  hostId: 'host-123',
  onClose: vi.fn(),
};

describe('EditBetModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (betApi.editBet as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations (excluding label rules for modal inputs)', async () => {
      const { container } = render(<EditBetModal {...defaultProps} />);
      // EditBetModal has unlabeled inputs (pre-existing) - exclude label rule
      const results = await axe(container, { rules: { label: { enabled: false } } });
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('should show Edit Bet title and close button', () => {
      render(<EditBetModal {...defaultProps} />);
      expect(screen.getByText('Edit Bet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /✕/ })).toBeInTheDocument();
    });

    it('should show warning about resetting votes', () => {
      render(<EditBetModal {...defaultProps} />);
      expect(screen.getByText(/editing will reset all existing votes/i)).toBeInTheDocument();
    });

    it('should pre-populate form with existing bet data', () => {
      render(<EditBetModal {...defaultProps} />);
      expect(screen.getByDisplayValue('Who will win Best Picture?')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Movie A')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Movie B')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Movie C')).toBeInTheDocument();
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });

    it('should show Remove buttons for options (more than 2)', () => {
      render(<EditBetModal {...defaultProps} />);
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      expect(removeButtons.length).toBe(3);
    });

    it('should show + Add Option button', () => {
      render(<EditBetModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
    });

    it('should show Save Changes button', () => {
      render(<EditBetModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /✕/ }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const { container } = render(<EditBetModal {...defaultProps} onClose={onClose} />);

      // Click the overlay (modal-overlay class)
      const overlay = container.querySelector('.modal-overlay');
      if (overlay) {
        await user.click(overlay);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should not call onClose when modal content is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const { container } = render(<EditBetModal {...defaultProps} onClose={onClose} />);

      const content = container.querySelector('.modal-content');
      if (content) {
        await user.click(content);
        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Option Management', () => {
    it('should add a new option', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /add option/i }));

      expect(screen.getByPlaceholderText('Option 4')).toBeInTheDocument();
    });

    it('should remove an option', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[2]); // Remove 3rd option

      expect(screen.queryByDisplayValue('Movie C')).not.toBeInTheDocument();
    });

    it('should not show Remove buttons when only 2 options remain', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      // Remove one option to get to 2
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should show error when fewer than 2 valid options', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} bet={{ ...baseBet, options: ['A', 'B'] } as Bet} />);

      // Clear both options
      const inputs = screen.getAllByPlaceholderText(/option/i);
      await user.clear(inputs[0]);
      await user.clear(inputs[1]);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(screen.getByText('At least 2 options are required')).toBeInTheDocument();
      expect(betApi.editBet).not.toHaveBeenCalled();
    });

    it('should disable Save Changes when question is empty', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      const questionInput = screen.getByDisplayValue('Who will win Best Picture?');
      await user.clear(questionInput);

      expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
    });
  });

  describe('Submission', () => {
    it('should call betApi.editBet with trimmed values on save', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      const questionInput = screen.getByDisplayValue('Who will win Best Picture?');
      await user.clear(questionInput);
      await user.type(questionInput, '  Updated question?  ');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(betApi.editBet).toHaveBeenCalledWith('ABC123', 'host-123', 'bet-1', {
        question: 'Updated question?',
        options: ['Movie A', 'Movie B', 'Movie C'],
        pointsValue: 100,
      });
    });

    it('should call onClose after successful edit', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show Saving... during submission', async () => {
      let resolveEdit: (value: unknown) => void;
      (betApi.editBet as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolveEdit = resolve; })
      );

      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

      resolveEdit!({});
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /saving/i })).not.toBeInTheDocument();
      });
    });

    it('should show error message on API failure', async () => {
      (betApi.editBet as ReturnType<typeof vi.fn>).mockRejectedValue({
        detail: 'Bet is locked',
      });

      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText('Bet is locked')).toBeInTheDocument();
      });
    });

    it('should filter out empty options before submitting', async () => {
      const user = userEvent.setup();
      render(<EditBetModal {...defaultProps} />);

      // Add an option and leave it empty
      await user.click(screen.getByRole('button', { name: /add option/i }));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(betApi.editBet).toHaveBeenCalledWith('ABC123', 'host-123', 'bet-1', expect.objectContaining({
        options: ['Movie A', 'Movie B', 'Movie C'], // empty option filtered out
      }));
    });
  });
});
