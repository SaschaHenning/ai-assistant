# AI Assistant

Personal AI gateway that routes messages from Telegram and a web UI through Claude with a plugin-based skill system via MCP (Model Context Protocol).

## Installation

There are three ways to run AI Assistant: **Docker** (recommended for servers), **macOS Menu Bar App** (one-line install), or **manual from source** (for development).

---

### Option 1: Docker

Best for headless servers, always-on setups, or keeping your host system clean.

**Prerequisites:** Docker and Docker Compose

```bash
git clone https://github.com/SaschaHenning/ai-assistant.git
cd ai-assistant
```

Create a `.env` file:

```env
# Telegram Bot (optional — get a token from @BotFather on Telegram)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ALLOWED_USERS=your-telegram-user-id

# Gateway
GATEWAY_PORT=4300
MCP_PORT=4301

# Database (Docker volume path)
DATABASE_PATH=/app/data/assistant.db
```

Start the container:

```bash
docker compose up -d
```

Authenticate Claude CLI (required once — credentials are persisted in a Docker volume):

```bash
docker exec -it ai-assistant-assistant-1 claude login
```

The web UI is available at `http://localhost:4300`.

**Pull from GHCR instead of building locally:**

```yaml
# docker-compose.yml
services:
  assistant:
    image: ghcr.io/saschahenning/ai-assistant:latest
    ports:
      - "4300:4300"
    volumes:
      - assistant-data:/app/data
      - claude-config:/home/bun/.claude
    env_file: .env
    environment:
      - DATABASE_PATH=/app/data/assistant.db
    restart: unless-stopped

volumes:
  assistant-data:
  claude-config:
```

---

### Option 2: macOS Menu Bar App

One-line install that sets up everything automatically (Xcode CLI tools, Homebrew, Bun, ffmpeg, Whisper model) and adds a **🤖** icon to your menu bar.

```bash
curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash
```

The installer prompts for your Telegram bot token and allowed user IDs during setup.

**Menu bar controls:**

| Menu Item | Action |
|---|---|
| 🟢 Running / 🔴 Stopped | Server health status (polls every 2s) |
| Start / Stop Server | Toggle the gateway process |
| Open Web UI | Opens `localhost:4312` |
| Edit Config | Opens `.env` in TextEdit |
| Quit | Stops server and exits |

**Config locations:**

| File | Path |
|---|---|
| App bundle | `~/Applications/AI Assistant.app` |
| Environment | `~/.ai-assistant/.env` |
| Database | `~/.ai-assistant/data/assistant.db` |
| Launch agent | `~/Library/LaunchAgents/com.ai-assistant.tray.plist` |

**Sample `.env`** (at `~/.ai-assistant/.env`):

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ALLOWED_USERS=your-telegram-user-id

# Gateway (tray app uses 431x ports to avoid conflicts with dev)
GATEWAY_PORT=4310
MCP_PORT=4311
```

**Uninstall:**

```bash
curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/uninstall.sh | bash
```

---

### Option 3: From Source

For development or customization. Requires [Bun](https://bun.sh) and [ffmpeg](https://ffmpeg.org) (for voice message transcription).

```bash
git clone https://github.com/SaschaHenning/ai-assistant.git
cd ai-assistant
bun install
```

Create a `.env` file:

```env
# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ALLOWED_USERS=your-telegram-user-id

# Gateway
GATEWAY_PORT=4300
MCP_PORT=4301

# Output directory for generated files (optional)
OUTPUT_DIR=/path/to/your/output/folder
```

Start in development mode (gateway + web UI + skills with hot reload):

```bash
bun run dev
```

| Service | URL |
|---|---|
| Gateway API | `http://localhost:4300` |
| MCP Server | `http://localhost:4301/mcp` |
| Web UI | `http://localhost:4302` |

**Other commands:**

```bash
bun run build             # Build all packages
bun run test-runner.ts    # Run tests
```

---

## Telegram Bot Setup

1. **Create a bot** — Message [@BotFather](https://t.me/BotFather) on Telegram, send `/newbot`, and follow the prompts. You'll receive a token like `123456789:ABCdefGhIjKlMnOpQrStUvWxYz`.
2. **Get your user ID** — Message [@userinfobot](https://t.me/userinfobot) on Telegram. It replies with your numeric user ID.
3. **Configure** — Add both values to your `.env` file. Multiple user IDs can be comma-separated.

For more details, see the [Telegram Bot API documentation](https://core.telegram.org/bots#how-do-i-create-a-bot).

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

### Message Flow

1. Platform connector (Telegram / web) receives message
2. Gateway normalizes it and looks up the session
3. Claude CLI is invoked with MCP tools from the skill registry
4. Response streams back to the platform
