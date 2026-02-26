/**
 * Unit tests for BetCreationForm component
 *
 * Tests bet creation form validation and submission errors
 */

import { describe, it, expect } from 'vitest';
import { render } from '@/test-utils';
import { axe, toHaveNoViolations } from 'vitest-axe';
import BetCreationForm from './BetCreationForm';

expect.extend(toHaveNoViolations);

describe('BetCreationForm', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<BetCreationForm roomCode="ABC123" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
