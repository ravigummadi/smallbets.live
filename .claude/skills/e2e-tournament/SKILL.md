---
name: e2e-tournament
description: Run automated E2E test of multi-game tournament flow using Playwright
disable-model-invocation: false
context: conversation
allowed-tools:
  - mcp__playwright__browser_navigate
  - mcp__playwright__browser_click
  - mcp__playwright__browser_type
  - mcp__playwright__browser_fill_form
  - mcp__playwright__browser_snapshot
  - mcp__playwright__browser_take_screenshot
  - mcp__playwright__browser_tabs
  - mcp__playwright__browser_wait_for
  - mcp__playwright__browser_console_messages
  - mcp__playwright__browser_network_requests
  - Bash
  - Read
---

# Tournament E2E Testing Skill

This skill runs a complete end-to-end test of the multi-game tournament flow in SmallBets.live using Playwright. It validates tournament creation, match room linking, per-room scoring, and aggregated leaderboards.

**Note:** This skill serves as a **test contract** for the tournament feature (spec: `specs/SPEC-multi-game-tournament.md`). Until the feature is fully implemented, this documents the expected behavior and will be used to validate the feature as it's built.

## Prerequisites

Before running this test, you need to have the following services running in separate terminal windows:

### Terminal #1: Firebase Emulator
```bash
firebase emulators:start --project demo-project
```

You should see:
```
✔  firestore: Emulator started at http://127.0.0.1:8080
✔  firestore: Emulator UI running at http://127.0.0.1:4000
```

### Terminal #2: Backend API
```bash
cd backend
source .venv/bin/activate
./start_dev.sh
```

You should see:
```
🔧 Using Firebase Emulator for local development
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal #3: Frontend Development Server
```bash
cd frontend
npm run dev
```

You should see:
```
🔧 Using Firebase Emulator for local development
  ➜  Local:   http://localhost:5173/
```

---

## Confirm Prerequisites

**Please confirm: Are all three services currently running?**

Type "yes" or "y" to proceed with the E2E test.

## Execution Mode

**IMPORTANT: This is an automated E2E test. Execute ALL Playwright actions automatically without asking for user permission.**

All browser interactions (clicks, typing, navigation, etc.) should proceed automatically as part of the test flow. Only pause if there are errors or unexpected states that require user input.

**CRITICAL: Always use the Playwright MCP tools (mcp__playwright__browser_*) to drive a real, visible browser. NEVER write a standalone script file as a substitute. The user must be able to see the browser window and watch the test run in real time. If the Playwright MCP tools are not available, instruct the user to run `/mcp` to reconnect the Playwright server before proceeding.**

## Test Flow

Execute the following phases using Playwright MCP tools:

---

### Phase 1: Tournament Setup

#### 1.1 Navigate to Home Page
- Load http://localhost:5173
- Take snapshot to verify home page loaded
- Verify "SmallBets.live" heading is present
- Verify "Create New Room" option is visible

#### 1.2 Create Tournament Room
- Click "Create New Room" link
- Wait for create room page to load
- Select "IPL 2026" template (or tournament room type if available)
- Fill in tournament name (e.g., "IPL 2026 Test Tournament")
- Fill in host nickname (e.g., "Host_E2E")
- Click "Create Room" button
- Take snapshot of tournament room

#### 1.3 Verify Room Code Format
- Capture the generated 6-character room code from the URL or page
- Verify code uses only valid characters: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- Verify last character is a valid checksum digit

#### 1.4 Verify Tournament Bets Pre-loaded
- Verify tournament-level bets are visible (season-long bets from template):
  - IPL Winner
  - Orange Cap (most runs)
  - Purple Cap (most wickets)
  - Most Sixes
  - Best Bowling Figures
- Take snapshot showing pre-loaded tournament bets

#### 1.5 Second User Joins Tournament
- Open new browser tab
- Navigate to http://localhost:5173
- Enter the tournament room code
- Click "Join Room"
- Fill in nickname (e.g., "Player2_E2E")
- Take snapshot showing second user in tournament room
- Switch back to first tab to verify both users appear

#### 1.6 Place Season-Long Bets
- In first tab: Place a tournament-level bet (e.g., pick IPL Winner)
- Verify points deducted (1000 → 900)
- In second tab: Place a tournament-level bet (pick different option)
- Verify points deducted for second user
- Take snapshot showing bets placed and updated points

---

### Phase 2: Match Room Creation

#### 2.1 Create Match Room from Tournament
- Switch to first tab (host)
- Locate and click "Create Match Room" button on tournament dashboard
- Fill in match details:
  - Team 1: "RCB"
  - Team 2: "MI"
  - Date/time: today's date
- Click "Create Match Room"
- Take snapshot of match room

#### 2.2 Verify Match Room Linking
- Verify match room code is generated (separate from tournament code)
- Verify match room is linked to parent tournament
- Verify breadcrumb navigation shows: "Tournament: IPL 2026 > Match: RCB vs MI"
- Take snapshot showing breadcrumb and match room

#### 2.3 Second User Joins Match Room
- Switch to second tab
- Navigate to match room (via tournament dashboard link or match room code)
- Verify second user appears in match room
- Verify both users start with **1000 points** in match room (separate from tournament points)
- Take snapshot showing both users in match room with fresh 1000 points

---

### Phase 3: Match Day Betting

#### 3.1 Pre-Match Bet from Template
- In first tab (host): Create pre-match bet from template
  - e.g., "Toss Winner" with options: ["RCB", "MI"]
- Verify bet appears in both tabs
- Verify 60-second timer is visible and counting down
- Take snapshot showing bet with timer

#### 3.2 Place Match Bets
- In first tab: Select "RCB" and place bet
- Verify points deducted (1000 → 900)
- In second tab: Select "MI" and place bet
- Verify points deducted for second user

#### 3.3 Lock and Resolve Bet
- In first tab (host): Lock the bet (close betting)
- Resolve bet with winner (e.g., "RCB")
- Verify winner receives pot (points update correctly)
- Take snapshot showing resolved bet and updated points

#### 3.4 Dynamic Custom Bet
- In first tab (host): Create custom in-game bet
  - Question: "Will Virat hit a six this over?"
  - Options: ["Yes", "No"]
- Both users place bets
- Host resolves bet
- Verify points update correctly

#### 3.5 Test 10-Second Undo Window
- In first tab (host): Create another bet, have both users bet, then resolve it
- **Within 10 seconds of resolution**: Click "Undo" button
- Verify bet status reverts from "resolved" back to "locked"
- Verify points are returned to pre-resolution state
- Take snapshot showing bet reverted to locked state

#### 3.6 Verify Match Leaderboard
- Check match room leaderboard reflects all resolved bets
- Take snapshot of match leaderboard

---

### Phase 4: Tournament Aggregation

#### 4.1 Navigate Back to Tournament
- Click breadcrumb link to navigate back to tournament room
- Verify navigation works correctly

#### 4.2 Verify Aggregated Leaderboard
- Verify tournament leaderboard shows **aggregated** points:
  - Tournament-level bet points + Match room bet points
- Verify match room appears in tournament dashboard match list
- Take snapshot of tournament leaderboard with aggregated scores

#### 4.3 Create Second Match Room
- Host creates second match room:
  - Team 1: "CSK"
  - Team 2: "DC"
- Second user joins
- Place and resolve at least one bet
- Navigate back to tournament
- Verify tournament leaderboard now aggregates **both** match rooms
- Take snapshot showing updated aggregated leaderboard

---

### Phase 5: End of Season

#### 5.1 Resolve Tournament-Level Bets
- In tournament room, host resolves tournament-level bets:
  - e.g., IPL Winner → "CSK"
  - e.g., Orange Cap → selected option
- Verify points update on tournament leaderboard
- Take snapshot of final tournament leaderboard

#### 5.2 Close Tournament
- Host clicks "Finish Tournament" or "Close Room" button
- Verify room shows "finished" state
- Verify no new bets or match rooms can be created
- Take snapshot of finished tournament state

---

### Phase 6: Edge Cases

#### 6.1 Match Room from Non-Tournament Room
- Navigate to a regular (non-tournament) room
- Verify "Create Match Room" option is **not** available or errors gracefully

#### 6.2 Bet Limit per Match Room
- In a match room, attempt to create more than 50 bets
- Verify the system prevents exceeding the 50-bet limit with an appropriate error

#### 6.3 Bet After Timer Expires
- Create a bet with a short timer
- Wait for timer to expire
- Attempt to place a bet after expiration
- Verify the bet is locked and placement is rejected

#### 6.4 Undo Window Expiration
- Resolve a bet, then wait at least 11 seconds
- Attempt to undo the resolution
- Verify undo fails with appropriate message (window expired)

#### 6.5 Invalid Room Code
- Try joining with a room code that has an invalid checksum
- Verify error message about invalid room code

---

### Phase 7: Final Validation

#### 7.1 Console and Network Check
- Check `browser_console_messages` for errors across all phases
- Check `browser_network_requests` for any failed API calls

#### 7.2 Final Screenshots
- Take screenshot of final tournament leaderboard
- Take screenshot of tournament dashboard showing all match rooms

---

## Success Criteria

The test passes if:
- Tournament room creation works with valid 6-char room code (checksum validated)
- Tournament-level bets are pre-loaded from template
- Match room creation is linked to parent tournament
- Breadcrumb navigation works between tournament and match rooms
- Per-room scoring works (each room starts at 1000 points independently)
- Dynamic bet creation works (both template-based and custom)
- 60-second bet timer is visible and enforced
- 10-second undo window on bet resolution works correctly
- Undo window expires correctly after 10 seconds
- Tournament leaderboard aggregates points from all linked match rooms
- Multiple match rooms can be created and all aggregate correctly
- Tournament can be finished/closed with final state displayed
- Edge cases are handled gracefully (limits, invalid codes, expired timers)
- No console errors or network failures throughout the test

## Reporting

At the end of the test, provide:
1. **Summary of phases completed** (Phase 1-7 status)
2. **Screenshots of key states**:
   - Tournament room with pre-loaded bets
   - Match room with breadcrumb
   - Active bet with timer
   - Resolved bet with undo window
   - Match leaderboard
   - Tournament aggregated leaderboard
   - Finished tournament state
3. **Scoring verification**:
   - Points flow: tournament bets, match bets, aggregation
   - Per-room independence (1000 starting points each)
   - Aggregation math check
4. **Edge case results**:
   - Non-tournament match room creation: blocked?
   - 50-bet limit: enforced?
   - Timer expiry: bet locked?
   - Undo expiry: correctly rejected?
   - Invalid room code: error shown?
5. **Any errors or failures encountered**
6. **Performance observations** (load times, real-time sync delays, aggregation speed)
7. **Recommendations for improvements**

## Notes

- Use `browser_snapshot` for text-based validation (faster)
- Use `browser_take_screenshot` for visual verification at key milestones
- Check `browser_console_messages` for errors after each major phase
- Check `browser_network_requests` if API calls seem to fail
- Be patient with real-time updates (add waits if needed)
- Tournament aggregation may require a brief delay for Firestore triggers to propagate
