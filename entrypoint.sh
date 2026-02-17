#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Check Claude CLI authentication
CREDENTIALS_FILE="$HOME/.claude/.credentials.json"

if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "========================================="
  echo "  Claude CLI is not authenticated."
  echo ""
  echo "  Run the following to log in:"
  echo "    docker exec -it <container> claude login"
  echo ""
  echo "  The gateway will start, but AI responses"
  echo "  will fail until you authenticate."
  echo "========================================="
fi

# Start the gateway
exec bun run apps/gateway/src/index.ts
