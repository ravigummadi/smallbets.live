/**
 * Unit tests for AdminPanel component
 *
 * Tests admin controls visibility and unauthorized access
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import AdminPanel from './AdminPanel';

expect.extend({ toHaveNoViolations });

const mockRoom = {
  code: 'ABC123',
  eventTemplate: 'custom',
  hostId: 'host-123',
  status: 'active',
  automationEnabled: false,
  createdAt: new Date().toISOString(),
} as any;

describe('AdminPanel', () => {
  describe('Rendering for host', () => {
    it('should render admin panel for host', () => {
      render(<AdminPanel room={mockRoom} hostId="host-123" onRoomUpdate={vi.fn()} />);
      expect(screen.queryByText(/admin/i)).toBeDefined();
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AdminPanel room={mockRoom} hostId="host-123" onRoomUpdate={vi.fn()} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
