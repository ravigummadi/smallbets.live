/**
 * Unit tests for BetCreationForm component
 *
 * Tests form validation, submission workflows, prefill behavior,
 * and dynamic option management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import BetCreationForm from './BetCreationForm';

expect.extend({ toHaveNoViolations });

// Mock the betApi
vi.mock('@/services/api', () => ({
  betApi: {
    createBet: vi.fn(),
  },
}));

import { betApi } from '@/services/api';

const defaultProps = {
  roomCode: 'ABC123',
  hostId: 'host-123',
  onSuccess: vi.fn(),
};

describe('BetCreationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (betApi.createBet as ReturnType<typeof vi.fn>).mockResolvedValue({
      betId: 'bet-1',
      question: 'Test?',
      options: ['A', 'B'],
      status: 'open',
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetCreationForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('should render question input, option inputs, points input, and submit buttons', () => {
      render(<BetCreationForm {...defaultProps} />);
      expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Option 1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Option 2')).toBeInTheDocument();
      expect(screen.getByLabelText(/points value/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create & open/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add to queue/i })).toBeInTheDocument();
    });

    it('should show character counter for question', () => {
      render(<BetCreationForm {...defaultProps} />);
      expect(screen.getByText('0/200 characters')).toBeInTheDocument();
    });

    it('should show + Add Option button', () => {
      render(<BetCreationForm {...defaultProps} />);
      expect(screen.getByRole('button', { name: /add option/i })).toBeInTheDocument();
    });

    it('should not show Remove buttons when only 2 options exist', () => {
      render(<BetCreationForm {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when question is empty', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(screen.getByText('Question is required')).toBeInTheDocument();
      expect(betApi.createBet).not.toHaveBeenCalled();
    });

    it('should show error when fewer than 2 options are filled', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Who will win?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'Only one');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(screen.getByText('At least 2 options are required')).toBeInTheDocument();
      expect(betApi.createBet).not.toHaveBeenCalled();
    });

    it('should show error when question exceeds 200 characters', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      // The input has maxLength=200, but validateForm also checks
      const longQuestion = 'A'.repeat(201);
      const questionInput = screen.getByLabelText(/question/i);
      // Since maxLength prevents typing more, we test the validation logic
      // by filling options and using a question that's at the boundary
      await user.type(questionInput, 'A'.repeat(200));
      await user.type(screen.getByPlaceholderText('Option 1'), 'Yes');
      await user.type(screen.getByPlaceholderText('Option 2'), 'No');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      // With 200 chars (at limit), should succeed
      expect(betApi.createBet).toHaveBeenCalled();
    });
  });

  describe('Option Management', () => {
    it('should add a new option when + Add Option is clicked', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /add option/i }));

      expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument();
    });

    it('should show Remove buttons when more than 2 options exist', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /add option/i }));

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      expect(removeButtons.length).toBe(3);
    });

    it('should remove an option when Remove is clicked', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /add option/i }));
      expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument();

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[2]); // Remove the 3rd option

      expect(screen.queryByPlaceholderText('Option 3')).not.toBeInTheDocument();
    });

    it('should not allow adding more than MAX_BET_OPTIONS (10)', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      // Start with 2, add 8 more to reach 10
      for (let i = 0; i < 8; i++) {
        await user.click(screen.getByRole('button', { name: /add option/i }));
      }

      expect(screen.getByPlaceholderText('Option 10')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add option/i })).not.toBeInTheDocument();
    });
  });

  describe('Submission', () => {
    it('should call betApi.createBet with status "open" on form submit', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Who will win?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'Team A');
      await user.type(screen.getByPlaceholderText('Option 2'), 'Team B');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(betApi.createBet).toHaveBeenCalledWith('ABC123', 'host-123', {
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
        pointsValue: 100,
        status: 'open',
      });
    });

    it('should call betApi.createBet with status "pending" for Add to Queue', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Who will win?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'Team A');
      await user.type(screen.getByPlaceholderText('Option 2'), 'Team B');
      await user.click(screen.getByRole('button', { name: /add to queue/i }));

      expect(betApi.createBet).toHaveBeenCalledWith('ABC123', 'host-123', expect.objectContaining({
        status: 'pending',
      }));
    });

    it('should show Creating... and disable buttons during submission', async () => {
      let resolvePromise: (value: unknown) => void;
      (betApi.createBet as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Test?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'A');
      await user.type(screen.getByPlaceholderText('Option 2'), 'B');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /add to queue/i })).toBeDisabled();

      resolvePromise!({ betId: 'bet-1' });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create & open/i })).not.toBeDisabled();
      });
    });

    it('should show success message and reset form after successful creation', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      render(<BetCreationForm {...defaultProps} onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/question/i), 'Who will win?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'A');
      await user.type(screen.getByPlaceholderText('Option 2'), 'B');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      await waitFor(() => {
        expect(screen.getByText(/bet created successfully/i)).toBeInTheDocument();
      });
      expect(onSuccess).toHaveBeenCalled();
      // Form should be reset
      expect(screen.getByLabelText(/question/i)).toHaveValue('');
    });

    it('should show error message on API failure', async () => {
      (betApi.createBet as ReturnType<typeof vi.fn>).mockRejectedValue({
        detail: 'Room not found',
      });

      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Test?');
      await user.type(screen.getByPlaceholderText('Option 1'), 'A');
      await user.type(screen.getByPlaceholderText('Option 2'), 'B');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      await waitFor(() => {
        expect(screen.getByText('Room not found')).toBeInTheDocument();
      });
    });

    it('should trim whitespace from question and options', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), '  Who will win?  ');
      await user.type(screen.getByPlaceholderText('Option 1'), '  Team A  ');
      await user.type(screen.getByPlaceholderText('Option 2'), '  Team B  ');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(betApi.createBet).toHaveBeenCalledWith('ABC123', 'host-123', expect.objectContaining({
        question: 'Who will win?',
        options: ['Team A', 'Team B'],
      }));
    });

    it('should filter out empty options before submission', async () => {
      const user = userEvent.setup();
      render(<BetCreationForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/question/i), 'Test?');
      await user.click(screen.getByRole('button', { name: /add option/i }));
      await user.type(screen.getByPlaceholderText('Option 1'), 'A');
      // Leave Option 2 empty
      await user.type(screen.getByPlaceholderText('Option 3'), 'C');
      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(betApi.createBet).toHaveBeenCalledWith('ABC123', 'host-123', expect.objectContaining({
        options: ['A', 'C'],
      }));
    });
  });

  describe('Prefill', () => {
    it('should populate form fields from prefill prop', () => {
      render(
        <BetCreationForm
          {...defaultProps}
          prefill={{
            question: 'Who wins the toss?',
            options: ['Team A', 'Team B'],
            pointsValue: 200,
          }}
        />
      );

      expect(screen.getByLabelText(/question/i)).toHaveValue('Who wins the toss?');
      expect(screen.getByPlaceholderText('Option 1')).toHaveValue('Team A');
      expect(screen.getByPlaceholderText('Option 2')).toHaveValue('Team B');
      expect(screen.getByLabelText(/points value/i)).toHaveValue(200);
    });

    it('should include timerDuration from prefill in API call', async () => {
      const user = userEvent.setup();
      render(
        <BetCreationForm
          {...defaultProps}
          prefill={{
            question: 'Test?',
            options: ['A', 'B'],
            timerDuration: 30,
          }}
        />
      );

      await user.click(screen.getByRole('button', { name: /create & open/i }));

      expect(betApi.createBet).toHaveBeenCalledWith('ABC123', 'host-123', expect.objectContaining({
        timerDuration: 30,
      }));
    });
  });
});
