#!/usr/bin/env bash
set -euo pipefail

# ─── AI Assistant Uninstaller ────────────────────────────────────────────────
# Usage: curl -fsSL https://raw.githubusercontent.com/SaschaHenning/ai-assistant/main/tools/uninstall.sh | bash

APP_NAME="AI Assistant"
APP_DIR="$HOME/Applications/${APP_NAME}.app"
CONFIG_DIR="$HOME/Library/Application Support/AI-Assistant"
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.ai-assistant.tray.plist"
INSTALL_DIR="$HOME/.ai-assistant"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}[info]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }

echo ""
echo -e "${BOLD}🤖 AI Assistant Uninstaller${NC}"
echo "────────────────────────────────────────"
echo ""

read -rp "This will remove AI Assistant and all its data. Continue? [y/N] " CONFIRM < /dev/tty
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    info "Cancelled."
    exit 0
fi

echo ""

# Stop the app if running
if pgrep -f "ai-assistant-tray" &>/dev/null; then
    info "Stopping AI Assistant..."
    pkill -f "ai-assistant-tray" || true
    sleep 1
    ok "App stopped"
fi

# Unload and remove launch agent
if [ -f "$LAUNCH_AGENT" ]; then
    launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
    rm -f "$LAUNCH_AGENT"
    ok "Launch agent removed"
else
    info "No launch agent found (skipped)"
fi

# Remove app bundle
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    ok "App bundle removed: $APP_DIR"
else
    info "No app bundle found (skipped)"
fi

# Remove config
if [ -d "$CONFIG_DIR" ]; then
    rm -rf "$CONFIG_DIR"
    ok "Config removed: $CONFIG_DIR"
else
    info "No config directory found (skipped)"
fi

# Remove repo / installation
if [ -d "$INSTALL_DIR" ]; then
    echo ""
    read -rp "Also remove the repository and all data at $INSTALL_DIR? [y/N] " REMOVE_REPO < /dev/tty
    if [[ "$REMOVE_REPO" =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
        ok "Repository removed: $INSTALL_DIR"
    else
        info "Keeping repository at $INSTALL_DIR"
    fi
else
    info "No repository found (skipped)"
fi

echo ""
echo -e "${GREEN}${BOLD}✅ AI Assistant uninstalled.${NC}"
echo ""
