# Lessons Learned

## 2026-03-15: Always add tests with feature changes

**Pattern**: Shipped a feature (room link sharing + My Rooms) without tests on the first commit. User had to ask "did you add tests sufficiently?" to catch the gap.

**Rule**: Every feature change MUST include tests in the same commit. Before committing, ask: "Did I add/update tests for every new component, hook, and behavioral change?" This is now codified in CLAUDE.md under "Test Requirements".

**Checklist before committing**:
1. New components → new `*.test.tsx` files
2. New hooks → new `*.test.ts` files
3. Modified components → updated existing tests for new behavior
4. All tests pass (`npx vitest run`)
