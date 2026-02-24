# Claude Code Configuration

This directory contains project-specific configuration for Claude Code.

## MCP Servers

### Playwright MCP Server

The project includes the official Microsoft Playwright MCP server for browser automation testing.

**What it does:**
- Enables automated browser testing through Claude Code
- Provides tools for navigating, clicking, filling forms, taking screenshots
- Used for end-to-end testing of the betting flow

**Installation:**
The server is automatically started by Claude Code using the configuration in `config.json`. The first time you use it, it will download the required browser binaries (Chromium).

**Available Tools:**
- `playwright_navigate` - Navigate to a URL
- `playwright_click` - Click elements
- `playwright_fill` - Fill input fields
- `playwright_screenshot` - Take screenshots
- `playwright_evaluate` - Run JavaScript in the page
- And more...

**Usage:**
Once configured, you can ask Claude to test flows like:
- "Test the room creation flow end-to-end"
- "Verify that users can place bets"
- "Take a screenshot of the room page"

## Reload Required

After modifying `config.json`, you need to **restart Claude Code** for changes to take effect.
