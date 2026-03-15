/**
 * Unit tests for BetCard component
 *
 * Tests rendering for different bet states, user interactions,
 * and host admin controls.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import BetCard from './BetCard';

expect.extend({ toHaveNoViolations });

const baseBet = {
  betId: 'bet-1',
  roomCode: 'ABC123',
  question: 'Who will win?',
  options: ['Option A', 'Option B'],
  status: 'open' as const,
  pointsValue: 100,
  createdAt: new Date().toISOString(),
  timerDuration: 0,
  betType: 'match' as const,
};

const baseProps = {
  bet: baseBet,
  isExpanded: false,
  isPlacing: false,
  isHost: false,
  closingBetId: null,
  resolvingBetId: null,
  deletingBetId: null,
  onToggleExpand: vi.fn(),
  onPlaceBet: vi.fn(),
  onCloseBet: vi.fn(),
  onResolveBet: vi.fn(),
  onDeleteBet: vi.fn(),
  onEditBet: vi.fn(),
  onUndoBet: vi.fn(),
  onViewBets: vi.fn(),
  canUndo: () => false,
};

describe('BetCard', () => {
  describe('Rendering', () => {
    it('should render bet question and metadata', () => {
      render(<BetCard {...baseProps} />);
      expect(screen.getByText('Who will win?')).toBeDefined();
      expect(screen.getByText(/2 options/)).toBeDefined();
      expect(screen.getByText(/100 points/)).toBeDefined();
    });

    it('should show "Bet placed" when user has placed a bet', () => {
      const userBet = {
        userId: 'user-1',
        betId: 'bet-1',
        roomCode: 'ABC123',
        selectedOption: 'Option A',
        pointsWon: null,
        placedAt: new Date().toISOString(),
      };
      render(<BetCard {...baseProps} userBet={userBet} />);
      expect(screen.getByText(/Bet placed/)).toBeDefined();
    });

    it('should show winner when bet is resolved', () => {
      const resolvedBet = {
        ...baseBet,
        status: 'resolved' as const,
        winningOption: 'Option A',
      };
      render(<BetCard {...baseProps} bet={resolvedBet} />);
      expect(screen.getByText(/Winner: Option A/)).toBeDefined();
    });
  });

  describe('Expanded state', () => {
    it('should show options when expanded and open', () => {
      render(<BetCard {...baseProps} isExpanded={true} />);
      expect(screen.getByText('Option A')).toBeDefined();
      expect(screen.getByText('Option B')).toBeDefined();
    });

    it('should show "Betting is closed" for locked bet', () => {
      const lockedBet = { ...baseBet, status: 'locked' as const };
      render(<BetCard {...baseProps} bet={lockedBet} isExpanded={true} />);
      expect(screen.getByText('Betting is closed')).toBeDefined();
    });

    it('should show user bet details when expanded', () => {
      const userBet = {
        userId: 'user-1',
        betId: 'bet-1',
        roomCode: 'ABC123',
        selectedOption: 'Option A',
        pointsWon: null,
        placedAt: new Date().toISOString(),
      };
      render(<BetCard {...baseProps} userBet={userBet} isExpanded={true} />);
      expect(screen.getByText('Option A')).toBeDefined();
      expect(screen.getByText(/Your bet:/)).toBeDefined();
    });

    it('should show win/loss result for resolved bet', () => {
      const resolvedBet = {
        ...baseBet,
        status: 'resolved' as const,
        winningOption: 'Option A',
      };
      const userBet = {
        userId: 'user-1',
        betId: 'bet-1',
        roomCode: 'ABC123',
        selectedOption: 'Option A',
        pointsWon: 200,
        placedAt: new Date().toISOString(),
      };
      render(<BetCard {...baseProps} bet={resolvedBet} userBet={userBet} isExpanded={true} />);
      expect(screen.getByText(/Won 200 pts/)).toBeDefined();
    });
  });

  describe('User interactions', () => {
    it('should call onToggleExpand when header is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<BetCard {...baseProps} onToggleExpand={onToggle} />);

      await user.click(screen.getByText('Who will win?'));
      expect(onToggle).toHaveBeenCalledWith('bet-1');
    });

    it('should call onPlaceBet when option is clicked', async () => {
      const user = userEvent.setup();
      const onPlace = vi.fn();
      render(<BetCard {...baseProps} isExpanded={true} onPlaceBet={onPlace} />);

      await user.click(screen.getByText('Option A'));
      expect(onPlace).toHaveBeenCalledWith('bet-1', 'Option A');
    });

    it('should disable options while placing bet', () => {
      render(<BetCard {...baseProps} isExpanded={true} isPlacing={true} />);
      const buttons = screen.getAllByRole('button');
      const optionBtn = buttons.find(b => b.textContent === 'Option A');
      expect(optionBtn?.getAttribute('disabled')).toBeDefined();
    });

    it('should show placing text while placing bet', () => {
      render(<BetCard {...baseProps} isExpanded={true} isPlacing={true} />);
      expect(screen.getByText('Placing bet...')).toBeDefined();
    });

    it('should show error message when bet placement fails', () => {
      render(<BetCard {...baseProps} isExpanded={true} error="Insufficient points" />);
      expect(screen.getByText('Insufficient points')).toBeDefined();
    });
  });

  describe('Host admin controls', () => {
    it('should show Lock Bet button for host on open bet', () => {
      render(<BetCard {...baseProps} isHost={true} isExpanded={true} />);
      expect(screen.getByText('Lock Bet')).toBeDefined();
    });

    it('should show Edit and Delete buttons for host on open bet', () => {
      render(<BetCard {...baseProps} isHost={true} isExpanded={true} />);
      expect(screen.getByText('Edit')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('should show quick-resolve buttons for host on locked bet', () => {
      const lockedBet = { ...baseBet, status: 'locked' as const };
      render(<BetCard {...baseProps} bet={lockedBet} isHost={true} isExpanded={true} />);
      expect(screen.getByText('Tap the winner:')).toBeDefined();
      expect(screen.getByText('Option A')).toBeDefined();
      expect(screen.getByText('Option B')).toBeDefined();
    });

    it('should not show admin controls for non-host', () => {
      render(<BetCard {...baseProps} isHost={false} isExpanded={true} />);
      expect(screen.queryByText('Lock Bet')).toBeNull();
    });

    it('should call onCloseBet when Lock Bet is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<BetCard {...baseProps} isHost={true} isExpanded={true} onCloseBet={onClose} />);

      await user.click(screen.getByText('Lock Bet'));
      expect(onClose).toHaveBeenCalledWith('bet-1');
    });

    it('should call onResolveBet when quick-resolve option is clicked', async () => {
      const user = userEvent.setup();
      const onResolve = vi.fn();
      const lockedBet = { ...baseBet, status: 'locked' as const };
      render(<BetCard {...baseProps} bet={lockedBet} isHost={true} isExpanded={true} onResolveBet={onResolve} />);

      await user.click(screen.getByText('Option A'));
      expect(onResolve).toHaveBeenCalledWith('bet-1', 'Option A');
    });

    it('should show Undo button for resolved bet within undo window', () => {
      const resolvedBet = {
        ...baseBet,
        status: 'resolved' as const,
        winningOption: 'Option A',
        canUndoUntil: new Date(Date.now() + 10000).toISOString(),
      };
      render(<BetCard {...baseProps} bet={resolvedBet} isHost={true} canUndo={() => true} />);
      expect(screen.getByText('Undo')).toBeDefined();
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetCard {...baseProps} isExpanded={true} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
