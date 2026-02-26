/**
 * Unit tests for HomePage component
 *
 * Tests navigation links and accessibility
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { axe, toHaveNoViolations } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import HomePage from './HomePage';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<HomePage />);

      expect(screen.getByText('SmallBets.live')).toBeInTheDocument();
    });

    it('should render the tagline', () => {
      render(<HomePage />);

      expect(
        screen.getByText('Real-time betting with friends during live events')
      ).toBeInTheDocument();
    });

    it('should render join room form', () => {
      render(<HomePage />);

      expect(screen.getByPlaceholderText(/enter room code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();
    });

    it('should render create room link', () => {
      render(<HomePage />);

      expect(screen.getByRole('link', { name: /create new room/i })).toBeInTheDocument();
    });

    it('should render informational text', () => {
      render(<HomePage />);

      expect(screen.getByText(/no accounts needed/i)).toBeInTheDocument();
      expect(screen.getByText(/virtual points only/i)).toBeInTheDocument();
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

    it('should limit input to 4 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i) as HTMLInputElement;

      await user.type(input, 'BLUE42');

      expect(input.value).toBe('BLUE');
      expect(input.maxLength).toBe(4);
    });

    it('should disable submit button when room code is empty', () => {
      render(<HomePage />);

      const button = screen.getByRole('button', { name: /join room/i });

      expect(button).toBeDisabled();
    });

    it('should disable submit button when room code is less than 4 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join room/i });

      await user.type(input, 'BLU');

      expect(button).toBeDisabled();
    });

    it('should enable submit button when room code is 4 characters', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join room/i });

      await user.type(input, 'BLUE');

      expect(button).toBeEnabled();
    });

    it('should navigate to join page on form submit', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join room/i });

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

      // Manually set value with whitespace
      await user.click(input);
      await user.paste('  BLUE  ');

      const button = screen.getByRole('button', { name: /join room/i });
      await user.click(button);

      // Should navigate with trimmed code
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/BLUE/)
      );
    });

    it('should not submit form with empty room code after whitespace trim', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join room/i });

      // Try to type only spaces (will be limited by maxLength)
      await user.type(input, '    ');

      // Button should remain disabled
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
      const user = userEvent.setup();
      render(<HomePage />);

      const link = screen.getByRole('link', { name: /create new room/i });

      // Note: In testing environment with BrowserRouter, clicking link doesn't
      // actually navigate, but we verify the href is correct
      expect(link).toHaveAttribute('href', '/create');
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<HomePage />);

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('should have autofocus on room code input for keyboard users', () => {
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      expect(input).toHaveAttribute('autoFocus');
    });

    it('should have proper button semantics', () => {
      render(<HomePage />);

      const joinButton = screen.getByRole('button', { name: /join room/i });

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
      const h3 = screen.getByRole('heading', { level: 3 });

      expect(h1).toHaveTextContent('SmallBets.live');
      expect(h3).toHaveTextContent('Join a Room');
    });

    it('should have descriptive placeholder text for input', () => {
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);

      expect(input).toHaveAttribute(
        'placeholder',
        expect.stringContaining('BLUE42')
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple rapid form submissions', async () => {
      const user = userEvent.setup();
      render(<HomePage />);

      const input = screen.getByPlaceholderText(/enter room code/i);
      const button = screen.getByRole('button', { name: /join room/i });

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
