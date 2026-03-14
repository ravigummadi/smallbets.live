/**
 * Unit tests for LiveFeedPanel component
 *
 * Tests transcript submission, automation toggle, history display,
 * and result feedback rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import LiveFeedPanel from './LiveFeedPanel';

expect.extend({ toHaveNoViolations });

const defaultProps = {
  roomCode: 'ABC123',
  hostId: 'host-123',
  automationEnabled: false,
  onToggleAutomation: vi.fn(),
};

// Helper to mock fetch responses
function mockFetch(responses: Array<{ ok: boolean; json?: () => Promise<unknown>; status?: number }>) {
  let callIndex = 0;
  return vi.fn(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: response.ok,
      json: response.json || (() => Promise.resolve({})),
      status: response.status || (response.ok ? 200 : 500),
    });
  });
}

describe('LiveFeedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty history fetch
    global.fetch = mockFetch([
      { ok: true, json: () => Promise.resolve({ entries: [] }) },
    ]);
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<LiveFeedPanel {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('should render transcript textarea and submit button', () => {
      render(<LiveFeedPanel {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('should render automation toggle showing OFF when disabled', () => {
      render(<LiveFeedPanel {...defaultProps} automationEnabled={false} />);
      expect(screen.getByRole('button', { name: /auto: off/i })).toBeInTheDocument();
    });

    it('should render automation toggle showing ON when enabled', () => {
      render(<LiveFeedPanel {...defaultProps} automationEnabled={true} />);
      expect(screen.getByRole('button', { name: /auto: on/i })).toBeInTheDocument();
    });

    it('should disable submit button when textarea is empty', () => {
      render(<LiveFeedPanel {...defaultProps} />);
      expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });

    it('should show instructions text', () => {
      render(<LiveFeedPanel {...defaultProps} />);
      expect(screen.getByText(/type key moments/i)).toBeInTheDocument();
    });
  });

  describe('Transcript Submission', () => {
    it('should show error when submitting empty text', async () => {
      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      // Type spaces only
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');
      await user.clear(textarea);

      // Submit button should be disabled when trimmed text is empty
      expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });

    it('should submit transcript text via POST', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) }, // history fetch
        { ok: true, json: () => Promise.resolve({ automation: { action_taken: 'ignored', confidence: 0 } }) }, // submit
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'And the winner is Beyonce!');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/rooms/ABC123/transcript',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ text: 'And the winner is Beyonce!', source: 'manual' }),
          })
        );
      });
    });

    it('should clear textarea after successful submission', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        { ok: true, json: () => Promise.resolve({ automation: { action_taken: 'ignored', confidence: 0 } }) },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'Test text');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('');
      });
    });

    it('should show Submitting... during submission', async () => {
      let resolveSubmit: (value: unknown) => void;
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ entries: [] }) })
        .mockReturnValueOnce(new Promise((resolve) => {
          resolveSubmit = resolve;
        }));

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'Test');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      expect(screen.getByRole('button', { name: /submitting/i })).toBeInTheDocument();

      resolveSubmit!({ ok: true, json: () => Promise.resolve({ automation: { action_taken: 'ignored', confidence: 0 } }) });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /submitting/i })).not.toBeInTheDocument();
      });
    });

    it('should show error message on submission failure', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        { ok: false, status: 500 },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'Test text');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to submit transcript/i)).toBeInTheDocument();
      });
    });
  });

  describe('Automation Result Display', () => {
    it('should display action result after successful submission', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        {
          ok: true,
          json: () => Promise.resolve({
            automation: {
              action_taken: 'open_bet',
              confidence: 0.85,
              details: { reason: 'Matched keyword' },
            },
          }),
        },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'Winner announced');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('open_bet')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        expect(screen.getByText('Matched keyword')).toBeInTheDocument();
      });
    });

    it('should display winner when resolve_bet action includes winner details', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        {
          ok: true,
          json: () => Promise.resolve({
            automation: {
              action_taken: 'resolve_bet',
              confidence: 0.9,
              details: { winner: 'Beyoncé' },
            },
          }),
        },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'Grammy goes to Beyonce');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Beyoncé')).toBeInTheDocument();
      });
    });
  });

  describe('Automation Toggle', () => {
    it('should call onToggleAutomation when toggle is clicked', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        { ok: true, json: () => Promise.resolve({}) }, // toggle response
      ]);

      const onToggle = vi.fn();
      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} onToggleAutomation={onToggle} />);

      await user.click(screen.getByRole('button', { name: /auto: off/i }));

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(true);
      });
    });

    it('should send POST with correct host header', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        { ok: true, json: () => Promise.resolve({}) },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /auto: off/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/rooms/ABC123/automation/toggle',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'X-Host-Id': 'host-123' }),
            body: JSON.stringify({ enabled: true }),
          })
        );
      });
    });

    it('should show error when toggle fails', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ entries: [] }) })
        .mockRejectedValueOnce(new Error('Network error'));

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /auto: off/i }));

      await waitFor(() => {
        expect(screen.getByText('Failed to toggle automation')).toBeInTheDocument();
      });
    });
  });

  describe('History', () => {
    it('should fetch and display transcript history on mount', async () => {
      global.fetch = mockFetch([
        {
          ok: true,
          json: () => Promise.resolve({
            entries: [
              { text: 'First moment', source: 'manual', timestamp: new Date().toISOString() },
              { text: 'Second moment', source: 'webhook', timestamp: new Date().toISOString() },
            ],
          }),
        },
      ]);

      render(<LiveFeedPanel {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First moment')).toBeInTheDocument();
        expect(screen.getByText('Second moment')).toBeInTheDocument();
        expect(screen.getByText('History (2)')).toBeInTheDocument();
      });
    });

    it('should not show history section when no entries exist', () => {
      render(<LiveFeedPanel {...defaultProps} />);
      expect(screen.queryByText(/history/i)).not.toBeInTheDocument();
    });

    it('should optimistically prepend new entry to history after submission', async () => {
      global.fetch = mockFetch([
        { ok: true, json: () => Promise.resolve({ entries: [] }) },
        { ok: true, json: () => Promise.resolve({ automation: { action_taken: 'ignored', confidence: 0 } }) },
      ]);

      const user = userEvent.setup();
      render(<LiveFeedPanel {...defaultProps} />);

      await user.type(screen.getByRole('textbox'), 'New moment');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('New moment')).toBeInTheDocument();
        expect(screen.getByText('History (1)')).toBeInTheDocument();
      });
    });
  });
});
