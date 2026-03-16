#!/bin/bash
# SiteDoc deploy-script — kjør fra Mac for å oppdatere serveren
set -e

echo "🚀 Deployer SiteDoc til serveren..."

# Push lokale endringer til GitHub
echo "→ Pusher til GitHub..."
git push

# Bygg og restart på serveren
echo "→ Bygger på serveren..."
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build && pm2 restart sitedoc-web sitedoc-api"

echo "→ Sjekker status..."
ssh sitedoc "pm2 list"

echo ""
echo "✅ Deploy ferdig!"
echo "   Web:  https://sitedoc.no"
echo "   API:  https://api.sitedoc.no/health"
