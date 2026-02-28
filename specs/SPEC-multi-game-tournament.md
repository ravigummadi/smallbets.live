# SmallBets.live - Multi-Event Tournament Specification (IPL 2026)

## Executive Summary

Adapt SmallBets.live from single-event ceremonies (Oscars, Grammys) to support multi-room tournament betting for IPL 2026 (starts end of March 2026).

## Context: Current vs IPL Requirements

### Current System (Ceremonies)
- Single room per event
- Pre-loaded sequential bets from template
- Linear flow: waiting → active → finished
- Admin opens/resolves bets in order
- 24-hour room expiry

### IPL Requirements (Based on User Input)
- **Two room types**: Tournament room + Match rooms
- **Room linking**: Match rooms connect to parent tournament room
- **Dynamic bet creation**: Host creates bets on-the-fly during match
- **Both bet types**: Pre-match + in-game + tournament-level
- **Manual management**: Host creates bets (templates + custom), manually resolves
- **Flexible duration**: Manual room closure (no auto-expiry for tournament/match rooms)
- **Remote viewing**: WhatsApp-coordinated watching with friends

## User Workflow

### Phase 1: Season Setup (Once at IPL start)
1. **First-time guided flow**:
   - Landing page shows "Create Tournament" prominently
   - Modal: "Welcome to IPL 2026! Let's set up your season room..."
   - Step-by-step: Name → Select teams → Place first bet
2. Host creates "IPL 2026 Tournament Room"
   - Selects "IPL 2026" template
   - Pre-loaded with tournament-level bets:
     - Tournament winner (10 teams)
     - Orange Cap (top run scorer)
     - Purple Cap (top wicket taker)
     - Most sixes
     - Best bowling figures
3. Gets tournament code (e.g., "BLU42X" - **6 chars exactly**)
4. Shares code via WhatsApp to friend group
5. Friends join tournament room
6. All place bets on season-long questions
7. Tournament room stays open entire season (manual close only)
8. **Room context chip always visible**: "Tournament: IPL 2026"

### Phase 2: Match Day (Repeated for each match)
1. Host opens app, clicks "Create Match Room" from tournament dashboard
   - **Guided flow**: "Watching a match? Create a match room from your tournament"
   - Fills in: Match details (RCB vs MI, Mar 23 2026 19:30 IST)
   - Auto-links to tournament room BLU42X
2. Gets match room code (e.g., "XY7KM2" - **6 chars**)
3. Shares match code with friends
4. Friends join match room (can navigate to/from tournament room easily)
5. **Room context chips**: "Tournament: IPL 2026 > Match: RCB vs MI"
6. **Pre-match betting** (before first ball):
   - Host creates bets using templates: "Toss winner", "Match winner", "Top scorer"
   - Friends place bets (60s timer per bet)
7. **Live match betting** (during game):
   - Host creates bets dynamically:
     - Quick templates: "Next wicket method", "Runs in this over", "Boundary in next 3 balls"
     - Custom: "Will Virat hit a six this over?"
   - Host opens bet → 30-60 second timer → betting locks
   - Host watches cricbuzz/TV, manually resolves bet
   - **Undo window**: 10-second grace period to undo accidental resolve
   - Points update instantly for all users
8. **Post-match**:
   - Final leaderboard shown
   - Host manually closes match room
   - Match room remains linked to tournament for history

### Phase 3: End of Season
1. IPL finals complete
2. Host manually resolves tournament-level bets
3. Final tournament leaderboard crowned (aggregated from all matches)
4. Host manually closes tournament room

## MVP Decisions (Resolved Open Questions)

### 1. Tournament Leaderboard (DECIDED)
**Decision**: Tournament room shows **aggregated points** from all linked match rooms

**Implementation**:
- Each match room maintains local leaderboard via room-scoped user documents
- Tournament room queries all child room memberships
- On match room close/bet resolution: Cloud Function updates tournament aggregate incrementally
- Event-driven updates (not recalculate-on-demand) for performance
- Query: `roomUsers.where('roomCode', 'in', childRoomCodesBatch)` - batch 10 rooms per query, merge results
- For 74 match rooms: 8 queries (10+10+10+10+10+10+10+4), merge on server, < 200ms total
- Firestore composite index: `(roomCode, userId, points)` in **roomUsers** collection

### 2. Bet Limits (DECIDED)
**Decision**:
- **50 bets max per match room** (prevents spam, reasonable for 3-hour game)
- **20 tournament bets max** (season-long questions only)
- **1 open bet at a time per room** (simplifies UX, prevents confusion)
**Enforcement**: Backend validation in `create_bet` endpoint, Firestore security rules

### 3. Visibility (DECIDED)
**Decision**: **Participants only for MVP** - no spectator mode
- Can only view/bet if joined room (part of `room.participants` array)
- Post-MVP: Add read-only spectator mode
**Enforcement**: Firestore rules check `userId in room.participants` for ALL room/bet reads

### 4. Room Code Format (DECIDED)
**Decision**: **6-character codes** with checksum pattern
- Alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (30 chars, no O/0/I/1/L)
- Format: `XXXXXY` where Y is checksum of first 5 chars (mod 30)
- Collision space: 30^5 = **24.3 million** valid codes
- Join throttling: Max 10 attempts per IP per minute
- Failed-attempt lockout: Block IP after 20 failed attempts in 5 minutes
**Implementation**: `generate_room_code_v2()` with checksum validation

## Data Model Changes

### Existing Models (Keep as-is)
- EventTemplate (for templates)
- UserBet (bet selection and results)

### New/Modified Models

#### Room (Modified)
```typescript
{
  roomCode: string              // "BLU42X" (6 chars with checksum)
  roomType: "tournament" | "match" | "event"  // Type distinction
  eventTemplate: string         // "ipl-2026" | "oscars-2026" | etc
  status: "waiting" | "active" | "finished"
  currentBetId: string | null
  hostId: string                // Verified Firebase Auth UID (NOT from client header)
  participants: string[]        // Array of user IDs (for visibility enforcement)

  // Room linking (SINGLE SOURCE OF TRUTH)
  parentRoomCode: string | null    // Match rooms link to tournament
  // childRoomCodes: REMOVED - derive via Firestore query

  // Match metadata (for match rooms only)
  matchDetails: {
    team1: string                  // "RCB"
    team2: string                  // "MI"
    matchDateTime: string          // ISO 8601 with timezone: "2026-03-23T19:30:00+05:30"
    venue?: string
  } | null

  // Room lifecycle
  automationEnabled: boolean
  createdAt: timestamp           // ISO 8601
  expiresAt: timestamp | null    // NULL for tournament/match, set for event (preserves ceremony 24h expiry)

  // Versioning for optimistic locking
  version: number                // Increment on every update, prevent race conditions
}
```

**Migration Strategy**:
1. Existing rooms: Set `roomType: "event"`, preserve existing `expiresAt` value, add `participants: []`
2. New tournament/match rooms: Set `expiresAt: null`, populate `participants` on join
3. Add `version: 1` to all rooms, increment on updates

**Firestore Indexes**:
- Composite: `(parentRoomCode, status)` - fetch active child rooms
- Single: `roomType` - filter by type
- Single: `version` - optimistic locking checks

#### NEW: RoomUser (Room-Scoped User Membership)
**Collection**: `roomUsers` (root-level, not subcollection)
**Document ID**: `{roomCode}_{userId}` (composite key)

```typescript
{
  id: string                    // "{roomCode}_{userId}" e.g. "BLU42X_uid123"
  roomCode: string              // "BLU42X"
  userId: string                // Firebase Auth UID
  nickname: string              // Display name
  points: number                // Starts at 1000 per room
  joinedAt: timestamp
  isHost: boolean               // Derived from room.hostId == userId
}
```

**Why this model**:
- One user can have separate scores across multiple rooms
- Queryable by `roomCode` for leaderboard
- Queryable by `roomCode` + `userId` for aggregation
- Firestore security rules can protect points field (read-only for clients)
- Scales to 74+ rooms per user
- **CORRECTED**: Document ID enforces canonical shape (prevents forgery)

**Firestore Indexes**:
- Composite: `(roomCode, points desc)` - leaderboard query
- Composite: `(roomCode, userId, points)` - aggregation query

#### Bet (Modified)
```typescript
{
  betId: string
  roomCode: string
  question: string
  options: string[]
  status: "pending" | "open" | "locked" | "resolved"

  // Bet categorization
  betType: "pre-match" | "in-game" | "tournament"

  // Template vs custom
  createdFrom: "template" | "custom"
  templateId: string | null        // "toss-winner", "next-wicket", etc

  openedAt: timestamp | null       // ISO 8601
  lockedAt: timestamp | null
  resolvedAt: timestamp | null
  winningOption: string | null
  timerDuration: number            // Default: 60s for match, 120s for tournament
  pointsValue: number              // Default: 100
  resolvePatterns: string[] | null

  // Undo grace period
  canUndoUntil: timestamp | null   // 10 seconds after resolution

  // Versioning for optimistic locking
  version: number
}
```

**Bet State Machine (with undo transition)**:
```
pending → open → locked → resolved
                    ↑_________|  (undo within 10 seconds)
```

#### NEW: BetTemplate
```typescript
{
  templateId: string               // "toss-winner", "next-wicket"
  category: "cricket-pre" | "cricket-live" | "cricket-tournament"
  name: string                     // "Toss Winner"
  questionTemplate: string         // "Who wins the toss?"
  optionsTemplate: string[]        // ["Team 1", "Team 2"] (variables replaced)
  defaultTimer: number             // 30 seconds
  defaultPoints: number            // 100
}
```

#### NEW: IdempotencyLock (Atomic Idempotency)
**Collection**: `idempotencyLocks`
**Document ID**: `{userId}_{operation}_{idempotencyKey}` (**CORRECTED**: scoped to user + operation)

```typescript
{
  lockId: string                // "{userId}_{operation}_{key}"
  userId: string                // User who created the lock
  operation: string             // "create_room" | "create_bet"
  createdAt: timestamp          // Lock creation time
  expiresAt: timestamp          // 24 hours from creation
  resultRoomCode: string        // Room code created (for return on retry)
}
```

**Why this model (CORRECTED)**:
- **CORRECTED**: Lock ID scoped to user + operation prevents cross-user cache pollution
- Transactional `create` on lock document prevents race conditions
- If lock doc already exists, validate userId matches before returning cached result
- Firestore guarantees uniqueness of document ID

## Architecture Impact Analysis

### FCIS Compliance
**Current**: Pure game logic (scoring, validation) in `game_logic.py`, I/O in `main.py`

**IPL Impact**:
- ✅ **Scoring logic**: No change - still pure functions
- ✅ **Bet validation**: Extend to check bet type, limits, concurrency (pure)
- ✅ **Room linking**: Pure data transformation (add parent ref)
- ✅ **Aggregation**: Pure function `aggregate_tournament_points(child_room_users)` (no I/O)
- ✅ **Dynamic bet creation**: New API endpoint, but delegates to service (still FCIS compliant)

**Verdict**: No FCIS violations. All business logic remains pure, I/O in shell.

### Module Depth
**Current Deep Modules**:
- `game_logic.py`: Scoring, validation (DEEP ✓)
- `transcript_parser.py`: Winner extraction (DEEP ✓)

**New Modules**:
- `bet_template_service.py`: Template instantiation (MEDIUM - simple interface, template logic hidden)
- `room_linking_service.py`: Parent-child query abstraction (SHALLOW - just Firestore read wrapper)
- `tournament_aggregation.py`: Points aggregation logic (DEEP - hides complexity of cross-room calculations + batching)

**Verdict**: Maintains depth guidelines. Core tournament logic is deep, linking service is appropriately shallow.

### Change Amplification
**Test**: How many files change to add new bet template?

**Current (Ceremony)**: 1 file (template JSON)
**IPL**: 1-2 files (template JSON + optional Python template model)

**Target**: < 3/10 ✓

**Verdict**: Low change amplification. Templates are data-driven.

### Cognitive Load
**Test**: Can developer understand bet creation flow without reading entire codebase?

**Mitigation**:
- Clear separation: `bet_creation_service.py` handles all bet creation logic
- Room linking isolated in `room_linking_service.py`
- UI components follow existing patterns
- State machine diagram in docs (pending → open → locked → resolved, with undo)

**Target**: < 5/10 (acceptable with documentation)

**Verdict**: Acceptable. Will add state machine diagram to docs.

### Performance Constraints & Validation Plan

**Hot Paths with Concrete Query Plans**:

1. **Bet state sync** (< 500ms to all clients):
   - Query: Firestore listener on `/bets/{betId}`
   - Index: Built-in (document ID)
   - Payload limit: 1 bet document (~2KB)
   - Test: 50 concurrent clients, verify < 500ms 95th percentile

2. **Timer countdown** (60fps):
   - Client-side only, no server calls
   - Test: Chrome DevTools Performance tab, verify no jank

3. **Leaderboard update** (< 100ms):
   - Query: Firestore read `roomUsers?roomCode={code}&orderBy=points:desc`
   - Index: Composite `(roomCode, points desc)`
   - Pagination: 50 users per page
   - Test: 100 users, verify < 100ms query time

4. **Room linking query** (< 100ms):
   - Query: `rooms.where('parentRoomCode', '==', tournamentCode).orderBy('matchDetails.matchDateTime')`
   - Index: Composite `(parentRoomCode, matchDetails.matchDateTime)`
   - Pagination: 20 matches per page
   - Test: 74 match rooms, verify < 100ms

5. **Tournament aggregation** (< 200ms):
   - Query: `roomUsers.where('roomCode', 'in', batch).where('userId', '==', uid)` - batch 10 rooms per query
   - **Batching logic**: For 74 child rooms, split into 8 queries (10+10+10+10+10+10+10+4)
   - **Merge**: Server-side sum of points across all batches
   - Index: Composite `(roomCode, userId, points)` in **roomUsers** collection
   - Test: 74 match rooms, 50 users, verify < 200ms total (8 queries * 25ms each)

**Firestore Index Definitions** (to be added to `firestore.indexes.json`):
```json
{
  "indexes": [
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "parentRoomCode", "order": "ASCENDING"},
        {"fieldPath": "matchDetails.matchDateTime", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "parentRoomCode", "order": "ASCENDING"},
        {"fieldPath": "roomType", "order": "ASCENDING"}
      ]
    },
    {
      "collectionGroup": "roomUsers",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "roomCode", "order": "ASCENDING"},
        {"fieldPath": "points", "order": "DESCENDING"}
      ]
    },
    {
      "collectionGroup": "roomUsers",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "roomCode", "order": "ASCENDING"},
        {"fieldPath": "userId", "order": "ASCENDING"},
        {"fieldPath": "points", "order": "DESCENDING"}
      ]
    }
  ]
}
```

**Test Dataset Sizes**:
- 1 tournament room
- 74 match rooms (full IPL season)
- 50 users per match room (worst case)
- 50 bets per match room (max limit)
- **Total**: ~3700 bets, 50 distinct users (same users across rooms), 75 rooms

## Security Model (Comprehensive - FINAL)

### Firestore Security Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isHost(roomCode) {
      // hostId verified from Firebase Auth (not client header)
      return request.auth != null &&
             get(/databases/$(database)/documents/rooms/$(roomCode)).data.hostId == request.auth.uid;
    }

    function isParticipant(roomCode) {
      return request.auth != null &&
             request.auth.uid in get(/databases/$(database)/documents/rooms/$(roomCode)).data.participants;
    }

    function isValidRoomType() {
      return request.resource.data.roomType in ['tournament', 'match', 'event'];
    }

    function isValidBetTransition(prevStatus, newStatus) {
      // Includes undo transition (resolved -> locked)
      return (prevStatus == 'pending' && newStatus == 'open') ||
             (prevStatus == 'open' && newStatus == 'locked') ||
             (prevStatus == 'locked' && newStatus == 'resolved') ||
             (prevStatus == 'resolved' && newStatus == 'locked');  // UNDO
    }

    // Rooms collection
    match /rooms/{roomCode} {
      // Participants-only reads
      allow read: if isParticipant(roomCode) || isHost(roomCode);

      // CORRECTED: Only authenticated users can create rooms
      // - Match rooms: parent REQUIRED, must exist, caller must be tournament host/participant
      // - Non-match rooms: parent FORBIDDEN (prevents forged child rooms)
      // - All rooms: hostId must match verified auth UID
      allow create: if request.auth != null &&
                       isValidRoomType() &&
                       request.resource.data.hostId == request.auth.uid &&  // VERIFIED
                       request.resource.data.version == 1 &&
                       // CORRECTED: Match rooms MUST have valid parent + authorization
                       (request.resource.data.roomType == 'match' ?
                        (request.resource.data.parentRoomCode != null &&
                         exists(/databases/$(database)/documents/rooms/$(request.resource.data.parentRoomCode)) &&
                         get(/databases/$(database)/documents/rooms/$(request.resource.data.parentRoomCode)).data.roomType == 'tournament' &&
                         (request.auth.uid == get(/databases/$(database)/documents/rooms/$(request.resource.data.parentRoomCode)).data.hostId ||
                          request.auth.uid in get(/databases/$(database)/documents/rooms/$(request.resource.data.parentRoomCode)).data.participants))
                        :
                        // CORRECTED: Non-match rooms MUST NOT have parent (prevents bypass)
                        (!request.resource.data.keys().hasAny(['parentRoomCode']) ||
                         request.resource.data.parentRoomCode == null));

      // Only host can update room
      allow update: if isHost(roomCode) &&
                       // Prevent changing immutable fields
                       request.resource.data.roomCode == resource.data.roomCode &&
                       request.resource.data.hostId == resource.data.hostId &&
                       request.resource.data.parentRoomCode == resource.data.parentRoomCode &&
                       // Optimistic locking check
                       request.resource.data.version == resource.data.version + 1;

      // Only host can delete room
      allow delete: if isHost(roomCode);
    }

    // Bets collection
    match /bets/{betId} {
      // Participants-only reads
      allow read: if isParticipant(resource.data.roomCode) || isHost(resource.data.roomCode);

      // Only host can create bets
      allow create: if isHost(request.resource.data.roomCode) &&
                       request.resource.data.status == 'pending' &&
                       request.resource.data.version == 1;

      // CORRECTED: Only host can update bets (includes undo + immutable fields)
      allow update: if isHost(resource.data.roomCode) &&
                       isValidBetTransition(resource.data.status, request.resource.data.status) &&
                       // Prevent changing resolved bets (unless within undo window)
                       (resource.data.status != 'resolved' ||
                        request.time < resource.data.canUndoUntil) &&
                       // CORRECTED: Immutable fields cannot change
                       request.resource.data.roomCode == resource.data.roomCode &&
                       request.resource.data.question == resource.data.question &&
                       request.resource.data.options == resource.data.options &&
                       request.resource.data.pointsValue == resource.data.pointsValue &&
                       request.resource.data.betType == resource.data.betType &&
                       // Optimistic locking
                       request.resource.data.version == resource.data.version + 1;

      // No client-side bet deletion
      allow delete: if false;
    }

    // UserBets collection
    match /userBets/{userBetId} {
      // Users can read their own bets
      allow read: if request.auth != null &&
                     resource.data.userId == request.auth.uid;

      // Users can create their own bets (only when bet is open)
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid &&
                       isParticipant(request.resource.data.roomCode) &&
                       // Verify bet is open (must read bet document)
                       get(/databases/$(database)/documents/bets/$(request.resource.data.betId)).data.status == 'open';

      // No updates or deletes
      allow update: if false;
      allow delete: if false;
    }

    // RoomUsers collection (CORRECTED - prevents forgery)
    match /roomUsers/{roomUserId} {
      // Only participants can read roomUsers in their room
      allow read: if isParticipant(resource.data.roomCode) || isHost(resource.data.roomCode);

      // CORRECTED: Users can create membership ONLY if:
      // 1. They are authenticated
      // 2. userId matches auth UID
      // 3. Document ID matches canonical pattern {roomCode}_{userId}
      // 4. They are a participant in the room
      // 5. Points start at 1000
      // 6. isHost matches actual room host
      allow create: if request.auth != null &&
                       request.resource.data.userId == request.auth.uid &&
                       // CORRECTED: Enforce canonical doc ID (prevents forgery)
                       roomUserId == request.resource.data.roomCode + '_' + request.auth.uid &&
                       // CORRECTED: Must be participant in room (prevents joining arbitrary rooms)
                       isParticipant(request.resource.data.roomCode) &&
                       // Points must start at 1000 (cannot be set by client)
                       request.resource.data.points == 1000 &&
                       // CORRECTED: Validate isHost matches actual room host (prevents self-marking)
                       request.resource.data.isHost == (request.auth.uid == get(/databases/$(database)/documents/rooms/$(request.resource.data.roomCode)).data.hostId);

      // Users can ONLY update nickname (NOT points)
      allow update: if request.auth != null &&
                       resource.data.userId == request.auth.uid &&
                       // Only nickname can change
                       request.resource.data.userId == resource.data.userId &&
                       request.resource.data.roomCode == resource.data.roomCode &&
                       request.resource.data.points == resource.data.points &&  // IMMUTABLE
                       request.resource.data.joinedAt == resource.data.joinedAt &&
                       request.resource.data.isHost == resource.data.isHost;

      allow delete: if false;
    }

    // IdempotencyLocks collection (server-only)
    match /idempotencyLocks/{lockId} {
      // No client reads
      allow read: if false;

      // Server creates locks (clients cannot write)
      allow create: if false;
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

### Backend Authorization Checks

**All endpoints enforce**:
- Firebase Auth token verification (NOT client header) - extract `request.auth.uid` from verified token
- Room existence and type checks
- State machine validation (prevent invalid transitions, allow undo)
- Rate limiting (10 req/sec per IP for write endpoints)
- Idempotency via scoped transactional lock creation

**Auth Flow**:
```python
from firebase_admin import auth

async def verify_user(id_token: str) -> str:
    """Verify Firebase ID token and return UID"""
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        raise HTTPException(401, "Invalid auth token")

@app.post("/api/rooms")
async def create_room(
    room_type: str,
    parent_room_code: str | None,
    idempotency_key: str,
    authorization: str = Header()  # "Bearer <token>"
):
    # Extract and verify token
    token = authorization.replace("Bearer ", "")
    host_uid = await verify_user(token)  # Verified UID from Firebase

    # host_uid is now trusted - use it for room.hostId
    ...
```

### Rate Limiting & Abuse Prevention

- **Room creation**: 5 rooms per user per day
- **Bet creation**: 50 bets per room (enforced in backend)
- **Join attempts**: 10 per IP per minute, 20 failures = 5-minute lockout
- **Bet placement**: No limit (users want to bet fast during live match)

## Transactional Guarantees (FINAL)

### Room Creation with Atomic Idempotency (CORRECTED v2)

**Operation**: Create match room + link to tournament + prevent duplicates + prevent collisions
**CORRECTED Implementation**: Scoped transactional lock + collision-safe room creation

```python
@app.post("/api/rooms")
async def create_room(
    room_type: str,
    parent_room_code: str | None,
    idempotency_key: str,  # Client-generated UUID
    authorization: str = Header()
):
    # 1. Verify Firebase Auth token (not client header)
    token = authorization.replace("Bearer ", "")
    host_uid = await verify_user(token)  # Throws 401 if invalid

    @firestore.transactional
    def create_room_transaction(transaction):
        # 2. CORRECTED: Scoped idempotency lock (user + operation + key)
        lock_id = f"{host_uid}_create_room_{idempotency_key}"
        lock_ref = db.collection('idempotencyLocks').document(lock_id)
        lock_snapshot = lock_ref.get(transaction=transaction)

        # If lock exists, validate user and return cached result
        if lock_snapshot.exists:
            lock_data = lock_snapshot.to_dict()
            # CORRECTED: Validate lock belongs to same user
            if lock_data['userId'] != host_uid:
                raise HTTPException(403, "Idempotency key belongs to different user")

            cached_room_code = lock_data['resultRoomCode']
            room_ref = db.collection('rooms').document(cached_room_code)
            return room_ref.get().to_dict()

        # 3. CORRECTED: Validate parent for match rooms (REQUIRED)
        # Match rooms MUST have a parent tournament and caller must be authorized
        if room_type == 'match':
            if not parent_room_code:
                raise HTTPException(400, "Match rooms require a parent tournament")

            parent_ref = db.collection('rooms').document(parent_room_code)
            parent = parent_ref.get(transaction=transaction)
            if not parent.exists or parent.get('roomType') != 'tournament':
                raise HTTPException(400, "Invalid parent room - must be a tournament")

            # CORRECTED: Check authorization (must be tournament host or participant)
            parent_data = parent.to_dict()
            if host_uid != parent_data['hostId'] and host_uid not in parent_data.get('participants', []):
                raise HTTPException(403, "Not authorized to create match rooms for this tournament")

        # For tournament/event rooms, parent_room_code should be None
        elif parent_room_code:
            raise HTTPException(400, f"{room_type} rooms cannot have a parent")

        # 4. CORRECTED: Generate room code with collision retry
        max_retries = 5
        room_code = None
        for attempt in range(max_retries):
            candidate_code = generate_room_code_v2()
            room_ref = db.collection('rooms').document(candidate_code)
            room_snapshot = room_ref.get(transaction=transaction)
            if not room_snapshot.exists:
                room_code = candidate_code
                break

        if not room_code:
            raise HTTPException(500, "Failed to generate unique room code after 5 attempts")

        # 5. Create idempotency lock (prevents concurrent duplicates)
        transaction.create(lock_ref, {
            'lockId': lock_id,
            'userId': host_uid,  # CORRECTED: Store user ID for validation
            'operation': 'create_room',
            'createdAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': datetime.utcnow() + timedelta(hours=24),
            'resultRoomCode': room_code
        })

        # 6. CORRECTED: Create room document with collision guard
        room_ref = db.collection('rooms').document(room_code)
        room_data = {
            'roomCode': room_code,
            'roomType': room_type,
            'parentRoomCode': parent_room_code,
            'hostId': host_uid,  # Verified UID from Firebase Auth
            'status': 'waiting',
            'participants': [host_uid],  # Host auto-joins
            'createdAt': firestore.SERVER_TIMESTAMP,
            'expiresAt': None if room_type in ['tournament', 'match'] else datetime.utcnow() + timedelta(hours=24),
            'version': 1
        }
        # CORRECTED: Use create (not set) to fail on collision
        transaction.create(room_ref, room_data)

        # 7. CORRECTED: Create host's roomUsers document with SERVER-DERIVED isHost
        # Host auto-joins, so create membership document immediately
        room_user_id = f"{room_code}_{host_uid}"
        room_user_ref = db.collection('roomUsers').document(room_user_id)
        room_user_data = {
            'roomCode': room_code,
            'userId': host_uid,
            'nickname': 'Host',  # Default nickname, can be updated later
            'points': 1000,
            'isHost': True,  # CORRECTED: Server-derived (host_uid == room_data['hostId'])
            'joinedAt': firestore.SERVER_TIMESTAMP,
            'participant': True
        }
        transaction.create(room_user_ref, room_user_data)

        return room_data

    # CORRECTED: Execute transaction with retry for commit-time create conflicts
    # The inner loop (lines 642-648) handles pre-read collisions
    # This outer loop handles commit-time collisions (race between read and commit)
    max_transaction_retries = 3
    for tx_attempt in range(max_transaction_retries):
        try:
            result = create_room_transaction(firestore.transaction())
            return JSONResponse(status_code=201, content=result)
        except AlreadyExists:
            # Room code collision at commit time - retry with new transaction
            if tx_attempt == max_transaction_retries - 1:
                raise HTTPException(500, "Room code collision at commit time after 3 transaction attempts - please retry with new idempotency key")
            continue  # Retry entire transaction with new room code
```

**Retry Semantics (CORRECTED)**:
- Client retries with same idempotency key + auth token
- Server creates scoped lock ID: `{userId}_create_room_{key}`
- If lock doc already exists: Validate userId matches, return cached room (idempotent)
- If lock doc doesn't exist: Try up to 5 room codes, use `transaction.create` (fails on collision)
- **Two-level collision handling**:
  - **Inner loop** (lines 642-653): Pre-read collision detection (check before transaction commit)
  - **Outer loop** (lines 688-696): Commit-time collision handling (AlreadyExists exception from transaction.create)
- No race conditions (lock doc uniqueness + room doc create-only + explicit exception handling)
- No cross-user cache pollution (scoped lock ID)
- No room overwrites (create-only)

### User Membership Creation (Join Room)

**Operation**: User joins room + create roomUsers document
**CORRECTED Implementation**: Server-side derivation of isHost (NEVER client-controlled)

**IMPORTANT**: The `isHost` field in `roomUsers` is ALWAYS derived server-side by comparing `request.auth.uid` to `room.hostId`. The server NEVER trusts client input for this field. Admin SDK bypasses Firestore rules, so explicit server-side validation is critical.

```python
@app.post("/api/rooms/{room_code}/join")
async def join_room(
    room_code: str,
    nickname: str,
    authorization: str = Header()
):
    # 1. Verify Firebase Auth token
    token = authorization.replace("Bearer ", "")
    user_uid = await verify_user(token)  # Throws 401 if invalid

    @firestore.transactional
    def join_transaction(transaction):
        # 2. Get room document
        room_ref = db.collection('rooms').document(room_code)
        room = room_ref.get(transaction=transaction)
        if not room.exists:
            raise HTTPException(404, "Room not found")

        room_data = room.to_dict()

        # 3. Add user to room.participants if not already present
        if user_uid not in room_data.get('participants', []):
            transaction.update(room_ref, {
                'participants': firestore.ArrayUnion([user_uid]),
                'version': room_data['version'] + 1
            })

        # 4. CORRECTED: Create roomUsers document with SERVER-DERIVED isHost
        # NEVER trust client input for isHost - derive from room.hostId
        room_user_id = f"{room_code}_{user_uid}"
        room_user_ref = db.collection('roomUsers').document(room_user_id)

        # Check if already joined
        room_user_snapshot = room_user_ref.get(transaction=transaction)
        if room_user_snapshot.exists:
            return room_user_snapshot.to_dict()  # Already joined, idempotent

        # CORRECTED: Server derives isHost (Admin SDK bypasses rules)
        is_host = (user_uid == room_data['hostId'])

        room_user_data = {
            'roomCode': room_code,
            'userId': user_uid,
            'nickname': nickname,
            'points': 1000,  # Starting points
            'isHost': is_host,  # CORRECTED: Server-derived, not client input
            'joinedAt': firestore.SERVER_TIMESTAMP,
            'participant': True
        }

        transaction.create(room_user_ref, room_user_data)
        return room_user_data

    result = join_transaction(firestore.transaction())
    return JSONResponse(status_code=201, content=result)
```

**Server-Side Guarantees**:
- `isHost` is ALWAYS derived: `user_uid == room.hostId`
- Client NEVER provides `isHost` in request body
- Admin SDK writes bypass Firestore rules, so server validation is mandatory
- Firestore rules provide defense-in-depth for direct client writes
- Both room creation and join endpoints derive isHost server-side

### Tournament Aggregation (Batched Queries)

**Operation**: Sum user points across all 74 match rooms
**Implementation**: Batched queries with merge + participant authorization

```python
@app.get("/api/tournaments/{code}/leaderboard")
async def get_tournament_leaderboard(
    code: str,
    authorization: str = Header()
):
    # Verify auth token
    token = authorization.replace("Bearer ", "")
    user_uid = await verify_user(token)

    # CORRECTED: Verify user is participant in tournament (Admin SDK bypasses Firestore rules)
    tournament_ref = db.collection('rooms').document(code)
    tournament = tournament_ref.get()
    if not tournament.exists:
        raise HTTPException(404, "Tournament not found")

    tournament_data = tournament.to_dict()
    if user_uid not in tournament_data.get('participants', []):
        raise HTTPException(403, "Not a participant in this tournament")

    # 1. CORRECTED: Get all child MATCH room codes (filter roomType to prevent forged child rooms)
    child_rooms_query = db.collection('rooms') \
        .where('parentRoomCode', '==', code) \
        .where('roomType', '==', 'match') \
        .get()
    child_room_codes = [room.get('roomCode') for room in child_rooms_query]

    # 2. Batch queries (Firestore `in` limit = 10 per query)
    user_scores = {}  # userId -> total_points
    batch_size = 10

    for i in range(0, len(child_room_codes), batch_size):
        batch = child_room_codes[i:i+batch_size]

        # Query roomUsers for this batch
        room_users_query = db.collection('roomUsers') \
            .where('roomCode', 'in', batch) \
            .get()

        # Aggregate points per user
        for room_user_doc in room_users_query:
            data = room_user_doc.to_dict()
            user_id = data['userId']
            points = data['points']

            if user_id not in user_scores:
                user_scores[user_id] = {'userId': user_id, 'nickname': data['nickname'], 'totalPoints': 0}

            user_scores[user_id]['totalPoints'] += points

    # 3. Sort by total points
    leaderboard = sorted(user_scores.values(), key=lambda x: x['totalPoints'], reverse=True)

    return {"leaderboard": leaderboard, "totalRooms": len(child_room_codes)}
```

**Performance**:
- 74 rooms → 8 queries (10+10+10+10+10+10+10+4)
- Each query ~25ms → 8 * 25ms = **200ms total**
- Server-side merge is instant
- Result: < 200ms aggregation (meets performance target)

## Implementation Phases

### Phase 6: Multi-Room Architecture (Week 1, Days 1-5)
**Goal**: Support tournament + match room structure with linking

### Phase 7: Dynamic Bet Creation (Week 2, Days 6-10)
**Goal**: Host can create bets during live match using templates + custom

### Phase 8: IPL 2026 Template (Week 3, Days 11-15)
**Goal**: Production-ready IPL template with all bet types

### Phase 9: Polish & Deployment (Week 4, Days 16-20)
**Goal**: Production-ready for end of March IPL launch

## Timeline Summary

- **Week 1 (Days 1-5)**: Multi-room architecture + transactions + security + auth + forgery prevention
- **Week 2 (Days 6-10)**: Dynamic bet creation + templates + concurrency + immutability
- **Week 3 (Days 11-15)**: IPL template + comprehensive testing + performance validation
- **Week 4 (Days 16-20)**: Polish + backup/restore + deployment
- **End of March**: IPL 2026 launches, app is live

## Security Validation Summary

This specification has been through 8 rounds of security review, addressing:
- ✅ Data consistency and transactional guarantees
- ✅ Idempotency with scoped locks (no cross-user pollution)
- ✅ Comprehensive Firestore security rules (participants-only, immutable fields)
- ✅ Points tampering prevention (client read-only, server increments)
- ✅ Room collision prevention (transaction.create with retry)
- ✅ roomUsers forgery prevention (canonical doc ID + participant check)
- ✅ Bet field immutability (security rules enforce)
- ✅ Match room authorization (tournament host/participant check in backend + Firestore rules)
- ✅ Server-side isHost derivation (explicit endpoints, never client-controlled)
- ✅ Non-match rooms cannot have parent (Firestore ternary check)
- ✅ Leaderboard filters by roomType (prevents forged child room injection)
- ✅ Tournament leaderboard authorization (participant check before aggregation)

Ready for production implementation.
