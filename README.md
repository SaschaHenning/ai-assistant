# AI Assistant

Personal AI gateway that routes messages from Telegram and a web UI through Claude with a plugin-based skill system via MCP (Model Context Protocol). Runs as a native macOS menu bar app.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash
```

This installs all prerequisites automatically (Xcode CLI tools, Homebrew, bun, ffmpeg), downloads the project, fetches the Whisper model, prompts for your Telegram credentials, compiles the menu bar app, and launches it. Look for **🤖** in your menu bar.

## Architecture

```
apps/gateway/        → Hono HTTP server + MCP server
apps/web/            → React 19 + Vite + Tailwind
packages/core/       → Shared types: Skill, NormalizedMessage, Platform
packages/db/         → Drizzle ORM + SQLite
packages/skill-runtime/ → Skill loader, registry, MCP bridge
skills/              → Plugin directory (connectors + tools)
tools/               → macOS menu bar app + installer
```

### Ports

| | Dev | Production (installed) |
|---|---|---|
| Gateway API | 4300 | 4310 |
| MCP Server | 4301 | 4311 |
| Web UI | 4302 | 4312 |

### Message Flow

1. Platform connector (Telegram / web) receives message
2. Gateway normalizes it and looks up the session
3. Claude CLI is invoked with MCP tools from the skill registry
4. Response streams back to the platform

## Development

```bash
bun run dev          # Start gateway + web + skills in watch mode
bun run build        # Build all packages
bun run test-runner.ts  # Run tests
```

## Menu Bar App

After installation, the **🤖** menu bar icon provides:

| Menu Item | Action |
|---|---|
| 🟢 Running / 🔴 Stopped | Server health status (polls every 2s) |
| Start / Stop Server | Toggle the gateway process |
| Open Web UI | Opens `localhost:4312` (Chat, Requests, Memory, Schedules) |
| Edit Config | Opens `.env` in TextEdit |
| Quit | Stops server and exits |

### Config Locations

| File | Path |
|---|---|
| App bundle | `~/Applications/AI Assistant.app` |
| App config | `~/Library/Application Support/AI-Assistant/config.json` |
| Environment | `~/.ai-assistant/.env` |
| Launch agent | `~/Library/LaunchAgents/com.ai-assistant.tray.plist` |

## Telegram Bot Setup

The installer prompts for a Telegram bot token and allowed user IDs. If you need to create a bot or find your user ID:

1. **Create a bot** — Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the prompts. You'll receive a token like `123456789:ABCdefGhIjKlMnOpQrStUvWxYz`.
2. **Get your user ID** — Message [@userinfobot](https://t.me/userinfobot) on Telegram. It replies with your numeric user ID.
3. **Configure** — Add both values to `~/.ai-assistant/.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-token-here
   TELEGRAM_ALLOWED_USERS=your-user-id
   ```
   Multiple user IDs can be comma-separated.

For more details, see the [Telegram Bot API documentation](https://core.telegram.org/bots#how-do-i-create-a-bot).

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/uninstall.sh | bash
```

Stops the app, removes the launch agent, app bundle, config, and optionally the repository.
