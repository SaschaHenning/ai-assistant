#!/usr/bin/env bash
set -euo pipefail

# ─── AI Assistant Installer ──────────────────────────────────────────────────
# Usage: curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/install.sh | bash

REPO_URL="https://github.com/SaschaHenning/ai-assistant.git"
INSTALL_DIR="$HOME/.ai-assistant"
APP_NAME="AI Assistant"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
CONFIG_DIR="$HOME/Library/Application Support/AI-Assistant"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.ai-assistant.tray.plist"
WHISPER_MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"

GATEWAY_PORT=4300
MCP_PORT=4301

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

# ─── Step 1: Check prerequisites ────────────────────────────────────────────

echo ""
echo -e "${BOLD}🤖 AI Assistant Installer${NC}"
echo "────────────────────────────────────────"
echo ""

MISSING=()

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        MISSING+=("$1")
        warn "$1 not found. Install: $2"
    else
        ok "$1 found: $(command -v "$1")"
    fi
}

info "Checking prerequisites..."
echo ""

check_cmd "bun"    "curl -fsSL https://bun.sh/install | bash"
check_cmd "swiftc" "xcode-select --install"
check_cmd "git"    "xcode-select --install"
check_cmd "ffmpeg" "brew install ffmpeg"

echo ""

if [ ${#MISSING[@]} -gt 0 ]; then
    error "Missing prerequisites: ${MISSING[*]}. Install them and re-run this script."
fi

BUN_PATH="$(command -v bun)"

# ─── Step 2: Clone or update repo ───────────────────────────────────────────

info "Setting up repository..."

if [ -d "$INSTALL_DIR/.git" ]; then
    info "Repository exists, pulling latest..."
    git -C "$INSTALL_DIR" pull --ff-only || warn "git pull failed, continuing with existing version"
    ok "Repository updated"
else
    if [ -d "$INSTALL_DIR" ]; then
        warn "$INSTALL_DIR exists but is not a git repo, backing up..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.bak.$(date +%s)"
    fi
    info "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repository cloned to $INSTALL_DIR"
fi

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
    info "Downloading whisper model (ggml-small.bin)..."
    mkdir -p "$MODEL_DIR"
    curl -fSL --progress-bar "$WHISPER_MODEL_URL" -o "$MODEL_FILE"
    ok "Whisper model downloaded"
fi

echo ""

# ─── Step 5: Prompt for config ──────────────────────────────────────────────

ENV_FILE="$INSTALL_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    info "Existing .env found"
    read -rp "Overwrite existing config? [y/N] " OVERWRITE
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

    read -rp "  Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    read -rp "  Telegram Allowed User IDs (comma-separated): " TELEGRAM_ALLOWED_USERS

    # ─── Step 6: Write .env ──────────────────────────────────────────────────

    cat > "$ENV_FILE" <<EOF
# Telegram Bot
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}

# Gateway
GATEWAY_PORT=${GATEWAY_PORT}
MCP_PORT=${MCP_PORT}

# Database
DATABASE_PATH=./data/assistant.db
EOF

    ok ".env written"
fi

echo ""

# ─── Step 7: Compile Swift app ──────────────────────────────────────────────

info "Compiling menu bar app..."

SWIFT_SRC="$INSTALL_DIR/tools/tray-app/main.swift"
TRAY_BIN="$INSTALL_DIR/tools/tray-app/ai-assistant-tray"

if [ ! -f "$SWIFT_SRC" ]; then
    error "Swift source not found: $SWIFT_SRC"
fi

swiftc -O -o "$TRAY_BIN" "$SWIFT_SRC" -framework Cocoa
ok "Menu bar app compiled"
echo ""

# ─── Step 8: Create .app bundle ─────────────────────────────────────────────

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

# ─── Step 9: Write config.json ──────────────────────────────────────────────

info "Writing config..."

mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_DIR/config.json" <<EOF
{
    "projectRoot": "${INSTALL_DIR}",
    "bunPath": "${BUN_PATH}",
    "gatewayPort": ${GATEWAY_PORT},
    "mcpPort": ${MCP_PORT}
}
EOF

ok "Config written to $CONFIG_DIR/config.json"
echo ""

# ─── Step 10: Launch agent (start on login) ─────────────────────────────────

read -rp "Start AI Assistant on login? [y/N] " START_ON_LOGIN

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

# ─── Step 11: Open the app ──────────────────────────────────────────────────

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
echo "  Look for 🤖 in your menu bar."
echo ""
