> **⚠️ ARBEIDSDOKUMENT — GODKJENT FASE 1-PLAN (Kenneth, 2026-06-08).**
> Ikke sannhetskilde, ikke i DOC-MAP. Alle fil:linje uavhengig verifisert mot kode av kontroll-Claude.
> Innholdet rutes til `timer.md` + `arkitektur.md` når Fase 1 implementeres (steg 8); deretter kan fila fjernes.
> SPOR 3 — ingen kode/branch før per-fase-godkjenning (denne planen ER Fase 1-godkjenningen).

# Fase 1 — Plan (ord): Oppmøtested-entitet + firmainnstillinger-modal + GPS-identifikasjon

> **Plan med ord for Kenneths godkjenning. Ingen kode/branch før godkjent.** Bygger på SPOR 2-beslutningssettet (timer.md § Planlagte arkitektur-utvidelser, fase-0 T.10). Fase 1 er rent additivt — **rører verken T.2 (`projectId NOT NULL`) eller firma-isolasjon**. Lavest risiko, etablerer rytmen.

## Mål

Et firma kan registrere sine faste oppmøtesteder (kontorer) med GPS-geofence. Mobilen identifiserer ved «Start dag» hvilket kontor (eller prosjekt) arbeideren faktisk startet på, logger inn/ut som dokumentasjon, og *foreslår* starttid. **Ingen lønns-/reiselogikk, ingen auto-rader** — kun identifikasjon + forslag.

## Forankring (eksisterende mønstre å speile — verifisert mot kode)

| Mønster | Fil:linje | Brukes til |
|---------|-----------|------------|
| `Avdeling`-entitet (firma-eid, kjerne) | `packages/db/prisma/schema.prisma:1902` | Mal for ny `Oppmotested`-entitet |
| `avdelingRouter` (CRUD + firma-admin-tilgang) | `apps/api/src/routes/avdeling.ts:40` | Mal for `oppmotestedRouter` |
| `haversineKm()` | `apps/mobile/src/utils/geo.ts:6` | Avstand GPS → oppmøtested/prosjekt |
| `arbeidsdag_local` (KUN lokal, synkes ikke) | `apps/mobile/src/db/migreringer.ts:294` | Mal for inn/ut-dokumentasjon (lokal) |
| `prosjekt_local`-cache + refresh | `apps/mobile/src/db/migreringer.ts:394` | Mal for `oppmotested_local`-cache |
| Idempotent lokal migrasjon (PRAGMA + ALTER) | `apps/mobile/src/db/migreringer.ts:256` | Ny lokal tabell trygt |
| `OrganizationSetting hentSetting/oppdaterSetting` (upsert) | `apps/api/src/routes/organisasjon.ts:766/803` | Mønster for firma-innstilling-skriving |
| Ekte `Modal` (ikke native confirm) | Lønnsarter-siden (Explore bekreftet) | CRUD-UI for oppmøtested |

## Steg (rekkefølge)

1. **DB — ny entitet (kjerne `packages/db`), søsken til `Avdeling`:**
   `Oppmotested { id, organizationId (FK→Organization, Cascade), navn, adresse?, lat Float, lng Float, radiusM Int @default(150), avdelingId? (FK→Avdeling, SetNull), aktiv Boolean @default(true), createdAt, updatedAt }` + `@@index([organizationId, aktiv])`.
   - Prisma-migrasjon: **rent additiv ny tabell** (ingen DROP, ingen endring av eksisterende). `pnpm --filter @sitedoc/db exec prisma migrate dev`.
   - 📌 **Plassering kjerne (ikke `db-modul`):** bevisst valg (KS-3). Oppmøtested er firma-*infrastruktur* på linje med `Avdeling` (også kjerne), ikke en modul-tabell. Speiler Avdeling-presedensen.

2. **API — `oppmotestedRouter`** (speil `avdeling.ts:40`): `list` / `opprett` / `oppdater` / `slett`, alle org-scopet, samme firma-admin-tilgangssjekk som Avdeling-routeren bruker. Zod-validering (lat/lng/radius). Mobil-konsumerbar `list` (for cache-refresh).

3. **Web — firmainnstillinger-side** (`apps/web/src/app/dashbord/firma/oppmotesteder/`): liste over oppmøtesteder + opprett/rediger/slett via **ekte `Modal`** (ikke native confirm — jf. CLAUDE.md). Felt: navn, adresse, lat/lng, radiusM, valgfri avdeling. **Koordinat-UX: Leaflet-kart-klikk** (kart finnes alt i stacken) for å sette lat/lng, med manuell tallinntasting som fallback. i18n via `t()`.

4. **Mobil — lokal cache `oppmotested_local`** (speil `prosjekt_local:394`): `CREATE TABLE IF NOT EXISTS` i `migreringer.ts` + Drizzle-schema-rad i `db/schema.ts`. Refresh-funksjon som kaller `oppmotested.list` (speil prosjekt-cache-refresh, kalles ved login + nett-gjenkomst). **KUN lokal** — synkes aldri opp.

5. **Mobil — GPS-identifikasjon i «Start dag»** (utvid `StartSluttDagKort` + Start-dag-forslagslogikken): ved «Start dag», kjør `haversineKm()` (geo.ts:6) mot **både** `oppmotested_local` og `prosjekt_local`. Nærmeste treff innenfor `radiusM` → «startet på Kontor X»; ellers nærmeste prosjekt → «startet på prosjekt Y». Logg inn/ut i `arbeidsdag_local` som **dokumentasjon** + *foreslå* starttid. **Aldri auto-opprett dagsseddel/timer-rad** (`fase-0 T.8:983`). Lønn ankret på arbeidsavtale, ikke geofence.
   - 📌 **Prosjekt-siden i Fase 1 = eksisterende `Project.lat/lng`-MVP** (som Start-dag-MVP-en alt bruker). Testbrukere kan sette prosjekt-koordinat manuelt. Presis byggeplass-deteksjon kommer i Fase 1c.

6. **i18n:** nye nøkler i `nb.json` + `en.json`, deretter `pnpm --filter @sitedoc/shared exec tsx src/i18n/generate.ts` (13 målspråk).

7. **Hjelpetekst** for den nye firmainnstillinger-siden (?-ikon, per CLAUDE.md-konvensjon).

8. **Docs i SAMME commit:** flytt oppmøtested fra «planlagt» → implementert i `timer.md` + `arkitektur.md` (entitet bygget); `STATUS-AKTUELT.md` (aktivt arbeid); `STATUS.md` (tri-felt). Modul-avhengighetssjekk gjelder ikke (rører ikke SheetTimer/dagsseddel-skjema).

## Hva Fase 1 IKKE gjør (grenser)

- **Ingen reise-/lønnslogikk** (Fase 3). GPS identifiserer kun oppmøtested + foreslår starttid.
- **Ingen firma-isolasjons-fiks** (Fase 1b) — rører ikke `rapport.ts`/`tilfoyTimerRad`.
- **Ingen Alt C** (Fase 2) — rører ikke `Project.type`/`SheetTimer.vehicleId`/T.2.
- **Inn/ut-dokumentasjon holdes lokal** (`arbeidsdag_local`, synkes ikke) — ingen server-side nærvær/fra-til (det er PSI-territorium + fra/til-feltisolasjon, holdt utenfor Fase 1).

## Fase 1c (ny, etter Fase 1) — byggeplass-geofence fra georeferert tegning

Avled byggeplassens geofence fra dens **georefererte tegning** (`Drawing.geoReference` Json + `coordinateSystem`, `schema.prisma:637/633`) + 100 m buffer, ved å gjenbruke eksisterende GPS-transform (`tegninger/page.tsx:149`, `GeoReferanse` i `@sitedoc/shared`). Erstatter/utfyller `Project.lat/lng` for prosjekt-deteksjon. **Bonus:** løser byggeplass-koordinat-gapet (`T.8:990`) som også Fase 3 (kontor→byggeplass-reise) trenger. Egen fase fordi den legger til reell kompleksitet (UTM/NTM → lat/lng-projeksjon, område + buffer); holdes ut av Fase 1 for å bevare lav risiko.

## ⚠️ Spørsmål til Kenneth før godkjenning

1. **Koordinat-UX:** Leaflet-kart-klikk (anbefalt) + manuell fallback — OK? Eller kun manuell lat/lng i MVP?
2. **`radiusM` default 150 m** — fornuftig geofence-radius for kontor, eller annen verdi?
3. **Inn/ut-dokumentasjon lokal-only i Fase 1** (ikke synket som nærvær) — bekreft at det er ønsket MVP-grense (server-side nærvær = senere PSI-arbeid).

## Verifisering + leveranse

- **Test-deploy → jeg verifiserer funksjonelt på test.sitedoc.no** (egne tester, ikke Opus' egenrapport): opprett oppmøtested i web-modal, bekreft at det vises/lagres org-scopet; mobil — bekreft cache-refresh + at «Start dag» innenfor radius identifiserer kontoret og foreslår starttid uten å opprette rader.
- **Prod kun ved eksplisitt forespørsel.** Mobil-del krever EAS-bygg for å nå brukere (jf. eksisterende Start-dag-MVP-status).
