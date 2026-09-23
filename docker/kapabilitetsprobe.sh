#!/usr/bin/env bash
#
# SiteDoc kapabilitets-probe — LESENDE. Rapporterer, reparerer ALDRI.
# ---------------------------------------------------------------------------
# Hvorfor denne finnes:
#   Ved serverflyttingen 2026-06-10 sluttet PDF-tegninger, DWG-konvertering og
#   3D-punktsky å virke fordi binærene de trenger ikke fulgte med det nye
#   imaget. INGEN test, ingen oppstartssjekk og ingen røykliste fanget det —
#   det ble oppdaget først 3,5 måned senere, ved at en tegning ikke rendret
#   (`spawn pdftoppm ENOENT`). Denne proben gjør at det ikke kan skje stille
#   igjen: den skriver hver avhengighet appen KODEMESSIG krever, med OK eller
#   MANGLER, per container.
#
# Hva den IKKE gjør:
#   - Installerer ingenting. `docker run`/`docker exec` brukes KUN til `command -v`
#     og `test -f` (lesende). Ingen skriving, ingen `apt`, ingen `npm`.
#   - Skriver ALDRI ut env-verdier (CLAUDE.md § SIKKERHET). Kun `grep -q` på om
#     en nøkkel finnes.
#   - Fikser ikke `pdftoppm`-feilen. Den finner ut hva MER som mangler.
#
# Bruk (på server-ny, der Kenneth har sudo):
#   bash docker/kapabilitetsprobe.sh                 # sjekk alle containere
#   bash docker/kapabilitetsprobe.sh --stack ~/stack/sitedoc
#   bash docker/kapabilitetsprobe.sh --lokal         # sjekk vertsmaskinen (ikke docker)
#   bash docker/kapabilitetsprobe.sh --selftest      # negativ kontroll (se § SELVTEST)
#
# Exit-kode:
#   0  = alt KREVES er på plass
#   1  = minst én KREVES-avhengighet MANGLER (UTSATT og VALGFRI teller IKKE)
#   2  = brukerfeil (ukjent flagg o.l.)
#
# Tre nivåer (ordre 2026-09-23): KREVES (skal virke i dag → exit 1) · UTSATT
# (bevisst utsatt, krever dato + BACKLOG-ref) · VALGFRI (har fallback). En probe
# som alltid feiler blir ignorert innen en uke — derfor teller kun KREVES.
#
# Listen under er UTLEDET FRA KODEN (grep execFile/spawn + docker-compose +
# Dockerfile.* + process.env). Fil:linje står i kommentarene så den kan revideres
# når koden endres. Se også § "HVA PROBEN IKKE KAN SJEKKE" nederst.
set -uo pipefail

# --- Argumenter --------------------------------------------------------------
STACK_DIR="${HOME}/stack/sitedoc"
MODUS="docker"    # docker | lokal | selftest
DOCKER="sudo docker"

while [ $# -gt 0 ]; do
  case "$1" in
    --stack)    STACK_DIR="$2"; shift 2 ;;
    --lokal)    MODUS="lokal"; shift ;;
    --selftest) MODUS="selftest"; shift ;;
    --no-sudo)  DOCKER="docker"; shift ;;
    -h|--help)
      sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Ukjent flagg: $1" >&2; exit 2 ;;
  esac
done

# --- Farger (av hvis ikke TTY) ----------------------------------------------
if [ -t 1 ]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[1m'; DIM=$'\033[2m'; N=$'\033[0m'
else
  R=""; G=""; Y=""; B=""; DIM=""; N=""
fi

MANGLER_KREVES=0
MANGLER_UTSATT=0
MANGLER_VALGFRI=0
UTSATT_UTEN_REF=0

# --- Kjernefunksjon: finnes binæren? -----------------------------------------
# $1 = container ("" = lokal/verts-modus), $2 = binærnavn eller absolutt sti
# Skriver stien til stdout hvis funnet, ellers tomt. Returkode 0 = funnet.
finn_bin() {
  local container="$1" bin="$2" sti=""
  if [ -n "$container" ]; then
    # command -v tåler både PATH-navn og absolutt sti. 2>/dev/null: still ved mangel.
    sti="$($DOCKER exec "$container" sh -c "command -v '$bin' 2>/dev/null" 2>/dev/null)"
  else
    sti="$(command -v "$bin" 2>/dev/null)"
  fi
  [ -n "$sti" ] && { printf '%s' "$sti"; return 0; }
  return 1
}

# --- Lint på UTSATT: KREVER dato + BACKLOG-referanse -------------------------
# Uten dem er UTSATT bare en måte å slå av alarmen på uten å skrive hvorfor —
# nøyaktig mekanismen vi prøver å unngå. Advarer, men teller IKKE mot exit
# (exit 1 skal bety «en LIVE-funksjon virker ikke», ikke «config-lint feilet»).
lint_utsatt() {
  local bin="$1" notat="$2" ok=1
  printf '%s' "$notat" | grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || ok=0
  printf '%s' "$notat" | grep -qi 'BACKLOG'                    || ok=0
  if [ "$ok" -eq 0 ]; then
    printf "      ${R}${B}⚠ UTSATT '%s' mangler dato og/eller BACKLOG-ref${N} ${DIM}— å flytte hit KREVER at noen skriver hvorfor + hvor saken står${N}\n" "$bin"
    UTSATT_UTEN_REF=$((UTSATT_UTEN_REF + 1))
  fi
}

# --- Rapportlinje for én binær ----------------------------------------------
# $1 = container, $2 = binær, $3 = nivå (KREVES|UTSATT|VALGFRI), $4 = notat
rapporter_bin() {
  local container="$1" bin="$2" nivaa="$3" notat="${4:-}" sti
  if sti="$(finn_bin "$container" "$bin")"; then
    printf "    %-22s ${G}OK${N}      ${DIM}%s${N}\n" "$bin" "$sti"
    return
  fi
  case "$nivaa" in
    KREVES)
      printf "    %-22s ${R}${B}MANGLER${N}  ${DIM}%s${N}\n" "$bin" "$notat"
      MANGLER_KREVES=$((MANGLER_KREVES + 1)) ;;
    UTSATT)
      printf "    %-22s ${Y}UTSATT${N}   ${DIM}%s${N}\n" "$bin" "$notat"
      MANGLER_UTSATT=$((MANGLER_UTSATT + 1))
      lint_utsatt "$bin" "$notat" ;;
    *)  # VALGFRI
      printf "    %-22s ${Y}valgfri${N}  ${DIM}(fallback finnes) %s${N}\n" "$bin" "$notat"
      MANGLER_VALGFRI=$((MANGLER_VALGFRI + 1)) ;;
  esac
}

# --- Er containeren oppe? ----------------------------------------------------
container_kjorer() {
  local navn="$1"
  $DOCKER ps --format '{{.Names}}' 2>/dev/null | grep -qx "$navn"
}

# ============================================================================
# LISTEN — utledet fra koden.
# ============================================================================
# Binærer appen kaller (execFile/spawn), med fil:linje:
#
#   pdftoppm         apps/api/src/routes/tegning.ts:258,631
#                    apps/api/src/services/blokk-prosessering.ts:226
#                    apps/api/src/services/ftd-prosessering.ts:331   (poppler-utils)
#   tesseract        apps/api/src/services/ftd-prosessering.ts:344   (+ språkdata "nor")
#   xvfb-run         apps/api/src/services/dwgKonvertering.ts:107
#                    apps/api/src/services/punktskyKonvertering.ts:64 (xvfb)
#   dwg2dxf          apps/api/src/services/dwgKonvertering.ts:80,892  (libredwg; env DWG2DXF_PATH, default /usr/local/bin/dwg2dxf)
#   dwg2SVG          apps/api/src/services/dwgKonvertering.ts:930     (libredwg; env DWG2SVG_PATH, default /usr/local/bin/dwg2SVG)
#   ODAFileConverter apps/api/src/services/dwgKonvertering.ts:107     (env ODA_CONVERTER_PATH, default /usr/bin/ODAFileConverter — VALGFRI, dwg2dxf er fallback)
#   CloudCompare     apps/api/src/services/punktskyKonvertering.ts:48,64,70
#   PotreeConverter  apps/api/src/services/punktskyKonvertering.ts:96 (PotreeConverter1.7 = valgfri eldre variant, :97)
#
# HVORFOR web trenger DET SAMME som api:
#   apps/web/src/app/api/trpc/[...trpc]/route.ts:2 importerer HELE appRouter fra
#   @sitedoc/api. Web kjører altså alle tRPC-prosedyrene IN-PROCESS — inkl.
#   tegning (pdftoppm), punktsky (CloudCompare/PotreeConverter) og mengde/mappe
#   (ftd → pdftoppm+tesseract). Web-imaget (Dockerfile.web) installerer INGEN av
#   dem. Det er nøyaktig `pdftoppm ENOENT`-feilklassen.
# ============================================================================

# Binærer som api+web (Node-appen) trenger. Format: "navn|nivå|notat"
#
# NIVÅ-SEMANTIKK (jf. ordre 2026-09-23):
#   KREVES  = skal virke i dag. Teller mot exit 1. LIVE-funksjoner.
#   UTSATT  = bevisst ikke installert ennå. Teller IKKE mot exit. KREVER
#             dato + BACKLOG-referanse i notatet (lint_utsatt håndhever).
#   VALGFRI = har fallback, trengs ikke. Teller ikke mot exit.
#
# KREVES = pdftoppm + tesseract(+nor): LIVE, men ødelagt i web i dag (web kjører
#   appRouter in-process uten poppler/tesseract). DE SKAL gi exit 1 — hele poenget.
# UTSATT = DWG (dwg2dxf/dwg2SVG) + 3D (CloudCompare/PotreeConverter) + xvfb-run
#   (kun DWG/3D-veiene bruker den). Falt ved serverflyttingen 2026-06-10, venter
#   Kenneth-beslutning + ODA-konto. IKKE valgfrie av natur — bevisst utsatt.
# VALGFRI = ODAFileConverter: valgfri av natur, dwg2dxf er fallback.
BINARER_NODE=(
  "pdftoppm|KREVES|poppler-utils — PDF→bilde (tegning, OCR, blokk)"
  "tesseract|KREVES|tesseract-ocr — OCR i ftd-prosessering; trenger språkdata 'nor'"
  "xvfb-run|UTSATT|utsatt 2026-06-10 · BACKLOG «FIRE FUNKSJONER TAPT VED SERVERFLYTTINGEN 2026-06-10» — virtuell X for DWG/3D-veiene"
  "dwg2dxf|UTSATT|utsatt 2026-06-10 · BACKLOG «FIRE FUNKSJONER TAPT VED SERVERFLYTTINGEN 2026-06-10» — libredwg DWG→DXF, venter Kenneth-beslutning"
  "dwg2SVG|UTSATT|utsatt 2026-06-10 · BACKLOG «FIRE FUNKSJONER TAPT VED SERVERFLYTTINGEN 2026-06-10» — libredwg DWG→SVG"
  "CloudCompare|UTSATT|utsatt 2026-06-10 · BACKLOG «FIRE FUNKSJONER TAPT VED SERVERFLYTTINGEN 2026-06-10» — E57/PLY→LAS (3D-punktsky)"
  "PotreeConverter|UTSATT|utsatt 2026-06-10 · BACKLOG «FIRE FUNKSJONER TAPT VED SERVERFLYTTINGEN 2026-06-10» — LAS→Potree octree (3D)"
  "ODAFileConverter|VALGFRI|bedre DWG enn libredwg; dwg2dxf er fallback"
)

# ---------------------------------------------------------------------------
sjekk_node_container() {
  local navn="$1"
  printf "\n${B}CONTAINER: %s${N}" "$navn"
  if [ "$MODUS" = "lokal" ]; then
    printf "  ${DIM}[verts-modus]${N}\n"
    navn=""   # tom = sjekk host
  elif container_kjorer "$navn"; then
    printf "  ${G}[KJØRER]${N}\n"
  else
    printf "  ${Y}[NEDE — hopper over, ingen krasj]${N}\n"
    return
  fi
  local rad bin nivaa notat
  for rad in "${BINARER_NODE[@]}"; do
    IFS='|' read -r bin nivaa notat <<< "$rad"
    rapporter_bin "$navn" "$bin" "$nivaa" "$notat"
  done
  # tesseract-språkdata "nor" — egen apt-pakke (tesseract-ocr-nor). Sjekk lesende.
  # KUN når tesseract-binæren finnes — ellers dobbelttelles samme rotårsak
  # (mangler tesseract, mangler nor trivielt). Da er nor en egen KREVES-linje
  # bare når binæren er der men språkdataen ikke er.
  if finn_bin "$navn" "tesseract" >/dev/null; then
    if $DOCKER exec "${navn:-__host__}" sh -c 'tesseract --list-langs 2>/dev/null | grep -qx nor' 2>/dev/null \
       || { [ "$MODUS" = "lokal" ] && tesseract --list-langs 2>/dev/null | grep -qx nor; }; then
      printf "    %-22s ${G}OK${N}      ${DIM}norsk språkdata${N}\n" "tesseract:nor"
    else
      printf "    %-22s ${R}${B}MANGLER${N}  ${DIM}tesseract-ocr-nor (norsk OCR) — tesseract finnes, språkdata ikke${N}\n" "tesseract:nor"
      MANGLER_KREVES=$((MANGLER_KREVES + 1))
    fi
  fi
}

# ---------------------------------------------------------------------------
# ML-containere (embed + oversettelse): samme image sitedoc-ml. Python-tjenester.
#   Dockerfile.ml: python + torch + transformers + sentencepiece; HF_HOME=/models.
#   Scripts: apps/api/src/services/{norbert-server.py,oversettelse-server.py}
sjekk_ml_container() {
  local navn="$1" script="$2"
  printf "\n${B}CONTAINER: %s${N}" "$navn"
  if [ "$MODUS" = "lokal" ]; then printf "  ${DIM}[hoppes over i verts-modus]${N}\n"; return; fi
  if container_kjorer "$navn"; then printf "  ${G}[KJØRER]${N}\n"; else
    printf "  ${Y}[NEDE — hopper over]${N}\n"; return
  fi
  rapporter_bin "$navn" "python3" "KREVES" "python3-tolker"
  # torch/transformers importbart? (lesende import, ingen sideeffekt)
  if $DOCKER exec "$navn" python3 -c 'import torch, transformers, sentencepiece' 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}importerbart${N}\n" "torch+transformers"
  else
    printf "    %-22s ${R}${B}MANGLER${N}  ${DIM}pip: torch/transformers/sentencepiece${N}\n" "torch+transformers"
    MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
  # server-scriptet til stede?
  if $DOCKER exec "$navn" sh -c "test -f /app/$script" 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}/app/%s${N}\n" "$script" "$script"
  else
    printf "    %-22s ${R}${B}MANGLER${N}  ${DIM}forventet /app/%s${N}\n" "$script" "$script"
    MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
  # modell-cache montert? (/models = ml_models-volum; HF laster hit ved første kjøring)
  if $DOCKER exec "$navn" sh -c 'test -d /models' 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}HF-vekter caches her (ml_models-volum)${N}\n" "/models"
  else
    printf "    %-22s ${Y}mangler${N}  ${DIM}(valgfri) /models ikke montert → re-nedlasting hver start${N}\n" "/models"
    MANGLER_VALGFRI=$((MANGLER_VALGFRI + 1))
  fi
}

# ---------------------------------------------------------------------------
# pdf-render (Stage 4a): Playwright-Chromium-base. node + server.mjs + chromium.
sjekk_pdf_container() {
  local navn="sitedoc-pdf-render"
  printf "\n${B}CONTAINER: %s${N}" "$navn"
  if [ "$MODUS" = "lokal" ]; then printf "  ${DIM}[hoppes over i verts-modus]${N}\n"; return; fi
  if container_kjorer "$navn"; then printf "  ${G}[KJØRER]${N}\n"; else
    printf "  ${Y}[NEDE — hopper over]${N}\n"; return
  fi
  rapporter_bin "$navn" "node" "KREVES" "Node-runtime for server.mjs"
  if $DOCKER exec "$navn" sh -c 'test -f /app/server.mjs' 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}/app/server.mjs${N}\n" "server.mjs"
  else
    printf "    %-22s ${R}${B}MANGLER${N}\n" "server.mjs"; MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
  # Chromium fra Playwright — sjekk at executablePath finnes på disk (lesende).
  if $DOCKER exec "$navn" node -e 'const{chromium}=require("playwright");const fs=require("fs");process.exit(fs.existsSync(chromium.executablePath())?0:1)' 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}playwright chromium${N}\n" "chromium"
  else
    printf "    %-22s ${R}${B}MANGLER${N}  ${DIM}playwright/chromium — HTML→PDF ryker${N}\n" "chromium"
    MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
}

# ---------------------------------------------------------------------------
# postgres (delt pgvector-container, egen compose, på appnet).
sjekk_postgres() {
  local navn="postgres"
  printf "\n${B}CONTAINER: %s${N}  ${DIM}(delt pgvector — egen compose)${N}" "$navn"
  if [ "$MODUS" = "lokal" ]; then printf "  ${DIM}[hoppes over]${N}\n"; return; fi
  if container_kjorer "$navn"; then printf "  ${G}[KJØRER]${N}\n"; else
    printf "  ${Y}[NEDE — hopper over]${N}\n"; return
  fi
  rapporter_bin "$navn" "psql" "KREVES" "postgres-klient i containeren"
  # pgvector-extension installert? (AI-søk krever den). Lesende SELECT mot pg_extension.
  if $DOCKER exec "$navn" sh -c "psql -U sitedoc -d sitedoc -tAc \"SELECT 1 FROM pg_extension WHERE extname='vector'\" 2>/dev/null | grep -q 1" 2>/dev/null; then
    printf "    %-22s ${G}OK${N}      ${DIM}pgvector aktiv i db 'sitedoc'${N}\n" "pgvector"
  else
    printf "    %-22s ${Y}?${N}       ${DIM}(kunne ikke bekrefte — rolle/db-navn kan avvike, sjekk manuelt)${N}\n" "pgvector"
  fi
}

# ---------------------------------------------------------------------------
# ENV-FILER — kun EKSISTENS av nøkler. ALDRI verdier (CLAUDE.md § SIKKERHET).
sjekk_env() {
  printf "\n${B}ENV-FILER${N}  ${DIM}%s/docker/env/ — kun nøkkel-eksistens, aldri verdier${N}\n" "$STACK_DIR"
  local envdir="$STACK_DIR/docker/env"
  if [ ! -d "$envdir" ]; then
    printf "    ${Y}%s finnes ikke — kjør fra riktig --stack, eller env ligger annet sted${N}\n" "$envdir"
    return
  fi
  # fil|nøkkel|nivå  (nøkler utledet fra process.env-grep + compose-kommentarer + .env.example)
  local krav=(
    "felles.env|FIL_SIGNING_SECRET|KREVES"
    "api.env|DATABASE_URL|KREVES"
    "api.env|SITEDOC_INTEGRATION_KEY|KREVES"
    "api.env|VEGVESEN_API_KEY|VALGFRI"
    "api.env|RESEND_API_KEY|VALGFRI"
    "web.env|AUTH_SECRET|KREVES"
    "web.env|DATABASE_URL|KREVES"
    "web.env|AUTH_GOOGLE_ID|KREVES"
    "web.env|AUTH_GOOGLE_SECRET|KREVES"
    "web.env|AUTH_MICROSOFT_ENTRA_ID_ID|VALGFRI"
    "web.env|AUTH_MICROSOFT_ENTRA_ID_SECRET|VALGFRI"
  )
  local rad fil nokkel nivaa
  for rad in "${krav[@]}"; do
    IFS='|' read -r fil nokkel nivaa <<< "$rad"
    if [ ! -f "$envdir/$fil" ]; then
      printf "    %-14s %-30s ${R}${B}FIL MANGLER${N}\n" "$fil" "$nokkel"
      [ "$nivaa" = "KREVES" ] && MANGLER_KREVES=$((MANGLER_KREVES + 1))
      continue
    fi
    if grep -q "^${nokkel}=" "$envdir/$fil" 2>/dev/null; then
      printf "    %-14s %-30s ${G}finnes${N}\n" "$fil" "$nokkel"
    else
      if [ "$nivaa" = "KREVES" ]; then
        printf "    %-14s %-30s ${R}${B}MANGLER${N}\n" "$fil" "$nokkel"
        MANGLER_KREVES=$((MANGLER_KREVES + 1))
      else
        printf "    %-14s %-30s ${Y}mangler${N} ${DIM}(valgfri)${N}\n" "$fil" "$nokkel"
        MANGLER_VALGFRI=$((MANGLER_VALGFRI + 1))
      fi
    fi
  done
}

# ---------------------------------------------------------------------------
# VOLUMER / BIND-MOUNTS — den store lærdommen (68 MB bilag forsvant en tidligere flytting).
sjekk_volumer() {
  printf "\n${B}VOLUMER / BIND-MOUNTS${N}\n"
  if [ "$MODUS" = "lokal" ]; then printf "    ${DIM}[hoppes over i verts-modus]${N}\n"; return; fi
  local uploads="$STACK_DIR/uploads"
  if [ -d "$uploads" ]; then
    local n; n="$(find "$uploads" -type f 2>/dev/null | head -10000 | wc -l | tr -d ' ')"
    printf "    %-30s ${G}finnes${N}  ${DIM}%s (≥%s filer) — bind-mount til api(rw)/web(ro)${N}\n" "uploads/" "$uploads" "$n"
    [ "$n" = "0" ] && printf "    ${Y}    ⚠ TOM — hvis prosjektet HAR opplastede filer er dette 68MB-feilklassen${N}\n"
  else
    printf "    %-30s ${R}${B}MANGLER${N}  ${DIM}%s — opplastede filer usynlige for appen${N}\n" "uploads/" "$uploads"
    MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
  # ml_models-volum
  if $DOCKER volume inspect sitedoc_ml_models >/dev/null 2>&1 || $DOCKER volume inspect ml_models >/dev/null 2>&1; then
    printf "    %-30s ${G}finnes${N}  ${DIM}HF-modellvekter${N}\n" "ml_models (named volume)"
  else
    printf "    %-30s ${Y}mangler${N}  ${DIM}(valgfri) modeller lastes på nytt fra HuggingFace${N}\n" "ml_models (named volume)"
    MANGLER_VALGFRI=$((MANGLER_VALGFRI + 1))
  fi
  # appnet (external: true) MÅ finnes før compose up
  if $DOCKER network inspect appnet >/dev/null 2>&1; then
    printf "    %-30s ${G}finnes${N}  ${DIM}external — postgres bor her${N}\n" "appnet (network)"
  else
    printf "    %-30s ${R}${B}MANGLER${N}  ${DIM}external:true → compose up feiler før start${N}\n" "appnet (network)"
    MANGLER_KREVES=$((MANGLER_KREVES + 1))
  fi
}

# ---------------------------------------------------------------------------
# EKSTERNE TJENESTER — enumereres, sjekkes IKKE (nettverk måles ikke lesende-trygt herfra).
skriv_eksterne() {
  printf "\n${B}EKSTERNE TJENESTER appen når ut til${N}  ${DIM}(listes, ikke pinget — verifiser i flytte-sjekklisten)${N}\n"
  cat <<'EOF'
    Google OAuth        accounts.google.com / www.googleapis.com    (innlogging)
    Microsoft Entra     login.microsoftonline.com                   (innlogging)
    HuggingFace         huggingface.co                              (ML-modeller, første start)
    Resend              api.resend.com                              (e-post, valgfri)
    Vegvesen            www.vegvesen.no/ws/.../kjoretoydata          (maskin-oppslag)
    Open-Meteo          api.open-meteo.com + archive-api            (værdata)
    Nominatim / OSRM    openstreetmap.org / project-osrm.org         (geokoding/rute)
    Geonorge / brreg    ws.geonorge.no / data.brreg.no               (adresse/enhetsregister)
    DeepL               api-free.deepl.com                          (oversettelse, valgfri)
EOF
}

# ============================================================================
# SELVTEST — negativ kontroll. En probe som aldri har SETT en MANGLER er ikke
# verifisert (CLAUDE.md-lærdom: tom output ≠ grønt).
# ============================================================================
selftest() {
  printf "${B}SELVTEST (negativ kontroll)${N} — bevis at proben KAN si både OK og MANGLER\n\n"
  local feil=0
  # 1) kjent-tilstede binær → skal gi OK
  if finn_bin "" "sh" >/dev/null; then
    printf "  ${G}✓${N} 'sh' funnet på host (positiv kontroll)\n"
  else
    printf "  ${R}✗${N} 'sh' IKKE funnet — proben er ødelagt\n"; feil=1
  fi
  # 2) binær som garantert ikke finnes → skal gi MANGLER + telle
  local for_test=$MANGLER_KREVES
  rapporter_bin "" "__finnes_helt_sikkert_ikke__" "KREVES" "syntetisk mangel"
  if [ "$MANGLER_KREVES" -gt "$for_test" ]; then
    printf "  ${G}✓${N} syntetisk binær rapportert MANGLER og talt (negativ kontroll)\n"
  else
    printf "  ${R}✗${N} syntetisk mangel ble IKKE fanget — exit-logikken er død\n"; feil=1
  fi
  # 3) UTSATT-lint: en oppføring uten dato/ref skal utløse advarsel
  local ref_for=$UTSATT_UTEN_REF
  lint_utsatt "__syntetisk__" "notat uten dato eller referanse" >/dev/null 2>&1
  if [ "$UTSATT_UTEN_REF" -gt "$ref_for" ]; then
    printf "  ${G}✓${N} UTSATT uten dato/BACKLOG-ref fanget av lint\n"
  else
    printf "  ${R}✗${N} UTSATT-lint fanget ikke manglende ref\n"; feil=1
  fi
  # ...og en KORREKT UTSATT (dato + BACKLOG) skal IKKE utløse advarsel
  ref_for=$UTSATT_UTEN_REF
  lint_utsatt "__syntetisk_ok__" "utsatt 2026-06-10 · BACKLOG § Pakke D" >/dev/null 2>&1
  if [ "$UTSATT_UTEN_REF" -eq "$ref_for" ]; then
    printf "  ${G}✓${N} korrekt UTSATT (dato + BACKLOG) gir ingen advarsel\n"
  else
    printf "  ${R}✗${N} lint slo ut på en korrekt UTSATT-linje (falsk positiv)\n"; feil=1
  fi
  echo
  if [ "$feil" -eq 0 ]; then
    printf "${G}Selvtest bestått: proben skiller OK fra MANGLER og teller mangler.${N}\n"
    exit 0
  fi
  printf "${R}Selvtest FEILET.${N}\n"; exit 1
}

# ============================================================================
# KJØRING
# ============================================================================
if [ "$MODUS" = "selftest" ]; then selftest; fi

printf "${B}SiteDoc kapabilitets-probe${N}  ${DIM}(lesende — rapporterer, reparerer ikke)${N}\n"
printf "${DIM}Modus: %s   Stack: %s${N}\n" "$MODUS" "$STACK_DIR"

if [ "$MODUS" = "lokal" ]; then
  # Verts-modus: sjekk kun Node-binærene på maskinen probe-en kjører på.
  sjekk_node_container "(vertsmaskin)"
else
  sjekk_node_container "sitedoc-api"
  sjekk_node_container "sitedoc-web"
  sjekk_ml_container   "sitedoc-embed"        "norbert-server.py"
  sjekk_ml_container   "sitedoc-oversettelse" "oversettelse-server.py"
  sjekk_pdf_container
  sjekk_postgres
  sjekk_env
  sjekk_volumer
  skriv_eksterne
fi

# --- Oppsummering ------------------------------------------------------------
printf "\n${B}─── OPPSUMMERING ───${N}\n"
if [ "$MANGLER_KREVES" -eq 0 ]; then
  printf "${G}${B}Alt KREVES er på plass.${N}"
else
  printf "${R}${B}%s KREVES-avhengighet(er) MANGLER${N} ${DIM}— noe som skulle virke, virker ikke${N}" "$MANGLER_KREVES"
fi
[ "$MANGLER_UTSATT"  -gt 0 ] && printf "  ${Y}(%s utsatt — bevisst, teller ikke)${N}" "$MANGLER_UTSATT"
[ "$MANGLER_VALGFRI" -gt 0 ] && printf "  ${Y}(%s valgfri — teller ikke)${N}" "$MANGLER_VALGFRI"
printf "\n"
if [ "$UTSATT_UTEN_REF" -gt 0 ]; then
  printf "${R}${B}⚠ %s UTSATT-oppføring(er) uten dato/BACKLOG-ref${N} ${DIM}— fyll inn, ellers er UTSATT bare en avslått alarm${N}\n" "$UTSATT_UTEN_REF"
fi

# HVA PROBEN IKKE KAN SJEKKE (går videre til flytte-sjekklisten i ny-server-veileder.md § 7):
printf "${DIM}Proben verifiserer IKKE: DNS/Cloudflare-tunnel, OAuth redirect-URI-er hos\n"
printf "Google/Azure, backup før+etter flytting, eller at env-VERDIENE er riktige\n"
printf "(kun at nøkkelen finnes). Se ny-server-veileder.md § 7 «Flytte-sjekkliste».${N}\n"

[ "$MANGLER_KREVES" -eq 0 ] && exit 0 || exit 1
