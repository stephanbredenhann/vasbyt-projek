#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
docker compose up -d db
until docker compose exec -T db pg_isready -U vasbyt >/dev/null 2>&1; do sleep 1; done
if [[ "$(docker compose exec -T db psql -U vasbyt -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'vasbyt_demo'")" != "1" ]]; then
  docker compose exec -T db createdb -U vasbyt vasbyt_demo
fi
(cd src/Vasbyt.Frontend && npm ci && npm run build)
dotnet restore Vasbyt.sln
dotnet build Vasbyt.sln --no-restore -m:1
export ASPNETCORE_ENVIRONMENT=Development
export ConnectionStrings__Default='Host=127.0.0.1;Port=5432;Database=vasbyt_demo;Username=vasbyt;Password=vasbyt'
export Demo__Enabled=true
export Seed__AdminEmail="${DEMO_ADMIN_EMAIL:-demo@vasbyt.local}"
export Seed__AdminPassword="${DEMO_ADMIN_PASSWORD:-VasbytDemo2027!}"
export Content__Root="$repo_dir/src/Vasbyt.API/demo-media"
exec dotnet run --project src/Vasbyt.API --no-launch-profile --no-build --urls http://127.0.0.1:5080
