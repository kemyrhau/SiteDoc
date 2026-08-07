#!/bin/bash
# SiteDoc — fast simulator-worktree: opprett eller oppdater.
#
# Formål: ett stabilt tre for iOS-simulator-testing (simulator-Opus ELLER Kenneth selv),
# adskilt fra hovedtreet så merging/branch-bytte der ikke drar filer bort under en test.
#
# Bruk:
#   ./scripts/simulator-tre.sh            # oppdater til nyeste origin/develop (default)
#   ./scripts/simulator-tre.sh main       # eller en annen ref
#
# Treet står på DETACHED HEAD med vilje — `develop` er checked out i hovedtreet, og
# en branch kan bare være ute i ett worktree om gangen. Detached = ingen konflikt,
# og treet er uansett kun for kjøring/testing, aldri for commits.
#
# Full rolle-/oppkoblingsdok: docs/claude/simulator-opus-oppkobling.md

set -euo pipefail

REF="${1:-origin/develop}"
TRE="$HOME/Documents/Programmering/SiteDoc-simulator"
HOVED="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$HOVED"

echo "→ Henter siste fra origin …"
git fetch origin --quiet

if [ ! -d "$TRE" ]; then
  echo "→ Oppretter simulator-worktree: $TRE"
  git worktree add "$TRE" --detach "$REF"
  NYTT=1
else
  echo "→ Oppdaterer eksisterende tre til $REF"
  git -C "$TRE" checkout --detach "$REF" --quiet
  NYTT=0
fi

# --- .env: gitignorert, overlever checkout. Opprettes kun første gang. ---
ENVFIL="$TRE/apps/mobile/.env"
if [ ! -f "$ENVFIL" ]; then
  echo "→ Oppretter apps/mobile/.env (localhost:3301 via SSH-tunnel)"
  printf 'EXPO_PUBLIC_API_URL=http://localhost:3301\n' > "$ENVFIL"
else
  echo "→ .env finnes (uendret): $(grep -c . "$ENVFIL") linjer"
fi

# --- Avhengigheter: kun ved nytt tre eller endret lockfile ---
LOCK_NA="$(git -C "$TRE" rev-parse HEAD:pnpm-lock.yaml 2>/dev/null || echo ukjent)"
MERKE="$TRE/.simulator-lock-hash"
LOCK_FOR="$(cat "$MERKE" 2>/dev/null || echo ingen)"

if [ "$NYTT" = "1" ] || [ "$LOCK_NA" != "$LOCK_FOR" ]; then
  echo "→ pnpm install (lockfile endret eller nytt tre) — dette tar noen minutter …"
  (cd "$TRE" && pnpm install --frozen-lockfile)
  echo "$LOCK_NA" > "$MERKE"
else
  echo "→ Avhengigheter uendret — hopper over pnpm install"
fi

echo
echo "✅ Simulator-tre klart: $TRE"
echo "   HEAD: $(git -C "$TRE" log --oneline -1)"
echo
echo "Start simulatoren slik (4 ledd — se docs/claude/simulator-opus-oppkobling.md § 1):"
echo "  1) xcrun simctl boot \"iPhone 16 Plus\"        # eller åpne Simulator.app"
echo "  2) ssh -N -L 3301:localhost:3301 server-ny    # HOLD ÅPEN i eget vindu"
echo "  3) cd $TRE/apps/mobile && npx expo start --clear"
echo "  4) .env peker alt på http://localhost:3301 ✓"
echo
echo "Henger appen på spinner: sudo networksetup -setv6off Wi-Fi"
echo "  (rotårsak: docs/claude/simulator-ipv6-nordvpn.md)"
