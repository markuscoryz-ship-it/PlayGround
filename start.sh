#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"
export PORT
PROJECT_DIR="$(pwd)"
BUILD_DIR="$PROJECT_DIR/dist"
WEB_DIR="${OPENCODE_WEB_DIR:-$PROJECT_DIR/.omgithub-runtime}"
export WEB_DIR

/usr/bin/time -p mkdir -p "$BUILD_DIR" "$WEB_DIR"
/usr/bin/time -p rm -rf "$BUILD_DIR"
/usr/bin/time -p mkdir -p "$BUILD_DIR"
/usr/bin/time -p cp index.html styles.css levels.js game.js "$BUILD_DIR"/

/usr/bin/time -p node --check levels.js
/usr/bin/time -p node --check game.js
/usr/bin/time -p node --check server.mjs

/usr/bin/time -p node -e 'const fs = require("node:fs"); const path = require("node:path"); const project = process.cwd(); const directory = path.join(project, "dist"); fs.writeFileSync(path.join(process.env.WEB_DIR, "deployment-output.json"), JSON.stringify({ project, directory }));'

echo "Serving $BUILD_DIR on port $PORT"
exec /usr/bin/time -p node server.mjs
