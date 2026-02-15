# AI Assistant — macOS Menu Bar App

A native macOS menu bar app that manages the AI Assistant gateway server. No Electron, no dependencies — just a single Swift binary.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash
```

### What the installer does

1. Checks prerequisites (`bun`, `swiftc`, `git`, `ffmpeg`)
2. Clones the repo to `~/.ai-assistant/`
3. Installs dependencies via `bun install`
4. Downloads the Whisper model (`ggml-small.bin`)
5. Prompts for Telegram bot token and allowed user IDs
6. Writes `.env` with your config
7. Compiles the Swift menu bar app
8. Creates `~/Applications/AI Assistant.app`
9. Optionally sets up launch-on-login
10. Opens the app

### Prerequisites

| Tool | Install |
|---|---|
| bun | `curl -fsSL https://bun.sh/install \| bash` |
| swiftc | `xcode-select --install` |
| git | `xcode-select --install` |
| ffmpeg | `brew install ffmpeg` |

## Usage

After installation, look for **🤖** in your menu bar.

| Menu Item | Action |
|---|---|
| 🟢 Running / 🔴 Stopped | Server status |
| Start / Stop Server | Toggle the gateway process |
| Open Web UI | Opens `localhost:4302` in your browser |
| Open Logs | Opens `localhost:4302/logs` |
| Edit Config | Opens `.env` in TextEdit |
| Quit | Stops the server and exits |

The app polls `localhost:4300/health` every 2 seconds to update the status indicator.

## Files

```
tools/
├── install.sh               # One-liner installer
├── tray-app/
│   └── main.swift            # Native Swift menu bar app (AppKit)
└── README.md
```

### Config locations

| File | Path |
|---|---|
| App bundle | `~/Applications/AI Assistant.app` |
| App config | `~/Library/Application Support/AI-Assistant/config.json` |
| Environment | `~/.ai-assistant/.env` |
| Launch agent | `~/Library/LaunchAgents/com.ai-assistant.tray.plist` |

## Uninstall

```bash
rm -rf ~/Applications/AI\ Assistant.app
rm -rf ~/Library/Application\ Support/AI-Assistant
rm -f ~/Library/LaunchAgents/com.ai-assistant.tray.plist
rm -rf ~/.ai-assistant
```
