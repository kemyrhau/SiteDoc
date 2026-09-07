---
tittel: Nå-rapport — reisetid over 30 min kjøretid (A.Markussen-kravet)
type: nå-rapport
dato: 2026-09-07
sist_verifisert_mot_kode: 2026-09-07
status: 🟢 MÅLING
bestilt_av: cowork (inbox-reisetid-naa-rapport.md)
formål: Grunnlag for Kenneths valg av kjøretidskilde. Ingen anbefaling, ingen design.
---

# Nå-rapport: reisetid over 30 min kjøretid

**Kravet (Kenneth 2026-09-01):** er kjøretiden mellom oppmøtested og byggeplass **over 30
minutter**, registreres tiden som **reisetid** (egen lønnsart). Under: **timelønn**.

> 🔴 **Overordnet funn — les først.** Ordren ba om grunnlag før bygging, «så fabel ikke
> designer på umålt grunn». Målingen viser at **grunnen ikke er tom: reisetid-regelen er
> allerede bygget ende-til-ende** — datamodell, firmainnstilling, OSRM-kjøretidsmatrise,
> og mobil auto-generering med nøyaktig 30-minutters terskel og reise-lønnsart. Kravet er
> ikke et greenfield-design; det er en **allerede kodet regel** hvis åpne spørsmål er
> (a) om koden er deployet til test/prod og (b) om test-/prod-firmaene faktisk har
> koordinatene og lønnsart-radene regelen forutsetter. Begge er live-DB-spørsmål jeg ikke
> kan måle herfra — se siste seksjon.

Alle påstander under bærer `fil:linje` mot koden i arbeidstreet (`SiteDoc-kontrollplan`,
detached HEAD fra develop). **Deploy-tilstand og faktiske DB-tall er «ikke målt».**

---

## 1. `Oppmotested` — felter og koordinater

Modellen finnes: `packages/db/prisma/schema.prisma:2484-2505` (tabell `oppmotesteder`).
Felter: `id`, `organizationId`, `navn`, `adresse` (nullable), **`lat Float`**,
**`lng Float`**, `radiusM Int @default(150)`, `avdelingId` (nullable), `aktiv`,
`createdAt`, `updatedAt`.

🔴 **Koordinatene `lat`/`lng` er PÅKREVDE (ikke-nullable) — `schema.prisma:2489-2490`.**
Det betyr strukturelt at **hvert oppmøtested som eksisterer, nødvendigvis har koordinater**;
et oppmøtested uten koordinater kan ikke opprettes. Automatikk-sporet er derfor **ikke** dødt
av manglende oppmøtested-koordinater — den risikoen ordren pekte på er utelukket i skjemaet.

Flaten `/dashbord/firma/oppmotesteder` skriver via `apps/api/src/routes/oppmotested.ts`
(bl.a. adressesøk/geokoding, se punkt 5), som fyller `lat`/`lng` ved opprettelse.

**Antall oppmøtesteder på test, og hvor mange med koordinater: ikke målt** (krever psql mot
`sitedoc_test`). Merk at «hvor mange med koordinater» er trivielt = «hvor mange finnes», gitt
at feltene er påkrevde.

---

## 2. Byggeplass-koordinater

Modellen: `packages/db/prisma/schema.prisma:904-941` (tabell `byggeplasser`). Koordinatene:
**`latitude Float?` og `longitude Float?` — NULLABLE** (`schema.prisma:916-917`), pluss
`radiusM Int?`. Kommentaren (`:913-916`) sier de settes «når en koblet tegning georefereres,
eller manuelt» — i tråd med `identifiserByggeplass`/georeferanse-veien ordren nevner.

Ved kjøretidsberegning resolveres byggeplass-koordinat i denne rekkefølgen:
**byggeplass egen → prosjekt-fallback → ingen** — `apps/api/src/services/reisetidMatrise.ts:68-74`
(`b.latitude ?? b.project?.latitude`, tilsvarende for lng). Byggeplasser uten koordinat (og
uten prosjekt-fallback) får matrise-radene sine **slettet** som stale
(`reisetidMatrise.ts:78-83`) — de gir ingen reisetid-forslag.

**Antall byggeplasser på test med koordinater (egen eller via prosjekt): ikke målt** (krever
psql mot `sitedoc_test`). Dette er den reelle dekningsvariabelen for automatikk-sporet, siden
byggeplass-koordinat i motsetning til oppmøtested-koordinat kan mangle.

---

## 3. Lønnsart-katalogen — finnes «reisetid»?

Modellen: `packages/db-timer/prisma/schema.prisma:22-54` (tabell `timer.lonnsarter`), per
firma (`organizationId`), med `type` (`ordinaer`/`fravaer`/`feriepenger`/`diett`), `navn`,
`kode`, `rekkefolge`, `overtidsnivaa` m.m.

**Det finnes ingen lønnsart som heter «Reisetid» i seed-katalogen.** Reisen føres i stedet på
eksisterende reise-arter. Nivå 2-seeden (`apps/api/src/services/seed/index.ts:112-119`)
oppretter bl.a.:
- `Reise 7,5–15 km`, `Reise 15–30 km`, `Reise 30–45 km`, `Reise 45–60 km` (`:114-117`)
- `Kilometergodtgjørelse (egen bil)` (`:118`)
- **`Reise/transport til prosjekter`** (`:119`) — arten reisetid-regelen faktisk lander på.

A.Markussen-fixturet har den samme: `apps/api/src/services/katalog/fixtures/a-markussen.json:15`
— kode `122`, `Reise/transport til/fra prosjekter`.

Hvilken art reisetid bokføres på bestemmes av (prioritert):
1. `OrganizationSetting.reiseLonnsartId` — eksplisitt valgt av firma-admin, svak FK →
   `timer.Lonnsart` (`packages/db/prisma/schema.prisma:433-435`).
2. **Navne-match** `/reise|transport/i` mot aktive lønnsarter, hvis 1 er null —
   `apps/mobile/src/services/timerKatalog.ts:263-270` (`hentReiseLonnsartId`).

🔴 **Om SITEDOC MYRHAUG på test faktisk har `Reise/transport til prosjekter` (eller en
`reiseLonnsartId` satt): ikke målt** (krever psql mot `sitedoc_test`). Uten en matchende art
returnerer resolveren `null`, og reisetid-forslag **undertrykkes** (ingen art å føre på) —
`StartSluttDagKort.tsx:509-512`.

---

## 4. Dagens registreringsvei — hvilken lønnsart, av hva, hvor

Reisetid-klassifiseringen kjører **i mobil «Start dag / Slutt dag»-auto-genereringen**, ikke
ved manuell rad-føring. Skrivestien fra toppen:

1. **UI-utløser:** «Slutt dag» i `apps/mobile/src/components/StartSluttDagKort.tsx`
   trigger `genererForslag` (funksjonen som starter rundt `:434`).
2. **Reisetid-kilde** (`StartSluttDagKort.tsx:470-497`): primært lokal matrise-rad
   `hentMatriseRadLokalt(oppmotestedId, byggeplassId)` (`:479`, verdi `-1`/uoppnåelig → 0,
   `:481`); fallback `estimerReisetidMin(avstandMeter(...))` fra GPS når matrisen mangler
   (`:491-496`).
3. **Klassifisering** (`:498-503`): `klassifiserReise(reisetidMin, regel)` mot firmaets
   `reiseTerskelMin` — kilde `packages/shared/src/utils/reise.ts:35-42`. Skarp grense: nøyaktig
   terskel regnes som «over» (`reisetidMin < terskel` → under, ellers over — `reise.ts:39`).
4. **Reise-lønnsart** (`:504-513`): er kategorien `reisetid`, resolveres arten via
   `hentReiseLonnsartId(orgId)` (punkt 3). Har firmaet ingen art, settes reisetid **ikke**.
5. **Normaltid/overtid** for resten av dagen klassifiseres separat av
   `klassifiserArbeidstid` (`packages/shared/src/utils/lonnsregel.ts:41-55`): normaltid-segment
   (`overtidsnivaa: null`) → firmaets standardvalg-art (`erStandardvalg`, seedet «Timelønn»,
   `seed/index.ts:100`); overtid → `velgOvertidLonnsart` (`lonnsregel.ts:73-84`, aldri
   fritekst-navn).
6. **Skriving** (`:570-600`): `opprettDagsseddelForSegment(...)` per midnatt-segment mottar
   `reiseLonnsartId` + fordelt `reisetidTimer` (`:589-591`); reise-raden skrives til lokal
   SQLite på `StartSluttDagKort.tsx:850-856` (`lonnsartId: reiseLonnsartId`), som deretter
   synkes til server.

**Firmainnstillingen** som styrer dette (`OrganizationSetting`,
`packages/db/prisma/schema.prisma:419-435`):
- `reiseTerskelMin Int @default(30)` (`:424`) — **default er nøyaktig 30 min, som kravet.**
- `reiseUnderTerskelType String @default("arbeidstid")` (`:426`)
- `reiseOverTerskelType String @default("reisetid")` (`:428`) — **default over terskel =
  reisetid, som kravet.**
- `reisetidTellerOvertid Boolean @default(false)` (`:432`)
- `reiseLonnsartId String?` (`:435`)

Innstillingen redigeres i web-UI: `apps/web/src/app/dashbord/firma/innstillinger/page.tsx:1179-1204`,
og eksponeres/oppdateres via `apps/api/src/routes/organisasjon.ts:1034-1037` (les) og
`:1117-1120` (skriv, Zod-validert). Mobil leser samme regelsett fra lokal cache:
`apps/mobile/src/services/organizationSettingKatalog.ts:73-77`, speilet i lokal Drizzle-schema
`apps/mobile/src/db/schema.ts:581-584`.

**Manuell rad-føring** (ansatt legger en timer-rad selv, uten Start/Slutt dag) velger lønnsart
fra katalog-nedtrekket; default = firmaets `erStandardvalg`-art. Denne veien kjører **ikke**
reisetid-klassifisering — den er knyttet til dag-auto-genereringen.

---

## 5. Finnes det alt en avstands-/ruteberegning?

**Ja — flere, hver med sitt formål. En andre skal ikke bygges.**

- **OSRM `/table` (kjøretid — den autoritative kilden):**
  `apps/api/src/services/rute-service.ts:89-114` (`matrise`), offentlig
  `hentKjoretidMatrise(fra, til)` (`:172-177`). Sekunder → minutter, uoppnåelige par → `-1`
  (`UOPPNAAELIG`, `:44`). Base-URL bak env `OSRM_BASE_URL`, public fallback
  `router.project-osrm.org` (`:31-32`).
- **Nominatim geokoding + Kartverket/Geonorge adressesøk:** `rute-service.ts:70-87`
  (`geokod`) og `:133-165` (`sokAdresser`) — keyless, for å gi oppmøtesteder koordinater.
- **`ReisetidMatrise` — forhåndsberegnet kjøretid per [kontor × byggeplass]:** tabell
  `packages/db/prisma/schema.prisma:2518-2533`; recompute-motor
  `apps/api/src/services/reisetidMatrise.ts:40-141` (`recomputeMatrise`), med fire-and-forget
  triggere ved kontor-/byggeplass-endring (`:146-175`). Trigges fra
  `apps/api/src/routes/oppmotested.ts:133-137` (eksplisitt «beregn matrise»-knapp) og
  `apps/api/src/routes/byggeplass.ts:171` (rad-recompute ved koordinatendring).
- **`estimerReisetidMin(avstandM, snittKmT=50)`** — MVP-fallback som avleder tid fra
  luftlinje-avstand × 50 km/t når matrisen mangler: `packages/shared/src/utils/reise.ts:50-57`.
- **`avstandMeter` (Haversine, meter):** `packages/shared/src/utils/georeferanse.ts:411`
  (eksportert `packages/shared/src/utils/index.ts:17`) — brukt av estimat-fallbacken.
- **`haversineKm`:** `apps/mobile/src/utils/geo.ts:6-12` — brukt til å identifisere
  prosjekt/byggeplass fra GPS (`StartSluttDagKort.tsx:444`), ikke til kjøretid.

⚠️ Merk skillet ordren la vekt på: **kjøretid** hentes fra OSRM (rute, ikke luftlinje);
`avstandMeter`/`haversineKm` er luftlinje og brukes kun til posisjons-identifikasjon og som
grov estimat-fallback. `estimerReisetidMin` er den eneste som konverterer luftlinje til tid,
og kun når OSRM-matrisen ikke har svart.

---

## Hva målingen gjør umulig (eller lar stå åpent)

1. 🔴 **Jeg kan ikke bekrefte at noen av dette er deployet til test eller prod.** Migreringene
   (`20260608120000_oppmotested_fase1`, `20260611120000_reisetid_matrise`, samt
   `OrganizationSetting`-reisefeltene) ligger i arbeidstreet, men **om de er kjørt mot
   `sitedoc_test`/`sitedoc` er ikke målt** — det krever `prisma migrate status` / psql, som
   igjen krever DB-tilgang jeg ikke har herfra (ingen sudo/Docker-exec; connection-string er
   secret).

2. 🔴 **De fire live-tallene ordren ba om er ikke målt** — alle krever psql mot `sitedoc_test`:
   - Antall oppmøtesteder på test (koordinat-dekning = 100 % av dem som finnes, jf. punkt 1).
   - Antall byggeplasser på test med koordinat (egen eller prosjekt-fallback).
   - Om SITEDOC MYRHAUG har lønnsart `Reise/transport til prosjekter` (eller `reiseLonnsartId`).
   - Om `ReisetidMatrise` faktisk har rader for firmaet.

   Kenneth (eller merge-agenten med DB-tilgang) kan hente alle fire i én omgang, f.eks.:
   ```sql
   -- mot sitedoc_test
   SELECT count(*) AS oppmotesteder FROM oppmotesteder;                       -- alle har lat/lng (påkrevd)
   SELECT count(*) FILTER (WHERE latitude IS NOT NULL) AS bp_med_koord,
          count(*) AS bp_totalt FROM byggeplasser;                            -- + prosjekt-fallback måles separat
   SELECT id, navn FROM timer.lonnsarter
     WHERE organization_id = '<SITEDOC_MYRHAUG_ORG_ID>' AND navn ~* 'reise|transport';
   SELECT count(*) FROM reisetid_matrise WHERE organization_id = '<SITEDOC_MYRHAUG_ORG_ID>';
   ```

3. **Den mest verdifulle setningen:** Ordrens premiss — at dette er umålt grunn der et
   kjøretidskilde-valg gjenstår før noe kan bygges — stemmer ikke med koden. Kjøretidskilden
   **er allerede valgt og kodet**: OSRM-rutematrise primært, GPS-luftlinje × 50 km/t som
   fallback. Det Kenneth reelt står overfor er ikke «hvordan skal vi finne kjøretiden», men
   «er den eksisterende implementasjonen (a) deployet og (b) matet med koordinater og
   lønnsart-rader i de firmaene som skal bruke den» — to måle-/drifts-spørsmål, ikke et
   design-spørsmål.
