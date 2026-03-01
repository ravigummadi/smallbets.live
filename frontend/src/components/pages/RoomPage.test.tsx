/**
 * Unit tests for RoomPage component
 *
 * Tests room state rendering, real-time updates, and disconnection handling
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

expect.extend({ toHaveNoViolations });

// Mock react-router-dom hooks (keep the rest from test-utils provider)
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useParams: () => ({ code: 'ABC123' }),
    useNavigate: () => vi.fn(),
  };
});

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
      status: 'waiting',
      hostId: 'host-123',
      eventTemplate: 'custom',
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
      isAdmin: false,
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useBets', () => ({
  useBets: () => ({
    bets: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useUserBets', () => ({
  useUserBets: () => ({
    userBets: [],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useParticipants', () => ({
  useParticipants: () => ({
    participants: [
      { userId: 'user-123', nickname: 'TestUser', points: 1000, isAdmin: false },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('@/services/api', () => ({
  betApi: {
    placeBet: vi.fn(),
  },
}));

vi.mock('@/components/admin/AdminPanel', () => ({
  default: () => <div data-testid="admin-panel">Admin Panel</div>,
}));

// Lazy-import RoomPage AFTER mocks are set up
const { default: RoomPage } = await import('./RoomPage');

describe('RoomPage', () => {
  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<RoomPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
