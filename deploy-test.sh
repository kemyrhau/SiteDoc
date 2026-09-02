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

# --- Ajour-guard: treet må være à jour med origin/develop ------------------
# Rotårsak 2026-08-21: merge skjer i SiteDoc-merge og pushes rett til develop,
# mens deploy rsyncer fra DETTE treet. Er det bak, sendes forrige runde til test
# — Docker ser identisk kontekst, cacher, og imaget blir gammelt uten at noe
# feiler. Kostet en runde med falsk «--no-cache»-feilsøking.
git fetch -q origin develop 2>/dev/null || true
BAK="$(git rev-list --count HEAD..origin/develop 2>/dev/null || echo 0)"
if [ "$BAK" != "0" ]; then
  echo "⚠️  Treet er $BAK commit(s) bak origin/develop."
  echo "    Deploy ville sendt GAMMEL kode til test uten å feile."
  echo "    Kjør:  git pull --ff-only origin develop   og prøv igjen. Avbryter."
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
#
# ⚠️ apps/mobile: innholdet ekskluderes (bloat), MEN package.json MÅ synkes.
# `pnpm install --frozen-lockfile` i Docker-bygget validerer pnpm-lock.yaml mot
# ALLE workspace-pakker — også de vi ikke deployer. Uten mobils package.json ser
# serveren en lockfil som lover pakker package.json-en ikke ber om → bygget feiler
# med ERR_PNPM_OUTDATED_LOCKFILE. (Traff oss 2026-07-20 da eslint-plugin-react-hooks
# ble lagt til i mobil: lockfila synket, package.json ikke.) Include-reglene må stå
# FØR exclude — rsync tar første treff.
echo "→ rsync (develop) til $DST ..."
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --include 'apps/mobile/' \
  --include 'apps/mobile/package.json' \
  --exclude 'apps/mobile/**' \
  --exclude .turbo \
  --exclude .pnpm-store \
  --exclude docker/env \
  --exclude uploads \
  "$SRC" "$DST"

# --- 2. Skriv ut docker-kommandoen (kjøres IKKE her — sudo krever TTY) -------
#
# Bygg-stempel (2026-08-23): GIT_SHA/BUILD_TID interpoleres inn i imaget via
# build-args (docker-compose.*.yml → Dockerfile.api/.web). Uten dem svarer
# /version «dev»/«ukjent» og footeren viser «Bygg dev · ukjent» — mekanismen
# fantes, men deploy-stien fylte den aldri. Kostet tre runder 2026-08-23:
# ingen kunne se om en merge faktisk var deployet, og et bygg som kom ut
# all-CACHED ble lest som «uendret» i stedet for «nådde ikke fram».
GIT_SHA="$(git -C "$(dirname "$0")" rev-parse --short HEAD)"
BUILD_TID="$(date -Iseconds)"

echo ""
echo "✅ Kode synket til server-ny. Kjør NÅ i egen TTY (sudo docker — ikke automatiserbart herfra):"
echo ""
echo "  STEG 1 av 3 — BYGG (ikke 'up' ennå: ny kode mot gammelt skjema gir 500):"
echo ""
echo "    ssh -t server-ny 'cd ~/stack/sitedoc && sudo env GIT_SHA=$GIT_SHA BUILD_TID=$BUILD_TID docker compose -f $COMPOSE build sitedoc-test-api sitedoc-test-web'"
echo ""
echo "  STEG 2 av 3 — MIGRER. Kjøres ALLTID, alle fire db-pakker."
echo "  Ikke utled fra diffen: kommandoen er idempotent og svarer 'No pending' på sekunder."
echo "  (2026-08-30: 'up -d --build' alene sendte REG fase 2 til test uten kolonnen den leser.)"
echo ""
echo "    ssh -t server-ny \"cd ~/stack/sitedoc && sudo docker compose -f $COMPOSE run --rm --no-deps --entrypoint sh sitedoc-test-api -c 'echo \\\"\\\$DATABASE_URL\\\" | grep -q sitedoc_test || { echo ABORT-ikke-test-DB; exit 1; }; for p in db db-timer db-maskin db-varelager; do echo \\\"--- \\\$p\\\"; pnpm --filter @sitedoc/\\\$p exec prisma migrate deploy || exit 1; done'\""
echo ""
echo "  STEG 3 av 3 — START. 🔴 UTEN DETTE KJØRER FORTSATT GAMMEL KODE."
echo "  (Hoppet over 2026-09-01 og 02.09: bygg + migrering kjørt, /version svarte"
echo "   gammel sha som så plausibel ut. Verifiseringen står derfor INNI dette steget.)"
echo ""
echo "    ssh -t server-ny 'cd ~/stack/sitedoc && sudo env GIT_SHA=$GIT_SHA BUILD_TID=$BUILD_TID docker compose -f $COMPOSE up -d --no-deps sitedoc-test-api sitedoc-test-web'"
echo ""
echo "  …og RETT ETTERPÅ, som del av samme steg:"
echo ""
echo "    curl -s https://api-test.sitedoc.no/version"
echo ""
echo "    → gitSha skal være $GIT_SHA"
echo "    → er den noe annet, startet ikke containerne på de nye imagene."
echo "      IKKE gate da — du måler gammel kode."
echo ""
echo "Kommer bygget ut med ALT «CACHED», også «COPY . .», nådde koden ikke fram."
echo "Tving da: sudo env GIT_SHA=$GIT_SHA BUILD_TID=$BUILD_TID docker compose -f $COMPOSE build --no-cache sitedoc-test-web sitedoc-test-api"
echo ""
echo "Verifiser til slutt som INNLOGGET bruker: https://test.sitedoc.no"
