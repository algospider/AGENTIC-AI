#!/bin/sh
# Beginner one-command runner: checks setup, installs deps if needed, launches the app.
# Usage: ./run.sh [--auto]  (--auto = no menu, prints dashboard + saves report)
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required but not found. Install it from https://www.python.org/downloads/"
  exit 1
fi

if [ ! -f .env ]; then
  echo "Note: no .env file — the app will run on the built-in rule engine."
  echo "For AI advice: cp .env.example .env  and add your key (see .env.example)."
fi

# Install deps only when something is missing (keeps repeat runs instant).
if ! python3 -c "import pandas, dotenv, rich" 2>/dev/null; then
  python3 -m pip install -q -r requirements.txt
fi
if ! python3 -c "import textual" 2>/dev/null; then
  echo "Tip: pip install textual  for the full-screen TUI (using classic menu for now)."
fi

python3 src/main.py "$@"
