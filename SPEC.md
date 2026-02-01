# SmallBets.live - Product Specification

## Overview
SmallBets.live is a real-time micro-betting platform for friends watching live events together (Oscars, Super Bowl, etc.). Users place virtual-point bets on their phones as events unfold, with bets opening and closing dynamically in sync with the live broadcast.

## Core Value Proposition
- **Dead simple**: No app install, no accounts, just load a URL and play
- **Live engagement**: Bets open/close in real-time as events happen on TV
- **Social focus**: Designed for groups of friends watching together
- **Mobile-first**: Optimized for phone use while watching TV

## User Flows

### 1. Host Creates a Session
1. Host navigates to smallbets.live
2. Selects event template (Oscars 2026, Super Bowl LIX, or custom)
3. Clicks "Create Room"
4. Gets room code (e.g., "BLUE42")
5. Shares code with friends (verbally, text, group chat)
6. Enters nickname and joins as participant + admin

### 2. Friends Join Session
1. Navigate to smallbets.live
2. Enter room code
3. Enter nickname
4. See "Waiting for event to start" screen with participant list

### 3. Live Event Flow (The Core Experience)
1. **Pre-event**: All users see countdown or "waiting to start"
2. **Admin triggers first bet**: Host/admin clicks "Open Next Bet" in admin view
3. **Bet opens**: All users' phones show:
   - Current bet question (e.g., "Best Motion Picture?")
   - Options to choose from
   - 60-second countdown timer
   - Current leaderboard (collapsed/minimized)
4. **Users place bets**: Tap their choice, see confirmation
5. **Timer expires or admin closes bet**: Betting locks
6. **Event announces outcome**: Admin watches TV
7. **Admin resolves bet**: Clicks winning option in admin view
8. **Results shown**: All users see:
   - Correct answer
   - Who won/lost
   - Point changes
   - Updated leaderboard (brief celebration animation)
9. **Next bet opens immediately**: Repeat from step 2
10. **Event ends**: Final leaderboard shown, winner crowned

### 4. Admin Controls (Host View)
- See all participants
- Open next bet (from pre-configured list or add custom)
- Close betting early if needed
- Resolve bet (select winning answer)
- Skip/cancel a bet if needed
- View overall session stats

## Technical Requirements

### MVP Scope (1-2 weeks)
**In scope:**
- Room creation with 4-character room codes
- Nickname-only auth (no accounts)
- Real-time sync (all users see same state instantly)
- Pre-configured event templates (Grammy Awards 2026, Oscars 2026, Super Bowl LIX)
- **Automated bet opening/resolution via transcript ingestion**
- Generic webhook API for transcript ingestion (supports any source)
- Keyword-based bet triggering
- Winner extraction from transcript text
- Admin override controls (when automation fails)
- 60-second countdown timer per bet
- Fixed-point betting (everyone bets same amount, e.g., 100 points)
- Live leaderboard
- Mobile-optimized UI (phone primary, desktop secondary)
- Single active bet at a time (users only see current bet)

**Out of scope for MVP:**
- User accounts / authentication
- Multiple simultaneous bets
- Variable bet amounts
- Real money
- Chat functionality
- Push notifications
- Historical session data / analytics
- Invite system beyond room codes

### Tech Stack

**Frontend:**
- React + TypeScript (Vite)
- Mobile-first responsive design
- Firebase Firestore SDK for real-time updates
- Hosted on Firebase Hosting

**Backend:**
- FastAPI (Python) on Google Cloud Run
- Firebase Firestore for data storage
- Firebase Admin SDK for server-side operations
- Docker containerization

**Rationale:**
- **FastAPI**: Matches familyfued architecture, better for complex automation logic, easier local development and debugging
- **Firestore real-time listeners**: Critical for sub-second updates (countdown timers, live results)
- **Cloud Run**: Serverless auto-scaling, easy deployment, cost-effective
- **Proven pattern**: Same stack as familyfued project, reducing unknowns

### Architecture Patterns (from FamilyFeud)

**Note:** See [ARCHITECTURE.md](./ARCHITECTURE.md) for comprehensive architecture documentation, automated review workflow using `/software-architect` skill, and project-specific constraints.

**1. Functional Core, Imperative Shell (FCIS)**
- Pure game logic in `bet_service.py` (deterministic, testable)
  ```python
  # Pure function - no I/O, deterministic
  def calculate_scores(bet: Bet, winning_option: str) -> dict[str, int]:
      # Calculate points for each user based on their selections
      pass
  ```
- API endpoints in `main.py` handle I/O (Firestore, HTTP requests)
- Clean separation makes testing and debugging easier

**2. Pydantic Models with Serialization**
All data models use Pydantic for validation and include Firestore serialization:
```python
from pydantic import BaseModel
from datetime import datetime

class Room(BaseModel):
    code: str
    status: str
    created_at: datetime
    expires_at: datetime

    def to_dict(self) -> dict:
        """Serialize for Firestore storage"""
        return {
            "code": self.code,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Room":
        """Deserialize from Firestore"""
        return cls(**data)
```

**3. Dependency Injection**
Reusable dependencies for cleaner endpoint code:
```python
from typing import Annotated
from fastapi import Depends, HTTPException

async def get_room_or_404(code: str) -> Room:
    room = await room_service.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

RoomDep = Annotated[Room, Depends(get_room_or_404)]

@app.post("/api/rooms/{code}/bets/place")
async def place_bet(room: RoomDep, bet_option: str):
    # room is automatically fetched and validated
    pass
```

**4. Room Code Generation**
4-character codes excluding confusing characters:
```python
import random
import string

# Exclude O/0, I/1/L to avoid confusion
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

def generate_room_code() -> str:
    while True:
        code = ''.join(random.choices(ALPHABET, k=4))
        # Check for collision in Firestore
        if not room_exists(code):
            return code
        # If expired, recycle the code
        if is_expired(code):
            delete_room(code)
            return code
```

**5. Header-Based Auth**
Simple admin authentication without complex JWT:
```typescript
// Frontend: Store host_id in sessionStorage
const hostId = sessionStorage.getItem('hostId');

fetch(`/api/rooms/${code}/bets/open`, {
  headers: { 'X-Host-Id': hostId }
});
```

```python
# Backend: Validate host_id from header
def require_host(code: str, host_id: str = Header(alias="X-Host-Id")):
    room = get_room(code)
    if room.host_id != host_id:
        raise HTTPException(status_code=403, detail="Not the room host")
```

**6. Visibility Control**
Different views for host vs players:
```python
def build_room_status(room: Room, is_host: bool) -> dict:
    base_status = {
        "code": room.code,
        "status": room.status,
        "participants": room.participants,
        "leaderboard": room.leaderboard,
    }

    if is_host:
        # Host sees everything including admin controls
        base_status.update({
            "automation_enabled": room.automation_enabled,
            "all_bets": room.bets,  # Including pending bets
            "transcript_log": room.transcript_log,
        })

    return base_status
```

**7. Room Lifecycle**
- Status progression: `"waiting"` → `"active"` → `"finished"`
- 24-hour expiry: `expires_at = created_at + timedelta(hours=24)`
- Cleanup job: Background task deletes expired rooms
- Recycling: Expired room codes can be reused

**8. Clipboard Sharing**
Easy code sharing on frontend:
```typescript
const handleCopyCode = async () => {
  await navigator.clipboard.writeText(roomCode);
  setShowCopied(true);
  setTimeout(() => setShowCopied(false), 2000);
};
```

### Data Model

**Room:**
```typescript
{
  roomCode: string          // "BLUE42" (4-char, no O/0/I/1/L)
  eventTemplate: string     // "grammys-2026" | "oscars-2026" | "superbowl-lix" | "custom"
  status: string            // "waiting" | "active" | "finished"
  currentBetId: string | null
  hostId: string            // User who created room (for X-Host-Id auth)
  automationEnabled: boolean // Can pause automation
  createdAt: timestamp
  expiresAt: timestamp      // 24 hours from creation
}
```

**Note:** Models include `to_dict()` and `from_dict()` methods for Firestore serialization (see Architecture Patterns above).

**User (Session Participant):**
```typescript
{
  userId: string            // auto-generated
  roomCode: string
  nickname: string
  points: number           // starts at 1000
  isAdmin: boolean
  joinedAt: timestamp
}
```

**Bet:**
```typescript
{
  betId: string
  roomCode: string
  question: string          // "Who wins Best Picture?"
  options: string[]         // ["Oppenheimer", "Barbie", ...]
  status: string            // "pending" | "open" | "locked" | "resolved"
  openedAt: timestamp | null
  lockedAt: timestamp | null
  resolvedAt: timestamp | null
  winningOption: string | null
  timerDuration: number    // seconds, default 60
}
```

**UserBet:**
```typescript
{
  userId: string
  betId: string
  roomCode: string
  selectedOption: string
  placedAt: timestamp
  pointsWon: number | null  // calculated on resolution
}
```

**TranscriptEntry:**
```typescript
{
  entryId: string
  roomCode: string
  text: string              // Raw transcript text
  timestamp: timestamp
  source: string            // "youtube" | "manual" | "webhook" | etc.
}
```

**EventTemplate:**
```typescript
{
  templateId: string        // "grammys-2026" | "oscars-2026" | "superbowl-lix"
  name: string
  bets: Bet[]
  triggerConfig: {
    openPatterns: string[]   // Regex patterns to detect bet opening
    resolvePatterns: string[] // Patterns to detect winner announcement
  }
}
```

### Automated Transcript Ingestion Architecture

**Core automation flow:**
1. Transcript source (YouTube, manual feed, scraper, etc.) sends text to webhook
2. Transcript ingestion service stores entry in Firestore
3. Bet trigger engine monitors new transcript entries
4. When trigger pattern matches, system opens next pending bet
5. When winner pattern matches, system extracts winner and resolves bet
6. All users' devices update in real-time via Firestore listeners

**Component breakdown:**

**1. Transcript Ingestion API (Cloud Function)**
- Endpoint: `POST /api/transcript`
- Payload: `{ roomCode, text, source? }`
- Stores transcript entry in Firestore `/transcripts/{roomCode}/{entryId}`
- Rate limiting: max 10 entries/second per room
- Auth: Simple API key or room-specific token

**2. Bet Trigger Engine (Cloud Function)**
- Firestore trigger: watches `/transcripts/{roomCode}/{entryId}`
- On new entry:
  - Check if room has pending bets
  - Match transcript text against next bet's open triggers
  - If match found and confidence > 80%, open next bet
  - Log trigger decision for debugging
- Fuzzy matching: handles typos, variations ("Best Picture" vs "best motion picture")

**3. Winner Extraction Engine (Cloud Function)**
- Firestore trigger: watches `/transcripts/{roomCode}/{entryId}` when bet is open/locked
- On new entry:
  - Match transcript text against resolve patterns
  - Extract winner name/option from text
  - Fuzzy match against current bet's options
  - If confident match (> 85%), auto-resolve bet
  - If uncertain, flag for admin review

**4. Admin Override Interface**
- Real-time view of transcript stream
- See trigger confidence scores
- Manual "Open Next Bet" button (bypasses automation)
- Manual "Resolve Bet" selector (overrides auto-detection)
- "Pause Automation" toggle (for troubleshooting)

**Trigger configuration example (Grammy Awards 2026):**
```json
{
  "templateId": "grammys-2026",
  "name": "Grammy Awards 2026",
  "bets": [
    {
      "betId": "album-of-year",
      "question": "Album of the Year?",
      "options": [
        "The Tortured Poets Department - Taylor Swift",
        "Cowboy Carter - Beyoncé",
        "Short n' Sweet - Sabrina Carpenter",
        "Hit Me Hard and Soft - Billie Eilish"
      ],
      "triggerConfig": {
        "open": [
          "album of the year",
          "next.*category.*album",
          "nominees.*album of the year"
        ],
        "resolve": [
          "grammy goes to",
          "and the winner is",
          "congratulations to"
        ]
      },
      "timerDuration": 60
    }
  ]
}
```

**Transcript sources (pluggable):**

**Option A: YouTube Live Captions**
- Separate service polls YouTube Data API
- Fetches auto-generated captions every 2-3 seconds
- Sends new text to transcript webhook
- Pros: Free, works for any YouTube stream, decent accuracy
- Cons: 2-10 second lag, occasional misspellings

**Option B: Manual Live Feed UI**
- Admin opens `/transcript-feed/{roomCode}` in separate browser
- Types key moments as they happen ("Now: Album of Year", "Winner: Beyoncé")
- Instantly POSTs to webhook
- Pros: 100% accurate, zero lag, works for any event
- Cons: Requires human operator, manual effort

**Option C: Generic Webhook (3rd party sources)**
- Provide webhook URL to any transcript service
- Web scrapers, sports APIs, custom integrations can POST
- Standardized JSON format
- Pros: Maximum flexibility, future-proof
- Cons: Need to build/find source per event type

**MVP implementation priority:**
1. Build generic webhook API first
2. Build manual live feed UI (guaranteed to work for Grammy Awards)
3. Add YouTube Live captions integration (nice-to-have for events that stream there)
4. Web scraping as last resort (too brittle for MVP)

### Event Templates

**Grammy Awards 2026 (Feb 2, 2026):**
- Major categories: Album/Record/Song of Year, Best New Artist
- Genre categories: Pop, Rock, R&B, Rap, Country
- Trigger keywords configured per category
- First live test event for automation
- ~12-15 bets total

**Oscars 2026 (March 2026):**
- Pre-loaded with major categories (Picture, Director, Actor, Actress, etc.)
- Nominees TBD (need to update when announced in January)
- ~15-20 bets total

**Super Bowl LIX (Feb 9, 2026):**
- Pre-game: Coin toss, first score type, will there be a safety?
- In-game: Halftime score, final score ranges, MVP
- Fun bets: Gatorade color, how long is national anthem, first commercial
- ~10-15 bets total

**Custom Template:**
- Blank slate - admin adds questions and options on the fly
- Useful for any event (Emmys, March Madness, debates, etc.)

### Scoring System (MVP)

**Fixed-point betting:**
- All users start with 1000 points
- Each bet costs 100 points (auto-deducted when bet opens)
- Winners split the pot evenly
  - Formula: `pointsWon = (totalPot / numberOfWinners)`
  - Example: 5 players, 3 pick correctly → 500 points / 3 = ~167 points each
- If everyone picks same answer: no points change (refund)
- Leaderboard sorted by total points, tiebreaker by join time

### Real-time Sync Strategy

**Firebase Realtime Database:**
- Clients subscribe to `/rooms/{roomCode}` for room status
- Clients subscribe to `/bets/{roomCode}/{betId}` for active bet
- Clients subscribe to `/leaderboard/{roomCode}` for live scores
- Admin actions trigger Cloud Functions that update data
- All clients reactively update UI

**Optimistic UI updates:**
- When user places bet, show immediately (don't wait for server)
- If server rejects (too late, already locked), show error and revert

### Admin Interface

**Admin view (separate URL or tab):**
- `/admin/{roomCode}` - requires admin auth (simple password or token)
- Shows participant list with current points

**Automation Control Panel:**
- **Automation Status**: ON/OFF toggle, current mode (auto/manual)
- **Live Transcript Feed**: Real-time view of incoming transcript entries with timestamps
- **Trigger Confidence**: Shows last 5 trigger attempts with confidence scores
- **Manual Override**:
  - "Open Next Bet" button (bypasses automation, highlights next pending bet)
  - "Resolve Bet" dropdown (select winning option manually)
  - "Pause Automation" toggle (stop auto-triggers, go full manual)

**Event Management:**
- List of all bets in event (collapsible)
  - Shows status: pending/open/locked/resolved
  - Edit trigger keywords per bet
  - Skip/delete bet if needed
- "Add Custom Bet" - quick form for adhoc questions (for custom events)

**Monitoring:**
- Real-time view of who's betting what
- Transcript source status (connected/disconnected)
- Last transcript update timestamp
- Auto-resolution success rate

### Mobile UI/UX Priorities

**Player view:**
- **Waiting state**: Room code (large), participant list, "Waiting to start"
- **Active bet**:
  - Question at top (large, readable)
  - Countdown timer (prominent, anxiety-inducing)
  - Options as large tappable cards
  - Minimize chrome (no nav, no header clutter)
- **Locked state**: "Betting closed - waiting for result"
- **Resolution state**:
  - Show correct answer (big)
  - "+167 points!" or "0 points" (animated)
  - Brief leaderboard (top 3 + you)
  - Auto-advance to next bet after 5 seconds
- **Final state**: Full leaderboard, winner confetti

**Design principles:**
- One-handed thumb use
- High contrast (readable in dark room)
- Big touch targets (min 44x44pt)
- Minimal scrolling
- Fast transitions

## Success Metrics (Post-MVP)

- **Engagement**: Average bets placed per user per session
- **Retention**: Users who return for second event
- **Virality**: Average room size (indicates sharing)
- **Performance**: < 1s latency for bet state changes

## Future Enhancements (v2+)

1. **Advanced NLP for winner extraction**: Use LLMs (Claude API) for better parsing of complex announcements
2. **User accounts**: Save stats across sessions, track win rate, cross-session leaderboards
3. **Chat**: Quick reactions, trash talk, emoji reactions
4. **Custom scoring**: Variable bet amounts, odds-based multipliers, dynamic odds
5. **Push notifications**: "Bet closing in 10 seconds!", "You won!", "Event starting"
6. **More event templates**: Emmys, March Madness, political debates, reality TV
7. **Spectator mode**: Join just to watch, don't bet
8. **Social features**: Share results to Twitter, bet history badges, achievements
9. **Analytics dashboard**: Most popular bets, accuracy rates, user engagement metrics
10. **Real money** (long-term): Requires legal compliance, payment processing, licensing

## Open Questions / Decisions Needed

1. **Room code generation**: Memorable words (e.g., "BLUE42") vs pure random (e.g., "X7K9")?
2. **Room expiration**: Auto-delete after 24 hours? Keep forever?
3. **Max room size**: Cap at 50 users for performance?
4. **Tie-breakers**: If two users end with same points, who wins?
5. **Edge cases**: What if admin disconnects mid-event? Auto-promote new admin?

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-3)
1. Set up Firebase project (Firestore, Functions, Hosting)
2. Create basic React app with routing
3. Implement room creation + joining flow (room codes, nickname auth)
4. Build real-time sync with Firestore listeners
5. Basic data model implementation

### Phase 2: Player Experience (Days 4-6)
6. Create player bet UI (mobile-first)
7. Implement countdown timer
8. Build leaderboard component
9. Add bet placement logic
10. Result/celebration animations

### Phase 3: Automation Engine (Days 7-10)
11. Build transcript ingestion webhook API
12. Implement bet trigger engine (keyword matching)
13. Build winner extraction engine (fuzzy matching)
14. Create manual live feed UI (for Grammy Awards)
15. Add YouTube Live captions integration (optional)

### Phase 4: Admin Controls (Days 11-12)
16. Build admin control panel
17. Automation monitoring dashboard
18. Manual override controls
19. Event template management

### Phase 5: Event Templates & Testing (Days 13-14)
20. Add Grammy Awards 2026 template with trigger config
21. Add Oscars 2026 + Super Bowl LIX templates
22. Implement scoring logic (Cloud Functions)
23. Test with simulated transcript feed
24. Load testing (20+ concurrent users)
25. Deploy to Firebase Hosting at smallbets.live

### Pre-Grammy Validation (Jan 31 - Feb 1, 2026)
- Final end-to-end testing
- Update Grammy nominees if announcements change
- Test manual live feed UI workflow
- Dry run with friends (simulated event)

---

**Target MVP delivery**: 2 weeks from start (Feb 14, 2026)
**First live test**: Grammy Awards 2026 (Feb 2, 2026)
**Note**: Grammy Awards is in 2 days - if we want to test with it, we need rapid MVP (basic automation + manual fallback)
