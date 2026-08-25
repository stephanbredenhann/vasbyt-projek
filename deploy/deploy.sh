#!/usr/bin/env bash
#
# Pull, build and restart. Safe to run repeatedly: it does nothing when there is no new commit.
#
#   ./deploy/deploy.sh            deploy if origin/main moved
#   ./deploy/deploy.sh --force    rebuild and restart regardless
#
set -euo pipefail

cd "$(dirname "$0")/.."
REPO=$(pwd)
COMPOSE="docker compose -f deploy/compose.yaml"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

log "Checking for new commits"
git fetch --quiet origin main
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)

if [ "$local_sha" = "$remote_sha" ] && [ "${1:-}" != "--force" ]; then
  echo "Already at ${local_sha:0:8} — nothing to do."
  exit 0
fi

if [ "$local_sha" != "$remote_sha" ]; then
  echo "${local_sha:0:8} -> ${remote_sha:0:8}"
  # --ff-only on purpose. If this checkout has local edits or has diverged, stop loudly rather
  # than throwing work away: a deploy target should be a mirror of origin and nothing else.
  git pull --ff-only origin main
fi

log "Building"
# The image is built here on the VPS, so a failed build leaves the running container untouched.
$COMPOSE build

log "Starting"
# Migrations run on startup, after compose has waited for Postgres to pass its healthcheck.
$COMPOSE up -d

log "Status"
$COMPOSE ps

log "Cleaning up old image layers"
docker image prune -f >/dev/null

log "Deployed ${remote_sha:0:8}"
echo "Logs:   cd $REPO && $COMPOSE logs -f api"
