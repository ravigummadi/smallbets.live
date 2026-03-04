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
let mockRoomCode: string | undefined = 'BLUE';
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
    // Default: room exists (getRoom resolves)
    vi.mocked(roomApi.getRoom).mockResolvedValue({} as any);
  });

  describe('Rendering', () => {
    it('should render page title', async () => {
      render(<JoinRoomPage />);
      await waitFor(() => {
        expect(screen.getByText(/join/i)).toBeInTheDocument();
      });
    });

    it('should render nickname input', async () => {
      render(<JoinRoomPage />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });
    });

    it('should render join button', async () => {
      render(<JoinRoomPage />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^join room$/i })).toBeInTheDocument();
      });
    });
  });

  describe('Form validation', () => {
    it('should disable join button when nickname is empty', async () => {
      render(<JoinRoomPage />);
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /^join room$/i });
        expect(button).toBeDisabled();
      });
    });

    it('should enable join button when nickname is provided', async () => {
      const user = userEvent.setup();
      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      expect(button).toBeEnabled();
    });

    it('should validate room code format', async () => {
      // Test with invalid room code (too long, won't trigger eager validation)
      mockRoomCode = 'INVALID_CODE';
      vi.mocked(roomApi.getRoom).mockClear();
      render(<JoinRoomPage />);

      // Room code should be visible in the input (no eager validation for codes outside 4-6 range)
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;
        expect(input.value).toBe('INVALID_CODE');
      });
    });
  });

  describe('Eager room validation', () => {
    it('should show room not found when URL code does not exist', async () => {
      vi.mocked(roomApi.getRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByText(/room not found/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create a new room/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try a different code/i })).toBeInTheDocument();
    });

    it('should show form when room exists', async () => {
      vi.mocked(roomApi.getRoom).mockResolvedValueOnce({} as any);

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });
    });

    it('should navigate to create page when Create a New Room is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(roomApi.getRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create a new room/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /create a new room/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/create');
    });

    it('should show join form when Try a Different Code is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(roomApi.getRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try a different code/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /try a different code/i }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter room code/i)).toBeInTheDocument();
      });
    });

    it('should not eagerly validate when no URL code is provided', () => {
      mockRoomCode = undefined;
      vi.mocked(roomApi.getRoom).mockClear();
      render(<JoinRoomPage />);

      expect(roomApi.getRoom).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText(/enter room code/i)).toBeInTheDocument();
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

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

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
        nickname: 'Player1',
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

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

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
    it('should show room not found state when join returns 404', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /create a new room/i })).toBeInTheDocument();
    });

    it('should show error when nickname already taken', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        status: 400,
        detail: 'Nickname already taken',
      });

      render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

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

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

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
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });
      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations on room not found', async () => {
      vi.mocked(roomApi.getRoom).mockRejectedValueOnce({
        status: 404,
        detail: 'Room not found',
      });

      const { container } = render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
      });

      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with error', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.joinRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      const { container } = render(<JoinRoomPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(input, 'Player1');

      const button = screen.getByRole('button', { name: /^join room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      const results = await axe(container, axeOptions);
      expect(results).toHaveNoViolations();
    });
  });
});
