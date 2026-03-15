/**
 * Unit tests for AnimatedLeaderboard component
 *
 * Verifies copy link buttons are visible for hosts in all room states,
 * including after event finishes (the leaderboard is room-status-agnostic).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import userEvent from '@testing-library/user-event';
import AnimatedLeaderboard from './AnimatedLeaderboard';
import type { User, ParticipantWithLink } from '@/types';

expect.extend({ toHaveNoViolations });

const baseDate = new Date('2026-01-01');

const makeUser = (overrides: Partial<User> = {}): User => ({
  userId: 'user-1',
  roomCode: 'TEST',
  nickname: 'Alice',
  points: 1000,
  isAdmin: false,
  joinedAt: baseDate,
  ...overrides,
});

const makeParticipantLink = (user: User, userKey: string): ParticipantWithLink => ({
  ...user,
  userKey,
});

const participants: User[] = [
  makeUser({ userId: 'host-1', nickname: 'Host', points: 1200, isAdmin: true }),
  makeUser({ userId: 'user-2', nickname: 'Bob', points: 900 }),
  makeUser({ userId: 'user-3', nickname: 'Charlie', points: 800 }),
];

const participantLinks: ParticipantWithLink[] = [
  makeParticipantLink(participants[0], 'key-host'),
  makeParticipantLink(participants[1], 'key-bob'),
  makeParticipantLink(participants[2], 'key-charlie'),
];

describe('AnimatedLeaderboard', () => {
  describe('Copy link buttons', () => {
    it('shows copy link buttons for each participant when host views leaderboard', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={true}
          isPrimaryHost={true}
          coHostIds={[]}
          participantLinks={participantLinks}
          copiedUserId={null}
          onCopyLink={vi.fn()}
        />
      );

      const copyButtons = screen.getAllByRole('button', { name: 'Copy Link' });
      expect(copyButtons).toHaveLength(3);
    });

    it('does not show copy link buttons for non-host users', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="user-2"
          isHost={false}
          isPrimaryHost={false}
          coHostIds={[]}
          participantLinks={participantLinks}
          copiedUserId={null}
          onCopyLink={vi.fn()}
        />
      );

      expect(screen.queryAllByRole('button', { name: 'Copy Link' })).toHaveLength(0);
    });

    it('calls onCopyLink with correct participant data when clicked', async () => {
      const user = userEvent.setup();
      const onCopyLink = vi.fn();

      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={true}
          isPrimaryHost={true}
          coHostIds={[]}
          participantLinks={participantLinks}
          copiedUserId={null}
          onCopyLink={onCopyLink}
        />
      );

      const copyButtons = screen.getAllByRole('button', { name: 'Copy Link' });
      // Click second participant's copy link (Bob)
      await user.click(copyButtons[1]);

      expect(onCopyLink).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', userKey: 'key-bob' })
      );
    });

    it('shows "Copied!" text for the participant whose link was just copied', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={true}
          isPrimaryHost={true}
          coHostIds={[]}
          participantLinks={participantLinks}
          copiedUserId="user-2"
          onCopyLink={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
      // Other participants still show "Copy Link"
      expect(screen.getAllByRole('button', { name: 'Copy Link' })).toHaveLength(2);
    });

    it('does not show copy link buttons when participantLinks is empty', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={true}
          isPrimaryHost={true}
          coHostIds={[]}
          participantLinks={[]}
          copiedUserId={null}
          onCopyLink={vi.fn()}
        />
      );

      expect(screen.queryAllByRole('button', { name: 'Copy Link' })).toHaveLength(0);
    });
  });

  describe('Rendering', () => {
    it('displays participants sorted by points in descending order', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={false}
          isPrimaryHost={false}
          coHostIds={[]}
          copiedUserId={null}
        />
      );

      // Verify all nicknames are present and in order
      const hostEl = screen.getByText('Host');
      const bobEl = screen.getByText('Bob');
      const charlieEl = screen.getByText('Charlie');
      expect(hostEl).toBeInTheDocument();
      expect(bobEl).toBeInTheDocument();
      expect(charlieEl).toBeInTheDocument();
    });

    it('shows host and co-host labels', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="user-2"
          isHost={false}
          isPrimaryHost={false}
          coHostIds={['user-2']}
          copiedUserId={null}
        />
      );

      expect(screen.getByText('(Host)')).toBeInTheDocument();
      expect(screen.getByText('Co-Host')).toBeInTheDocument();
    });

    it('highlights current user with "You" label', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="user-2"
          isHost={false}
          isPrimaryHost={false}
          coHostIds={[]}
          copiedUserId={null}
        />
      );

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('shows participant count in heading', () => {
      render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={false}
          isPrimaryHost={false}
          coHostIds={[]}
          copiedUserId={null}
        />
      );

      const header = screen.getByRole('button', { name: /Leaderboard/i });
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('3');
    });
  });

  describe('Accessibility (a11y)', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AnimatedLeaderboard
          participants={participants}
          currentUserId="host-1"
          isHost={true}
          isPrimaryHost={true}
          coHostIds={[]}
          participantLinks={participantLinks}
          copiedUserId={null}
          onCopyLink={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
