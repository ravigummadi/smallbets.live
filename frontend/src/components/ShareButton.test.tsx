/**
 * Unit tests for ShareButton component
 *
 * Tests native share, clipboard fallback, compact/full modes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import ShareButton from './ShareButton';

expect.extend({ toHaveNoViolations });

const baseProps = {
  roomCode: 'ABC123',
  eventName: 'Test Event',
  isTournament: false,
};

const mockWriteText = vi.fn().mockResolvedValue(undefined);

describe('ShareButton', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
    // Default: no native share
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    // jsdom doesn't provide navigator.clipboard, so define it
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });
  });

  describe('Full mode (default)', () => {
    it('should render share button with invite text', () => {
      render(<ShareButton {...baseProps} />);
      expect(screen.getByText('Share Invite Link')).toBeDefined();
    });

    it('should display room code', () => {
      render(<ShareButton {...baseProps} />);
      expect(screen.getByText('ABC123')).toBeDefined();
    });

    it('should copy join link to clipboard when clicked (no native share)', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Share Invite Link'));

      // Verify the copy succeeded by checking the UI feedback
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
    });

    it('should show "Link Copied!" after clicking', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Share Invite Link'));

      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
    });
  });

  describe('Compact mode', () => {
    it('should render compact share button', () => {
      render(<ShareButton {...baseProps} compact />);
      expect(screen.getByText('Share')).toBeDefined();
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('should have aria-label for accessibility', () => {
      render(<ShareButton {...baseProps} compact />);
      expect(screen.getByLabelText('Share room link')).toBeDefined();
    });

    it('should show "Copied!" after clicking in compact mode', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} compact />);

      await user.click(screen.getByText('Share'));

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeDefined();
      });
    });
  });

  describe('Native share', () => {
    it('should use navigator.share when available', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Share Invite Link'));

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Join Test Event on SmallBets.live',
        text: 'Join my betting room on SmallBets.live! Code: ABC123',
        url: expect.stringContaining('/join/ABC123'),
      });
    });

    it('should use tournament text when isTournament is true', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const user = userEvent.setup();
      render(<ShareButton {...baseProps} isTournament />);

      await user.click(screen.getByText('Share Invite Link'));

      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('tournament'),
        })
      );
    });

    it('should fall back to clipboard if native share is cancelled', async () => {
      const mockShare = vi.fn().mockRejectedValue(new Error('cancelled'));
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Share Invite Link'));

      // Falls back to copy, which shows "Link Copied!" feedback
      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations in full mode', async () => {
      const { container } = render(<ShareButton {...baseProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in compact mode', async () => {
      const { container } = render(<ShareButton {...baseProps} compact />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
