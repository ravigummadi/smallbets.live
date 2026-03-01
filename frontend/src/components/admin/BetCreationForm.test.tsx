/**
 * Unit tests for BetCreationForm component
 *
 * Tests bet creation form validation and submission errors
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import BetCreationForm from './BetCreationForm';

expect.extend({ toHaveNoViolations });

describe('BetCreationForm', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetCreationForm roomCode="ABC123" hostId="host-123" onSuccess={vi.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
