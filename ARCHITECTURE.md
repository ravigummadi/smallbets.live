# SmallBets.live - Architecture Documentation

## 1. Overview

### Purpose
This document provides comprehensive architecture guidance for the SmallBets.live project. It establishes patterns, principles, constraints, and review processes to ensure code quality and maintainability throughout development.

### Relationship to Other Documentation
- **SPEC.md**: Defines product requirements, features, and implementation timeline
- **CLAUDE.md**: Describes project context, tech stack, and development workflow
- **ARCHITECTURE.md** (this file): Documents architecture patterns, design principles, review checkpoints, and quality gates

### Target Audience
- Developers implementing features
- Reviewers evaluating code quality
- Future maintainers understanding architectural decisions
- AI assistants ensuring consistency across sessions

## 2. Architectural Principles

### A Philosophy of Software Design (Ousterhout)

This project follows principles from John Ousterhout's "A Philosophy of Software Design" (2nd Edition):

**Deep Modules over Shallow Modules**
- Prefer modules with simple interfaces that hide substantial complexity
- A deep module provides powerful functionality through a clean, minimal API
- Shallow modules have interfaces nearly as complex as their implementations (anti-pattern)

**Managing Complexity (The Enemy)**

Complexity manifests in three ways:

1. **Change Amplification**: A simple conceptual change requires modifications in many places
   - Target: < 3/10 for this project
   - Example: Adding a new event type should only touch template JSON and trigger config

2. **Cognitive Load**: How much a developer must know to make a change safely
   - Target: < 5/10 for this project
   - Example: Understanding bet lifecycle shouldn't require reading all modules

3. **Unknown Unknowns**: Non-obvious behaviors that cause unexpected failures
   - Target: < 4/10 for this project
   - Example: Firestore listener detachment behavior must be documented

**Information Hiding**
- Each module should encapsulate knowledge that other modules don't need
- Minimize dependencies between modules
- Expose only what is necessary through interfaces

### Functional Core, Imperative Shell (FCIS)

The project strictly separates pure business logic from I/O operations:

**Functional Core (Pure Functions)**
- Deterministic: same inputs always produce same outputs
- No side effects: no I/O, no mutations of external state
- Easy to test: no mocks or stubs needed
- Easy to reason about: behavior is self-contained

**Imperative Shell (I/O Orchestration)**
- Thin layer that performs I/O operations
- Delegates all business logic to the core
- Orchestrates calls to pure functions
- Handles async operations, network calls, database operations

**Benefits**
- Testability: Core logic tested without I/O complexity
- Reliability: Pure functions eliminate entire classes of bugs
- Maintainability: Clear boundaries between what and how
- Performance: Pure functions can be memoized and parallelized

## 3. SmallBets.live Architecture Patterns

### Pattern Summary

Based on proven patterns from the FamilyFeud reference implementation, adapted for SmallBets.live:

**1. Functional Core, Imperative Shell Separation**
- **Core**: `game_logic.py` contains all scoring calculations, bet eligibility rules, point validation
- **Shell**: `main.py` (FastAPI endpoints), `triggers.py` (Firestore triggers)
- Clean separation enables pure unit tests for business logic

**2. Pydantic Models with Firestore Serialization**
- All data models use Pydantic for validation
- Each model includes `to_dict()` for Firestore writes
- Each model includes `from_dict()` classmethod for Firestore reads
- Serialization logic is pure (no I/O in model code)

**3. Dependency Injection (FastAPI Pattern)**
- Reusable dependencies for common operations (room lookup, auth validation)
- Type-annotated dependencies using `Annotated[Type, Depends(...)]`
- Cleaner endpoint signatures with automatic validation

**4. Header-Based Authentication**
- Simple admin auth using `X-Host-Id` header
- No JWT complexity for MVP
- Host ID stored in sessionStorage on frontend
- Backend validates host ID against room's host_id field

**5. Visibility Control**
- Different data views for host vs players
- Players see: current bet, leaderboard, their own selections
- Hosts see: admin controls, automation status, all bets, transcript log
- Implemented via `build_room_status(room, is_host)` function

**6. Room Lifecycle Management**
- Status progression: `"waiting"` → `"active"` → `"finished"`
- 24-hour expiry with cleanup job
- Room code recycling for expired codes
- 4-character codes excluding confusing characters (O/0, I/1/L)

**7. Real-time Sync Strategy**
- All state changes propagate via Firestore
- Frontend uses Firestore listeners for instant updates
- No direct client-to-client communication
- Optimistic UI updates allowed with rollback on error

## 4. The 9 Architectural Red Flags

These are anti-patterns to actively avoid during development:

| Red Flag | What to Avoid in SmallBets | How to Detect | Fix |
|----------|---------------------------|---------------|-----|
| **Shallow Module** | Bet service with interface as complex as implementation | Interface has many parameters/methods but little hidden complexity | Simplify interface, hide more details |
| **Information Leakage** | Duplicating room code validation logic across modules | Same validation appears in multiple files | Extract to shared validator module |
| **Temporal Decomposition** | Organizing code by "first this, then that" instead of concepts | File/class names describe sequence (step1, step2) | Reorganize by concept (rooms, bets, users) |
| **Pass-Through Method** | API endpoint that just calls service without adding value | Method body is single delegation call | Remove wrapper or add validation/transformation |
| **Repetition** | Firestore serialization code duplicated per model | Copy-paste of to_dict/from_dict patterns | Create base class or mixin for serialization |
| **Special-General Mixture** | Admin controls mixed into player UI components | Single component handles both concerns with conditionals | Split into PlayerView and AdminView components |
| **Conjoined Methods** | Bet opening + timer start that can't be separated | Two operations always called together | Combine into single method or clarify independence |
| **Hard to Name** | Functions with vague names like "handleBetStuff" | Name doesn't clearly describe purpose | Refactor to have single clear responsibility |
| **Nonobvious Code** | Transcript parsing with hidden side effects | Surprising behavior not evident from signature | Make side effects explicit or eliminate them |

**Critical Rule**: Any red flag found during review must be resolved before merge.

## 5. Module Depth Guidelines

Expected depth ratings for major modules (Deep = good, Shallow = refactor needed):

| Module | Expected Depth | Interface | Hidden Complexity | Rationale |
|--------|---------------|-----------|-------------------|-----------|
| `game_logic.py` | **DEEP** | `calculate_scores(bet, winner)` → `dict[str, int]` | Points distribution, tie handling, edge cases, eligibility validation | Core business logic should hide complexity |
| `transcript_parser.py` | **DEEP** | `extract_winner(text, options)` → `Optional[str]` | Fuzzy matching, NLP, confidence scoring, keyword variations | NLP complexity hidden behind simple interface |
| `bet_service.py` | **MEDIUM** | `open_bet(room, options)`, `resolve_bet(bet, winner)` | State transitions, validation, Firestore writes | Service layer provides meaningful abstraction |
| `main.py` (API) | **SHALLOW** | HTTP endpoints with path parameters | Just delegation to services, input validation | Thin HTTP layer, no business logic |
| React components | **SHALLOW** | Props interface | Thin presentation, hooks delegate to services | UI components should be simple |

**Review Guideline**: If a module expected to be DEEP has trivial implementation, consider whether it's providing real value. If a module expected to be SHALLOW has complex logic, extract that logic to a deeper module.

## 6. FCIS Implementation Map

### Functional Core (Pure Functions)

**files/game_logic.py** - All scoring and bet resolution logic
```python
# Pure functions - deterministic, no I/O, testable without mocks
def calculate_scores(bet: Bet, winning_option: str) -> dict[str, int]:
    """Calculate point changes for all participants"""
    # Pure calculation logic only

def validate_bet_eligibility(user_points: int, bet_cost: int) -> bool:
    """Check if user can afford bet"""
    return user_points >= bet_cost

def distribute_pot(winners: list[str], pot_total: int) -> dict[str, int]:
    """Split pot evenly among winners"""
    # Pure division logic
```

**files/transcript_parser.py** - Winner extraction (pure string processing)
```python
# Pure NLP - no database calls, just text processing
def extract_winner(text: str, options: list[str]) -> Optional[str]:
    """Parse transcript text to identify winner"""
    # Fuzzy matching, keyword detection, confidence scoring
    # All pure string operations
```

**frontend/src/utils/** - Client-side pure functions
- Timer calculations (time remaining, progress percentage)
- Point formatting (display logic)
- Validation helpers (client-side input validation)

### Imperative Shell (I/O Operations)

**files/main.py** - FastAPI HTTP endpoints
```python
# I/O shell - handles HTTP, delegates to core
@app.post("/api/rooms/{code}/bets/place")
async def place_bet(code: str, option: str):
    # 1. Parse HTTP request
    # 2. Call Firestore to get room/user data
    # 3. Call core logic: validate_bet_eligibility()
    # 4. Call core logic: calculate_scores()
    # 5. Write results to Firestore
    # 6. Return HTTP response
```

**files/triggers.py** - Firestore triggers
```python
# I/O shell - responds to database events
@firestore_fn.on_document_created(document="transcripts/{roomCode}")
def on_transcript_update(event):
    # 1. Read Firestore document
    # 2. Call core logic: extract_winner()
    # 3. Write winner to Firestore
```

**frontend/src/services/** - Firebase SDK calls
- All Firestore reads/writes
- All authentication operations
- All real-time listener setup

**frontend/src/hooks/** - React hooks with side effects
- `useFirestoreDocument`: Sets up listeners (I/O)
- `useAuth`: Manages session state (I/O)
- All async operations, network calls

**Critical Rule**: NO business logic in shell files. NO I/O in core files. Violations block merge.

## 7. Complexity Targets

### Change Amplification Target: < 3/10

**Goal**: Adding common features should require minimal code changes

**Examples**:
- Adding new event type: Only requires new template JSON + trigger keywords config
- Adding new bet category: Only requires template update
- Changing points calculation: Only requires change in game_logic.py

**Anti-pattern to Avoid**: Bet logic duplicated across API endpoints, requiring updates in 5+ files for single conceptual change

### Cognitive Load Target: < 5/10

**Goal**: Developer can understand component behavior without reading entire codebase

**Examples**:
- Bet lifecycle should be understandable from state machine diagram + game_logic.py
- Component responsibilities clear from file names and interface signatures
- Minimal hidden dependencies between modules

**Anti-pattern to Avoid**: Need to trace through 7 files to understand how bet resolution works

### Unknown Unknowns Target: < 4/10

**Goal**: Minimize surprising behaviors and hidden edge cases

**Required Documentation**:
- Firestore listener lifecycle (when they detach, how to clean up)
- Timer synchronization assumptions (client clocks may drift)
- Transcript processing failure modes (what happens when winner can't be extracted)
- Race conditions (concurrent bet placements, room expiry during active bet)

**Anti-pattern to Avoid**: Undocumented assumptions that cause production bugs

## 8. Performance Constraints

Critical paths with strict performance requirements:

| Path | Requirement | Anti-patterns to Avoid | How to Verify |
|------|-------------|------------------------|---------------|
| **Transcript processing** | < 50ms per entry | Allocation in fuzzy matching loop, regex recompilation per call | Benchmark with 1000 entries |
| **Bet state sync** | < 500ms to all clients | N+1 Firestore queries, broadcasting to each client individually | Test with 20 concurrent clients |
| **Timer countdown** | 60fps smooth | Re-rendering entire component tree, heavy calculations in render | Chrome DevTools Performance tab |
| **Leaderboard update** | < 100ms calculation | O(N²) sorting with nested loops, recalculating entire history | Benchmark with 50 participants |

**Performance Review Checkpoint**: Before Phase 5 deployment, run `/software-architect performance` to identify anti-patterns.

## 9. Architecture Review Workflow

### When to Review

**Mandatory Reviews** (blocking gates):
- After each implementation phase (SPEC.md Phase 1-5)
- Before merging significant features or refactors
- Pre-deployment (mandatory gate before production launch)

**Discretionary Reviews** (recommended):
- When complexity "feels wrong" during development
- When considering major architectural changes
- When adding new module or significant abstraction

### How to Invoke

Use the `/software-architect` skill with specific modes:

```bash
# General architecture review (default)
/software-architect

# Scan for all 9 architectural red flags
/software-architect red-flags

# Evaluate module depth (deep vs shallow)
/software-architect depth

# Analyze complexity (change amplification, cognitive load, unknown unknowns)
/software-architect complexity

# Validate Functional Core / Imperative Shell separation
/software-architect fcis

# Identify performance anti-patterns in hot paths
/software-architect performance

# Advise on whether to split or combine specific code
/software-architect split

# Review specific file or code snippet
/software-architect review <file-path>
```

### Review Checkpoints (Mapped to Implementation Plan)

#### Phase 1: Core Infrastructure (Days 1-3)
**After implementing**: Room creation, data models, real-time sync

**Reviews to Run**:
```bash
/software-architect fcis       # Validate data models are pure (no I/O)
/software-architect depth      # Ensure service modules have simple interfaces
```

**Target Files**:
- Room creation logic
- Pydantic models (Room, Bet, User)
- Firebase service wrappers

**Acceptance Criteria**:
- Zero FCIS violations in data models
- Service modules rated MEDIUM or DEEP
- No Firestore calls in to_dict/from_dict methods

#### Phase 2: Player Experience (Days 4-6)
**After implementing**: Bet UI, timer, leaderboard

**Reviews to Run**:
```bash
/software-architect complexity   # Check for change amplification in React tree
/software-architect red-flags    # Scan for shallow modules and repetition
```

**Target Files**:
- components/player/*
- hooks/*
- services/*

**Acceptance Criteria**:
- No shallow modules in core components
- Complexity < 5/10 (cognitive load)
- Zero repetition in Firestore listener setup

#### Phase 3: Automation Engine (Days 7-10)
**After implementing**: Transcript ingestion, triggers, winner extraction

**Reviews to Run**:
```bash
/software-architect fcis          # Ensure parsing is pure, triggers are shell
/software-architect performance   # Check hot paths (transcript < 50ms)
/software-architect red-flags     # Full scan for all 9 flags
```

**Target Files**:
- transcript_parser.py
- triggers.py
- Keyword matching logic

**Acceptance Criteria**:
- Zero critical violations in any category
- Performance targets met (< 50ms per transcript entry)
- Winner extraction is pure function (no I/O)

#### Phase 4: Admin Controls (Days 11-12)
**After implementing**: Admin panel, automation monitoring

**Reviews to Run**:
```bash
/software-architect complexity   # Verify admin features don't increase load
/software-architect depth        # Check admin components are shallow (thin UI)
```

**Target Files**:
- components/admin/*
- Automation controls

**Acceptance Criteria**:
- Admin code doesn't leak into player views (no special-general mixture)
- Admin components are SHALLOW (just presentation)
- No duplication of player UI logic

#### Phase 5: Templates & Testing (Days 13-14)
**Before deployment**: Final comprehensive review

**Reviews to Run**:
```bash
/software-architect              # Full comprehensive review
/software-architect complexity   # Final complexity audit across all modules
/software-architect performance  # Validate all hot paths meet requirements
```

**Target Files**: All critical files

**Acceptance Criteria**:
- All complexity targets met (change amp < 3, cognitive < 5, unknowns < 4)
- Zero critical issues in any category
- All performance requirements validated via benchmarks

### Acceptance Criteria for Reviews

#### Critical (Must Fix Before Merge)
- FCIS violations in game logic (business rules in I/O code)
- Shallow modules in core services (bet_service, game_logic)
- Performance violations in hot paths (transcript processing > 50ms)
- Information leakage (same logic duplicated across modules)

#### High Priority (Fix Before Deployment)
- Complexity scores > 7/10 in any dimension
- More than 2 red flags in any single module
- Pass-through methods without clear value
- Hard-to-name components or functions

#### Medium Priority (Fix in Follow-up)
- Repetition that could be abstracted
- Nonobvious code that needs better comments
- Minor depth issues in utility modules

## 10. Project-Specific Architectural Constraints

Hard rules for this project (zero tolerance for violations):

### FCIS Compliance (Zero Tolerance)

**Requirements**:
- All game logic MUST be pure functions (scoring, eligibility, validation)
- NO Firestore calls in components (use hooks/services only)
- NO business logic in API endpoints (delegate to services)
- Timer calculations MUST be client-side (no server polling)

**Enforcement**: CI gate blocks merge if violations detected via `/software-architect fcis`

### Performance Requirements

**Hot Paths** (must meet targets):
- Transcript processing: < 50ms per entry
- Bet state sync to all clients: < 500ms
- Leaderboard recalculation: < 100ms (after each bet)
- Timer countdown: 60fps smooth rendering

**Anti-patterns** (will fail performance review):
- Allocation in fuzzy matching loop
- N+1 Firestore queries
- Re-rendering entire component tree on timer tick
- O(N²) algorithms in hot paths

### Module Depth Rules

**DEEP modules required**:
- game_logic.py (scoring, bet resolution)
- transcript_parser.py (winner extraction)

**SHALLOW modules required**:
- main.py API endpoints (just delegation)
- React components (thin presentation)

**NEVER allowed**:
- Business logic in React render functions
- Firestore operations in components
- I/O operations in game_logic.py

### Real-time Sync Constraints

**Requirements**:
- All state changes MUST propagate via Firestore (no direct client updates)
- Optimistic UI updates allowed only with rollback on error
- Timer sync: client-calculated, no polling
- Listener cleanup required in useEffect return

**Anti-patterns**:
- Direct setState without Firestore write
- Polling server for state changes
- Memory leaks from undetached listeners

## 11. Decision Log

Track major architectural decisions with rationale and trade-offs:

| Date | Decision | Rationale | Trade-offs |
|------|----------|-----------|------------|
| 2026-02-01 | Use FastAPI + Firestore instead of Firebase Functions only | Better FCIS separation, easier local dev, matches FamilyFeud pattern | More deployment complexity vs pure Firebase |
| 2026-02-01 | Client-side timer countdown | Eliminates server polling, reduces latency, better UX | Requires clock sync assumption (tolerable drift < 1s) |
| 2026-02-01 | Fixed-point betting (100 pts/bet) | Simplifies MVP scoring logic, reduces cognitive load | Less flexibility for future variable betting (acceptable for MVP) |
| 2026-02-01 | Header-based auth (X-Host-Id) instead of JWT | Simpler MVP implementation, adequate for room-based security | Less secure than JWT (acceptable for virtual points only) |
| 2026-02-01 | Manual transcript feed for MVP | Most reliable for first event, no external API dependencies | Requires human operator during event (acceptable for MVP) |

**Future Decisions**: Add new rows as architectural choices are made during implementation.

## 12. References

### Project Documentation
- [SPEC.md](./SPEC.md): Product specification and implementation timeline
  - Lines 105-232: Detailed FCIS code examples for this project
- [CLAUDE.md](./CLAUDE.md): Project context and development workflow

### Architecture Tools
- `~/.claude/skills/software-architect/`: Plugin for automated architecture reviews
  - SKILL.md: Core concepts (deep modules, 9 red flags, complexity, FCIS)
  - SKILL.codex.md: Review modes and output formats

### Source Materials
- "A Philosophy of Software Design" (2nd Edition) by John Ousterhout
  - Deep modules (Chapter 4)
  - Information hiding (Chapter 5)
  - 9 red flags (Chapter 20)
  - Complexity manifestations (Chapter 2)
- Functional Core, Imperative Shell pattern by Gary Bernhardt
  - [Boundaries talk](https://www.destroyallsoftware.com/talks/boundaries)
  - Separation of pure logic from side effects

### Review Workflow
Invoke `/software-architect` skill with modes:
- `fcis`, `red-flags`, `depth`, `complexity`, `performance`, `split`, `review <file>`
