#!/bin/bash
# SiteDoc TEST deploy-script — server-ny (Docker). Gjenskapt 2026-07-07.
#
# Erstatter den gamle PM2/WSL-ettlinjeren (opprettet 2026-03-16, 42983dab) som ble
# deprecated til stub i server-migreringen 2026-06-10 (20a98cdf) og ALDRI erstattet.
# Test-stacken ble reist på server-ny Docker 2026-06-11, men deploy-scriptet ble borte
# → test-deploy hadde vært ad-hoc manuell siden (rotårsak til «web nådde aldri test»
# 2026-06-24). Se docs/claude/BACKLOG.md § «Auto-deploy til test» finnes ikke.
#
# Det finnes INGEN auto-deploy. Dette scriptet er hele test-deploy-mekanikken.
# Scriptet gjør rsync (native — kan kjøres fra Mac/Opus) og SKRIVER UT den eksakte
# docker-kommandoen. Det KJØRER IKKE sudo docker — det krever Kenneths ekte TTY.

set -euo pipefail

# --- Branch-guard: test skal deploye develop -------------------------------
cd "$(git rev-parse --show-toplevel)"
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "develop" ]; then
  echo "⚠️  Du står på '$BRANCH', ikke develop. Test-deploy skal deploye develop."
  echo "    Bytt til develop (eller develop-worktreet) og kjør på nytt. Avbryter."
  exit 1
fi

SRC="$(pwd)/"
DST="server-ny:stack/sitedoc/"
COMPOSE="docker/docker-compose.test.yml"

# --- 1. Synk kode til server-ny --------------------------------------------
# --delete: fjerner filer på server som er slettet/omdøpt lokalt (fikser relikvier
#           som gammel oppsett/lokasjoner/ etter byggeplass-rename 2026-06-24).
# Excludes beskyttes automatisk mot --delete (uten --delete-excluded):
#   docker/env  = server-.env — KRITISK, må aldri slettes/overskrives
#   uploads     = server-only brukerdata (~1,4G) + bind-mount — MÅ aldri slettes, som docker/env
#   node_modules/.next/.git/apps/mobile/.turbo/.pnpm-store = bloat (apps/mobile ~3 GB kontekst)
echo "→ rsync (develop) til $DST ..."
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude apps/mobile \
  --exclude .turbo \
  --exclude .pnpm-store \
  --exclude docker/env \
  --exclude uploads \
  "$SRC" "$DST"

# --- 2. Skriv ut docker-kommandoen (kjøres IKKE her — sudo krever TTY) -------
echo ""
echo "✅ Kode synket til server-ny. Kjør NÅ i egen TTY (sudo docker — ikke automatiserbart herfra):"
echo ""
echo "    ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f $COMPOSE up -d --build'"
echo ""
echo "Verifiser etterpå som INNLOGGET bruker: https://test.sitedoc.no"
