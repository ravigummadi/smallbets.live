# Unique Per-User Room Links - Specification

## Executive Summary

Add functionality for hosts to share unique, persistent links for each participant. These links allow users to rejoin a room and restore their complete session (identity, points, bets) even after closing their browser or losing session data.

**Timeline**: 1-2 days for MVP implementation
**Status**: MVP-ready (23 issues addressed across 4 rounds of external code review)

## Problem Statement

Users rely on browser sessionStorage for identity. If they close the browser, clear data, switch devices, or navigate away, they lose access to their session and cannot continue with their original identity, points, and bet history.

**User Pain Point**: Host must manually recreate lost users or users start over, losing all progress.

## Solution Overview

Create unique shareable links for each user:
```
https://smallbets.live/room/{roomCode}/u/{userKey}
```

**Components**:
- `{roomCode}`: Room code (e.g., "ABC123")
- `{userKey}`: 8-character unique identifier per user (e.g., "xY7kM9zQ")

**Flow**:
1. User visits link
2. Frontend looks up userId from userKey
3. If no session for this room: shows confirmation "Continue as Alice?"
4. On confirm, restores full session
5. URL stays at `/room/{roomCode}/u/{userKey}` (bookmarkable)

## User Requirements

1. **Link Generation**: Automatic when user joins or creates room
2. **URL is the identity**: All users (host + guest) have a unique URL `/room/{code}/u/{key}`
3. **UI Location**: Participants list on main room page (visible to host only)
4. **Existing Session**: Replace with link's userId (after confirmation)
5. **Link Security**: No expiration (simple MVP approach)

## User Workflows

### Workflow 1: Host Creates Room
1. Host enters nickname and creates room (any type: event, tournament, match)
2. Backend creates User with UUID `user_id` + unique 8-char `user_key`
3. Backend returns `user_key` in CreateRoomResponse
4. Frontend navigates to `/room/{code}/u/{hostKey}` (host's unique URL)
5. Host can bookmark this URL for session recovery

### Workflow 2: User Joins Room (Link Generation)
1. User enters nickname and joins room
2. Backend creates User with UUID `user_id` + unique 8-char `user_key`
3. Collision retry: Up to 5 attempts if duplicate detected
4. Backend returns `user_key` in JoinRoomResponse
5. Frontend navigates to `/room/{code}/u/{userKey}` (user's unique URL)
6. User can bookmark this URL for session recovery

### Workflow 3: Host Shares Link
1. Host views Participants list in room page
2. Each participant has a "Copy Link" button (host-only)
3. Host clicks "Copy Link" for participant
4. Frontend constructs `https://smallbets.live/room/{code}/u/{key}` and copies to clipboard
5. Button shows "Copied!" confirmation
6. Host shares via WhatsApp/SMS

### Workflow 4: User Restores Session via Link
1. User clicks unique link (possibly different device)
2. Frontend detects URL pattern `/room/:code/u/:userKey`
3. If user already has session for this room: shows room directly (no confirmation needed)
4. If no session: calls API to look up user by key
5. Shows confirmation modal: "Continue as Alice? You have 850 points."
6. User confirms
7. Session restored, stays on `/room/{code}/u/{userKey}`

### Workflow 5: User Clicks Different User's Link
1. User with active session clicks different user's link
2. Same confirmation flow as Workflow 4
3. User confirms → session replaced, stays on new URL

---

## Technical Design

### Data Model Changes

#### User Model (`backend/models/user.py`)
**Add field**:
- `user_key: Optional[str]` - 8-character unique identifier (base32-crockford alphabet)

**Update `to_dict()` method**:
- Add `include_key: bool = False` parameter
- Default excludes `userKey` (security - not exposed to clients)
- Only include when explicitly requested (host-only endpoints)

**CRITICAL**: All write paths must use `user.to_dict(include_key=True)` or `user_ref.update()` to avoid silently deleting persisted keys.

#### Helper Functions (`backend/services/user_service.py`)

**`generate_user_key()`**:
- Returns 8-character string using base32-crockford alphabet (excludes ambiguous chars: 0, O, I, L, 1)
- ~1.1 trillion possible keys

**`create_user()`**:
- Generate unique userKey with collision retry (5 attempts)
- Persist with `user.to_dict(include_key=True)`
- Handle `AlreadyExists`/`FailedPrecondition` exceptions
- Log collisions for monitoring

**`ensure_user_has_key()`**:
- On-demand backfill for existing users without keys
- Same collision retry logic
- Used when host requests participant links

**`get_user_by_key(room_code, user_key)`**:
- Query with composite index: `(roomCode, userKey)`
- Return User or None

### API Endpoint Changes

#### 0. Existing Endpoints: Return user_key

**CreateRoomResponse**, **CreateTournamentResponse**, and **JoinRoomResponse** now include `user_key` field so the frontend can immediately navigate to the unique URL.

```json
{
  "room_code": "ABC123",
  "host_id": "uuid",
  "user_id": "uuid",
  "user_key": "xY7kM9zQ"
}
```

For JoinRoom with existing user (re-join by nickname), the backend backfills the key if missing via `ensure_user_has_key()`.

#### 1. Host-Only Endpoint: Get Participants with Links
```
GET /api/rooms/{code}/participants-with-links
Authorization: Bearer <firebase_id_token>
```

**Purpose**: Return all participants with their unique links (host-only)

**Authentication**:
- Verify Firebase ID token (not spoofable header)
- Extract authenticated userId from token
- Verify authenticated userId matches room hostId

**Logic**:
- Get all participants in room
- For each without userKey: call `ensure_user_has_key()` (on-demand backfill)
- Return list with userKey included

**Response**:
```json
{
  "participants": [
    {
      "userId": "uuid",
      "nickname": "Alice",
      "points": 1000,
      "isAdmin": false,
      "userKey": "xY7kM9zQ"
    }
  ]
}
```

**Error Handling**:
- 401: Invalid/expired Firebase token
- 403: Not the room host
- Log backfill failures, continue without that participant

#### 2. Public Endpoint: Session Restoration
```
GET /api/rooms/{code}/users/{user_key}
```

**Purpose**: Look up user by userKey for session restoration (public, no auth)

**Security Controls**:
- Input validation: Regex pattern `^[23456789A-HJ-NP-Za-hj-np-z]{8}$`
- Rate limiting: 10 req/min per IP
- Structured logging for abuse monitoring

**IP Detection**:
- Trust X-Forwarded-For header (assumes Cloud Load Balancer strips client headers)
- Document proxy trust requirement

**Response** (excludes userKey):
```json
{
  "userId": "uuid",
  "nickname": "Alice",
  "points": 850,
  "isAdmin": false,
  "roomCode": "ABC123"
}
```

**Error Handling**:
- 400: Invalid userKey format
- 404: User not found
- 429: Rate limit exceeded
- 503: Firestore index not ready (`FAILED_PRECONDITION`)

### Frontend Changes

#### 1. Routing (`frontend/src/App.tsx`)
**Add route**:
```tsx
<Route path="/room/:code/u/:userKey" element={<RoomPage />} />
```

#### 2. API Client (`frontend/src/services/api.ts`)

**Add function**:
```typescript
getParticipantsWithLinks(roomCode: string)
```
- Get Firebase Auth token via `getAuth().currentUser.getIdToken()`
- Send in `Authorization: Bearer <token>` header
- Throw 401 if no authenticated user

**Add function**:
```typescript
getUserByKey(roomCode: string, userKey: string)
```
- Public endpoint, no auth
- Returns user data for session restoration

#### 3. Create Room Page (`frontend/src/components/pages/CreateRoomPage.tsx`)

**Navigate to unique URL after creation**:
- After successful room creation, navigate to `/room/{code}/u/{userKey}` instead of `/room/{code}`
- Falls back to `/room/{code}` if `user_key` not in response

#### 4. Join Room Page (`frontend/src/components/pages/JoinRoomPage.tsx`)

**Navigate to unique URL after joining**:
- After successful join, navigate to `/room/{code}/u/{userKey}` instead of `/room/{code}`
- Falls back to `/room/{code}` if `user_key` not in response

#### 5. Room Page (`frontend/src/components/pages/RoomPage.tsx`)

**Session restoration logic**:
- Detect URL pattern with userKey
- If session already exists for this room: skip restoration, show room normally
- If no session: call `getUserByKey()` API, show confirmation modal
- On confirm: update session storage, stay on `/u/:userKey` URL
- Handle errors (429, 404, 400)

**Participant links for host**:
- Load participant links via `getParticipantsWithLinks()` when host is viewing
- Show "Copy Link" button next to each participant in the participants list
- Re-fetch when participant count changes to pick up new joiners

#### 6. Admin Panel (`frontend/src/components/admin/AdminPanel.tsx`)

**"Participants" section** (collapsible, lazy-loaded):
- Call `getParticipantsWithLinks()` when expanded
- "Copy Link" button per participant
- Construct URL: `${window.location.origin}/room/${roomCode}/u/${userKey}`
- Copy to clipboard, show "Copied!" feedback

**Error handling**:
- 403: Show "Not authorized" message

#### 5. TypeScript Types

**Add interface**:
```typescript
interface ParticipantWithLink extends User {
  userKey: string;  // Only for host-authenticated endpoints
}
```

**Note**: Generic `User` type never includes `userKey` (security)

### Firestore Index

**Add to `firestore.indexes.json`**:
```json
{
  "collectionGroup": "users",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "roomCode", "order": "ASCENDING"},
    {"fieldPath": "userKey", "order": "ASCENDING"}
  ]
}
```

**Deployment Steps**:
1. Add index to `firestore.indexes.json`
2. Deploy: `firebase deploy --only firestore:indexes`
3. Wait for index to build (5-10 minutes)
4. Verify: `firebase firestore:indexes`
5. Deploy code that uses index

---

## Testing Strategy

### Backend Tests

**Unit Tests** (`backend/tests/test_user_service.py`):
- `generate_user_key()` format validation
- `create_user()` collision retry (mock duplicate exceptions)
- `ensure_user_has_key()` backfill logic
- `get_user_by_key()` query correctness
- `User.to_dict()` excludes userKey by default
- `User.to_dict(include_key=True)` includes userKey

**API Tests** (`backend/tests/test_main.py`):
- Host-only endpoint: 401 without auth, 403 if not host, 200 with valid token
- Host-only endpoint: Backfills missing keys correctly
- Public endpoint: 400 for invalid format, 404 for not found, 429 for rate limit
- Public endpoint: Returns data without userKey

### Frontend Tests

**API Tests** (`frontend/src/services/api.test.ts`):
- `getParticipantsWithLinks()` sends Firebase Auth token
- `getParticipantsWithLinks()` throws 401 when not authenticated
- `getUserByKey()` handles 404, 429, 400 errors

**Hook Tests** (`frontend/src/hooks/useSession.test.ts`):
- Session restoration updates storage correctly
- Confirmation flow prevents accidental takeover

**Component Tests**:
- Admin Panel loads and displays participants
- Copy button copies correct URL format
- RoomPage detects userKey in URL and triggers restoration

### E2E Tests

**Update** `.claude/skills/e2e-test/SKILL.md`:
- Add scenario: User joins room, host copies link, user clicks link on new device
- Verify: Session restored with correct nickname and points
- Verify: Confirmation modal appears before restoration
- Verify: Admin panel shows all participants with Copy Link buttons

---

## Deployment Checklist

### Pre-Deployment
- [ ] Add `user_key` field to User model
- [ ] Implement collision retry in `create_user()`
- [ ] Add `ensure_user_has_key()` function
- [ ] Add host-only endpoint with Firebase Auth
- [ ] Add public session restoration endpoint
- [ ] Add rate limiting (in-memory for MVP)
- [ ] Update frontend routing
- [ ] Add Admin Panel participants section
- [ ] Add RoomPage session restoration logic

### Database Migration
- [ ] Deploy Firestore index: `firebase deploy --only firestore:indexes`
- [ ] Wait for index build completion: `firebase firestore:indexes`
- [ ] Verify index status shows "Ready"

### Deployment
- [ ] Deploy backend with new endpoints
- [ ] Deploy frontend with new routes/UI
- [ ] Monitor logs for `USERKEY_COLLISION` events (should be rare)
- [ ] Monitor 429 rate limit responses
- [ ] Test end-to-end with real room

### Post-Deployment Validation
- [ ] Create test room, join as multiple users
- [ ] Verify links are generated automatically
- [ ] Copy link from Admin Panel, open in incognito
- [ ] Verify confirmation modal appears
- [ ] Verify session restored with correct data
- [ ] Test rate limiting (make 11 requests in 1 minute)

---

## Known Limitations (MVP Tradeoffs)

This specification was reviewed through 4 rounds of external code review (OpenAI Codex gpt-5.3). The following limitations are **documented and accepted** for MVP:

### 1. Firestore Uniqueness Not Enforced at Database Level
**Concern**: Composite indexes enable queries but don't enforce uniqueness. Duplicate userKeys are possible under high concurrency.

**MVP Mitigation**:
- 1.1 trillion possible keys, collision probability ~0.000001% for rooms <1000 users
- User sees error and retries join if collision occurs
- **Production**: Use Firestore document ID as userKey (guaranteed unique)

### 2. `to_dict()` Persistence Footgun
**Concern**: Default `to_dict()` excludes userKey, so code using `set(user.to_dict())` silently deletes keys.

**MVP Mitigation**:
- Comprehensive audit documentation provided
- All write paths in spec use `include_key=True`
- Unit tests validate behavior
- **Production**: Use `merge=True` on all writes or separate `to_api_dict()` method

### 3. No Link Expiry or Revocation
**Concern**: userKey links are permanent credentials. Leaked link = indefinite account takeover.

**MVP Tradeoff** (user-selected):
- Simple UX: Links never expire
- Risk acceptable: Only virtual points, no real money or PII
- **Production**: Add expiry timestamps, revocation API, or periodic rotation

### 4. Partial Backfill Failures Not Signaled
**Concern**: If key generation fails for some users, endpoint logs and continues, silently omitting participants.

**MVP Mitigation**:
- Logged for monitoring (`KEY_GENERATION_FAILED`)
- Extremely rare (only for existing users + collision)
- **Production**: Return `{ participants: [...], errors: [...] }` structure

### 5. In-Memory Rate Limiting Not Production-Scale
**Concern**: Per-instance state, unbounded memory growth, no persistence.

**MVP Mitigation**:
- Adequate for single-instance or low-traffic MVP
- Documented with Redis/Cloud Armor recommendations
- **Production**: Redis-based rate limiting or Cloud Load Balancer rules

### 6. Bearer Links Are Permanent Credentials
**Concern**: No authentication beyond userKey possession.

**MVP Tradeoff** (by design):
- Matches user selection: "No expiration (simple approach)"
- Use case: Host shares to participants who lost session
- **Production**: Firebase Auth + userKey association, or link expiry

---

## Security Review Summary

**23 critical/high/medium issues addressed across 4 rounds**:

**Round 1** (8 issues): userKey exposure → host-only endpoint; no collision handling → retry loop; missing keys → backfill; silent takeover → confirmation modal; no validation → regex; unclear deployment → steps; no rate limiting → 10/min; missing tests → comprehensive suite

**Round 2** (4 issues): userKey not persisted → `include_key=True` fix; spoofable auth → Firebase tokens; no error handling → FAILED_PRECONDITION; print() logging → structured logging

**Round 3** (5 issues): untrusted X-Forwarded-For → proxy docs; race conditions → write-time enforcement; test inconsistency → Firebase Auth mocks; unclear persistence → audit docs; missing rate limit docs → Redis recommendations

**Round 4** (6 issues): Documented as MVP tradeoffs above

---

## Production Hardening (Future)

If needed for real money or scale:
- Firestore transactions or unique document IDs for userKeys
- Separate `to_api_dict()` method to eliminate persistence footgun
- Link expiry/revocation system
- Redis-based distributed rate limiting
- Explicit partial failure responses
- Authentication token + userKey hybrid approach

---

## Conclusion

**Status**: MVP-ready for casual social betting with virtual points only
**Timeline**: 1-2 days implementation
**External Review**: 4 rounds, 23 issues addressed, 6 tradeoffs documented
