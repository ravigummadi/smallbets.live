import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SmallBets.live E2E tests
 *
 * Prerequisites:
 * 1. Firebase Emulator running on port 8080
 * 2. Backend API running on port 8000
 * 3. Frontend dev server running on port 5173
 *
 * Quick start:
 *   firebase emulators:start --project demo-test &
 *   cd backend && uvicorn main:app --port 8000 &
 *   cd frontend && npm run dev &
 *   cd e2e && npx playwright test
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Tests share emulator state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Sequential execution for shared Firebase emulator
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  /* Default timeout for each test */
  timeout: 60_000,

  /* Expect timeout */
  expect: {
    timeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
