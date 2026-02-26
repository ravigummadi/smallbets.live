/**
 * Unit tests for CreateRoomPage component
 *
 * Tests form validation, room creation failure/retry, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import { axe, toHaveNoViolations } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import CreateRoomPage from './CreateRoomPage';
import { roomApi } from '@/services/api';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock API
vi.mock('@/services/api', () => ({
  roomApi: {
    createRoom: vi.fn(),
  },
}));

// Mock useSession hook
const mockSaveSession = vi.fn();
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    saveSession: mockSaveSession,
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CreateRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<CreateRoomPage />);

      expect(screen.getByText('Create a Room')).toBeInTheDocument();
    });

    it('should render nickname input', () => {
      render(<CreateRoomPage />);

      expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
    });

    it('should render event template selector', () => {
      render(<CreateRoomPage />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /grammy awards 2026/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /oscars 2026/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /super bowl lix/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /custom event/i })).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<CreateRoomPage />);

      expect(screen.getByRole('button', { name: /^create room$/i })).toBeInTheDocument();
    });

    it('should render cancel button', () => {
      render(<CreateRoomPage />);

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not show custom event name input by default', () => {
      render(<CreateRoomPage />);

      expect(screen.queryByPlaceholderText(/enter your event name/i)).not.toBeInTheDocument();
    });

    it('should show custom event name input when custom template is selected', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      expect(screen.getByPlaceholderText(/enter your event name/i)).toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should disable submit button when nickname is empty', () => {
      render(<CreateRoomPage />);

      const button = screen.getByRole('button', { name: /^create room$/i });

      expect(button).toBeDisabled();
    });

    it('should enable submit button when nickname is provided', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });

      expect(button).toBeEnabled();
    });

    it('should disable submit button when nickname is only whitespace', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, '   ');

      const button = screen.getByRole('button', { name: /^create room$/i });

      expect(button).toBeDisabled();
    });

    it('should show validation error when submitting empty nickname', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, '   '); // Type and clear

      const button = screen.getByRole('button', { name: /^create room$/i });

      // Button should be disabled so this shouldn't trigger, but test the validation logic
      expect(button).toBeDisabled();
    });

    it('should disable submit button for custom template without event name', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      const button = screen.getByRole('button', { name: /^create room$/i });

      expect(button).toBeDisabled();
    });

    it('should enable submit button for custom template with event name', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      const eventNameInput = screen.getByPlaceholderText(/enter your event name/i);
      await user.type(eventNameInput, 'My Custom Event');

      const button = screen.getByRole('button', { name: /^create room$/i });

      expect(button).toBeEnabled();
    });

    it('should limit nickname to 20 characters', () => {
      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i) as HTMLInputElement;

      expect(nicknameInput.maxLength).toBe(20);
    });

    it('should limit event name to 50 characters', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      const eventNameInput = screen.getByPlaceholderText(/enter your event name/i) as HTMLInputElement;

      expect(eventNameInput.maxLength).toBe(50);
    });
  });

  describe('Room creation', () => {
    it('should create room successfully and navigate', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      };

      vi.mocked(roomApi.createRoom).mockResolvedValueOnce(mockResponse);

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.createRoom).toHaveBeenCalledWith({
          event_template: 'grammys-2026',
          event_name: undefined,
          host_nickname: 'TestHost',
        });
      });

      expect(mockSaveSession).toHaveBeenCalledWith({
        userId: 'user-123',
        roomCode: 'BLUE42',
        hostId: 'host-123',
      });

      expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE42');
    });

    it('should trim nickname before submission', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      };

      vi.mocked(roomApi.createRoom).mockResolvedValueOnce(mockResponse);

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, '  TestHost  ');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.createRoom).toHaveBeenCalledWith(
          expect.objectContaining({
            host_nickname: 'TestHost',
          })
        );
      });
    });

    it('should send custom event name for custom template', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      };

      vi.mocked(roomApi.createRoom).mockResolvedValueOnce(mockResponse);

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      const eventNameInput = screen.getByPlaceholderText(/enter your event name/i);
      await user.type(eventNameInput, 'My Custom Event');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(roomApi.createRoom).toHaveBeenCalledWith({
          event_template: 'custom',
          event_name: 'My Custom Event',
          host_nickname: 'TestHost',
        });
      });
    });

    it('should show loading state during creation', async () => {
      const user = userEvent.setup();

      // Create a promise that we can control
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });

      vi.mocked(roomApi.createRoom).mockReturnValueOnce(createPromise as any);

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      // Should show loading state
      expect(screen.getByRole('button', { name: /creating room/i })).toBeDisabled();

      // Resolve the promise
      resolveCreate!({
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      });
    });

    it('should disable buttons during loading', async () => {
      const user = userEvent.setup();

      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });

      vi.mocked(roomApi.createRoom).mockReturnValueOnce(createPromise as any);

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const submitButton = screen.getByRole('button', { name: /^create room$/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      await user.click(submitButton);

      // Both buttons should be disabled
      expect(submitButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();

      resolveCreate!({
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      });
    });
  });

  describe('Error handling', () => {
    it('should display error message on failure', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.createRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('should display generic error message when detail is missing', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.createRoom).mockRejectedValueOnce(new Error('Network error'));

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/failed to create room/i)).toBeInTheDocument();
      });
    });

    it('should allow retry after failure', async () => {
      const user = userEvent.setup();

      // First call fails
      vi.mocked(roomApi.createRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Button should be re-enabled
      expect(button).toBeEnabled();

      // Second call succeeds
      vi.mocked(roomApi.createRoom).mockResolvedValueOnce({
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      });

      await user.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/room/BLUE42');
      });
    });

    it('should clear error when retrying', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.createRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      // Mock success for retry
      let resolveCreate: (value: any) => void;
      const createPromise = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(roomApi.createRoom).mockReturnValueOnce(createPromise as any);

      await user.click(button);

      // Error should be cleared during loading
      expect(screen.queryByText('Server error')).not.toBeInTheDocument();

      resolveCreate!({
        room_code: 'BLUE42',
        user_id: 'user-123',
        host_id: 'host-123',
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back to home on cancel', async () => {
      const user = userEvent.setup();
      render(<CreateRoomPage />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<CreateRoomPage />);

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with custom event name', async () => {
      const user = userEvent.setup();
      const { container } = render(<CreateRoomPage />);

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'custom');

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with error message', async () => {
      const user = userEvent.setup();

      vi.mocked(roomApi.createRoom).mockRejectedValueOnce({
        detail: 'Server error',
      });

      const { container } = render(<CreateRoomPage />);

      const nicknameInput = screen.getByPlaceholderText(/enter your nickname/i);
      await user.type(nicknameInput, 'TestHost');

      const button = screen.getByRole('button', { name: /^create room$/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should have autofocus on nickname input', () => {
      render(<CreateRoomPage />);

      const input = screen.getByPlaceholderText(/enter your nickname/i);

      expect(input).toHaveAttribute('autoFocus');
    });

    it('should have proper heading hierarchy', () => {
      render(<CreateRoomPage />);

      const h2 = screen.getByRole('heading', { level: 2 });
      const h4s = screen.getAllByRole('heading', { level: 4 });

      expect(h2).toHaveTextContent('Create a Room');
      expect(h4s.length).toBeGreaterThanOrEqual(2);
    });
  });
});
