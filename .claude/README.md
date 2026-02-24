# Claude Code Configuration

This directory contains project-specific configuration for Claude Code.

## Skills

### e2e-test

Automated end-to-end testing skill that validates the complete SmallBets.live application flow using Playwright.

**What it tests:**
- Room creation and joining
- Multi-user real-time sync
- Bet placement and resolution
- Point calculations and leaderboard
- Error handling and edge cases

**Prerequisites:**
1. Firebase emulator running (`firebase emulators:start`)
2. Backend API running (`cd backend && ./start_dev.sh`)
3. Frontend dev server running (`cd frontend && npm run dev`)

**Usage:**
```
/e2e-test
```

Or simply ask: "Run the e2e test"

**Location:** `.claude/skills/e2e-test/SKILL.md`

## MCP Servers

### Playwright MCP Server

The project includes the official Microsoft Playwright MCP server for browser automation testing.

**What it does:**
- Enables automated browser testing through Claude Code
- Provides tools for navigating, clicking, filling forms, taking screenshots
- Used by the e2e-test skill for browser automation

**Installation:**
The server is automatically started by Claude Code using the configuration in `settings.local.json`. The first time you use it, it will download the required browser binaries (Chromium).

**Available Tools:**
- `mcp__playwright__browser_navigate` - Navigate to a URL
- `mcp__playwright__browser_click` - Click elements
- `mcp__playwright__browser_type` - Fill input fields
- `mcp__playwright__browser_take_screenshot` - Take screenshots
- `mcp__playwright__browser_snapshot` - Get page accessibility tree
- `mcp__playwright__browser_evaluate` - Run JavaScript in the page
- And more...

**Configuration:** `.claude/settings.local.json`

## Reload Required

After modifying configuration files, you may need to **restart Claude Code** for changes to take effect.
