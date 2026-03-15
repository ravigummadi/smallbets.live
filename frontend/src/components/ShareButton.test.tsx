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
    it('should render copy button with invite text', () => {
      render(<ShareButton {...baseProps} />);
      expect(screen.getByText('Copy Invite Link')).toBeDefined();
    });

    it('should display room code', () => {
      render(<ShareButton {...baseProps} />);
      expect(screen.getByText('ABC123')).toBeDefined();
    });

    it('should copy join link to clipboard when clicked', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Copy Invite Link'));

      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
    });

    it('should show "Link Copied!" after clicking', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Copy Invite Link'));

      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
    });
  });

  describe('Compact mode', () => {
    it('should render compact copy link button', () => {
      render(<ShareButton {...baseProps} compact />);
      expect(screen.getByLabelText('Copy room link')).toBeDefined();
    });

    it('should have aria-label for accessibility', () => {
      render(<ShareButton {...baseProps} compact />);
      expect(screen.getByLabelText('Copy room link')).toBeDefined();
    });

    it('should copy to clipboard when icon is clicked', async () => {
      const user = userEvent.setup();
      render(<ShareButton {...baseProps} compact />);

      await user.click(screen.getByLabelText('Copy room link'));

      // Verify copy happened by checking the icon changes to checkmark (copied state)
      await waitFor(() => {
        expect(screen.getByLabelText('Copy room link').classList.contains('share-btn--copied')).toBe(true);
      });
    });
  });

  describe('Native share', () => {
    it('should show separate Share button when navigator.share is available', () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      render(<ShareButton {...baseProps} />);
      expect(screen.getByText('Share')).toBeDefined();
    });

    it('should copy to clipboard on Copy button click (not native share)', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Copy Invite Link'));

      await waitFor(() => {
        expect(screen.getByText('Link Copied!')).toBeDefined();
      });
      expect(mockShare).not.toHaveBeenCalled();
    });

    it('should call navigator.share when Share button is clicked', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: mockShare, writable: true, configurable: true });

      const user = userEvent.setup();
      render(<ShareButton {...baseProps} />);

      await user.click(screen.getByText('Share'));

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

      await user.click(screen.getByText('Share'));

      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('tournament'),
        })
      );
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
