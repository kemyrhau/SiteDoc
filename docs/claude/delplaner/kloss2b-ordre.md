---
name: kloss2b-ordre
status: 🟢 AKTIV — byggeordre B Kloss 2b (firma-innstilling auto-prosjektadmin). Design: rettighetsmatrise-config-design rev.6 § 1b. Kode på branch; cowork gater (INGEN merge autonomt)
eier: cowork (ordre + gate) · kode-Opus «B Kloss 2b» (ledd 3)
sist_verifisert_mot_kode: 2026-07-24
---

# Ordre — B Kloss 2b: firma-innstilling «auto-prosjektadmin» (medlemskap, ikke flyt-nivå)

> **Cowork-ordre 2026-07-24.** Design: [rettighetsmatrise-config-design.md § 1b](rettighetsmatrise-config-design.md) (fabel rev.6, cowork-gatet). Løser hierarki-invarianten (firma-admin ≥ prosjektadmin i eget firma) ved **medlemskap**, ikke `adminNiva="firma"`. Kloss 2-maskineriet står helt urørt.

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus «B Kloss 2b», ledd 3. **Du koder — kun det.** Gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Arbeidstre + branch:** `feat/flytmatrise-autoprosjektadmin` fra `origin/develop`. Du pusher kun denne.

**Kjernen:** en opt-in firma-innstilling som, ved oppretting av NYE prosjekter, auto-legger firmaets firma-admin(er) som `ProjectMember.role=admin`. Da får de `adminNiva="prosjekt"` gjennom eksisterende sti — **ingen `adminNiva`-endring, ingen `verifiserFlytRolle`-endring, ingen `firmaadmin`-rolle i matrisen.** Innstillingen automatiserer bare omveien cowork alt har verifisert (firma-admin kan selv-tildele seg `ProjectMember.role=admin` via `medlem.leggTil` → `verifiserAdmin` → O-3a firma-fallback).

## 1. Byggeoppgaver

**A. Schema — `OrganizationSetting.autoProsjektAdmin` (enum, IKKE boolean):**
- Nytt felt: `autoProsjektAdmin String @default("av") @map("auto_prosjekt_admin")`. Verdier (kommentar over feltet, som de andre enum-feltene i modellen): `"av" | "alle_firma_admins"`. **Fremtidssikret:** `"utvalg"` (+ relasjonstabell per person/kontorsted/avdeling) legges til i umbrella-delplanen senere — ny enum-verdi + tabell, INGEN semantikk-migrering. Følg presedensen `timerTilgangDefault`/`maskinbrukTilgangDefault` (String @default + «Verdier:»-kommentar).
- **Migrering hånd-skrevet idempotent** (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS "auto_prosjekt_admin" TEXT NOT NULL DEFAULT 'av'`). Additiv, ingen backfill, bevarer eksisterende rader. `prisma generate` for `@sitedoc/db`. **IKKE kjør mot lokal DB — Kenneth kjører `migrate deploy` mot test.**

**B. Hook — auto-medlemskap ved prosjektoppretting (ALLE tre stier):**
- Cowork-målt hook-punkt: `apps/api/src/routes/prosjekt.ts` (`opprett` + `opprettTestprosjekt`) + `apps/api/src/routes/admin.ts` (`opprettProsjekt`). Alle tre lager prosjektet i en transaksjon med oppretter som `members: { create: { role: "admin" } }`.
- **Etter** at prosjektet + oppretter-medlemmet er laget (inne i samme `tx`): hvis `OrganizationSetting.autoProsjektAdmin === "alle_firma_admins"` for prosjektets `primaryOrganizationId`, hent firmaets firma-admins (`OrganizationMember` der `firmaRoller` inneholder `"firma_admin"` på den org-en) og legg hver til som `ProjectMember { role: "admin" }`.
- **Dedup:** hopp over brukere som alt har en `ProjectMember`-rad på prosjektet (oppretteren, evt. andre). Bruk `createMany` med `skipDuplicates` eller eksplisitt sjekk — ingen dobbel-rad, ingen unik-constraint-krasj.
- **Ingen innstilling / `"av"` = dagens oppførsel** (kun oppretteren, som i dag). Additiv.

**C. Firma-UI — innstillingen:**
- En kontroll i firma-innstillingene (`dashbord/firma/innstillinger` eller nærmeste innstillings-flate) som setter `autoProsjektAdmin`. V1 viser **på/av** (av = `"av"`, på = `"alle_firma_admins"`) med forklarende hjelpetekst: «Firma-admins legges automatisk som prosjektadmin ved nye prosjekter.»
- **Redigeringsgate = firma-admin + sitedoc-admin** (det er firmaets egen driftsinnstilling — IKKE matrise-config-retten, som er sitedoc-only). tRPC-prosedyre henter/setter feltet, firma-grense server-side (`verifiserAdmin`/org-scope).
- i18n `t()` i `nb.json` + `en.json` + `generate.ts`.

## 2. Kanter (Rev.6 § 1b — håndter eksplisitt)

1. **Kun NYE prosjekter** — ingen backfill, ingen engangs-handling på eksisterende. Der brukes omveien (manuell tildeling, som i dag).
2. **Firma-admin utnevnt ETTER prosjektoppretting** — dekkes ikke av auto-regelen. Omveien finnes; dokumentér i hjelpeteksten/PR.
3. **Fjernet firma-admin** — medlemskapet består (vanlig medlemsforvaltning), fjernes manuelt. Auto-regelen re-kjører ikke.
4. **Hvem** — firma-styrt via enum. V1: `"alle_firma_admins"`. Ikke bygg utvalgs-UI (umbrella-delplanen).

## 3. Ufravikelig

- **`adminNiva`, `verifiserFlytRolle`, `celleTillatt`, matrisen — RØRES IKKE.** Dette er ren medlemskaps-automatisering; flyt-laget er ferdig i Kloss 2.
- **Firma-grense server-side:** firma-admin-oppslag ALLTID via `OrganizationMember.firmaRoller` på prosjektets `primaryOrganizationId` — aldri cross-org. Standalone-prosjekt (`primaryOrganizationId = null`) = no-op.
- **ALDRI slett data:** kun `ADD COLUMN` + `INSERT`/`createMany`. Migrering additiv + idempotent.
- Norsk bokmål, æ/ø/å. i18n i begge språkfiler + `generate.ts`.

## 4. DoD

`prisma generate` ren · migrering idempotent (verifisert ved konstruksjon) · hook i **alle tre** opprettelses-stier med dedup · setting-UI + tRPC (firma-gatet) · i18n × 14 · `typecheck` + `next build` grønn · lint på rørte filer rene. **Bevis i PR:** (a) enum-feltet + migrering, (b) at alle tre opprettelses-stier auto-legger + deduper, (c) at `"av"`/ingen-innstilling er bit-identisk med dagens oppretting. **Ikke merge, ikke deploy** — push branch, cowork gater.
