/**
 * Unit tests for HostActionBar component
 *
 * Tests sticky action bar rendering for different room states.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import HostActionBar from './HostActionBar';

const mockRoom = {
  code: 'ABC123',
  status: 'active',
  hostId: 'host-123',
  roomType: 'event',
} as any;

const baseProps = {
  room: mockRoom,
  isTournament: false,
  openBets: [],
  closingBetId: null,
  onStartRoom: vi.fn(),
  onCloseBet: vi.fn(),
  onShowBetModal: vi.fn(),
  onShowFeedModal: vi.fn(),
};

describe('HostActionBar', () => {
  describe('Active room', () => {
    it('should show New Bet and Live Feed buttons', () => {
      render(<HostActionBar {...baseProps} />);
      expect(screen.getByText('+ New Bet')).toBeDefined();
      expect(screen.getByText('Live Feed')).toBeDefined();
    });

    it('should show Lock button when open bets exist', () => {
      const openBet = { betId: 'b1', question: 'Test question here?', status: 'open' } as any;
      render(<HostActionBar {...baseProps} openBets={[openBet]} />);
      expect(screen.getByText(/Lock: Test question here/)).toBeDefined();
    });

    it('should truncate long bet questions in Lock button', () => {
      const openBet = {
        betId: 'b1',
        question: 'This is a very long question that exceeds twenty five chars',
        status: 'open',
      } as any;
      render(<HostActionBar {...baseProps} openBets={[openBet]} />);
      expect(screen.getByText(/Lock: This is a very long quest\.\.\./)).toBeDefined();
    });

    it('should call onCloseBet when Lock button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const openBet = { betId: 'b1', question: 'Test?', status: 'open' } as any;
      render(<HostActionBar {...baseProps} openBets={[openBet]} onCloseBet={onClose} />);

      await user.click(screen.getByText(/Lock:/));
      expect(onClose).toHaveBeenCalledWith('b1');
    });
  });

  describe('Waiting room', () => {
    it('should show Start Event button', () => {
      const waitingRoom = { ...mockRoom, status: 'waiting' };
      render(<HostActionBar {...baseProps} room={waitingRoom} />);
      expect(screen.getByText('Start Event')).toBeDefined();
    });

    it('should show Start Tournament for tournament rooms', () => {
      const waitingRoom = { ...mockRoom, status: 'waiting' };
      render(<HostActionBar {...baseProps} room={waitingRoom} isTournament={true} />);
      expect(screen.getByText('Start Tournament')).toBeDefined();
    });

    it('should call onStartRoom when Start button is clicked', async () => {
      const user = userEvent.setup();
      const onStart = vi.fn();
      const waitingRoom = { ...mockRoom, status: 'waiting' };
      render(<HostActionBar {...baseProps} room={waitingRoom} onStartRoom={onStart} />);

      await user.click(screen.getByText('Start Event'));
      expect(onStart).toHaveBeenCalledOnce();
    });
  });

  describe('Finished room', () => {
    it('should not render for finished rooms', () => {
      const finishedRoom = { ...mockRoom, status: 'finished' };
      const { container } = render(<HostActionBar {...baseProps} room={finishedRoom} />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('Button interactions', () => {
    it('should call onShowBetModal when New Bet is clicked', async () => {
      const user = userEvent.setup();
      const onShow = vi.fn();
      render(<HostActionBar {...baseProps} onShowBetModal={onShow} />);

      await user.click(screen.getByText('+ New Bet'));
      expect(onShow).toHaveBeenCalledOnce();
    });

    it('should call onShowFeedModal when Live Feed is clicked', async () => {
      const user = userEvent.setup();
      const onShow = vi.fn();
      render(<HostActionBar {...baseProps} onShowFeedModal={onShow} />);

      await user.click(screen.getByText('Live Feed'));
      expect(onShow).toHaveBeenCalledOnce();
    });
  });
});
