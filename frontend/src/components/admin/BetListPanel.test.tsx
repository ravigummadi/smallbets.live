/**
 * Unit tests for BetListPanel component
 *
 * Tests bet list rendering, sorting, status actions (close, resolve, delete),
 * and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import BetListPanel from './BetListPanel';
import type { Bet } from '@/types';

expect.extend({ toHaveNoViolations });

vi.mock('@/services/api', () => ({
  betApi: {
    lockBet: vi.fn(),
    resolveBet: vi.fn(),
    deleteBet: vi.fn(),
  },
}));

import { betApi } from '@/services/api';

const defaultProps = {
  roomCode: 'ABC123',
  hostId: 'host-123',
};

function makeBet(overrides: Partial<Bet> = {}): Bet {
  return {
    betId: 'bet-1',
    roomCode: 'ABC123',
    question: 'Who will win?',
    options: ['Option A', 'Option B'],
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
    ...overrides,
  } as Bet;
}

describe('BetListPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (betApi.lockBet as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (betApi.resolveBet as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (betApi.deleteBet as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetListPanel {...defaultProps} bets={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no bets exist', () => {
      render(<BetListPanel {...defaultProps} bets={[]} />);
      expect(screen.getByText(/no bets created yet/i)).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('should display bet question and metadata', () => {
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);
      expect(screen.getByText('Who will win?')).toBeInTheDocument();
      expect(screen.getByText(/2 options/)).toBeInTheDocument();
      expect(screen.getByText(/100 points/)).toBeInTheDocument();
    });

    it('should show status badge', () => {
      render(<BetListPanel {...defaultProps} bets={[makeBet({ status: 'open' })]} />);
      expect(screen.getByText('open')).toBeInTheDocument();
    });

    it('should show options in expandable details', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByText('View options'));

      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    it('should display winning option for resolved bets', () => {
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ status: 'resolved', winningOption: 'Option A' }),
      ]} />);
      expect(screen.getByText(/winner: option a/i)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort bets by status: pending → open → locked → resolved', () => {
      const bets = [
        makeBet({ betId: 'resolved-1', status: 'resolved', question: 'Resolved Q' }),
        makeBet({ betId: 'open-1', status: 'open', question: 'Open Q' }),
        makeBet({ betId: 'pending-1', status: 'pending', question: 'Pending Q' }),
        makeBet({ betId: 'locked-1', status: 'locked', question: 'Locked Q' }),
      ];

      render(<BetListPanel {...defaultProps} bets={bets} />);

      const questions = screen.getAllByText(/Q$/).map(el => el.textContent);
      expect(questions).toEqual(['Pending Q', 'Open Q', 'Locked Q', 'Resolved Q']);
    });
  });

  describe('Actions - Open Bets', () => {
    it('should show Close Bet and Delete buttons for open bets', () => {
      render(<BetListPanel {...defaultProps} bets={[makeBet({ status: 'open' })]} />);
      expect(screen.getByRole('button', { name: /close bet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should call betApi.lockBet when Close Bet is clicked', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet({ betId: 'bet-42' })]} />);

      await user.click(screen.getByRole('button', { name: /close bet/i }));

      expect(betApi.lockBet).toHaveBeenCalledWith('ABC123', 'host-123', 'bet-42');
    });

    it('should show Closing... text during close operation', async () => {
      let resolveClose: (value: unknown) => void;
      (betApi.lockBet as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolveClose = resolve; })
      );

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByRole('button', { name: /close bet/i }));

      expect(screen.getByRole('button', { name: /closing/i })).toBeDisabled();

      resolveClose!({});
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /closing/i })).not.toBeInTheDocument();
      });
    });

    it('should call betApi.deleteBet when Delete is clicked', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet({ betId: 'bet-42' })]} />);

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(betApi.deleteBet).toHaveBeenCalledWith('ABC123', 'host-123', 'bet-42');
    });

    it('should show Deleting... text during delete operation', async () => {
      let resolveDelete: (value: unknown) => void;
      (betApi.deleteBet as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolveDelete = resolve; })
      );

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();

      resolveDelete!({});
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /deleting/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Actions - Locked Bets (Resolve)', () => {
    it('should show Resolve Bet button for locked bets', () => {
      render(<BetListPanel {...defaultProps} bets={[makeBet({ status: 'locked' })]} />);
      expect(screen.getByRole('button', { name: /resolve bet/i })).toBeInTheDocument();
    });

    it('should not show Close or Delete buttons for locked bets', () => {
      render(<BetListPanel {...defaultProps} bets={[makeBet({ status: 'locked' })]} />);
      expect(screen.queryByRole('button', { name: /close bet/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it('should show option selection when Resolve Bet is clicked', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ status: 'locked', options: ['Winner A', 'Winner B'] }),
      ]} />);

      await user.click(screen.getByRole('button', { name: /resolve bet/i }));

      expect(screen.getByText('Select winning option:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Winner A' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Winner B' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should call betApi.resolveBet when a winning option is selected', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ betId: 'bet-42', status: 'locked', options: ['A', 'B'] }),
      ]} />);

      await user.click(screen.getByRole('button', { name: /resolve bet/i }));
      await user.click(screen.getByRole('button', { name: 'A' }));

      expect(betApi.resolveBet).toHaveBeenCalledWith('ABC123', 'host-123', 'bet-42', 'A');
    });

    it('should hide option selection when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ status: 'locked', options: ['A', 'B'] }),
      ]} />);

      await user.click(screen.getByRole('button', { name: /resolve bet/i }));
      expect(screen.getByText('Select winning option:')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByText('Select winning option:')).not.toBeInTheDocument();
    });
  });

  describe('Actions - Resolved Bets', () => {
    it('should not show any action buttons for resolved bets', () => {
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ status: 'resolved', winningOption: 'A' }),
      ]} />);
      expect(screen.queryByRole('button', { name: /close bet/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resolve bet/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error when close bet fails', async () => {
      (betApi.lockBet as ReturnType<typeof vi.fn>).mockRejectedValue({
        detail: 'Bet already closed',
      });

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByRole('button', { name: /close bet/i }));

      await waitFor(() => {
        expect(screen.getByText('Bet already closed')).toBeInTheDocument();
      });
    });

    it('should show error when resolve bet fails', async () => {
      (betApi.resolveBet as ReturnType<typeof vi.fn>).mockRejectedValue({
        detail: 'Invalid option',
      });

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[
        makeBet({ status: 'locked', options: ['A', 'B'] }),
      ]} />);

      await user.click(screen.getByRole('button', { name: /resolve bet/i }));
      await user.click(screen.getByRole('button', { name: 'A' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid option')).toBeInTheDocument();
      });
    });

    it('should show error when delete bet fails', async () => {
      (betApi.deleteBet as ReturnType<typeof vi.fn>).mockRejectedValue({
        detail: 'Cannot delete locked bet',
      });

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(screen.getByText('Cannot delete locked bet')).toBeInTheDocument();
      });
    });

    it('should show generic error message when API error has no detail', async () => {
      (betApi.lockBet as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<BetListPanel {...defaultProps} bets={[makeBet()]} />);

      await user.click(screen.getByRole('button', { name: /close bet/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to close bet')).toBeInTheDocument();
      });
    });
  });
});
