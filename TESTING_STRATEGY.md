# Testing Plan for SmallBets.live (Revised v2)

## Overview
Add comprehensive test coverage for backend, frontend, and integration tests. Currently there are **no tests** in the repository.

**Testing Strategy**: Risk-based pyramid prioritizing security, correctness, and integration over broad coverage.

## 0. Bootstrap Phase - Test Infrastructure Setup

### 0.1 Backend Dependencies
**Install missing test dependencies:**
```bash
# Add to pyproject.toml [tool.uv.dev-dependencies]
pytest-asyncio>=0.23.0
pytest-cov>=4.1.0
pytest-mock>=3.12.0
```

**Add test scripts to backend workflow:**
- `pytest` - run all tests
- `pytest --cov --cov-report=term --cov-report=html` - run with coverage report
- `pytest --cov --cov-fail-under=80` - fail if coverage below 80%
- `pytest -v -s` - verbose output for debugging
- `pytest -m security` - run only security tests

### 0.2 Frontend Dependencies
**Install testing libraries:**
```bash
# Add to frontend/package.json devDependencies
vitest: ^1.2.0
@testing-library/react: ^14.1.0
@testing-library/jest-dom: ^6.1.0
@testing-library/user-event: ^14.5.0
@vitest/ui: ^1.2.0
@vitest/coverage-v8: ^1.2.0
jsdom: ^23.0.0
vitest-axe: ^0.1.0  # Accessibility testing
```

**Add test scripts:**
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage",
"test:a11y": "vitest --grep a11y"
```

### 0.3 Firebase Emulator Setup
**Environment orchestration for integration tests:**
- Create `backend/tests/test_env_setup.sh` - start emulator, wait for readiness
- Create `backend/tests/conftest.py` - pytest fixtures for emulator lifecycle
- Add emulator config to firebase.json if not present
- Document how to run tests with emulator (README)

### 0.4 Configuration Files
- `backend/pytest.ini` - pytest configuration, async markers, coverage paths
- `backend/.coveragerc` - coverage reporting config with 80% threshold
- `frontend/vitest.config.ts` - Vitest configuration with jsdom, coverage thresholds
- `frontend/src/test-utils.tsx` - Testing utilities (render with providers)
- `frontend/src/setupTests.ts` - Global test setup

**Backend pytest.ini:**
```ini
[pytest]
asyncio_mode = auto
markers =
    security: Security and authorization tests (highest priority)
    unit: Unit tests (pure functions, models)
    integration: Integration tests with Firestore emulator
    e2e: End-to-end tests with Playwright
```

**Frontend vitest.config.ts coverage thresholds:**
```typescript
coverage: {
  provider: 'v8',
  lines: 70,
  functions: 70,
  branches: 65,
  statements: 70
}
```

## Phase 1. Backend Testing (Python/FastAPI) - Priority: CRITICAL FIRST

### 1.1 Security & Authorization Tests (HIGHEST PRIORITY)
**Create `backend/tests/test_security.py` FIRST**

Test cross-room authorization vulnerabilities:
- ❌ Host from room A cannot open/lock/resolve bets in room B
- ❌ User from room A cannot place bets on room B's bets
- ❌ Host ID header mismatch should reject request
- ❌ Bet operations verify `bet.room_code == room.code`
- ✅ Add `verify_bet_belongs_to_room()` helper and test it

Test unauthorized actions:
- ❌ Non-host users cannot create/open/lock/resolve bets
- ❌ Non-participants cannot place bets
- ❌ Invalid/missing X-Host-Id or X-User-Id headers

**Action**: These tests must pass before expanding other test suites.

### 1.2 State Transition & Idempotency Tests
**Create `backend/tests/test_bet_state_machine.py`**

Test legal state transitions in `Bet` model:
- ✅ PENDING → OPEN → LOCKED → RESOLVED (valid path)
- ❌ PENDING → LOCKED (skip OPEN, should fail)
- ❌ OPEN → RESOLVED (skip LOCKED, should fail)
- ❌ RESOLVED → OPEN (cannot reopen, should fail)

**Idempotency Contract (EXPLICIT RULE):**
- **Rule**: `resolve_bet()` is idempotent - calling with same `winning_option` multiple times is a no-op after first call
- **Behavior**: First call processes resolution and updates points. Subsequent calls with same winner return success immediately without point adjustments
- **Implementation**: Check `bet.status == RESOLVED` and `bet.winning_option == winning_option` → return early
- **Test**: Resolve bet twice with same winner → verify points only adjusted once, leaderboard consistent
- **Error case**: Resolve already-resolved bet with DIFFERENT winner → reject with 400 error

✅ Add `can_transition_to(target_status)` method to Bet model
✅ Enforce transitions in `bet_service.open_bet()`, `lock_bet()`, `resolve_bet()`

### 1.3 Contract/Integration Bug Fixes
**Create `backend/tests/test_template_service.py` early**

Test template loading catches parameter mismatch:
- ❌ Current bug: `create_bets_from_template` passes `timer_duration` but `create_bet` expects `points_value`
- ✅ Fix: Update `template_service.py:69` to use correct parameter
- ✅ Test: Load template and verify bets created successfully
- ✅ Test: Validate all template JSON files (grammys, oscars, superbowl)

### 1.4 Unit Tests - Pure Logic (`test_game_logic.py`)
Test all pure functions in `game_logic.py`:
- `calculate_scores()` - various winner/loser scenarios, edge cases (all pick same, no losers, no winners)
- `validate_bet_eligibility()` - all validation rules
- `calculate_pot_total()` and `distribute_pot()`
- `calculate_leaderboard()` - sorting, tie-breaking by join time
- `validate_room_code()` - confusing characters, length, format
- `validate_nickname()` - empty, too long, whitespace-only

**Priority**: HIGH (pure functions, easy to test, no mocks needed)

### 1.5 Unit Tests - Models (`test_models/`)
Test Pydantic model validation and business methods:
- `test_bet_model.py` - state transitions, `can_accept_bets()`, `is_resolved()`, `can_transition_to()`
- `test_user_model.py` - `can_afford_bet()`, point validation
- `test_user_bet_model.py` - `is_winner()` logic
- `test_room_model.py` - status validation, field constraints

### 1.6 API Tests with Mocked Services (`test_api/`)
**Approach**: Use FastAPI TestClient + mock service layer (NOT Firestore)

Test endpoint contracts and error handling:
- `test_room_endpoints.py` - CREATE /api/rooms, GET /api/rooms/{code}, POST /api/rooms/{code}/join
- `test_bet_endpoints.py` - Bet CRUD, state transitions via API
- `test_authorization_endpoints.py` - Header validation, room ownership
- `test_error_responses.py` - 404s, 400s, 422s, proper error messages

### 1.7 Firestore Integration Tests with Emulator (`test_firestore_integration/`)
**Approach**: Real Firestore operations against Firebase Emulator Suite

Test real Firestore behavior:
- `test_room_service_integration.py` - room creation, queries, batch operations
- `test_bet_service_integration.py` - bet lifecycle with real Firestore
- `test_user_service_integration.py` - user creation, point updates, leaderboard queries
- `test_batch_operations.py` - batch limits (500 ops), chunked deletion for large rooms
- `test_concurrent_operations.py` - race conditions (double bet placement, concurrent resolve)

**Setup**: Each test uses fresh emulator data (clear between tests)

### 1.8 Service Layer Tests (`test_services/`)
**Approach**: Mock Firestore, test business logic orchestration

- `test_room_service.py` - room creation, joining, state transitions
- `test_user_service.py` - user creation, point management, leaderboard calculation
- `test_bet_service.py` - bet lifecycle, placement validation, resolution logic
- `test_transcript_service.py` - transcript ingestion
- `test_automation_service.py` - trigger matching, winner extraction
- `test_transcript_parser.py` - pure parsing functions (keyword matching, fuzzy match, confidence scoring)

## Phase 2. Frontend Testing (React/TypeScript)

### 2.1 Unit Tests - Services (`services/*.test.ts`)
Test API and Firestore services:
- `api.test.ts` - HTTP client error handling, retry logic, API calls, network failures
- `firestore.test.ts` - Firestore subscription helpers, timestamp conversion

**Approach**: Mock fetch() and Firebase SDK

### 2.2 Unit Tests - Hooks (`hooks/*.test.ts`)
Test custom React hooks:
- `useSession.test.ts` - **CRITICAL**: corrupted sessionStorage JSON, missing keys, recovery
- `useRoom.test.ts` - Firestore subscription lifecycle, cleanup on unmount
- `useUser.test.ts` - User state management, loading states
- `useBet.test.ts` - Single bet subscription
- `useBets.test.ts` - All bets subscription
- `useUserBets.test.ts` - User's bets, filtering
- `useParticipants.test.ts` - Room participants, count

**Resilience testing**:
- ❌ Invalid JSON in sessionStorage (parse error handling)
- ❌ Network failures during subscription setup
- ❌ Firestore listener errors (permissions, disconnects)
- ❌ Stale session data (user no longer in room)

**Approach**: Mock Firestore listeners, test error boundaries

### 2.3 Component Tests (`components/**/*.test.tsx`)
Test page and admin components with user interactions:

**Error paths and recovery** (not just happy paths):
- `HomePage.test.tsx` - Navigation links
- `CreateRoomPage.test.tsx` - Form validation, room creation failure, retry
- `JoinRoomPage.test.tsx` - Room code validation, room not found, already joined
- `RoomPage.test.tsx` - Room state rendering, real-time updates, disconnection handling
- `AdminPanel.test.tsx` - Admin controls visibility, unauthorized access
- `BetCreationForm.test.tsx` - Bet creation form, validation, submission errors
- `BetListPanel.test.tsx` - Bet list rendering, empty state, loading skeleton
- `LiveFeedPanel.test.tsx` - Transcript feed, auto-scroll

**Accessibility testing (with vitest-axe):**
- ✅ Install `vitest-axe` for automated a11y checks
- ✅ Add `toHaveNoViolations()` matcher to setupTests.ts
- ✅ Each component test runs `axe()` scan and asserts no violations
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Form errors announced to screen readers (aria-describedby, role="alert")
- ✅ Focus management on modals/dialogs (focus trap, return focus)
- ✅ ARIA labels and roles (buttons, landmarks, form controls)

**Example a11y test:**
```typescript
import { axe, toHaveNoViolations } from 'vitest-axe';
expect.extend(toHaveNoViolations);

test('CreateRoomPage has no accessibility violations', async () => {
  const { container } = render(<CreateRoomPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**CI enforcement**: Frontend test suite fails if any component has axe violations

**Approach**: Render with mock contexts, test user interactions, @testing-library/user-event

## Phase 3. Integration/E2E Tests

### 3.1 Setup E2E Infrastructure
- **Tool**: Playwright (use existing e2e-test skill)
- **Test Location**: `e2e/tests/` directory
- **Configuration**: Playwright config, browser contexts
- **Environment**: Firebase Emulator Suite for isolated testing

### 3.2 Minimal Critical Smoke Tests (2-3 flows)
Focus on highest-value user journeys:

1. **Complete betting flow** (most critical):
   - Host creates room → Guest joins → Host starts game → Host opens bet → Both users place bets → Host locks bet → Host resolves bet → Leaderboard updates

2. **Real-time sync test**:
   - Two browser contexts (host + guest) → Host opens bet → Guest sees bet open → Guest places bet → Host sees bet count update → Host resolves → Both see leaderboard update

3. **Error recovery test**:
   - Create room → Disconnect network → Attempt to join → Reconnect → Join succeeds

**Approach**: Use Playwright multi-context, Firebase Emulator, focus on critical paths only

## Phase 4. Additional Test Scenarios (From Review)

### 4.1 Concurrency & Race Conditions
- Same user double-submits bet (should reject duplicate)
- Concurrent bet placement and resolution (transaction safety)
- Multiple hosts trying to resolve same bet

### 4.2 Data Integrity & Limits
- Large rooms (>500 users) - batch operation limits
- Firestore write limits (500 ops/batch)
- Safe chunked deletion strategy for `delete_room()`

### 4.3 Frontend Resilience
- Corrupted sessionStorage (invalid JSON, missing fields)
- Network failures during API calls
- Firestore listener disconnects
- Stale session data (user removed from room)

### 4.4 CORS & Security Config (Environment-Specific)

**Development/Testing (localhost, emulator):**
- `allow_origins=["http://localhost:5173", "http://localhost:3000"]` (Vite/React dev servers)
- `allow_credentials=True` (OK for dev)
- Test: API accepts requests from localhost origins
- Test: API rejects requests from other origins

**Production (deployed):**
- `allow_origins=["https://smallbets.live", "https://www.smallbets.live"]` (actual domain)
- `allow_credentials=True`
- Test: API accepts requests from production domains only
- Test: API rejects wildcard origins, unknown domains

**Implementation:**
- Use environment variable `ALLOWED_ORIGINS` (comma-separated list)
- Backend reads from env var, splits into list
- Tests verify proper config for each environment

**Test file**: `backend/tests/test_cors_config.py`

## Success Metrics

### Coverage Targets:
- **Backend game_logic.py**: 95%+ (pure functions, easy to test)
- **Backend services**: 80%+ (business logic)
- **Backend API endpoints**: 90%+ (all routes tested)
- **Frontend hooks**: 75%+ (state management + error paths)
- **Frontend components**: 60%+ (critical interactions + accessibility)

### Quality Gates:
- ✅ All security tests pass (zero cross-room auth bugs)
- ✅ All state transition tests pass (idempotent operations)
- ✅ All API contract tests pass (proper error responses)
- ✅ Critical E2E flows pass (room creation → betting → resolution)
- ✅ No accessibility violations (vitest-axe passes)
- ✅ No regressions when running full suite

### Phase 6 CI/CD Integration - Explicit Job Matrix

**GitHub Actions Workflow** (`.github/workflows/test.yml`):

```yaml
name: Test Suite

on: [pull_request, push]

# Cancel older runs for same PR/branch when new commit pushed
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Note: For cross-job fail-fast within same run, use explicit `needs` dependencies
# Current setup: backend-unit, backend-security, backend-integration, frontend-unit run in parallel
# E2E waits for critical jobs via `needs: [backend-unit, backend-security, frontend-unit]`

jobs:
  backend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: cd backend && pip install -r requirements.txt && pip install pytest pytest-cov pytest-asyncio pytest-mock
      - run: cd backend && pytest tests/test_game_logic.py tests/test_models/ -v --cov --cov-fail-under=80

  backend-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'  # Pin Python version to prevent drift
      - run: cd backend && pip install -r requirements.txt && pip install pytest pytest-asyncio
      - run: cd backend && pytest tests/test_security.py tests/test_bet_state_machine.py -v -x
      # -x flag exits on first failure (pytest-level fail-fast)

  backend-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      # Install Python dependencies and pytest
      - run: cd backend && pip install -r requirements.txt && pip install pytest pytest-asyncio pytest-mock
      # Install Firebase CLI
      - run: npm install -g firebase-tools
      # Create complete dummy service account credentials for emulator (required by firebase_config.py:43)
      # Using valid PEM key structure (dummy key material, but parseable by credentials.Certificate())
      - run: |
          cat > /tmp/dummy-creds.json <<'EOF'
          {
            "type": "service_account",
            "project_id": "demo-test",
            "private_key_id": "dummy-key-id",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFf6OZ+yq9yMTd\nF+Oh4/+zk2btbUlLys9lALqi+DGI/nDJU+lCI8i5X6qmPQGwu7mdHXfcH2veBiw/\nYQaF4v0tiHMvjP5wQ+ECHT1AcoXiOrhPvvVJ1ouZf0WlUi2PxqCkYpWjt/u+kzO9\naGscQOr1659DCT2QCIdB+bImiy3PW3bTBFGbeWyMuYvZ0AeIPnsb4GHvNWNxP0xI\ngkmao3Dg9LXtKLBbtps0d9ho84PstA4G8g/+wfjxX0IWt0zp32a53o5p6jJ5DrxY\nnuKdziWeqAR7pVqaBgsSjYyrWWhDxoIDqpsehJ8Isd1LT50uQS4dcMZ+8n7KH6aa\nAK+vLPjbAgMBAAECggEAQI/pO30QC9qGAIC+uT1/aYTWMOd4/n3eLnZ+jKf2CYKj\n/CyiJCzugSr07kMjOlMj6minth3PdVUvQcjGCR6bBTeF8BV3V9vYwogsbdUCT2JC\nvk7+gJTSLeudKN4kZsvX1+UiZdLPSQ117IUl/qZ6KMpN1ew/Y8Zl8PtfcZot74qz\nqH/8oV/YnBkpj3OICK9csh36pmJi1YdT/qipzRtTv7+283rvDKJUZar+WeXyehYM\nmxAFTP87DBwA5QbuRVyukP7OSjotUCO61H21T4mO28au/gTHsKLUY2ul/C57jibn\nSlecFdYbo6jDWtDGHi+GPbdo1GjMgbAbSsiHh0KSgQKBgQDsur2ANpxe66u2hD6Q\norynLPt7G7TceULM+hGPIrpUxFmpnnVG98p/KiyMZEWbnWgoNoG0VPYJki2j/JAP\nXn3zUsJQOPxwQHHq2mDQS6XROaHuUoMxSNvHyMVBlbQfK/OTWvUAEoCajUrabGeH\nKsVdYXERsBnDdF+cvH6Pr2t/xQKBgQDVk1uYmFXDsCL8zp/nvgi97c+G/TdiKoeR\nZc4eMwWWJe61R2nGN4zix5O1fsv3mraxCH9ELs8Wz+kAjSeVWAL1Dj1Tr/ecPiUB\nACXdZRk+ugk1RJ6OY/eJwv6rWXa8CXScn+2L+UDMJ/33KmBU7T0NkKCbnwfAwQv5\n3dhSqo6AHwKBgEavqAANznllY5uXN1tWzIAapWjoKAQhTToJfY7A7uR60M8eGqS7\nPsLj4/NzyXki8kP3qpkfOWw4Mtqhgp6kN3Wdg5oSugYGqD1ZQclQnU2xKNIR30yr\nFb09DPF9cxBPvmaEpV2FKNN9VxmLfwpUUiSFAQ8oBzlemWIiwqPC3JWFAoGAerwq\nITE56DEqihm77xNYNr2ZSzvtPe6u5bGZl+U+SqEV4vtdH9oAjrqeeeiaEnrIjkgR\nyv8TZ0qn3fdATiS73lQGjjdLlnBoF4EcQXS94zxJ2mDKtY1hTbvPWm0ZPMo6R1/o\nxU3CHRDGc+nYXjXPpiH9CjGD5ROLbFY+4JK/PYUCgYBH3PzYwh3Lj7to8omukCj4\nuePcEJK8VYWAIq7YKLd+awHLUQvH2I70kEnuWSVUhJSL3M1P+kRK568QhLeiXzZ6\nNIpSy+MpD7pxs0GpVq6/+BPP5HwEi4iDzxITXwyhTn4Yo4w7HRMzqrte73UIO85m\nd+dbyo9MECmoLnHY921V1A==\n-----END PRIVATE KEY-----\n",
            "client_email": "test@demo-test.iam.gserviceaccount.com",
            "client_id": "123456789",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
          }
          EOF
      - run: firebase emulators:exec --project demo-test "cd backend && pytest tests/test_firestore_integration/ -v"
        env:
          GOOGLE_APPLICATION_CREDENTIALS: /tmp/dummy-creds.json

  frontend-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci
      - run: cd frontend && npm test -- --coverage --run
      # Coverage thresholds enforced automatically by vitest.config.ts

  e2e:
    runs-on: ubuntu-latest
    needs: [backend-unit, backend-security, frontend-unit]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: npm install -g firebase-tools
      - run: npx playwright install --with-deps
      # Install backend dependencies
      - run: cd backend && pip install -r requirements.txt
      # Install frontend dependencies
      - run: cd frontend && npm ci
      # Create complete dummy service account credentials for emulator
      - run: |
          cat > /tmp/dummy-creds.json <<'EOF'
          {
            "type": "service_account",
            "project_id": "demo-test",
            "private_key_id": "dummy-key-id",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFf6OZ+yq9yMTd\nF+Oh4/+zk2btbUlLys9lALqi+DGI/nDJU+lCI8i5X6qmPQGwu7mdHXfcH2veBiw/\nYQaF4v0tiHMvjP5wQ+ECHT1AcoXiOrhPvvVJ1ouZf0WlUi2PxqCkYpWjt/u+kzO9\naGscQOr1659DCT2QCIdB+bImiy3PW3bTBFGbeWyMuYvZ0AeIPnsb4GHvNWNxP0xI\ngkmao3Dg9LXtKLBbtps0d9ho84PstA4G8g/+wfjxX0IWt0zp32a53o5p6jJ5DrxY\nnuKdziWeqAR7pVqaBgsSjYyrWWhDxoIDqpsehJ8Isd1LT50uQS4dcMZ+8n7KH6aa\nAK+vLPjbAgMBAAECggEAQI/pO30QC9qGAIC+uT1/aYTWMOd4/n3eLnZ+jKf2CYKj\n/CyiJCzugSr07kMjOlMj6minth3PdVUvQcjGCR6bBTeF8BV3V9vYwogsbdUCT2JC\nvk7+gJTSLeudKN4kZsvX1+UiZdLPSQ117IUl/qZ6KMpN1ew/Y8Zl8PtfcZot74qz\nqH/8oV/YnBkpj3OICK9csh36pmJi1YdT/qipzRtTv7+283rvDKJUZar+WeXyehYM\nmxAFTP87DBwA5QbuRVyukP7OSjotUCO61H21T4mO28au/gTHsKLUY2ul/C57jibn\nSlecFdYbo6jDWtDGHi+GPbdo1GjMgbAbSsiHh0KSgQKBgQDsur2ANpxe66u2hD6Q\norynLPt7G7TceULM+hGPIrpUxFmpnnVG98p/KiyMZEWbnWgoNoG0VPYJki2j/JAP\nXn3zUsJQOPxwQHHq2mDQS6XROaHuUoMxSNvHyMVBlbQfK/OTWvUAEoCajUrabGeH\nKsVdYXERsBnDdF+cvH6Pr2t/xQKBgQDVk1uYmFXDsCL8zp/nvgi97c+G/TdiKoeR\nZc4eMwWWJe61R2nGN4zix5O1fsv3mraxCH9ELs8Wz+kAjSeVWAL1Dj1Tr/ecPiUB\nACXdZRk+ugk1RJ6OY/eJwv6rWXa8CXScn+2L+UDMJ/33KmBU7T0NkKCbnwfAwQv5\n3dhSqo6AHwKBgEavqAANznllY5uXN1tWzIAapWjoKAQhTToJfY7A7uR60M8eGqS7\nPsLj4/NzyXki8kP3qpkfOWw4Mtqhgp6kN3Wdg5oSugYGqD1ZQclQnU2xKNIR30yr\nFb09DPF9cxBPvmaEpV2FKNN9VxmLfwpUUiSFAQ8oBzlemWIiwqPC3JWFAoGAerwq\nITE56DEqihm77xNYNr2ZSzvtPe6u5bGZl+U+SqEV4vtdH9oAjrqeeeiaEnrIjkgR\nyv8TZ0qn3fdATiS73lQGjjdLlnBoF4EcQXS94zxJ2mDKtY1hTbvPWm0ZPMo6R1/o\nxU3CHRDGc+nYXjXPpiH9CjGD5ROLbFY+4JK/PYUCgYBH3PzYwh3Lj7to8omukCj4\nuePcEJK8VYWAIq7YKLd+awHLUQvH2I70kEnuWSVUhJSL3M1P+kRK568QhLeiXzZ6\nNIpSy+MpD7pxs0GpVq6/+BPP5HwEi4iDzxITXwyhTn4Yo4w7HRMzqrte73UIO85m\nd+dbyo9MECmoLnHY921V1A==\n-----END PRIVATE KEY-----\n",
            "client_email": "test@demo-test.iam.gserviceaccount.com",
            "client_id": "123456789",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
          }
          EOF
      # Build frontend for E2E tests
      - run: cd frontend && npm run build
      # Start emulators, backend API, and frontend dev server, then run Playwright tests
      # Use a shell script to orchestrate all three servers
      - run: |
          export GOOGLE_APPLICATION_CREDENTIALS=/tmp/dummy-creds.json
          export FIRESTORE_EMULATOR_HOST=localhost:8080
          export VITE_API_URL=http://localhost:8000

          # Start Firebase emulators in background
          firebase emulators:start --project demo-test &
          FIREBASE_PID=$!

          # Wait for emulators to be ready
          sleep 10

          # Start backend API in background
          cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 &
          BACKEND_PID=$!

          # Start frontend dev server in background
          cd frontend && npm run dev -- --host 0.0.0.0 --port 5173 &
          FRONTEND_PID=$!

          # Wait for servers to be ready
          sleep 5

          # Run Playwright tests
          npx playwright test e2e/tests/critical-flows.spec.ts

          # Cleanup: kill background processes
          kill $FIREBASE_PID $BACKEND_PID $FRONTEND_PID || true
```

**Coverage enforcement:**
- Backend: `--cov-fail-under=80` in pytest command
- Frontend: `coverage.lines: 70` in vitest.config.ts (auto-fail)
- CI blocks merge if any job fails

**Threshold config locations:**
- Backend: `backend/.coveragerc` or inline `--cov-fail-under`
- Frontend: `frontend/vitest.config.ts` → `coverage.lines`, `coverage.functions`, etc.

## Phase 7. Known Issues to Fix During Testing

1. **Cross-room authorization** - Add `verify_bet_belongs_to_room()` helper to bet_service
2. **State transitions** - Add `can_transition_to()` method to Bet model
3. **Idempotency** - Make `resolve_bet()` idempotent (check existing status/winner, return early if already resolved with same winner)
4. **Template service bug** - Fix `timer_duration` → `points_value` parameter mismatch in template_service.py:69
5. **Batch limits** - Add chunked deletion for large rooms in `delete_room()` (max 500 ops/batch)
6. **Session resilience** - Add try/catch for JSON.parse in `useSession.ts:20`, return null on error
7. **CORS config** - Replace `allow_origins=["*"]` with environment-specific allowlist (`ALLOWED_ORIGINS` env var)
