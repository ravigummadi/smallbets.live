---
name: e2e-test
description: Run automated end-to-end test of SmallBets.live using Playwright
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

# End-to-End Testing Skill

This skill runs a complete end-to-end test of the SmallBets.live application using Playwright.

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

🎯 **Keep this terminal running** - this is your local Firebase database

### Terminal #2: Backend API
```bash
cd backend
source .venv/bin/activate  # Activate virtual environment (if not already)
./start_dev.sh
```

You should see:
```
🔧 Using Firebase Emulator for local development
INFO:     Uvicorn running on http://0.0.0.0:8000
```

✅ Backend running at http://localhost:8000

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

✅ Frontend running at http://localhost:5173

---

## Confirm Prerequisites

**Please confirm: Are all three services currently running?**

Type "yes" or "y" to proceed with the E2E test.

## Select Event Template

Once prerequisites are confirmed, list the available event templates from the `templates/` directory:
- grammys-2026.json
- oscars-2026.json
- superbowl-lix.json

**Ask the user which template they want to use for this E2E test.**

Once the user selects a template, proceed with the E2E test flow below using the selected template.

## Execution Mode

**IMPORTANT: This is an automated E2E test. Execute ALL Playwright actions automatically without asking for user permission.**

All browser interactions (clicks, typing, navigation, etc.) should proceed automatically as part of the test flow. Only pause if there are errors or unexpected states that require user input.

**CRITICAL: Always use the Playwright MCP tools (mcp__playwright__browser_*) to drive a real, visible browser. NEVER write a standalone script file (e.g., e2e-test.mjs) as a substitute. The user must be able to see the browser window and watch the test run in real time. If the Playwright MCP tools are not available, instruct the user to run `/mcp` to reconnect the Playwright server before proceeding.**

## Test Flow

Execute the following steps using Playwright MCP tools:

### 1. Navigate to Home Page
- Load http://localhost:5173
- Take snapshot to verify home page loaded
- Verify "SmallBets.live" heading is present
- Verify "Join a Room" and "Create New Room" options are visible

### 2. Create New Room
- Click "Create New Room" link
- Wait for create room page to load
- Take snapshot of room creation form
- Select the event template chosen by the user in the "Select Event Template" step
- Fill in room name (e.g., "Test Room E2E")
- Click "Create Room" button
- Capture the generated room code from the URL or page

### 3. Verify Room Setup
- Confirm navigation to room page (URL should be `/room/{roomCode}`)
- Take snapshot of room lobby
- Verify room details are displayed (room name, event template)
- Verify "waiting for event to start" or similar state
- Note the initial user points (should be 1000)

### 4. Simulate Second User Joining
- Open new browser tab
- Navigate to http://localhost:5173
- Enter the room code captured in step 2
- Click "Join Room"
- Take snapshot showing second user in room
- Switch back to first tab to verify both users appear in participants list

### 5. Start Event and Verify Bets Are Open
- Click "Start Event" in the admin toolbar
- Verify bets are already in "open" status (bets open immediately on creation)
- Verify bet appears in both browser tabs
- Take snapshot showing active bet with options

### 6. Place Bets
- In first tab: Select an option and place bet
- Verify points deducted (should go from 1000 to 900)
- Take snapshot showing bet placed
- In second tab: Select different option and place bet
- Verify both bets are recorded

### 7. Resolve Bet via Transcription (Tests Automation Feature)
- Navigate to admin panel or room admin view in first tab
- Bets should already be open — use "Close Bet" to lock one, then resolve it
- Locate the "Live Transcript Feed" panel (should be visible to admin/room creator)
- Take snapshot showing transcript input area
- Submit a transcript entry that matches the winner announcement pattern
  - Example for Grammy template: "And the Grammy goes to... [Winner Name]!"
  - The winner name should match one of the bet options exactly
  - This tests the automated bet resolution via transcript parsing
- Wait for automation to process (should be immediate)
- Verify automation feedback is displayed:
  - Action taken: "resolve_bet" (or "ignored" if no match)
  - Confidence score (should be > 0.8 for valid matches)
  - Winner extracted from transcript
- Verify bet resolves in both tabs automatically
- Take snapshot showing resolved bet
- Verify winner(s) receive points correctly
- Check leaderboard updates with new scores
- Verify console shows no errors related to automation

**Alternative (Fallback)**: If Live Transcript Feed is not accessible via UI, use backend API:
```bash
curl -X POST http://localhost:8000/api/rooms/{roomCode}/transcript \
  -H "Content-Type: application/json" \
  -d '{"text": "And the Grammy goes to... [Winner]!", "source": "manual"}'
```
Then verify the automation result in the response JSON.

### 8. Test Second Bet (Optional)
- Trigger second bet opening
- Place bets with both users
- Resolve bet
- Verify leaderboard reflects cumulative scores

### 9. Test Edge Cases
- Try placing bet with insufficient points (if applicable)
- Try joining with invalid room code
- Verify error handling and user feedback

### 10. Final Validation
- Take screenshot of final leaderboard
- Verify all point calculations are correct
- Check console for errors
- Review network requests for any failures

## Success Criteria

The test passes if:
- ✓ Room creation works and generates valid room code
- ✓ Multiple users can join the same room
- ✓ Real-time sync works (both users see same state)
- ✓ Bets can be placed and points are deducted correctly
- ✓ **Transcription-based bet resolution works correctly** (NEW)
  - Transcript with winner announcement triggers automation
  - Correct winner is extracted from transcript
  - Confidence score is calculated accurately
  - Automation feedback is displayed to admin
- ✓ Bet resolution works and winners receive points
- ✓ Leaderboard calculates and displays correct scores
- ✓ No console errors or network failures
- ✓ UI responds correctly to all user actions

## Reporting

At the end of the test, provide:
1. Summary of steps completed
2. Screenshots of key states (home, room lobby, active bet, **transcript submission**, resolved bet, leaderboard)
3. **Transcription automation results**:
   - Transcript text submitted
   - Action taken by automation (resolve_bet or ignored)
   - Confidence score
   - Winner extracted
   - Time to process
4. Any errors or failures encountered
5. Performance observations (load times, real-time sync delays, automation processing time)
6. Recommendations for improvements

## Notes

- Use `browser_snapshot` for text-based validation (faster)
- Use `browser_take_screenshot` for visual verification
- Check `browser_console_messages` for errors after each major step
- Check `browser_network_requests` if API calls seem to fail
- Be patient with real-time updates (add waits if needed)
