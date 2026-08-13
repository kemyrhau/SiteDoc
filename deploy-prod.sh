#!/usr/bin/env bash
# deploy-prod.sh — synk main til server-ny og skriv ut prod-docker-kommandoene.
#
# Speiler deploy-test.sh, men for PROD. Opprettet 2026-08-13 etter at en
# håndskrevet prod-rsync manglet `--exclude docker/env` og slettet env-filene
# for BÅDE prod og test (de deler ~/stack/sitedoc). Prod hadde ingen nedetid,
# men ingen deploy var mulig, og det fantes ingen backup av env noe sted.
# Et script finnes nettopp for at den kommandoen aldri skal skrives for hånd igjen.
#
# Scriptet gjør rsync (native) og SKRIVER UT docker-kommandoene.
# Det KJØRER IKKE sudo docker — det krever Kenneths ekte TTY.

set -euo pipefail

# --- Branch-guard: prod skal deploye main ----------------------------------
cd "$(git rev-parse --show-toplevel)"
BRANCH="$(git branch --show-current)"
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Du står på '$BRANCH', ikke main. Prod-deploy skal deploye main."
  echo "    Bruk SiteDoc-deploy-worktreet (main) og kjør på nytt. Avbryter."
  exit 1
fi

# --- Guard: main skal være à jour med origin -------------------------------
git fetch origin --quiet
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "⚠️  HEAD != origin/main. Push eller pull først. Avbryter."
  exit 1
fi

SRC="$(pwd)/"
DST="server-ny:stack/sitedoc/"
COMPOSE="docker/docker-compose.yml"
SHA="$(git rev-parse --short HEAD)"

echo "→ Prod-deploy av main ($SHA)"
read -r -p "   Dette deployer til PRODUKSJON. Skriv 'prod' for å fortsette: " SVAR
[ "$SVAR" = "prod" ] || { echo "Avbrutt."; exit 1; }

# --- 1. Synk kode til server-ny --------------------------------------------
# Excludes beskyttes automatisk mot --delete (uten --delete-excluded):
#   docker/env  = server-.env for BÅDE prod og test — KRITISK, må aldri slettes.
#                 Finnes ikke i git (gitignored) og kan ikke gjenskapes derfra.
#   uploads     = server-only brukerdata + bind-mount, delt test↔prod
#   node_modules/.next/.git/apps/mobile/.turbo/.pnpm-store = bloat
#
# ⚠️ apps/mobile: innholdet ekskluderes, MEN package.json MÅ synkes — ellers
# feiler `pnpm install --frozen-lockfile` med ERR_PNPM_OUTDATED_LOCKFILE.
# Include-reglene MÅ stå FØR exclude — rsync tar første treff.
echo "→ rsync (main) til $DST ..."
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

# --- 2. Skriv ut docker-kommandoene (kjøres IKKE her — sudo krever TTY) -----
TID="$(date -u +%Y-%m-%dT%H:%MZ)"
cat <<KOMMANDOER

✅ Kode synket til server-ny ($SHA). Kjør NÅ i egen TTY:

  # api og web bygges HVER FOR SEG — samtidig gir OOM
  ssh -t server-ny "cd ~/stack/sitedoc && sudo env GIT_SHA=$SHA BUILD_TID=$TID docker compose -f $COMPOSE build sitedoc-api"

  ssh -t server-ny "cd ~/stack/sitedoc && sudo env GIT_SHA=$SHA BUILD_TID=$TID docker compose -f $COMPOSE build sitedoc-web"

  # up UTEN -p (containerne ligger i tre compose-prosjekter) og med --no-deps
  # (beskytter embed/oversettelse mot restart)
  ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f $COMPOSE up -d --no-deps sitedoc-api sitedoc-web'

  # Har releasen migreringer — KUN da, og gaten avbryter mot feil database:
  # ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f $COMPOSE run --rm --no-deps --entrypoint sh sitedoc-api -c "echo \\\$DATABASE_URL | grep -qE \\"/sitedoc([?].*)?\\\$\\" || exit 1; pnpm --filter @sitedoc/db exec prisma migrate deploy"'

Verifiser: curl -s https://api.sitedoc.no/version   (skal vise $SHA)
Deretter som INNLOGGET bruker på https://sitedoc.no — anonym 200 er IKKE godkjent verifisering.

KOMMANDOER
