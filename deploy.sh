#!/bin/bash
# SiteDoc deploy-script — kjør fra Mac for å oppdatere ny server (Docker på server-ny).
# Gammel PM2/WSL-deploy (ssh sitedoc) er utgått. Server-git er ikke satt opp ennå,
# så koden synkes med rsync og bygges/startes med docker compose på server-ny.
# Detaljer: docs/claude/infrastruktur.md + docker/DOCKER-NOTES.md
set -e

echo "🚀 Deployer SiteDoc til server-ny (Docker)..."

# 1. Kildekontroll
echo "→ Pusher til GitHub..."
git push

# 2. Synk kode til server-ny
echo "→ rsync til server-ny:~/stack/sitedoc ..."
rsync -a --exclude node_modules --exclude .next --exclude .git \
  ~/Documents/Programmering/SiteDoc/ server-ny:stack/sitedoc/

# 3. (Ved schema-endring) Prisma-migrasjoner — IKKE automatisert i Docker-oppsettet ennå.
#    DB ble flyttet via pg_dump/pg_restore ved cutover; løpende schema-endringer må
#    kjøres manuelt mot postgres-containeren for alle fire db-pakker
#    (@sitedoc/db, -maskin, -timer, -varelager) FØR build. Se infrastruktur.md (TODO).

# 4. Bygg + start containere (ssh -t kreves for sudo-passord)
echo "→ docker compose up -d --build på server-ny..."
ssh -t server-ny 'cd ~/stack/sitedoc && sudo docker compose -f docker/docker-compose.yml up -d --build'

# 5. Status
echo "→ Sjekker status..."
ssh -t server-ny 'sudo docker compose -f ~/stack/sitedoc/docker/docker-compose.yml ps'

echo ""
echo "✅ Deploy ferdig!"
echo "   Web:  https://sitedoc.no"
echo "   API:  https://api.sitedoc.no/health"
