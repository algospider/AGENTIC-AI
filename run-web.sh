#!/bin/sh
# Launch the Next.js website. Installs Node locally on first run if missing.
# Usage: ./run-web.sh [--prod]   (default: dev server on http://localhost:3000)
set -e
cd "$(dirname "$0")/web"

if ! command -v node >/dev/null 2>&1; then
  if [ -x "$HOME/.local/node/bin/node" ]; then
    export PATH="$HOME/.local/node/bin:$PATH"
  else
    echo "Node.js not found and no local copy. Install from https://nodejs.org/ (v22+),"
    echo "then re-run ./run-web.sh"
    exit 1
  fi
fi

if [ ! -d node_modules ]; then
  echo "Installing web dependencies (one-time)..."
  npm install
fi

if [ "$1" = "--prod" ]; then
  npm run build && npm run start
else
  npm run dev
fi
