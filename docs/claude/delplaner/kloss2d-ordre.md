---
name: kloss2d-ordre
status: ✅ MERGET develop (`42b77e0c`, 2026-07-24). Cowork-gate bestått (schema orgId-fri, loader/tRPC/UI orgId-frie, migrering idempotent+TRUNCATE, shared statusHandlinger + Kloss 2b urørt, 259 tester grønne). Kenneth kjører `migrate deploy` for `20260724130000` (bekrefter TRUNCATE)
eier: cowork (ordre + gate) · kode-Opus «B Kloss 2d» (ledd 3)
sist_verifisert_mot_kode: 2026-07-24
---

# Ordre — B Kloss 2d: global flyt-rettighetskonfig (dropp per-firma orgId)

> **Cowork-ordre 2026-07-24.** Design: [rettighetsmatrise-config-design.md rev.7 § 0 + § 1](rettighetsmatrise-config-design.md) (fabel, cowork-gatet). **Kenneth-vedtak (sett på test):** matrisen skal være ÉN global sitedoc-konfig, ikke per-firma. Vedtak 4 revidert. Reverserer per-firma-dimensjonen fra Kloss 1 (`orgId`-nøkling) + 2c (firma-dropdown). Delta-modellen består (kode-defaults + globale overstyringer); statusmaskin-bindingen (vedtak 1) står.

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus «B Kloss 2d», ledd 3. **Du koder — kun det.** Gater ikke, merger ikke, deployer ikke. **Branch:** `feat/flytmatrise-global` fra `origin/develop`. Du pusher kun denne.

**Kjernen:** `FlytRettighetOverride`/`FlytRettighetLogg` er i dag nøklet på `orgId` (Kloss 1). Dropp `orgId` → tabellene blir globale, unik-nøkkel `(rolle, fraStatus, tilStatus)`. Loader/tRPC/2c-UI slutter å ta `orgId`. **Shared `statusHandlinger.ts` (celleTillatt/celleTillatt-logikk) RØRES IKKE** — den mottar bare en global overrides-map i stedet for en per-org; logikken er uendret.

## 1. Byggeoppgaver

**A. Schema (`packages/db/prisma/schema.prisma`):**
- `FlytRettighetOverride`: fjern `orgId` + `organization`-relasjonen + `@@index([orgId])`. Ny `@@unique([rolle, fraStatus, tilStatus])`. Behold `endretAv`-relasjonen (User).
- `FlytRettighetLogg`: fjern `orgId` + `organization`-relasjonen + `@@index([orgId])`. Behold resten (append-only, `endretAv`).
- `Organization`-modellen: fjern back-relasjonene `flytRettighetOverrides` + `flytRettighetLogg` (lagt til i Kloss 1).

**B. Migrering (hånd-skrevet idempotent):**
- Dropp FK-ene (`flyt_rettighet_overrides_org_id_fkey`, `flyt_rettighet_logg_org_id_fkey`) + de gamle unik/`org_id`-indeksene, dropp `org_id`-kolonnen, legg ny unik `(rolle, fra_status, til_status)`. Bruk `DO $$`-guards (`IF EXISTS`) så den er idempotent.
- 🔴 **Data:** tabellene kan ha per-org test-rader. Ny unik `(rolle, fra_status, til_status)` kolliderer hvis to org-er overstyrte samme celle → **`TRUNCATE` begge tabellene før ALTER** (config-data, kastbart; ingenting på prod, test-overstyringer er throwaway). **Flagg for gaten/Kenneth:** dette avviker fra to-stegs-migrasjonspolicyen + «aldri slett data» — begrunnet: tabellene er dager gamle, aldri på prod, holder kun regenererbar config (sitedoc-admin re-konfigurerer). **Kenneth kjører `migrate deploy` og bekrefter migrerings-tilnærmingen.**

**C. Loader + server (`apps/api/src/services/flytRettighet.ts` + `tilgangskontroll.ts`):**
- `hentFlytRettighetOverrides()` — dropp `orgId`-param, `findMany()` uten `where` → returnerer alle (globale) overstyringer som map. Tom tabell → `{}` (bit-identisk fallback).
- `verifiserFlytRolle`: fjern `project.primaryOrganizationId`-oppslaget som matet loaderen — kall `hentFlytRettighetOverrides()` uten arg. (Prosjekt-oppslaget kan fjernes helt hvis det kun var for dette.)

**D. tRPC (`apps/api/src/routes/flytMatrise.ts`):**
- Dropp `orgId` fra `celleInput` + fra `hentMatrise`/`hentLogg`/`settRettighet`/`tilbakestill`. `findMany`/`upsert`/`delete`/`create` uten `orgId`. `verifiserSiteDocAdmin`-gaten uendret (sitedoc-only står).

**E. 2c-UI (`apps/web/src/app/dashbord/admin/flyt-rettigheter/page.tsx`):**
- Fjern firma-dropdownen (`admin.hentAlleOrganisasjoner`-query + `valgtFirma`-state + `<select>`). Matrisen ER den globale konfigen — last den direkte (ingen `orgId`-gating). i18n: `flytmatrise.firmaLabel`/`firmaVelger`/`velgFirma` blir døde → fjern nøklene fra `nb.json`+`en.json` og kjør `generate.ts` (rydder de 13).

## 2. Ufravikelig

- **Statusmaskin-bindingen (vedtak 1) står:** override-only-snittet mot `validTransitions` i `celleTillatt` er uendret. **Shared `statusHandlinger.ts` rører du IKKE.**
- **Kloss 2b (`autoProsjektAdmin`) er UBERØRT** — det er per-firma medlemskap, ingenting med matrisens `orgId` å gjøre.
- **Gate uendret:** `kanRedigereFlytMatrise` = sitedoc_admin only.
- **`dokumentflytId` reserveres IKKE** (YAGNI — gjenoppstår per-firma-behovet, koster det det samme da).
- ALDRI slett bruker-/medlemskaps-/prosjektdata. Kun config-tabellene truncates (flagget over).

## 3. DoD

`prisma generate` ren · migrering idempotent (`IF EXISTS`-guards) · loader/tRPC/UI uten `orgId` · døde i18n-nøkler ryddet (`generate.ts` kjørt) · eksisterende `statusHandlinger.test.ts` uendret grønn (shared urørt) · `typecheck` (shared/api/web) + `next build` grønn · lint rene rørte filer. **Bevis i PR:** (a) schema-diff + migrering, (b) at loader/tRPC/UI er `orgId`-frie, (c) at matrisen laster uten firma-valg. **Ikke merge, ikke deploy** — push branch, cowork gater. Kenneth kjører `migrate deploy` mot test.
