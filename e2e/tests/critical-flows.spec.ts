/**
 * Critical E2E Smoke Tests for SmallBets.live
 *
 * Phase 3 - Integration/E2E Tests
 * Focus on highest-value user journeys using Playwright multi-context.
 *
 * Prerequisites:
 * - Firebase Emulator Suite running (port 8080)
 * - Backend API running (port 8000)
 * - Frontend dev server running (port 5173)
 *
 * Test Flows:
 * 1. Complete Betting Flow (most critical)
 * 2. Real-time Sync Test (multi-context)
 * 3. Error Recovery Test (network disconnect/reconnect)
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000';

/**
 * Create a room via the UI and return the room code + host context info.
 * Navigates the given page through the Create Room flow.
 */
async function createRoomViaUI(
  page: Page,
  nickname: string,
): Promise<string> {
  // Navigate to home
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('SmallBets.live');

  // Click "Create New Room"
  await page.click('a:has-text("Create New Room")');
  await expect(page.locator('h2')).toContainText('Create a Room');

  // Fill in nickname
  await page.fill('input[placeholder="Enter your nickname"]', nickname);

  // Select "Custom Event" template
  await page.selectOption('select', 'custom');

  // Fill in custom event name
  await page.fill('input[placeholder="Enter your event name"]', 'E2E Test Event');

  // Click "Create Room"
  await page.click('button:has-text("Create Room")');

  // Wait for navigation to room page
  await page.waitForURL(/\/room\/[A-Z0-9]{4}$/);

  // Extract room code from URL
  const url = page.url();
  const roomCode = url.match(/\/room\/([A-Z0-9]{4})$/)?.[1];
  if (!roomCode) throw new Error(`Could not extract room code from URL: ${url}`);

  return roomCode;
}

/**
 * Join an existing room via the UI.
 */
async function joinRoomViaUI(
  page: Page,
  roomCode: string,
  nickname: string,
): Promise<void> {
  // Navigate to join page with room code
  await page.goto(`/join/${roomCode}`);
  await expect(page.locator('h2')).toContainText('Join a Room');

  // Room code should be pre-filled
  const codeInput = page.locator('input[placeholder="Enter 4-character code"]');
  await expect(codeInput).toHaveValue(roomCode);

  // Fill in nickname
  await page.fill('input[placeholder="Enter your nickname"]', nickname);

  // Click "Join Room"
  await page.click('button:has-text("Join Room")');

  // Wait for navigation to room page
  await page.waitForURL(`/room/${roomCode}`);
}

/**
 * Open the admin panel (host only).
 */
async function openAdminPanel(page: Page): Promise<void> {
  const adminButton = page.locator('button:has-text("Show Admin Panel")');
  await expect(adminButton).toBeVisible();
  await adminButton.click();
  await expect(page.locator('h4:has-text("Room Controls")')).toBeVisible();
}

/**
 * Start the event via admin panel (host only).
 */
async function startEvent(page: Page): Promise<void> {
  const startButton = page.locator('button:has-text("Start Event")');
  await expect(startButton).toBeVisible();
  await startButton.click();

  // Verify the room is now active - Finish Event button appears
  await expect(page.locator('button:has-text("Finish Event")')).toBeVisible();
}

/**
 * Create a bet via the admin panel bet creation form.
 */
async function createBetViaAdmin(
  page: Page,
  question: string,
  options: string[],
): Promise<void> {
  // Show the bet creation form
  const showFormButton = page.locator('button:has-text("Show Form")');
  await expect(showFormButton).toBeVisible();
  await showFormButton.click();

  // Fill in question
  await page.fill('#question', question);

  // Fill in options (form starts with 2 empty option inputs)
  const optionInputs = page.locator('input[placeholder^="Option"]');

  // Fill first 2 options
  await optionInputs.nth(0).fill(options[0]);
  await optionInputs.nth(1).fill(options[1]);

  // Add and fill additional options if needed
  for (let i = 2; i < options.length; i++) {
    await page.click('button:has-text("+ Add Option")');
    await optionInputs.nth(i).fill(options[i]);
  }

  // Submit the bet
  await page.click('button:has-text("Create Bet")');

  // Wait for success indicator
  await expect(page.locator('text=Bet created successfully')).toBeVisible({ timeout: 10_000 });
}

/**
 * Open a bet via the admin panel's Bet Management section.
 * Clicks the "Open Bet" button for the first pending bet.
 */
async function openBetViaAdmin(page: Page): Promise<void> {
  const openButton = page.locator('button:has-text("Open Bet")').first();
  await expect(openButton).toBeVisible();
  await openButton.click();

  // Verify the bet status changed - the "Open Bet" button should disappear for that bet
  // and "Close Bet" should appear
  await expect(page.locator('button:has-text("Close Bet")').first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Lock (close) a bet via the admin panel.
 */
async function lockBetViaAdmin(page: Page): Promise<void> {
  const closeButton = page.locator('button:has-text("Close Bet")').first();
  await expect(closeButton).toBeVisible();
  await closeButton.click();

  // Verify the bet is now locked - "Resolve Bet" button should appear
  await expect(page.locator('button:has-text("Resolve Bet")').first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Resolve a bet via the admin panel by selecting the winning option.
 */
async function resolveBetViaAdmin(page: Page, winningOption: string): Promise<void> {
  // Click "Resolve Bet"
  const resolveButton = page.locator('button:has-text("Resolve Bet")').first();
  await expect(resolveButton).toBeVisible();
  await resolveButton.click();

  // Wait for "Select winning option:" prompt
  await expect(page.locator('text=Select winning option:')).toBeVisible();

  // Click the winning option button
  await page.locator(`button:has-text("${winningOption}")`).click();

  // Verify resolution - look for the winner display
  await expect(page.locator(`text=Winner: ${winningOption}`)).toBeVisible({ timeout: 10_000 });
}

/**
 * Place a bet on an open bet by clicking on the bet question to expand it,
 * then clicking the option button.
 */
async function placeBet(page: Page, question: string, option: string): Promise<void> {
  // Find and click the bet to expand it
  const betHeader = page.locator(`text=${question}`).first();
  await expect(betHeader).toBeVisible({ timeout: 10_000 });
  await betHeader.click();

  // Click the option button to place the bet
  // The option buttons are inside the expanded bet content area
  const optionButton = page.locator(`button:has-text("${option}")`).first();
  await expect(optionButton).toBeVisible();
  await optionButton.click();

  // Verify bet was placed - "Your bet:" confirmation appears
  await expect(page.locator(`text=Your bet: ${option}`)).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test 1: Complete Betting Flow
// ---------------------------------------------------------------------------

test.describe('Complete Betting Flow', () => {
  const BET_QUESTION = 'Who will win the test award?';
  const BET_OPTIONS = ['Option Alpha', 'Option Beta', 'Option Gamma'];
  const WINNING_OPTION = 'Option Alpha';

  test('host creates room, guest joins, full bet lifecycle, leaderboard updates', async ({ browser }) => {
    // Create two isolated browser contexts (host and guest)
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // Step 1: Host creates a room
      const roomCode = await createRoomViaUI(hostPage, 'HostPlayer');

      // Verify host is in the room and sees "Waiting to start"
      await expect(hostPage.locator('text=Waiting to start')).toBeVisible();
      await expect(hostPage.locator('text=HostPlayer')).toBeVisible();
      await expect(hostPage.locator('text=1000')).toBeVisible();

      // Step 2: Guest joins the room
      await joinRoomViaUI(guestPage, roomCode, 'GuestPlayer');

      // Verify guest sees the room
      await expect(guestPage.locator('text=Waiting to start')).toBeVisible();
      await expect(guestPage.locator('text=GuestPlayer')).toBeVisible();

      // Verify host sees guest in participant list
      await expect(hostPage.locator('text=GuestPlayer')).toBeVisible({ timeout: 10_000 });

      // Step 3: Host opens admin panel and starts the event
      await openAdminPanel(hostPage);
      await startEvent(hostPage);

      // Step 4: Host creates a bet
      await createBetViaAdmin(hostPage, BET_QUESTION, BET_OPTIONS);

      // Step 5: Host opens the bet
      await openBetViaAdmin(hostPage);

      // Step 6: Guest sees the open bet and places a bet
      await expect(guestPage.locator(`text=${BET_QUESTION}`)).toBeVisible({ timeout: 10_000 });
      await placeBet(guestPage, BET_QUESTION, 'Option Beta');

      // Step 7: Host places a bet too
      // Host needs to scroll down past admin panel or look in the main content area
      await placeBet(hostPage, BET_QUESTION, WINNING_OPTION);

      // Step 8: Host locks the bet
      await lockBetViaAdmin(hostPage);

      // Step 9: Host resolves the bet
      await resolveBetViaAdmin(hostPage, WINNING_OPTION);

      // Step 10: Verify leaderboard updates
      // Host picked the winning option, so host should have gained points
      // Guest picked a losing option, so guest should have lost points
      // Host: 1000 - 100 (bet cost) + winnings = more than 1000
      // Guest: 1000 - 100 (bet cost) = 900

      // Wait for Firestore real-time updates to propagate
      // Host should have more than initial 1000 points (won the bet)
      await expect(async () => {
        const hostPointsText = await hostPage.locator('text=points').locator('..').locator('p').first().textContent();
        const hostPoints = parseInt(hostPointsText || '0');
        expect(hostPoints).toBeGreaterThan(1000);
      }).toPass({ timeout: 15_000 });

      // Guest should have 900 points (lost 100 from the bet)
      await expect(async () => {
        const guestParticipants = guestPage.locator('text=GuestPlayer').locator('..');
        const guestPointsEl = guestParticipants.locator('span').last();
        const guestPoints = parseInt(await guestPointsEl.textContent() || '0');
        expect(guestPoints).toBe(900);
      }).toPass({ timeout: 15_000 });

    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: Real-time Sync Test
// ---------------------------------------------------------------------------

test.describe('Real-time Sync', () => {
  const BET_QUESTION = 'Who wins the real-time test?';
  const BET_OPTIONS = ['Sync Alpha', 'Sync Beta'];

  test('two browser contexts see identical state updates in real-time', async ({ browser }) => {
    // Create two isolated browser contexts
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // Setup: Host creates room, guest joins
      const roomCode = await createRoomViaUI(hostPage, 'SyncHost');
      await joinRoomViaUI(guestPage, roomCode, 'SyncGuest');

      // Both see "Waiting to start"
      await expect(hostPage.locator('text=Waiting to start')).toBeVisible();
      await expect(guestPage.locator('text=Waiting to start')).toBeVisible();

      // Verify both see 2 participants
      await expect(hostPage.locator('text=2 participants')).toBeVisible({ timeout: 10_000 });
      await expect(guestPage.locator('text=2 participants')).toBeVisible({ timeout: 10_000 });

      // Host starts event
      await openAdminPanel(hostPage);
      await startEvent(hostPage);

      // SYNC CHECK 1: Guest should see room status change to active
      // Guest should see "Event in progress" or active status indicators
      // When active with no open bets, guest sees "No open bets"
      await expect(guestPage.locator('text=No open bets')).toBeVisible({ timeout: 10_000 });

      // Host creates and opens a bet
      await createBetViaAdmin(hostPage, BET_QUESTION, BET_OPTIONS);
      await openBetViaAdmin(hostPage);

      // SYNC CHECK 2: Guest sees the bet open in real-time
      await expect(guestPage.locator(`text=${BET_QUESTION}`)).toBeVisible({ timeout: 10_000 });

      // Guest places a bet
      await placeBet(guestPage, BET_QUESTION, 'Sync Beta');

      // Host locks the bet
      await lockBetViaAdmin(hostPage);

      // SYNC CHECK 3: Guest should no longer see the bet as open
      // When bet is locked, it disappears from "Open Bets" section
      await expect(guestPage.locator('text=No open bets')).toBeVisible({ timeout: 10_000 });

      // Host resolves the bet
      await resolveBetViaAdmin(hostPage, 'Sync Beta');

      // SYNC CHECK 4: Both see leaderboard update
      // Guest won - should have more than 1000 points
      await expect(async () => {
        const guestParticipants = guestPage.locator('text=SyncGuest').locator('..');
        const guestPointsEl = guestParticipants.locator('span').last();
        const guestPoints = parseInt(await guestPointsEl.textContent() || '0');
        expect(guestPoints).toBeGreaterThan(1000);
      }).toPass({ timeout: 15_000 });

      // Host see the same leaderboard - guest has more points
      await expect(async () => {
        const hostSeesGuest = hostPage.locator('text=SyncGuest').locator('..');
        const guestPointsOnHost = hostSeesGuest.locator('span').last();
        const points = parseInt(await guestPointsOnHost.textContent() || '0');
        expect(points).toBeGreaterThan(1000);
      }).toPass({ timeout: 15_000 });

    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Error Recovery Test
// ---------------------------------------------------------------------------

test.describe('Error Recovery', () => {
  test('join room succeeds after network disconnect and reconnect', async ({ browser }) => {
    // Create host context and set up a room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      // Host creates a room first
      const roomCode = await createRoomViaUI(hostPage, 'RecoveryHost');

      // Guest navigates to join page
      await guestPage.goto(`/join/${roomCode}`);
      await expect(guestPage.locator('h2')).toContainText('Join a Room');

      // Fill in nickname
      await guestPage.fill('input[placeholder="Enter your nickname"]', 'RecoveryGuest');

      // Simulate network disconnect by blocking API requests
      await guestPage.route(`${API_URL}/**`, (route) => route.abort('connectionfailed'));
      // Also block relative API paths (proxied through vite)
      await guestPage.route('**/api/**', (route) => route.abort('connectionfailed'));

      // Try to join - should fail
      await guestPage.click('button:has-text("Join Room")');

      // Should see an error message
      await expect(guestPage.locator('.text-error')).toBeVisible({ timeout: 10_000 });

      // Simulate network reconnect by removing the route intercepts
      await guestPage.unrouteAll();

      // Clear the error state - re-fill nickname if needed and retry
      // The form should still have the data, just click join again
      await guestPage.click('button:has-text("Join Room")');

      // Should successfully navigate to the room
      await guestPage.waitForURL(`/room/${roomCode}`, { timeout: 15_000 });

      // Verify guest is in the room
      await expect(guestPage.locator('text=RecoveryGuest')).toBeVisible({ timeout: 10_000 });

      // Verify host sees the guest joined
      await expect(hostPage.locator('text=RecoveryGuest')).toBeVisible({ timeout: 10_000 });

    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
