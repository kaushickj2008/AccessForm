#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "AccessForm needs Node.js 22 or newer. Install it once before the offline demo."
  exit 1
fi
if [ ! -d node_modules/ws ]; then
  echo "First-time setup required: npm ci. Afterwards ./start.sh works without Wi-Fi."
  exit 1
fi
exec node server/index.js
