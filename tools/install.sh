#!/usr/bin/env bash
set -euo pipefail

# ─── AI Assistant Installer ──────────────────────────────────────────────────
# Usage: curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash

REPO_TARBALL="https://github.com/SaschaHenning/ai-assistant/archive/refs/heads/main.tar.gz"
INSTALL_DIR="$HOME/.ai-assistant"
APP_NAME="AI Assistant"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
CONFIG_DIR="$HOME/Library/Application Support/AI-Assistant"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.ai-assistant.tray.plist"
WHISPER_MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
VERSION_URL="https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/VERSION"

# Production ports (dev uses 4300-4302)
GATEWAY_PORT=4310
MCP_PORT=4311

# ─── Colors ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

require_tty() {
    if [ ! -t 0 ] && [ ! -e /dev/tty ]; then
        error "This script requires an interactive terminal (TTY). Run it directly in a terminal, not via curl|bash in a non-interactive context."
    fi
}

require_tty

# ─── Step 1: Check and install prerequisites ────────────────────────────────

echo ""
echo -e "${BOLD}🤖 AI Assistant Installer${NC}"
echo "────────────────────────────────────────"
echo ""

info "Checking prerequisites..."
echo ""

# Xcode Command Line Tools (provides swiftc)
if ! xcode-select -p &>/dev/null; then
    info "Installing Xcode Command Line Tools (provides swiftc)..."
    xcode-select --install
    echo ""
    echo -e "${YELLOW}  A system dialog should have appeared.${NC}"
    echo -e "${YELLOW}  Complete the installation, then re-run this script.${NC}"
    echo ""
    exit 0
else
    ok "Xcode CLI tools installed"
fi

# Verify swiftc
if command -v swiftc &>/dev/null; then
    ok "swiftc found: $(command -v swiftc)"
else
    error "swiftc not found even though Xcode CLI tools are installed. Run: xcode-select --install"
fi

# Homebrew
if ! command -v brew &>/dev/null; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add brew to PATH for this session (Apple Silicon vs Intel)
    if [ -f "/opt/homebrew/bin/brew" ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f "/usr/local/bin/brew" ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
else
    ok "Homebrew found: $(command -v brew)"
fi

# Bun
if ! command -v bun &>/dev/null; then
    info "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    # Source bun into current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    ok "bun installed"
else
    ok "bun found: $(command -v bun)"
fi

# ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    info "Installing ffmpeg via Homebrew..."
    brew install ffmpeg
    ok "ffmpeg installed"
else
    ok "ffmpeg found: $(command -v ffmpeg)"
fi

BUN_PATH="$(command -v bun)"

echo ""

# ─── Step 2: Download or update project ──────────────────────────────────────

info "Downloading project files..."

TMPDIR_DL="$(mktemp -d)"
curl -fsSL "$REPO_TARBALL" | tar -xz -C "$TMPDIR_DL"

# GitHub tarballs extract to <repo>-<branch>/ directory
EXTRACTED_DIR="$TMPDIR_DL/ai-assistant-main"

if [ -d "$INSTALL_DIR" ]; then
    # Preserve user data: .env, data/, node_modules/
    info "Updating existing installation..."
    rsync -a --exclude='.env' --exclude='data/' --exclude='node_modules/' "$EXTRACTED_DIR/" "$INSTALL_DIR/"
    ok "Project updated (kept .env, data, node_modules)"
else
    mv "$EXTRACTED_DIR" "$INSTALL_DIR"
    ok "Project downloaded to $INSTALL_DIR"
fi

rm -rf "$TMPDIR_DL"

echo ""

# ─── Step 3: Install dependencies ───────────────────────────────────────────

info "Installing dependencies..."
cd "$INSTALL_DIR"
bun install
ok "Dependencies installed"
echo ""

# ─── Step 4: Download whisper model ─────────────────────────────────────────

MODEL_DIR="$INSTALL_DIR/data/models"
MODEL_FILE="$MODEL_DIR/ggml-small.bin"

if [ -f "$MODEL_FILE" ]; then
    ok "Whisper model already present"
else
    info "Downloading whisper model (ggml-small.bin, ~466 MB)..."
    mkdir -p "$MODEL_DIR"
    curl -fSL --progress-bar "$WHISPER_MODEL_URL" -o "$MODEL_FILE"
    ok "Whisper model downloaded"
fi

echo ""

# ─── Step 5: Prompt for config ──────────────────────────────────────────────

ENV_FILE="$INSTALL_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    info "Existing .env found"
    read -rp "Overwrite existing config? [y/N] " OVERWRITE < /dev/tty
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        ok "Keeping existing .env"
        SKIP_ENV=true
    else
        SKIP_ENV=false
    fi
else
    SKIP_ENV=false
fi

if [ "$SKIP_ENV" = false ]; then
    echo ""
    info "Configure your AI Assistant:"
    echo ""

    read -rp "  Telegram Bot Token: " TELEGRAM_BOT_TOKEN < /dev/tty
    read -rp "  Telegram Allowed User IDs (comma-separated): " TELEGRAM_ALLOWED_USERS < /dev/tty

    # ─── Step 6: Write .env ──────────────────────────────────────────────────

    cat > "$ENV_FILE" <<EOF
# Telegram Bot
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}

# Gateway (production ports — dev uses 4300/4301)
GATEWAY_PORT=${GATEWAY_PORT}
MCP_PORT=${MCP_PORT}

# Database
DATABASE_PATH=./data/assistant.db
EOF

    ok ".env written"
fi

echo ""

# ─── Step 7: Stop running tray app ──────────────────────────────────────────

if pgrep -f "ai-assistant-tray" &>/dev/null; then
    info "Stopping running AI Assistant..."
    pkill -f "ai-assistant-tray" 2>/dev/null || true
    sleep 1
    ok "Old instance stopped"
else
    info "No running instance found"
fi

echo ""

# ─── Step 8: Compile Swift app ──────────────────────────────────────────────

info "Compiling menu bar app..."

SWIFT_SRC="$INSTALL_DIR/tools/tray-app/main.swift"
TRAY_BIN="$INSTALL_DIR/tools/tray-app/ai-assistant-tray"

if [ ! -f "$SWIFT_SRC" ]; then
    error "Swift source not found: $SWIFT_SRC"
fi

swiftc -O -o "$TRAY_BIN" "$SWIFT_SRC" -framework Cocoa
ok "Menu bar app compiled"
echo ""

# ─── Step 9: Create .app bundle ─────────────────────────────────────────────

info "Creating app bundle..."

mkdir -p "$HOME/Applications"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$TRAY_BIN" "$APP_DIR/Contents/MacOS/ai-assistant-tray"

cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ai-assistant-tray</string>
    <key>CFBundleIdentifier</key>
    <string>com.ai-assistant.tray</string>
    <key>CFBundleName</key>
    <string>AI Assistant</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
PLIST

ok "App bundle created at $APP_DIR"
echo ""

# ─── Step 10: Write config.json ─────────────────────────────────────────────

info "Writing config..."

mkdir -p "$CONFIG_DIR"

# Read version from downloaded project
APP_VERSION="$(cat "$INSTALL_DIR/VERSION" 2>/dev/null || echo "0.0.0")"
APP_VERSION="$(echo "$APP_VERSION" | tr -d '[:space:]')"

cat > "$CONFIG_DIR/config.json" <<EOF
{
    "projectRoot": "${INSTALL_DIR}",
    "bunPath": "${BUN_PATH}",
    "gatewayPort": ${GATEWAY_PORT},
    "mcpPort": ${MCP_PORT},
    "version": "${APP_VERSION}"
}
EOF

ok "Config written to $CONFIG_DIR/config.json"
echo ""

# ─── Step 11: Launch agent (start on login) ─────────────────────────────────

read -rp "Start AI Assistant on login? [y/N] " START_ON_LOGIN < /dev/tty

if [[ "$START_ON_LOGIN" =~ ^[Yy]$ ]]; then
    mkdir -p "$HOME/Library/LaunchAgents"

    cat > "$LAUNCH_AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-assistant.tray</string>
    <key>ProgramArguments</key>
    <array>
        <string>${APP_DIR}/Contents/MacOS/ai-assistant-tray</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
EOF

    ok "Launch agent created — will start on login"
else
    # Remove stale launch agent if present
    [ -f "$LAUNCH_AGENT" ] && rm -f "$LAUNCH_AGENT"
    info "Skipped — you can launch from ~/Applications"
fi

echo ""

# ─── Step 12: Open the app ──────────────────────────────────────────────────

info "Launching AI Assistant..."
open "$APP_DIR"

echo ""
echo -e "${GREEN}${BOLD}✅ Installation complete!${NC}"
echo ""
echo "  App:    $APP_DIR"
echo "  Config: $CONFIG_DIR/config.json"
echo "  Env:    $ENV_FILE"
echo "  Repo:   $INSTALL_DIR"
echo ""
echo "  Gateway:  http://localhost:${GATEWAY_PORT}"
echo "  Web UI:   http://localhost:$(( GATEWAY_PORT + 2 ))"
echo ""
echo "  Look for 🤖 in your menu bar."
echo ""
echo "  To uninstall:"
echo "  curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/uninstall.sh | bash"
echo ""
