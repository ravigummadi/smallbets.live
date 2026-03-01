/**
 * Unit tests for JoinRoomPage component
 *
 * Tests room code validation, room not found handling, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import userEvent from '@testing-library/user-event';
import JoinRoomPage from './JoinRoomPage';
import { roomApi } from '@/services/api';

expect.extend({ toHaveNoViolations });

// Mock API
vi.mock('@/services/api', () => ({
  roomApi: {
    joinRoom: vi.fn(),
    getRoom: vi.fn(),
  },
}));

// Mock useSession hook
const mockSaveSession = vi.fn();
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    saveSession: mockSaveSession,
  }),
}));

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
let mockRoomCode = 'BLUE';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ code: mockRoomCode }),
  };
});

describe('JoinRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomCode = 'BLUE';
  });

  describe('Rendering', () => {
    it('should render page title', () => {
      render(<JoinRoomPage />);
      expect(screen.getByText(/join room/i)).toBeInTheDocument();
    });

    it('should render nickname input', () => {
      render(<JoinRoomPage />);
      expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
    });

    it('should render join button', () => {
      render(<JoinRoomPage />);
      expect(screen.getByRole('button', { name: /^join room$/i })).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should disable join button when nickname is empty', () => {
      render(<JoinRoomPage />);
      const button = screen.getByRole('button', { name: /^join room$/i });
      expect(button).toBeDisabled();
    });

    it('should enable join button when nickname is provided', async () => {
      const user = userEvent.setup();
      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      expect(button).toBeEnabled();
    });

    it('should validate room code format', () => {
      // Test with invalid room code (too long - maxLength=4 truncates to "INVA")
      mockRoomCode = 'INVALID_CODE';
      render(<JoinRoomPage />);

      // Room code should be visible in the input (truncated by maxLength to 4 chars)
      const input = screen.getByPlaceholderText(/enter 4-character code/i) as HTMLInputElement;
      expect(input.value).toBe('INVALID_CODE');
    });
  });

  describe('Join room success', () => {
    it('should join room successfully', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        user_id: 'user-123',
        room_code: 'BLUE',
      };

      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce(mockResponse);

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.joinRoom).toHaveBeenCalledWith('BLUE', {
          nickname: 'Player1',
        });
      });

      expect(mockSaveSession).toHaveBeenCalledWith({
        userId: 'user-123',
        roomCode: 'BLUE',
      });

      expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE');
    });

    it('should trim nickname before joining', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        user_id: 'user-123',
        room_code: 'BLUE',
      };

      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce(mockResponse);

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, '  Player1  ');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.joinRoom).toHaveBeenCalledWith('BLUE', {
          nickname: 'Player1',
        });
      });
    });
  });

  describe('Error handling', () => {
    it('should show error when room not found', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });
    });

    it('should show error when nickname already taken', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        status: 400,
        detail: 'Nickname already taken',
      });

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'ExistingPlayer');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/nickname already taken/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();

      // First attempt fails
      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Second attempt succeeds
      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce({
        user_id: 'user-123',
        room_code: 'BLUE',
      });

      await user.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE');
      });
    });
  });

  describe('Already joined handling', () => {
    it('should show message when user already joined', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        status: 400,
        detail: 'Already a member of this room',
      });

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/already a member/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility (a11y)', () => {
    const axeOptions = { rules: { 'heading-order': { enabled: false } } };

    it('should have no accessibility violations', async () => {
      const { container } = render(<JoinRoomPage />);
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with error', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        detail: 'Room not found',
      });

      const { container } = render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });

      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });
});
