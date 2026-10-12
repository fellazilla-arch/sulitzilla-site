#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-139.59.231.34}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/performance_sulitzilla_deploy}"
REMOTE_DIR="/var/www/grist-monitor"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$(dirname "$0")"

echo "Deploying grist-monitor to ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}"

tar czf - --exclude=node_modules . | ssh -i "$DEPLOY_KEY" -o BatchMode=yes "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "mkdir -p '$REMOTE_DIR' && tar xzf - -C '$REMOTE_DIR'"

ssh -i "$DEPLOY_KEY" -o BatchMode=yes "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<'REMOTE'
set -euo pipefail
cd /var/www/grist-monitor

if [ ! -f .env ]; then
  KEY="$(python3 - <<'PY'
import sqlite3
c=sqlite3.connect("file:/root/grist/home.sqlite3?mode=ro", uri=True)
print(c.execute("select api_key from users where id=5").fetchone()[0])
PY
)"
  cat > .env <<EOF
PORT=3005
GRIST_API_KEY=${KEY}
GRIST_DOC_ID=eEMaR9RHiD3ruspeNWqKHn
GRIST_TABLE=Master_List
GRIST_INTERNAL_URL=http://127.0.0.1:8484
SAMPLE_INTERVAL_MS=5000
HISTORY_LIMIT=720
EOF
  chmod 600 .env
fi

npm install --omit=dev
if pm2 describe grist-monitor >/dev/null 2>&1; then
  pm2 restart grist-monitor
else
  pm2 start server.js --name grist-monitor
fi
pm2 save
REMOTE

echo "Done. Open https://grist.sulitzilla.com/monitor/ (same login as track.sulitzilla.com)"
