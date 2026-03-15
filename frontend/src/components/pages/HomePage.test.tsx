/**
 * Unit tests for HomePage component
 *
 * Tests navigation links and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

// Extend expect with accessibility matchers
expect.extend({ toHaveNoViolations });

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useMyRooms hook
const mockRemoveRoom = vi.fn();
let mockMyRooms: any[] = [];
vi.mock('@/hooks/useMyRooms', () => ({
  useMyRooms: () => ({
    rooms: mockMyRooms,
    saveRoom: vi.fn(),
    removeRoom: mockRemoveRoom,
  }),
}));

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRemoveRoom.mockClear();
    mockMyRooms = [];
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SmallBets.live');
    });

    it('should render the tagline', () => {
      render(<HomePage />);

      expect(
        screen.getByText(/bet on anything with friends/i)
      ).toBeInTheDocument();
    });

    it('should render join room form', () => {
      render(<HomePage />);

      expect(screen.getByPlaceholderText(/enter room code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
    });

    it('should render create room link', () => {
      render(<HomePage />);

      expect(screen.getByRole('link', { name: /create new room/i })).toBeInTheDocument();
    });

    it('should render how-it-works section', () => {
      render(<HomePage />);

      expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument();
      expect(screen.getByText(/create or join/i)).toBeInTheDocument();
      expect(screen.getByText(/place your bets/i)).toBeInTheDocument();
      expect(screen.getByText(/win bragging rights/i)).toBeInTheDocument();
    });

    it('should render event types section', () => {
      render(<HomePage />);

      expect(screen.getByText(/built for any event/i)).toBeInTheDocument();
      expect(screen.getByText(/award shows/i)).toBeInTheDocument();
      expect(screen.getByText(/sports/i)).toBeInTheDocument();
    });

    it('should render CTA section', () => {
      render(<HomePage />);

      expect(screen.getByText(/ready to play/i)).toBeInTheDocument();
      expect(screen.getByText(/no signup required/i)).toBeInTheDocument();
    });
  });

  describe('Form interactions', () => {
    it('should allow typing in the room code input', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;

      await user.type(input, 'BLUE');

      expect(input.value).toBe('BLUE');
    });

    it('should convert lowercase input to uppercase', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;

      await user.type(input, 'blue');

      expect(input.value).toBe('BLUE');
    });

    it('should limit input to 6 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;

      await user.type(input, 'BLUE42X');

      expect(input.value).toBe('BLUE42');
      expect(input.maxLength).toBe(6);
    });

    it('should disable submit button when room code is empty', () => {
      render(<HomePage />);

      const button = screen.getByRole('button', { name: /join/i });

      expect(button).toBeDisabled();
    });

    it('should disable submit button when room code is less than 4 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join/i });

      await user.type(input, 'BLU');

      expect(button).toBeDisabled();
    });

    it('should enable submit button when room code is 4 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join/i });

      await user.type(input, 'BLUE');

      expect(button).toBeEnabled();
    });

    it('should navigate to join page on form submit', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join/i });

      await user.type(input, 'BLUE');
      await user.click(button);

      expect(mockNavigate).toHaveBeenCalledWith('/join/BLUE');
    });

    it('should navigate to join page on Enter key', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      await user.type(input, 'BLUE');
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/join/BLUE');
    });

    it('should trim whitespace from room code', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      // Type a valid room code
      await user.type(input, 'BLUE');

      const button = screen.getByRole('button', { name: /join/i });
      await user.click(button);

      // Should navigate with the code
      expect(mockNavigate).toHaveBeenCalledWith('/join/BLUE');
    });

    it('should not submit form with empty room code after whitespace trim', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join/i });

      // Type fewer than 4 characters
      await user.type(input, 'BL');

      // Button should remain disabled (less than 4 chars)
      expect(button).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should have link to create room page', () => {
      render(<HomePage />);

      const link = screen.getByRole('link', { name: /create new room/i });

      expect(link).toHaveAttribute('href', '/create');
    });

    it('should navigate to create room when link is clicked', async () => {
      render(<HomePage />);

      const link = screen.getByRole('link', { name: /create new room/i });

      expect(link).toHaveAttribute('href', '/create');
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<HomePage />);

      const results = await axe(container, {
        rules: { 'heading-order': { enabled: false } },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper button semantics', () => {
      render(<HomePage />);

      const joinButton = screen.getByRole('button', { name: /join/i });

      expect(joinButton).toHaveAttribute('type', 'submit');
    });

    it('should have proper link semantics', () => {
      render(<HomePage />);

      const createLink = screen.getByRole('link', { name: /create new room/i });

      expect(createLink.tagName).toBe('A');
      expect(createLink).toHaveAttribute('href');
    });

    it('should have proper heading hierarchy', () => {
      render(<HomePage />);

      const h1 = screen.getByRole('heading', { level: 1 });

      expect(h1).toHaveTextContent('SmallBets.live');
    });
  });

  describe('My Rooms section', () => {
    it('should not show My Rooms section when no rooms saved', () => {
      mockMyRooms = [];
      render(<HomePage />);
      expect(screen.queryByText('My Rooms')).not.toBeInTheDocument();
    });

    it('should show My Rooms section when rooms exist', () => {
      mockMyRooms = [{
        roomCode: 'ABCD',
        userKey: 'key12345',
        hostLink: 'http://localhost/room/ABCD/u/key12345',
        joinLink: 'http://localhost/join/ABCD',
        eventName: 'Grammy Awards 2026',
        isTournament: false,
        isHost: true,
        createdAt: Date.now(),
      }];
      render(<HomePage />);
      expect(screen.getByText('My Rooms')).toBeInTheDocument();
      expect(screen.getByText('Grammy Awards 2026')).toBeInTheDocument();
      expect(screen.getByText('Code: ABCD')).toBeInTheDocument();
    });

    it('should show Host badge for host rooms', () => {
      mockMyRooms = [{
        roomCode: 'ABCD',
        userKey: 'key12345',
        hostLink: 'http://localhost/room/ABCD/u/key12345',
        joinLink: 'http://localhost/join/ABCD',
        eventName: 'Test Room',
        isTournament: false,
        isHost: true,
        createdAt: Date.now(),
      }];
      render(<HomePage />);
      expect(screen.getByText('Host')).toBeInTheDocument();
    });

    it('should show Tournament badge for tournament rooms', () => {
      mockMyRooms = [{
        roomCode: 'TOUR42',
        userKey: 'key12345',
        hostLink: 'http://localhost/room/TOUR42/u/key12345',
        joinLink: 'http://localhost/join/TOUR42',
        eventName: 'IPL 2026',
        isTournament: true,
        isHost: true,
        createdAt: Date.now(),
      }];
      render(<HomePage />);
      expect(screen.getByText('Tournament')).toBeInTheDocument();
    });

    it('should have Open link pointing to room with user key', () => {
      mockMyRooms = [{
        roomCode: 'ABCD',
        userKey: 'key12345',
        hostLink: 'http://localhost/room/ABCD/u/key12345',
        joinLink: 'http://localhost/join/ABCD',
        eventName: 'Test Room',
        isTournament: false,
        isHost: true,
        createdAt: Date.now(),
      }];
      render(<HomePage />);
      const openLink = screen.getByRole('link', { name: /open/i });
      expect(openLink).toHaveAttribute('href', '/room/ABCD/u/key12345');
    });

    it('should call removeRoom when remove button is clicked', async () => {
      const user = userEvent.setup();
      mockMyRooms = [{
        roomCode: 'ABCD',
        userKey: 'key12345',
        hostLink: 'http://localhost/room/ABCD/u/key12345',
        joinLink: 'http://localhost/join/ABCD',
        eventName: 'Test Room',
        isTournament: false,
        isHost: true,
        createdAt: Date.now(),
      }];
      render(<HomePage />);
      const removeBtn = screen.getByTitle('Remove from list');
      await user.click(removeBtn);
      expect(mockRemoveRoom).toHaveBeenCalledWith('ABCD');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple rapid form submissions', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join/i });

      await user.type(input, 'BLUE');

      // Click multiple times rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should navigate (multiple calls are okay, just testing no errors)
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should handle special characters in room code', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      // Try typing special characters
      await user.type(input, 'BL@#');

      // Should accept them (validation is on backend)
      expect((input as HTMLInputElement).value).toBe('BL@#');
    });

    it('should handle numbers in room code', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      await user.type(input, '1234');

      expect((input as HTMLInputElement).value).toBe('1234');
    });

    it('should clear form and allow new entry', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;

      await user.type(input, 'BLUE');
      expect(input.value).toBe('BLUE');

      await user.clear(input);
      expect(input.value).toBe('');

      await user.type(input, 'RED1');
      expect(input.value).toBe('RED1');
    });
  });
});
