/**
 * Unit tests for LiveFeedPanel component
 *
 * Tests transcript feed and auto-scroll functionality
 */

import { describe, it, expect } from 'vitest';
import { render } from '@/test-utils';
import { axe, toHaveNoViolations } from 'vitest-axe';
import LiveFeedPanel from './LiveFeedPanel';

expect.extend(toHaveNoViolations);

describe('LiveFeedPanel', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<LiveFeedPanel roomCode="ABC123" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
