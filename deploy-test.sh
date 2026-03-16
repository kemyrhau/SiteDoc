#!/bin/bash
# SiteDoc TEST deploy-script — deployer develop-branch til test.sitedoc.no
set -e

echo "🧪 Deployer SiteDoc TEST til serveren..."

# Push develop-branch til GitHub
echo "→ Pusher develop til GitHub..."
git push origin develop

# Bygg og restart på serveren
echo "→ Bygger test-miljø på serveren..."
ssh sitedoc "cd ~/programmering/sitedoc-test && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && pnpm build && pm2 restart sitedoc-test-web sitedoc-test-api"

echo "→ Sjekker status..."
ssh sitedoc "pm2 list"

echo ""
echo "✅ Test-deploy ferdig!"
echo "   Web:  https://test.sitedoc.no"
echo "   API:  https://api-test.sitedoc.no/health"
