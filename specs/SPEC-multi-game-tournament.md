# Multi-Event Tournament Spec (IPL 2026)

Adapt SmallBets.live from single-event ceremonies to multi-room tournament betting for IPL 2026 (starts end of March 2026).

---

# Part 1: Product Requirements

## Current System vs IPL

| | Ceremonies (Current) | IPL (New) |
|---|---|---|
| Rooms | Single room per event | Tournament room + linked match rooms |
| Bets | Pre-loaded from template, sequential | Dynamic creation (templates + custom), on-the-fly |
| Management | Admin opens/resolves in order | Host creates/resolves manually during live match |
| Duration | 24-hour auto-expiry | Manual close (no expiry) |
| Coordination | N/A | WhatsApp-shared room codes |

## User Workflow

### Phase 1: Season Setup (once)
1. Host creates "IPL 2026 Tournament Room" using IPL template
2. Pre-loaded tournament bets: Winner (10 teams), Orange Cap, Purple Cap, Most Sixes, Best Bowling Figures
3. Gets 6-char tournament code (e.g. "BLU42X"), shares via WhatsApp
4. Friends join and place season-long bets
5. Tournament room stays open entire season (manual close only)
6. UI: Room context chip always visible ("Tournament: IPL 2026")
7. First-time guided flow: Landing → "Create Tournament" → Name → Select teams → Place first bet

### Phase 2: Match Day (repeated per match)
1. Host clicks "Create Match Room" from tournament dashboard
   - Guided flow: enters match details (teams, date/time)
   - Auto-links to parent tournament room
2. Gets match code, shares with friends
3. UI: Breadcrumb chips ("Tournament: IPL 2026 > Match: RCB vs MI")
4. **Pre-match**: Host creates bets from templates (Toss winner, Match winner, Top scorer) — 60s timer
5. **Live match**: Host creates bets dynamically
   - Templates: "Next wicket method", "Runs in this over", "Boundary in next 3 balls"
   - Custom: "Will Virat hit a six this over?"
   - 30-60s timer → lock → host resolves manually
   - **10-second undo window** on accidental resolve
   - Points update instantly
6. **Post-match**: Final leaderboard shown, host manually closes room (stays linked for history)

### Phase 3: End of Season
1. Host resolves tournament-level bets after IPL finals
2. Final tournament leaderboard (aggregated from all matches)
3. Host manually closes tournament room

## Product Decisions

**Leaderboard**: Tournament room shows aggregated points from all linked match rooms.

**Bet limits**: 50 per match room, 20 per tournament, 1 open bet at a time per room.

**Visibility**: Participants only (no spectator mode for MVP).

**Room codes**: 6-char, alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (30 chars, no O/0/I/1/L). Format `XXXXXY` where Y = checksum (mod 30). Collision space: 24.3M.

**Bet types**: Pre-match, in-game, tournament.

**Bet lifecycle**: `pending → open → locked → resolved` with undo (`resolved → locked` within 10s). Default timer: 60s match, 120s tournament.

**Room lifecycle**: Tournament/match = manual close, no expiry. Event (legacy) = 24h auto-expiry.

**Scoring**: 1000 starting points per room, 100 per bet (fixed), winners split pot evenly. Tournament aggregates across all linked match rooms.

**Abuse prevention**: 5 room creates/user/day. 10 join attempts/IP/min, 5-min lockout after 20 failures. No bet placement limit.

**Scale targets**: 1 tournament, up to 150 match rooms, up to 50 users/room, up to 50 bets/match room.

---

# Part 2: Implementation Plan

## Data Models

**Existing models (keep as-is)**: EventTemplate, UserBet.

### Room (modified)
```typescript
{
  roomCode: string                 // 6-char with checksum
  roomType: "tournament" | "match" | "event"
  eventTemplate: string            // "ipl-2026" | "oscars-2026"
  status: "waiting" | "active" | "finished"
  currentBetId: string | null
  hostId: string                   // Firebase Auth UID (verified server-side, NOT from client header)
  participants: string[]           // User IDs (for visibility enforcement)
  parentRoomCode: string | null    // Match rooms link to tournament; derive children via query
  matchDetails: {                  // Match rooms only
    team1: string
    team2: string
    matchDateTime: string          // ISO 8601 with timezone
    venue?: string
  } | null
  automationEnabled: boolean
  createdAt: timestamp
  expiresAt: timestamp | null      // null for tournament/match, set for event
  version: number                  // Optimistic locking
}
```

**Migration**: Existing rooms get `roomType: "event"`, preserve `expiresAt`, add `participants: []`, `version: 1`.

### RoomUser (new)
**Collection**: `roomUsers` (root-level). **Doc ID**: `{roomCode}_{userId}`.

```typescript
{
  id: string           // "{roomCode}_{userId}"
  roomCode: string
  userId: string       // Firebase Auth UID
  nickname: string
  points: number       // Starts at 1000
  joinedAt: timestamp
  isHost: boolean      // ALWAYS derived server-side from room.hostId == userId
}
```

Enables per-room scoring, leaderboard queries by roomCode, and cross-room aggregation.

### Bet (modified)
```typescript
{
  betId: string
  roomCode: string
  question: string
  options: string[]
  status: "pending" | "open" | "locked" | "resolved"
  betType: "pre-match" | "in-game" | "tournament"
  createdFrom: "template" | "custom"
  templateId: string | null
  openedAt: timestamp | null
  lockedAt: timestamp | null
  resolvedAt: timestamp | null
  winningOption: string | null
  timerDuration: number      // 60s match, 120s tournament
  pointsValue: number        // Default 100
  resolvePatterns: string[] | null
  canUndoUntil: timestamp | null   // 10s after resolution
  version: number
}
```

State machine: `pending → open → locked → resolved`, undo: `resolved → locked` (within 10s).

### BetTemplate (new)
```typescript
{
  templateId: string          // "toss-winner", "next-wicket"
  category: "cricket-pre" | "cricket-live" | "cricket-tournament"
  name: string
  questionTemplate: string    // "Who wins the toss?"
  optionsTemplate: string[]   // ["Team 1", "Team 2"] (variables replaced)
  defaultTimer: number
  defaultPoints: number
}
```

### IdempotencyLock (new)
**Collection**: `idempotencyLocks`. **Doc ID**: `{userId}_{operation}_{idempotencyKey}`.

```typescript
{
  lockId: string
  userId: string
  operation: "create_room" | "create_bet"
  createdAt: timestamp
  expiresAt: timestamp       // 24h TTL
  resultRoomCode: string     // Cached result for idempotent retry
}
```

Scoped to user+operation to prevent cross-user cache pollution. Uses transactional `create` to prevent races.

## Firestore Indexes

```json
{
  "indexes": [
    { "collectionGroup": "rooms", "fields": [
      {"fieldPath": "parentRoomCode", "order": "ASCENDING"},
      {"fieldPath": "matchDetails.matchDateTime", "order": "ASCENDING"}
    ]},
    { "collectionGroup": "rooms", "fields": [
      {"fieldPath": "parentRoomCode", "order": "ASCENDING"},
      {"fieldPath": "roomType", "order": "ASCENDING"}
    ]},
    { "collectionGroup": "roomUsers", "fields": [
      {"fieldPath": "roomCode", "order": "ASCENDING"},
      {"fieldPath": "points", "order": "DESCENDING"}
    ]},
    { "collectionGroup": "roomUsers", "fields": [
      {"fieldPath": "roomCode", "order": "ASCENDING"},
      {"fieldPath": "userId", "order": "ASCENDING"},
      {"fieldPath": "points", "order": "DESCENDING"}
    ]}
  ]
}
```

## Security Requirements

### Firestore Rules

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| rooms | Participant or host | Auth'd, hostId==auth.uid, version==1. Match rooms: parent required + must be tournament + caller must be tournament participant. Non-match: parent forbidden. | Host only, immutable: roomCode/hostId/parentRoomCode, version must increment by 1 | Host only |
| bets | Participant or host | Host only, status must be "pending", version==1 | Host only, valid state transition only, undo only within canUndoUntil window. Immutable: roomCode/question/options/pointsValue/betType. Version must increment. | Denied |
| userBets | Own bets only (userId==auth.uid) | Auth'd, userId==auth.uid, must be participant, bet must be in "open" status | Denied | Denied |
| roomUsers | Participant or host | Auth'd, userId==auth.uid, doc ID must be `{roomCode}_{userId}`, must be participant, points==1000, isHost matches actual room host | Own doc only, can only change nickname (points/joinedAt/isHost immutable) | Denied |
| idempotencyLocks | Denied (server-only) | Denied | Denied | Denied |

### Backend Authorization
- All endpoints verify Firebase Auth token (never trust client headers)
- `isHost` is ALWAYS derived server-side (`auth.uid == room.hostId`), never from client input
- Admin SDK bypasses Firestore rules, so server-side validation is mandatory
- Rate limit: 10 req/sec per IP for write endpoints

## Key Transaction Patterns

### Room Creation
1. Verify Firebase Auth token
2. Check scoped idempotency lock (`{userId}_create_room_{key}`). If exists and same user, return cached result.
3. For match rooms: validate parent exists, is tournament type, caller is participant/host. For non-match: reject if parent provided.
4. Generate room code with collision retry (up to 5 attempts, pre-read check)
5. Atomically create: idempotency lock + room doc + host's roomUsers doc (all via `transaction.create`)
6. Outer retry (up to 3x) handles commit-time collisions (`AlreadyExists`)

### Join Room
1. Verify Firebase Auth token
2. Validate room exists
3. Add userId to `room.participants` array (if not already present)
4. Create `roomUsers` doc with server-derived `isHost`. If already exists, return existing (idempotent).

### Tournament Aggregation
1. Verify caller is tournament participant
2. Query child rooms: `rooms.where(parentRoomCode==code, roomType=='match')`
3. Batch query `roomUsers` (Firestore `in` limit = 10 per query, so 150 rooms = 15 batches)
4. Server-side sum of points per user, sort descending

### Room Code Generation
```python
def generate_room_code_v2():
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # 30 chars
    first_5 = ''.join(random.choices(alphabet, k=5))
    checksum = sum(alphabet.index(c) for c in first_5) % 30
    return first_5 + alphabet[checksum]
```

## Performance Targets

| Operation | Target | Query Strategy |
|---|---|---|
| Bet state sync | < 500ms to all clients | Firestore listener on `/bets/{betId}` |
| Timer countdown | 60fps | Client-side only, no server calls |
| Leaderboard | < 100ms | `roomUsers` ordered by points desc, paginated at 50 |
| Room linking | < 100ms | `rooms.where(parentRoomCode==code)` ordered by matchDateTime |
| Tournament aggregation | < 400ms | Batched `roomUsers` queries (15 batches * ~25ms) |

## Implementation Phases

| Phase | Week | Goal |
|---|---|---|
| 6: Multi-Room Architecture | 1 (Days 1-5) | Tournament + match room structure, linking, transactions, security, auth |
| 7: Dynamic Bet Creation | 2 (Days 6-10) | Live bet creation with templates + custom, concurrency |
| 8: IPL Template | 3 (Days 11-15) | Production IPL template, all bet types, testing, perf validation |
| 9: Polish & Deploy | 4 (Days 16-20) | Polish, backup/restore, deployment for end-of-March IPL launch |
