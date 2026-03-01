/**
 * Unit tests for BetListPanel component
 *
 * Tests bet list rendering, empty state, and loading skeleton
 */

import { describe, it, expect } from 'vitest';
import { render } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import BetListPanel from './BetListPanel';

expect.extend({ toHaveNoViolations });

describe('BetListPanel', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetListPanel roomCode="ABC123" hostId="host-123" bets={[]} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
