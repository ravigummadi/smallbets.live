# SmallBets.live — Quality Audit & Improvement Plan

**Date:** 2026-03-04
**Targets:** T20 World Cup Final (March 11-12) | IPL 2026 (March 28 onwards)
**Methodology:** Spec analysis, full codebase review, competitive research (12+ apps), E2E test attempt

---

## Part 1: Scoring (1-10 scale)

### 1. Requirements Satisfaction — 5/10

**What's built well:**
- Core single-event flow works: create room, join, place bets, resolve, leaderboard
- Real-time sync via Firestore listeners with clean hook patterns
- Session restoration via unique user links (`/room/{code}/u/{userKey}`)
- Game logic is production-quality with exhaustive tests
- Mobile-first dark theme with proper touch targets
- Tournament room type exists with match room creation
- Dynamic bet creation (template + custom) is implemented
- 10-second undo window on bet resolution is implemented
- Edit/delete for open bets is implemented

**What's missing or incomplete:**
- **Firebase Auth upgrade never happened.** The tournament spec explicitly says "hostId is Firebase Auth UID, verified server-side, NOT from client header." The codebase still uses `X-Host-Id` headers — trivially spoofable. Any user who inspects network requests can act as host.
- **6-char room codes with checksum** are specified but implementation is inconsistent — two code generation functions exist (`generate_room_code` for 4-char, `generate_room_code_v2` for 6-char).
- **Tournament leaderboard aggregation** (cross-room point summation) — unclear if fully working. The spec describes batched Firestore queries for aggregation; the codebase has basic leaderboard logic but aggregation across match rooms needs verification.
- **Abuse prevention** (5 room creates/user/day, 10 join attempts/IP/min) — not implemented. Rate limiting only exists on `place_bet` endpoint (60/min in-memory).
- **Optimistic locking** (`version` field) — models have the field but it's not enforced in service operations.
- **Bet limits** (50/match room, 20/tournament) — not enforced.
- **Firestore security rules** — current rules are read-only for all, write via Admin SDK only. The detailed per-collection rules from the tournament spec are not implemented.
- **Transcript automation** — the original spec's crown jewel (automated bet opening/closing from live feeds) is built but effectively abandoned for the tournament use case. No discussion of how/if it applies to cricket.
- **README.md is stale** — still shows Phase 1-4 as the roadmap, doesn't mention tournament features, unique links, or any post-February work.

**Spec contradictions unresolved:**
- CLAUDE.md says "Backend: Firebase (Cloud Functions + Hosting)" but actual backend is FastAPI on Cloud Run
- ARCHITECTURE.md documents header-based auth as the pattern, while tournament spec explicitly rejects it
- Triple source of truth for admin status: `User.is_admin`, `RoomUser.is_admin`, `Room.host_id`
- SPEC.md references are broken after move to `specs/` directory

### 2. Ease of Use — 6/10

**For single ceremony events (Oscars/Grammys): 7/10**
- Flow is straightforward: create room, share code, everyone bets on pre-loaded categories
- Templates for Oscars/Grammys/Super Bowl are ready with trigger configs
- The automation engine (transcript → auto-open/resolve bets) genuinely works
- Admin can manually override when automation fails
- Single active bet design keeps focus — validated by competitive research (DraftKings/FanDuel struggle with information overload)

**For IPL-style tournaments: 5/10**
- Tournament creation works, match room linking works
- But the **host burden is extreme** for cricket. During a live T20 match, the host must:
  1. Create each bet manually (type question + options)
  2. Wait for everyone to bet
  3. Lock the bet
  4. Resolve with the correct answer
  5. Repeat 15-25 times per match
  - This is not viable while also watching the match with friends. The host becomes a full-time operator, not a participant.
- No bet templates surfaced in the UI during match creation — host must type everything from scratch each time
- No quick-fire bet creation (e.g., "Next over: runs?" with pre-filled options for cricket)
- No way to prepare bets before a match and queue them
- Match room discovery is unclear — how do tournament participants find/join child match rooms?
- The "single active bet" design that works for ceremonies is a bottleneck for cricket where multiple things happen simultaneously

**Competitive comparison:**
- PlayAuctionGame.com (closest comparable) has zero-friction room codes + no signup — SmallBets.live matches this
- Superbru (2.6M users) handles the tournament lifecycle well but lacks real-time in-play betting — SmallBets.live's differentiator
- Dream11 has polished cricket UX patterns (team colors, player names, cricket vocabulary) that SmallBets.live lacks
- Scoreboard Social automates everything — no host admin needed. SmallBets.live requires heavy host involvement

### 3. User Experience & UI Quality — 6/10

**Strengths:**
- Dark theme with neon green accent is distinctive and appropriate for a sports betting feel
- 44px minimum touch targets follow iOS guidelines
- CSS custom properties create a consistent design system
- Loading states and error handling throughout
- Session restoration via user links is well-implemented
- Real-time updates are smooth via Firestore listeners

**Weaknesses:**
- **RoomPage is a 1,098-line god component** — the entire game experience is one monolithic file. This makes it hard to maintain and impossible to optimize rendering.
- **Mixed styling approaches** — CSS classes from `index.css` mixed with inline `style={}` objects throughout components. Verbose and inconsistent.
- **No visual feedback on bet placement success** beyond points changing. Comparable apps (Kahoot, FanDuel) use animations, color flashes, and celebratory feedback.
- **Timer countdown** exists but lacks the urgency design that Kahoot/betting apps use (pulsing, color changes as time runs out, sound cues)
- **Leaderboard is static** — no animation on position changes, no "you moved up!" feedback. Competitive research shows the leaderboard is THE primary engagement driver.
- **No cricket-specific theming** — no team colors, no player images, no cricket vocabulary in the UI
- **No "bet resolved" celebration** — when a bet resolves, winners and losers should see clear, distinct feedback
- **Duplicate admin panel** — `AdminPanel.tsx` exists separately but RoomPage duplicates its functionality inline
- **No empty states** — what does a new room look like with no bets? A tournament with no matches yet? These states need design.
- **No onboarding** — first-time users land in a room with no context about how betting works, what points mean, or what to expect

### 4. Code Quality — 7/10

**Strengths (genuinely good):**
- **Game logic** (`game_logic.py`) — Pure functions, no I/O, exhaustive edge case handling. This is production-quality code. Handles all-same-pick refunds, no-winner refunds, integer division for splits, tie-breaking by join time.
- **Security tests** — 15+ tests covering cross-room authorization, unauthorized actions, header validation. Thorough.
- **Backend architecture** — Clean separation: models (Pydantic) → services (Firestore I/O) → endpoints (FastAPI) → game logic (pure). Good dependency injection via `Depends()`.
- **Frontend hooks** — Six hooks, all 30-40 lines, all follow the same clean subscribe/unsubscribe pattern. `useRoom` has a nice 2-second grace period for newly-created rooms.
- **API client** — Consistent error handling, proper headers, clean interface.
- **CI + push gate** — GitHub Actions runs tests on PRs. The `.claude/hooks/test-gate-push.sh` hook blocks pushes unless tests pass.
- **Firestore indexes** — Six composite indexes that match actual query patterns.

**Weaknesses:**
- **Blocking Firestore calls in async functions** — All service methods are `async def` but call synchronous Firebase Admin SDK methods. This blocks the event loop. Fine for 5-10 users, will choke at 50.
- **No transactions for multi-document operations** — Bet resolution updates the bet, all user bets, and all user points across multiple documents. If the process crashes mid-operation, data becomes inconsistent.
- **No service-layer tests** — `bet_service.py`, `room_service.py`, `user_service.py` have zero unit tests. Only game_logic and security are tested.
- **Frontend has minimal tests** — Vitest is configured but the test files contain very little coverage.
- **CORS is `allow_origins=["*"]`** — Acceptable for dev, not for production.
- **In-memory rate limiting** — `defaultdict` on a single process. Won't work with multiple backend instances.
- **No input sanitization** — Nicknames, bet questions, and options are stored and displayed without XSS protection.
- **Constants duplicated** — `INITIAL_POINTS = 1000`, `MAX_BET_OPTIONS = 10` defined independently in backend and frontend.
- **No logging framework** — No structured logging, no error tracking (Sentry/similar), no observability.

### 5. Operational Readiness — 3/10

This is the biggest gap. Can you confidently run a live event?

**Missing:**
- **No production deployment pipeline.** Dockerfile exists but there's no `cloudbuild.yaml`, no deploy script, no staging environment. How do you deploy?
- **No monitoring.** If the backend crashes during a live match, how would you know? No health checks, no alerting.
- **No error recovery.** If a bet resolution partially fails (some users get points, others don't), there's no way to detect or fix this.
- **No data backup.** Firestore data for an in-progress tournament — what if it corrupts?
- **No load testing.** The spec targets 50 users/room. Has this been tested? The synchronous Firestore calls will likely bottleneck well before 50 concurrent users.
- **No host failover.** If the host's phone dies mid-match, can someone else take over? Currently no.
- **No offline tolerance.** If a user loses connection for 30 seconds during a bet window, they miss the bet. No queued bet submission.
- **CORS wide open.** Anyone can call the API from any origin.
- **Auth is spoofable.** A technically savvy participant could act as host by sending the right headers.

**What exists:**
- Firebase Hosting for frontend — straightforward deployment
- Backend Dockerfile for Cloud Run — exists but untested in production
- Push gate hook — ensures tests pass before pushing code

### 6. Competitive Positioning — 7/10

SmallBets.live occupies a **genuinely unique position** in the market:

| Feature | SmallBets.live | Closest Competitor |
|---------|:-:|:-:|
| Virtual points (no real money) | Yes | WagerLab, Superbru |
| Room-code based | Yes | PlayAuctionGame, Kahoot |
| No signup required | Yes | PlayAuctionGame, Scoreboard Social |
| Real-time live betting | Yes | Scoreboard Social (limited) |
| Cricket/IPL support | Yes | Superbru (pre-match only) |
| Social/friends focus | Yes | Most competitors |
| Browser-only (no app) | Yes | Scoreboard Social |

**No existing app combines all six.** PlayAuctionGame.com comes closest in spirit (room code + no signup + IPL + real-time) but serves auction simulation, not match predictions.

The "Kahoot for live betting" positioning is strong and validated. Kahoot proved the room-code + timer + leaderboard model at massive scale. SmallBets.live applies it to real event outcomes.

**Key competitive advantages:**
- Zero friction: share a link, enter name, play. No app install, no account, no payment.
- Virtual points avoid the regulatory minefield that killed Probo in India (ED raid, July 2025, 400+ crore frozen).
- Real-time in-play betting during cricket matches — Superbru only does pre-match predictions.

**Risks:**
- If Scoreboard Social adds cricket, they'd be a direct threat (they already have automated scoring with no host needed).
- The heavy host burden for cricket could limit adoption — the host experience must improve or the app stays a novelty.

---

## Part 2: Tiered Improvement Plan

### Tier 1: MUST DO before T20 WC Final (March 11-12) — 7 days

These are the minimum changes to run a successful dry-run event.

#### 1.1 Cricket Quick-Fire Bet Templates
**Problem:** Host must type every bet from scratch during a live T20 match. This is untenable.
**Solution:** Pre-built cricket bet templates that the host can trigger with 1-2 taps.
- "Toss winner" → [Team A, Team B]
- "Runs in this over" → [0-5, 6-10, 11-15, 16+]
- "Next wicket method" → [Caught, Bowled, LBW, Run Out, Other]
- "Will there be a six this over?" → [Yes, No]
- "Top scorer this innings" → [Player options based on team]
- "Next ball outcome" → [Dot, Single, Boundary, Six, Wicket, Other]
- Surface these as a scrollable row of quick-action buttons in the host admin bar
- Host taps template → auto-fills question and options → host hits "Open Bet" → done in 2 taps

**Effort:** 1-2 days

#### 1.2 Host UX Simplification for Live Cricket
**Problem:** During a live match, the host performs 4 steps per bet: create → wait → lock → resolve. Too many clicks.
**Solution:**
- **Auto-lock on timer expiry.** When timer hits 0, the bet locks automatically. Host doesn't need to manually lock.
- **One-tap resolve.** After bet locks, show winning option buttons directly — host taps the winner, done.
- **Sticky host action bar.** Pin the "next action" at the bottom of the screen so the host doesn't scroll.
- **Keyboard shortcut / quick-resolve.** If bet has 2 options, show two big buttons: "Option A wins" / "Option B wins"

**Effort:** 1-2 days

#### 1.3 Bet Resolution Feedback
**Problem:** When a bet resolves, there's no visual celebration or commiseration.
**Solution:**
- Winners: green flash + "+X points" animation + brief confetti (CSS-only)
- Losers: red flash + "-100 points" shown
- Show the updated leaderboard immediately after resolution with position changes highlighted

**Effort:** 1 day

#### 1.4 Timer Urgency Polish
**Problem:** Timer exists but lacks urgency.
**Solution:**
- Last 10 seconds: timer turns red, pulses
- Last 5 seconds: larger text, faster pulse
- Timer expiry: brief flash + auto-lock (see 1.2)
- Sound optional (vibration on mobile if supported)

**Effort:** 0.5 days

#### 1.5 Basic Deployment
**Problem:** No way to deploy and test with real users on phones.
**Solution:**
- Deploy frontend to Firebase Hosting
- Deploy backend to Cloud Run (Dockerfile exists)
- Lock down CORS to actual domain
- Verify on mobile browsers (iOS Safari, Android Chrome)

**Effort:** 1-2 days

#### 1.6 Dry Run Rehearsal
**Problem:** Never tested with real users on real devices.
**Solution:**
- Run a mock "T20 match" with 3-5 friends before the real final
- Test: room creation, joining via link, bet flow, real-time sync, leaderboard
- Identify and fix any mobile-specific bugs
- Time the host workflow — is it sustainable for 15+ bets per match?

**Effort:** 0.5 days

---

### Tier 2: SHOULD DO before IPL (March 28) — 3.5 weeks

#### 2.1 Match Room Discovery in Tournament
**Problem:** Tournament participants must somehow learn the match room code for each game. Current flow requires the host to share a new code via WhatsApp for every match.
**Solution:**
- Tournament room shows a "Matches" tab listing all child match rooms
- Each match shows: teams, date, status (upcoming/live/finished), room code
- "Join Match" button that directly joins the user into the match room
- Push notification (or just a banner) when a new match room opens

**Effort:** 2-3 days

#### 2.2 Bet Queue / Pre-Created Bets
**Problem:** Host can't prepare bets before a match starts.
**Solution:**
- Allow host to create bets in "pending" status before the match
- Queue view: host sees prepared bets, opens them one-by-one during the match with a single tap
- Pre-populate from cricket templates (see 1.1) for the specific match
- This reduces live hosting to: open next bet → wait → resolve → repeat

**Effort:** 2-3 days

#### 2.3 Animated Leaderboard
**Problem:** Leaderboard is static and doesn't drive engagement.
**Solution:**
- After each bet resolves, show a "leaderboard update" animation
- Position changes slide up/down
- Points delta shown (+200 / -100) next to each player
- Top 3 have distinctive treatment (gold/silver/bronze — already exists, needs animation)
- Auto-show leaderboard for 3 seconds after each bet resolution before showing next bet

**Effort:** 2 days

#### 2.4 Cricket-Specific Theming for IPL
**Problem:** App feels generic, not cricket-specific.
**Solution:**
- IPL team colors as accent colors in match rooms (e.g., RCB red, CSK yellow, MI blue)
- Cricket terminology in UI copy ("innings", "over", "powerplay")
- Match context bar: show current score, overs, key stats (host enters periodically)
- Team badges/logos (if licensing allows, otherwise team color coding)

**Effort:** 2-3 days

#### 2.5 Tournament Leaderboard Aggregation
**Problem:** Unclear if cross-room aggregation is working correctly.
**Solution:**
- Verify and test aggregated leaderboard across multiple match rooms
- Show per-match point breakdown (expandable rows)
- Track "bets won" / "bets placed" ratio per player
- Season stats: total bets, win %, biggest win, worst loss

**Effort:** 2 days

#### 2.6 Host Reliability
**Problem:** If host's phone dies, the event stalls. No recovery mechanism.
**Solution:**
- "Co-host" capability: host can promote another participant to co-host
- Co-host can create/lock/resolve bets
- If host disconnects for >60 seconds, show prompt to co-host
- Store host actions in Firestore so state is recoverable

**Effort:** 2-3 days

#### 2.7 Onboarding / First-Time User Experience
**Problem:** Users join a room with zero context.
**Solution:**
- Brief welcome modal for first-time users (dismiss once): "You start with 1000 points. When a bet opens, pick your answer before time runs out. Winners split the pot!"
- Show a tooltip on the first bet that opens: "Tap an option to bet"
- For the host: a one-time "Host guide" explaining the create → open → resolve flow

**Effort:** 1 day

#### 2.8 Backend Hardening
**Problem:** Multiple production risks.
**Solution:**
- Add Firestore transactions for bet resolution (atomic multi-document updates)
- Switch to async Firestore operations (or use run_in_executor)
- Add structured logging (Python logging + Cloud Logging)
- Lock down CORS to production domain
- Add basic health check endpoint
- Add XSS sanitization on user inputs (nicknames, bet questions)

**Effort:** 2-3 days

---

### Tier 3: NICE TO HAVE (post-IPL launch)

#### 3.1 Firebase Auth Migration
Replace `X-Host-Id` header auth with Firebase Auth tokens. This was specified in the tournament spec but never implemented. Not blocking for a friends-only group but needed before sharing with strangers.

#### 3.2 Chat / Reactions
Add lightweight social features: emoji reactions on bet outcomes, simple chat in room. BuddyBet and BetU show this drives retention.

#### 3.3 Automated Cricket Scoring
Integrate with a cricket API (CricBuzz, ESPNcricinfo) to auto-populate match scores and potentially auto-resolve certain bets (e.g., "Toss winner" once the toss happens).

#### 3.4 PWA Support
Add service worker, manifest, and offline tolerance. Allow users to "install" the web app to their home screen for quick access during the IPL season.

#### 3.5 Push Notifications
Notify users when: a new bet opens, a match room is created, results are in. Critical for tournament engagement over weeks.

#### 3.6 Code Quality
- Break up RoomPage (1,098 lines) into 5-6 focused components
- Add service-layer tests (bet_service, room_service, user_service)
- Add frontend component tests
- Remove duplicate AdminPanel component
- Unify styling approach (pick CSS modules or inline — not both)
- Clean up stale docs (CLAUDE.md, ARCHITECTURE.md, README.md references)

#### 3.7 Spectator Mode
Allow users to watch bets and leaderboard without betting. Useful for people who join late or just want to follow.

#### 3.8 Historical Stats / Season Review
End-of-season summary: best predictor, biggest upset, most popular bets, luckiest player, etc. Shareable social card.

---

## Part 3: Competitive Research Summary

### Direct Comparables
| App | Model | Strength | SmallBets.live Advantage |
|-----|-------|----------|--------------------------|
| **WagerLab** | Virtual currency social betting | Gamification (avatars, trophies, streaks) | Real-time live events, no app install |
| **BuddyBet** | Peer-to-peer handshake bets | Social feed, agree/disagree mechanic | No account needed, cricket support |
| **Scoreboard Social** | Browser-based watch party predictions | Fully automated, no host needed | Cricket support, custom events |
| **Superbru** (2.6M users) | Pre-match predictions with friend pools | Tournament lifecycle, massive user base | Real-time in-play betting during matches |
| **PlayAuctionGame** | IPL auction simulator, room-code based | IPL-specific, zero friction | Match predictions vs. auction simulation |
| **Kahoot!** | Room-code quiz games | Proven at massive scale, great UX | Real event outcomes, betting mechanic |

### Key Insight
SmallBets.live is the only app that combines: **virtual points + no signup + room codes + real-time live betting + cricket + friends.** The positioning is strong. The execution gap is in **host experience** (too much manual work for cricket) and **operational readiness** (never deployed, never tested with real users).

### Regulatory Context
Probo (India's leading prediction market) was raided by the Enforcement Directorate in July 2025 — 400+ crore in assets frozen. India's 2025 Online Gaming Act classifies real-money prediction apps as gambling. SmallBets.live's virtual-points-only model is **immune to this** by design. This is a feature, not a limitation.

---

## Part 4: Priority Matrix

| Priority | Item | Impact | Effort | Target |
|----------|------|--------|--------|--------|
| P0 | Cricket quick-fire templates (1.1) | High | 1-2d | T20 WC Final |
| P0 | Host UX simplification (1.2) | High | 1-2d | T20 WC Final |
| P0 | Basic deployment (1.5) | Critical | 1-2d | T20 WC Final |
| P0 | Dry run rehearsal (1.6) | Critical | 0.5d | T20 WC Final |
| P1 | Bet resolution feedback (1.3) | Medium | 1d | T20 WC Final |
| P1 | Timer urgency (1.4) | Medium | 0.5d | T20 WC Final |
| P1 | Match room discovery (2.1) | High | 2-3d | IPL |
| P1 | Bet queue/pre-create (2.2) | High | 2-3d | IPL |
| P1 | Animated leaderboard (2.3) | Medium | 2d | IPL |
| P1 | Cricket theming (2.4) | Medium | 2-3d | IPL |
| P2 | Tournament aggregation (2.5) | Medium | 2d | IPL |
| P2 | Co-host capability (2.6) | High | 2-3d | IPL |
| P2 | Onboarding (2.7) | Medium | 1d | IPL |
| P2 | Backend hardening (2.8) | Medium | 2-3d | IPL |
| P3 | Firebase Auth (3.1) | Low | 3-5d | Post-IPL |
| P3 | Chat/reactions (3.2) | Low | 2-3d | Post-IPL |
| P3 | Auto cricket scoring (3.3) | Medium | 3-5d | Post-IPL |
| P3 | PWA (3.4) | Low | 1-2d | Post-IPL |
| P3 | Code quality cleanup (3.6) | Low | 3-5d | Post-IPL |

---

## Part 5: Overall Assessment

**The core idea is strong and validated by competitive research.** No existing product does exactly what SmallBets.live does. The virtual-points model is legally smart for India. The room-code no-signup pattern is proven at scale (Kahoot). Real-time in-play betting during cricket is a genuine differentiator over Superbru.

**The gap is execution, not vision.** The biggest risks for the upcoming events are:

1. **Host burnout** — The host experience for live cricket is not sustainable. This is the #1 thing to fix.
2. **Never deployed** — The app has never been used by real people on real phones. Unknown unknowns lurk.
3. **No safety net** — No monitoring, no error recovery, no co-host failover. If something breaks during a live match, there's no recovery path.

**Recommended focus for the next 7 days (T20 WC Final):**
- Quick-fire cricket bet templates (1.1)
- Auto-lock on timer + one-tap resolve (1.2)
- Deploy to Firebase Hosting + Cloud Run (1.5)
- Test with friends on phones (1.6)

If those four things are done, the T20 WC Final dry run will be viable. Everything else can wait for IPL.
