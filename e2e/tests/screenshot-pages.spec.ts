/**
 * Screenshot capture for UI variations
 * Takes screenshots of key pages for visual comparison
 */
import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || '/home/user/smallbets.live/ui-analysis/screenshots';

test.describe('UI Screenshots', () => {
  test('capture home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('SmallBets.live');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/home-page.png`,
      fullPage: true,
    });
  });

  test('capture create room page', async ({ page }) => {
    await page.goto('/create');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2')).toContainText('Create a Room');
    // Fill in some sample data to show the form populated
    await page.fill('input[placeholder="Enter your nickname"]', 'TestPlayer');
    await page.selectOption('select', 'custom');
    await page.fill('input[placeholder="Enter your event name"]', 'Oscar Watch Party 2026');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/create-room.png`,
      fullPage: true,
    });
  });

  test('capture join room page', async ({ page }) => {
    await page.goto('/join/ABCD');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2')).toContainText('Join a Room');
    await page.fill('input[placeholder="Enter your nickname"]', 'GuestUser');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/join-room.png`,
      fullPage: true,
    });
  });
});
