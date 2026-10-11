#!/usr/bin/env bash
#
# Pull, build and restart. Safe to run repeatedly: it does nothing when there is no new commit.
#
#   ./deploy/deploy.sh            deploy if origin/prod_deploy moved
#   ./deploy/deploy.sh --force    rebuild and restart regardless
#
set -euo pipefail

cd "$(dirname "$0")/.."
REPO=$(pwd)
COMPOSE="docker compose -f deploy/compose.yaml"
BRANCH=prod_deploy

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

log "Checking for new commits"
git fetch --quiet origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")

if [ "$local_sha" = "$remote_sha" ] && [ "${1:-}" != "--force" ]; then
  echo "Already at ${local_sha:0:8} — nothing to do."
  exit 0
fi

if [ "$local_sha" != "$remote_sha" ]; then
  echo "${local_sha:0:8} -> ${remote_sha:0:8}"
  # --ff-only on purpose. If this checkout has local edits or has diverged, stop loudly rather
  # than throwing work away: a deploy target should be a mirror of origin and nothing else.
  git pull --ff-only origin "$BRANCH"
fi

log "Checking deploy/.env"
# Fail before building rather than ship a site whose links and emails are broken.
env_get() { grep -E "^$1=" deploy/.env 2>/dev/null | tail -1 | cut -d= -f2-; }
[ -f deploy/.env ] || { echo "deploy/.env is missing. Copy deploy/.env.example and fill it in."; exit 1; }
case "$(env_get PUBLIC_BASE_URL)" in
  https://*) ;;
  *) echo "PUBLIC_BASE_URL in deploy/.env must be the public https origin, e.g. https://vasbyt.co.za"; exit 1 ;;
esac
[ -n "$(env_get KWIK_API_KEY)" ] && [ -n "$(env_get KWIK_API_SECRET)" ] || echo "Warning: KWIK_API_KEY or KWIK_API_SECRET is empty, so only the demo payment is available."
[ -n "$(env_get RESEND_API_KEY)" ] || echo "Warning: RESEND_API_KEY is empty, so no email (QR passes, receipts, recovery) will be sent."
[ -z "$(env_get PRELAUNCH_KEY)" ] || echo "Note: PRELAUNCH_KEY is set, so the public sees the holding page. Team preview: $(env_get PUBLIC_BASE_URL)/?voorskou=<key>"

log "Building"
# The image is built here on the VPS, so a failed build leaves the running container untouched.
$COMPOSE build api-blue

# Blue/green: start the idle colour next to the live one, and only stop the live one once the new one is healthy.
running() { [ "$(docker inspect -f '{{.State.Running}}' "vasbyt-$1" 2>/dev/null)" = true ]; }
if running api-blue; then live=api-blue next=api-green; else live=api-green next=api-blue; fi
running "$live" || live=""

$COMPOSE up -d --wait db

log "Starting $next"
# Migrations run on startup, so healthy means migrated, seeded and serving. Old code keeps running on the new schema meanwhile.
if ! $COMPOSE up -d --no-deps --force-recreate --wait --wait-timeout 180 "$next"; then
  echo "$next did not become healthy. ${live:-Nothing} is still serving. Last logs:"
  $COMPOSE logs --tail 80 "$next"
  $COMPOSE stop "$next"
  exit 1
fi

if [ -n "$live" ]; then
  log "Stopping $live"
  # Caddy already sends new requests to $next; this drains what $live is still handling.
  $COMPOSE stop "$live"
fi
# The single-container layout from before blue/green.
docker rm -f vasbyt-api >/dev/null 2>&1 || true

log "Status"
$COMPOSE ps

log "Cleaning up old image layers"
docker image prune -f >/dev/null

log "Deployed ${remote_sha:0:8}"
echo "Logs:   cd $REPO && $COMPOSE logs -f $next"
