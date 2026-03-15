/**
 * Unit tests for RoomHeader component
 *
 * Tests room title, status display, points, role badge, and host controls.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import RoomHeader from './RoomHeader';

expect.extend({ toHaveNoViolations });

const mockRoom = {
  code: 'ABC123',
  eventTemplate: 'custom',
  eventName: 'Test Event',
  status: 'active',
  hostId: 'host-123',
  roomType: 'event',
} as any;

const mockUser = {
  userId: 'user-123',
  nickname: 'TestUser',
  points: 1000,
  isAdmin: false,
} as any;

const baseProps = {
  room: mockRoom,
  user: mockUser,
  isHost: false,
  isCoHost: false,
  isTournament: false,
  onFinishRoom: vi.fn(),
};

describe('RoomHeader', () => {
  describe('Rendering', () => {
    it('should display event name and room code', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByText(/Test Event - Room ABC123/)).toBeDefined();
    });

    it('should display user points', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByText('1000')).toBeDefined();
      expect(screen.getByText('points')).toBeDefined();
    });

    it('should display "Guest" badge for non-host', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByText('Guest')).toBeDefined();
    });

    it('should display "Host" badge for host', () => {
      render(<RoomHeader {...baseProps} isHost={true} />);
      expect(screen.getByText('Host')).toBeDefined();
    });

    it('should render compact ShareButton in header', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByLabelText('Share room link')).toBeDefined();
    });

    it('should display room code in title', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByText(/ABC123/)).toBeDefined();
    });
  });

  describe('Status display', () => {
    it('should show "Waiting to start" for waiting rooms', () => {
      const waitingRoom = { ...mockRoom, status: 'waiting' };
      render(<RoomHeader {...baseProps} room={waitingRoom} />);
      expect(screen.getByText('Waiting to start')).toBeDefined();
    });

    it('should show "Event in progress" and LIVE badge for active rooms', () => {
      render(<RoomHeader {...baseProps} />);
      expect(screen.getByText('Event in progress')).toBeDefined();
      expect(screen.getByText('LIVE')).toBeDefined();
    });

    it('should show "Tournament in progress" for active tournaments', () => {
      render(<RoomHeader {...baseProps} isTournament={true} />);
      expect(screen.getByText('Tournament in progress')).toBeDefined();
    });

    it('should show "Event finished" for finished rooms', () => {
      const finishedRoom = { ...mockRoom, status: 'finished' };
      render(<RoomHeader {...baseProps} room={finishedRoom} />);
      expect(screen.getByText('Event finished')).toBeDefined();
    });
  });

  describe('Host controls', () => {
    it('should show Finish button for host on active room', () => {
      render(<RoomHeader {...baseProps} isHost={true} />);
      expect(screen.getByText('Finish Event')).toBeDefined();
    });

    it('should show "Finish Tournament" for tournament host', () => {
      render(<RoomHeader {...baseProps} isHost={true} isTournament={true} />);
      expect(screen.getByText('Finish Tournament')).toBeDefined();
    });

    it('should not show Finish button for non-host', () => {
      render(<RoomHeader {...baseProps} isHost={false} />);
      expect(screen.queryByText('Finish Event')).toBeNull();
    });

    it('should not show Finish button for finished room', () => {
      const finishedRoom = { ...mockRoom, status: 'finished' };
      render(<RoomHeader {...baseProps} room={finishedRoom} isHost={true} />);
      expect(screen.queryByText('Finish Event')).toBeNull();
    });

    it('should call onFinishRoom when Finish button is clicked', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(<RoomHeader {...baseProps} isHost={true} onFinishRoom={onFinish} />);

      await user.click(screen.getByText('Finish Event'));
      expect(onFinish).toHaveBeenCalledOnce();
    });
  });

  describe('Template name mapping', () => {
    it('should map known template IDs to friendly names', () => {
      const iplRoom = { ...mockRoom, eventTemplate: 'ipl-2026', eventName: undefined };
      render(<RoomHeader {...baseProps} room={iplRoom} />);
      expect(screen.getByText(/IPL 2026/)).toBeDefined();
    });

    it('should fall back to "Event" for unknown templates', () => {
      const unknownRoom = { ...mockRoom, eventTemplate: 'unknown', eventName: undefined };
      render(<RoomHeader {...baseProps} room={unknownRoom} />);
      expect(screen.getByText(/Event - Room ABC123/)).toBeDefined();
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<RoomHeader {...baseProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
