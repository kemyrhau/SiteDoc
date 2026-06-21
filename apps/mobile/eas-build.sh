#!/usr/bin/env bash
# Wrapper for EAS iOS-bygg som laster Apple-credentials fra .env.eas.local
# (App Store Connect API-nøkkel — se eas-build-veileder.md § Apple-auth).
#
# Bruk:
#   ./eas-build.sh           # bygger med profil "test" (default)
#   ./eas-build.sh preview   # annen profil
#
# .env.eas.local er git-ignorert og inneholder Kenneths credentials —
# committes ALDRI. Forventede variabler:
#   EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID,
#   EXPO_APPLE_TEAM_ID, EXPO_APPLE_TEAM_TYPE

set -euo pipefail

# Kjør fra scriptets egen mappe uansett hvor det kalles fra.
cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FIL=".env.eas.local"
if [[ ! -f "$ENV_FIL" ]]; then
  echo "Fant ikke $ENV_FIL i $(pwd)." >&2
  echo "Opprett den med ASC API-nøkkel-variablene (se eas-build-veileder.md § Automatisert bygg)." >&2
  exit 1
fi

# Eksporter alt fra .env.eas.local inn i miljøet for eas-kommandoen.
set -a
# shellcheck disable=SC1090
source "$ENV_FIL"
set +a

PROFIL="${1:-test}"
echo "Bygger iOS med profil: $PROFIL"
eas build --platform ios --profile "$PROFIL"
