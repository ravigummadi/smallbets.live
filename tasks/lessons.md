# Lessons Learned

## 2026-03-15: Always add tests with feature changes

**Pattern**: Shipped a feature (room link sharing + My Rooms) without tests on the first commit. User had to ask "did you add tests sufficiently?" to catch the gap.

**Rule**: Every feature change MUST include tests in the same commit. Before committing, ask: "Did I add/update tests for every new component, hook, and behavioral change?" This is now codified in CLAUDE.md under "Test Requirements".

**Checklist before committing**:
1. New components → new `*.test.tsx` files
2. New hooks → new `*.test.ts` files
3. Modified components → updated existing tests for new behavior
4. All tests pass (`npx vitest run`)

## 2026-03-16: React hooks must be called before early returns

**Pattern**: The collapsible sections feature added `useMemo` hooks after conditional early returns in `RoomPage.tsx`. This caused React error #310 ("Rendered more hooks than during the previous render") which completely broke tournament and room pages.

**Rule**: ALL React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useId`, etc.) MUST be called before any conditional `return` statement in a component. When adding new hooks to a component with early returns, always place them with the other hooks at the top.

**Checklist before committing hook changes**:
1. Search for early `return` statements in the component
2. Verify ALL hooks are called BEFORE the first early return
3. If hooks were added after early returns, move them up

## 2026-03-16: Always run E2E tests with Playwright for UI changes

**Pattern**: Shipped a feature (collapsible sections) that broke pages in the browser but passed unit tests. The bug was only visible when rendering the full component in a real browser context.

**Rule**: For any changes touching page components or UI rendering logic, ALWAYS run E2E tests using the `e2e-test` and/or `e2e-tournament` skills before pushing. Unit tests alone are not sufficient to catch rendering issues like hook ordering violations.

**Checklist before pushing UI changes**:
1. Unit tests pass (`npx vitest run`)
2. Run `e2e-test` skill with Playwright to verify pages render
3. For tournament-related changes, also run `e2e-tournament` skill
4. Check browser console for React errors (especially #310, #300)

## 2026-03-16: E2E test environment setup in sandboxed environments

**Pattern**: Setting up Firebase emulator + backend + frontend for E2E testing required multiple retries due to proxy issues, missing browser binaries, and stale gRPC connections.

**Setup steps for E2E tests in this environment**:
1. **Firebase Emulator**: Download JAR and UI zip manually if proxy blocks auto-download:
   - `curl -L -o ~/.cache/firebase/emulators/cloud-firestore-emulator-v1.20.2.jar "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.20.2.jar"`
   - `curl -L -o ~/.cache/firebase/emulators/ui-v1.15.0.zip "https://storage.googleapis.com/firebase-preview-drop/emulator/ui-v1.15.0.zip"`
   - Start with: `firebase emulators:start --project demo-project --only firestore`
2. **Backend**: Use `FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"` (NOT `localhost:8080` — avoids IPv6 issues). Restart backend if Firestore emulator was restarted (stale gRPC connections).
3. **Frontend**: `cd frontend && npm install && npm run dev`
4. **Playwright browser**: Install chromium via `npx playwright install chromium --with-deps`. Create wrapper at `/opt/google/chrome/chrome` with `--no-sandbox` for root environments:
   ```bash
   #!/bin/bash
   exec /root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome --no-sandbox "$@"
   ```
