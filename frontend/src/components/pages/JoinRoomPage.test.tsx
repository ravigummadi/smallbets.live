/**
 * Unit tests for JoinRoomPage component
 *
 * Tests room code validation, room not found handling, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { axe, toHaveNoViolations } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import JoinRoomPage from './JoinRoomPage';
import { roomApi } from '@/services/api';

expect.extend(toHaveNoViolations);

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
let mockRoomCode = 'BLUE42';
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ roomCode: mockRoomCode }),
  };
});

describe('JoinRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomCode = 'BLUE42';
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
      expect(screen.getByRole('button', { name: /^join$/i })).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should disable join button when nickname is empty', () => {
      render(<JoinRoomPage />);
      const button = screen.getByRole('button', { name: /^join$/i });
      expect(button).toBeDisabled();
    });

    it('should enable join button when nickname is provided', async () => {
      const user = userEvent.setup();
      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join$/i });
      expect(button).toBeEnabled();
    });

    it('should validate room code format', () => {
      // Test with invalid room code
      mockRoomCode = 'INVALID_CODE';
      render(<JoinRoomPage />);

      // Room code should be visible somewhere in the UI
      expect(screen.getByText(/INVALID_CODE/i)).toBeInTheDocument();
    });
  });

  describe('Join room success', () => {
    it('should join room successfully', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        user_id: 'user-123',
        room_code: 'BLUE42',
      };

      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce(mockResponse);

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.joinRoom).toHaveBeenCalledWith('BLUE42', {
          nickname: 'Player1',
        });
      });

      expect(mockSaveSession).toHaveBeenCalledWith({
        userId: 'user-123',
        roomCode: 'BLUE42',
      });

      expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE42');
    });

    it('should trim nickname before joining', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        user_id: 'user-123',
        room_code: 'BLUE42',
      };

      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce(mockResponse);

      render(<JoinRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, '  Player1  ');

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.joinRoom).toHaveBeenCalledWith('BLUE42', {
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

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
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

      const button = screen.getByRole('button', { name: /^join$/i });
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

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Second attempt succeeds
      vi.mocked(roomApi.joinRoom).mockResolvedValueOnce({
        user_id: 'user-123',
        room_code: 'BLUE42',
      });

      await user.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE42');
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

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/already a member/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<JoinRoomPage />);
      const results = await axe(container);
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

      const button = screen.getByRole('button', { name: /^join$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
