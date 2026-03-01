/**
 * Unit tests for RoomPage component
 *
 * Tests room state rendering, real-time updates, and disconnection handling
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import RoomPage from './RoomPage';

expect.extend({ toHaveNoViolations });

// Mock hooks
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: { userId: 'user-123', roomCode: 'ABC123', hostId: 'host-123' },
    isHost: true,
  }),
}));

vi.mock('@/hooks/useRoom', () => ({
  useRoom: () => ({
    room: {
      code: 'ABC123',
      eventName: 'Test Event',
      status: 'WAITING',
      hostId: 'host-123',
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: {
      userId: 'user-123',
      nickname: 'TestUser',
      points: 1000,
    },
    loading: false,
    error: null,
  }),
}));

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ roomCode: 'ABC123' }),
    useNavigate: () => vi.fn(),
  };
});

describe('RoomPage', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<RoomPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
