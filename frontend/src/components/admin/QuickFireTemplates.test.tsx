/**
 * Unit tests for QuickFireTemplates component
 *
 * Tests template rendering and selection callback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import QuickFireTemplates from './QuickFireTemplates';
import { cricketQuickFireTemplates } from '@/data/cricketQuickFireTemplates';

expect.extend({ toHaveNoViolations });

describe('QuickFireTemplates', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<QuickFireTemplates onSelect={vi.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('should render Quick-Fire Bets heading', () => {
      render(<QuickFireTemplates onSelect={vi.fn()} />);
      expect(screen.getByText('Quick-Fire Bets')).toBeInTheDocument();
    });

    it('should render a button for each cricket template', () => {
      render(<QuickFireTemplates onSelect={vi.fn()} />);
      for (const template of cricketQuickFireTemplates) {
        expect(screen.getByRole('button', { name: template.label })).toBeInTheDocument();
      }
    });

    it('should render all 10 template buttons', () => {
      render(<QuickFireTemplates onSelect={vi.fn()} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(cricketQuickFireTemplates.length);
    });
  });

  describe('Selection', () => {
    it('should call onSelect with the correct template when a button is clicked', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<QuickFireTemplates onSelect={onSelect} />);

      await user.click(screen.getByRole('button', { name: 'Toss Winner' }));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'toss-winner',
          label: 'Toss Winner',
          question: 'Who will win the toss?',
          options: ['Team A', 'Team B'],
        })
      );
    });

    it('should call onSelect with different templates for different clicks', async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<QuickFireTemplates onSelect={onSelect} />);

      await user.click(screen.getByRole('button', { name: 'Next Ball' }));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'next-ball-outcome',
          question: 'Next ball outcome?',
        })
      );
    });
  });
});
