/**
 * Unit tests for RoomCreatedPage component
 *
 * Tests share options, copy-to-clipboard, native share, mailto, and navigation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import RoomCreatedPage from './RoomCreatedPage';

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

describe('RoomCreatedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default params for a valid room
    mockSearchParams = new URLSearchParams({
      code: 'ABCD',
      uk: 'testkey1',
      name: 'Grammy Awards 2026',
    });
  });

  describe('Rendering', () => {
    it('should render Room Created heading for single event', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText('Room Created!')).toBeInTheDocument();
    });

    it('should render Tournament Created heading when type=tournament', () => {
      mockSearchParams.set('type', 'tournament');
      render(<RoomCreatedPage />);
      expect(screen.getByText('Tournament Created!')).toBeInTheDocument();
    });

    it('should display the event name', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText('Grammy Awards 2026')).toBeInTheDocument();
    });

    it('should display the host link', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText(/\/room\/ABCD\/u\/testkey1/)).toBeInTheDocument();
    });

    it('should display the join link with room code', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText(/\/join\/ABCD/)).toBeInTheDocument();
      expect(screen.getByText('ABCD')).toBeInTheDocument();
    });

    it('should show Your Host Link section', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText('Your Host Link')).toBeInTheDocument();
    });

    it('should show Share with Friends section', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText('Share with Friends')).toBeInTheDocument();
    });

    it('should show Email section', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByText('Email Yourself a Copy')).toBeInTheDocument();
    });

    it('should show Go to Room button', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByRole('button', { name: /go to room/i })).toBeInTheDocument();
    });
  });

  describe('Copy to clipboard', () => {
    it('should show Copied! feedback after copying host link', async () => {
      const user = userEvent.setup();
      render(<RoomCreatedPage />);

      const copyBtn = screen.getByRole('button', { name: /copy host link/i });
      await user.click(copyBtn);

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('should show Copy Host Link and Copy Join Link buttons', () => {
      render(<RoomCreatedPage />);
      expect(screen.getByRole('button', { name: /copy host link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy join link/i })).toBeInTheDocument();
    });
  });

  describe('Native Share', () => {
    it('should show Share button when navigator.share is available', () => {
      Object.defineProperty(navigator, 'share', {
        value: vi.fn().mockResolvedValue(undefined),
        writable: true,
        configurable: true,
      });
      render(<RoomCreatedPage />);
      expect(screen.getByRole('button', { name: /share\.\.\./i })).toBeInTheDocument();
    });

    it('should not show Share button when navigator.share is unavailable', () => {
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      render(<RoomCreatedPage />);
      expect(screen.queryByRole('button', { name: /share\.\.\./i })).not.toBeInTheDocument();
    });

    it('should call navigator.share with correct data', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        value: mockShare,
        writable: true,
        configurable: true,
      });
      const user = userEvent.setup();

      render(<RoomCreatedPage />);

      const shareBtn = screen.getByRole('button', { name: /share\.\.\./i });
      await user.click(shareBtn);

      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/join/ABCD'),
        })
      );
    });
  });

  describe('Email link', () => {
    it('should have mailto link with pre-filled content', () => {
      render(<RoomCreatedPage />);

      const emailLink = screen.getByRole('link', { name: /open email app/i });
      const href = emailLink.getAttribute('href');

      expect(href).toMatch(/^mailto:\?subject=/);
      expect(href).toContain(encodeURIComponent('ABCD'));
    });
  });

  describe('Navigation', () => {
    it('should navigate to room when Go to Room is clicked', async () => {
      const user = userEvent.setup();
      render(<RoomCreatedPage />);

      const goBtn = screen.getByRole('button', { name: /go to room/i });
      await user.click(goBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/room/ABCD/u/testkey1');
    });

    it('should redirect to home when roomCode is missing', () => {
      mockSearchParams = new URLSearchParams({ uk: 'testkey1' });
      render(<RoomCreatedPage />);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('should redirect to home when userKey is missing', () => {
      mockSearchParams = new URLSearchParams({ code: 'ABCD' });
      render(<RoomCreatedPage />);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
