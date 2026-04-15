#!/bin/bash
# SiteDoc deploy-script — kjør fra Mac for å oppdatere serveren
set -e

echo "🚀 Deployer SiteDoc til serveren..."

# Push lokale endringer til GitHub
echo "→ Pusher til GitHub..."
git push

# Bygg og restart på serveren
echo "→ Bygger på serveren..."
ssh sitedoc "cd ~/programmering/sitedoc && git pull && pnpm install --frozen-lockfile && pnpm db:migrate && du -sm apps/web/.next/cache 2>/dev/null | awk '\$1>500{print \"Rydder .next/cache (\"\$1\"MB)\"}' && find apps/web/.next/cache -maxdepth 0 -type d 2>/dev/null | xargs -I{} sh -c 'size=\$(du -sm {} | cut -f1); [ \$size -gt 500 ] && rm -rf {}' && pnpm build --filter @sitedoc/web --filter @sitedoc/api && pm2 restart sitedoc-web sitedoc-api"

echo "→ Sjekker status..."
ssh sitedoc "pm2 list"

echo ""
echo "✅ Deploy ferdig!"
echo "   Web:  https://sitedoc.no"
echo "   API:  https://api.sitedoc.no/health"
