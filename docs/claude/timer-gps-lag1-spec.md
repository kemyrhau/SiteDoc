---
name: timer-gps-lag1-spec
description: Spesifikasjon for LAG 1 i timer-GPS-helhetsplanen — én stedsmodell i @sitedoc/shared, reiseberegning etter V3/V5/V6/V7/V10/V11/V12/V13/V15, og datagrunnlag (V14). Skrevet av fabel 2026-10-02, gates av orkestrator før ordrer skrives.
sist_verifisert_mot_kode: 2026-10-02
eier: fabel (kontroll-Claude) — orkestrator gater
status: 🟡 BESTILT 2026-10-02 (Kenneth «bestill lag 1») — gatet av orkestrator, B2 re-gatet; L1-C ∥ L1-A nå, L1-B etter L1-A. Rammer i relay/inbox-orkestrator.md
---

# LAG 1 — én stedsmodell og én reiseberegning

> Forelder: [timer-gps-helhetsplan.md](timer-gps-helhetsplan.md) § 5 LAG 1 og § 4b (V1–V15).
> Lag 0 er komplett (`89acee95` · `a13f4343` · `c78bc14f`). **Alt under er spesifikasjon, ikke kode**
> — hver påstand om hva systemet *skal* gjøre er ❌ IKKE IMPLEMENTERT inntil ordren som bærer den er
> merget. Kode-referanser peker på det som skal endres.

## 0. Hva lag 1 er, og ikke er

**Lag 1 svarer på ett spørsmål med ett svar: «hvor er jeg, og hvor langt er det dit».** Det leverer
tre ting: (A) én delt stedsmodell i `packages/shared`, (B) én reiseberegning i den rene
forslagsfunksjonen fra lag 0b, og (C) datagrunnlaget som gjør at B har noe å regne på.

**Ikke i lag 1:** reisetid ut av overtidsgrunnlaget og klokkevindu på reise-rader (V1, V2, V8 → lag 2)
· bekreftelsesskjermen (lag 3) · mellometapper og flere prosjekter (V4, V9 → lag 4) · sjåfør (lag 5)
· server-mottak av arbeidsdag (lag 2, K5). **Lag 1 endrer ingen lønnsklassifisering for en dag som
i dag får riktig svar** — det fjerner svarene som er gale eller gjettet.

## 1. Målt utgangspunkt (2026-10-02, `develop` ≥ `fa4a623e`)

| # | Fakta | Bevis |
|---|---|---|
| M1 | **Fem** kopier av haversine, ikke fire: lag 0b la en femte i den rene funksjonen | `apps/mobile/src/utils/geo.ts:6`, `utils/dagsforslag.ts:235`, + `georeferanse.ts:411` (ekvirektangulær `avstandMeter`) |
| M2 | Gjenkjenning av oppmøtested og byggeplass er to speilede kopier, begge «nærmeste innenfor egen radius», ingen test | `hooks/useArbeidsdag.ts:71-87`, `services/byggeplassKatalog.ts:72-96` |
| M3 | Prosjekt velges som nærmeste haversine **uten grense**, fallback `prosjekter[0]`; «+ Ny» har 500 m-grense | `dagsforslag.ts:209-231` (`velgNaermesteProsjekt`), `app/timer/ny.tsx:139` |
| M4 | Reise måles til prosjektets **primærbyggeplass** («published først, lavest nummer»), aldri til den GPS fant | `services/reisetidMatriseKatalog.ts:94-118`, `StartSluttDagKort.tsx:418` |
| M5 | Reservemåling: luftlinje start→slutt ÷ 50 km/t; km-enhet uten avstand → stille «under terskel» | `dagsforslag.ts:~370-385`, `shared/utils/reise.ts:89-92`, `:165-172` |
| M6 | 🔴 **H21 — matrisen arver prosjektets koordinat** når byggeplassen mangler punkt | `apps/api/src/services/reisetidMatrise.ts:67-74` (`b.latitude ?? b.project?.latitude`) |
| M7 | Byggeplasser uten koordinat hoppes stille over i matrisen, radene deres slettes, ingen rapport; uoppnåelig lagres som `-1/-1` og telles som «beregnet» | `reisetidMatrise.ts:76-83`, `rute-service.ts:120-131`; returverdi `{ rader }` |
| M8 | Opprett-dialogen for byggeplass har kun navn; `address` finnes i Zod og Prisma, ikke i UI; ingen geokoding noe sted | `oppsett/byggeplasser/page.tsx:960-967`, `:1239-1268`, `validation/index.ts:95-101`, `schema.prisma:1031-1069` |
| M9 | Geofence-modalen: Kartverket-søk (`bygning.geokod` → `sokAdresser`), kart, lat/lng, glider 25–500, tallfelt ≤ 100 000; «Beregn fra tegning» **overskriver alltid** (`kunHvisTom=false`); auto fra `settGeoReferanse` kun hvis tomt | `page.tsx:1298-1435`, `byggeplass.ts:127-174`, `byggeplassGeofence.ts:17-58`, `tegning.ts:497-506` |
| M10 | **Punktets kilde lagres ikke** (tegning / manuelt / geokodet) | `schema.prisma:1040-1045` |
| M11 | To geokodere: Nominatim for oppmøtested (`oppmotested.geokod`), Kartverket/Geonorge for byggeplass-søk. i18n-attribusjon sier OpenStreetMap der siden viser Kartverket | `rute-service.ts:82-98`, `:156-188`, `nb.json:1686` vs. `page.tsx:1362` |
| M12 | Pausevinduet regnes fra **segmentets GPS-start** (= reisestart), ikke fra ankomst og ikke fra fast starttid | `dagsforslag.ts:~580` `pauseVinduFra(startTidHHMM, …)`, `pauseBeregning.ts:55` |
| M13 | Glemt-dag-vakten kapper til `start + dagsnorm`, uten reise og pause | `dagsforslag.ts:415-424` (`kappGlemtDagSlutt`) |
| M14 | Ingen test dekker haversine, gjenkjenning, matrise-oppslag, `resolverPrimaerByggeplass`, `recomputeMatrise`, geokoding | agent-måling 2026-10-02 |
| M15 | Eneste teller for manglende grunnlag er `reiseMatriseParUtenAvstand` (rader med `avstandM: null`); `-1` telles ikke | `organisasjon.ts:1046-1048`, `innstillinger/page.tsx:1272` |
| M16 | `arbeidsdag_local` har kun start/slutt-posisjon + oppmøtested- og byggeplass-id/navn, synkes aldri | `apps/mobile/src/db/schema.ts:357-379` |

🔴 **M6 er lag 1s skarpeste funn.** Det er den samme arvingen Kenneth fikk fjernet fra origo-ordren
2026-10-01 («et prosjekt kan strekke seg over kilometer») — men den står i matrise-beregningen, og
den har produsert reise-avstander for byggeplasser uten punkt siden R3 (2026-06-11). Ført som **H21**
i helhetsplanen § 4.

## 2. Leveranse A — stedsmodellen (`packages/shared/src/utils/sted.ts`)

Én fil, rene funksjoner, ingen DB, ingen RN. **Kun globaler som finnes i RN, Node og nettleser** (jf.
lag 0c-kanten `types: ["node"]`). Alle fem haversine-kopiene (M1) erstattes av A1; `georeferanse.ts`
beholder sin ekvirektangulære for tegnings-transformasjoner, men **reise bruker den aldri**.

| # | Funksjon | Kontrakt |
|---|---|---|
| **A1** | `avstandM(a: Punkt, b: Punkt): number` | Haversine i **meter** (heltall). Én implementasjon. Erstatter `geo.ts`, `dagsforslag.ts:235`, `ny.tsx`-bruken |
| **A2** | `gjenkjennSted<T extends Geofence>(pos: Punkt \| null, kandidater: T[]): Treff<T> \| null` | **Kapabilitet A.** Nærmeste kandidat der `avstandM ≤ radiusM`. Returnerer `{ sted, avstandM }`. Kandidater uten `lat/lng/radiusM` filtreres av kalleren — funksjonen krever komplette geofencer. Brukes for BÅDE oppmøtested og byggeplass (erstatter M2) |
| **A3** | `tolkStart(pos, oppmotesteder, byggeplasser): Startsted` | Forener de to treffene (V11, V12, V15). Diskriminert union: `{ type: "kontor", oppmotestedId, byggeplassId: string \| null }` · `{ type: "byggeplass", byggeplassId }` · `{ type: "utenfor" }` · `{ type: "ukjent", aarsak: "posisjon_utilgjengelig" }`. **Kontor vinner når begge treffer** (V15). `pos == null` → `ukjent`, aldri `utenfor` (H11) |
| **A4** | `tolkSlutt(pos, oppmotesteder, byggeplasser): Sluttsted` | Samme union. Grunnlag for retur (V7) |
| **A5** | `velgDestinasjon(args): Destinasjon` | **Kapabilitet C, innsnevret.** Rekkefølge: (1) `sluttsted.type === "byggeplass"` → den · (2) `kontekstByggeplassId` (arbeiderens aktive byggeplass) · (3) prosjektet har **nøyaktig én** byggeplass med punkt → den · (4) ellers `{ type: "ukjent", aarsak: "flere_byggeplasser" \| "ingen_byggeplass_med_punkt" }`. **Aldri primærbyggeplass, aldri nærmeste-uten-grense, aldri `prosjekter[0]`** (M3, M4) |
| **A6** | `RADIUS_GRENSER` | Én navngitt tabell for de tre spennene (oppmøtested 10–5000, byggeplass-API 1–100 000, modal 25–500). **Grensene endres ikke** i lag 1 — de får navn og én kilde |

**Prosjektvalg (kapabilitet C) i lag 1:** prosjektet er byggeplassens prosjekt når A5 gir en
destinasjon; ellers `aktivtProsjektId` (arbeiderens valgte kontekst — G1: arbeider-valg er
autoritativt); ellers utfall **`prosjektUkjent`** i `anvendDagsforslag` — dagen holdes åpen med melding,
samme mønster som `kildeManglet` fra lag 0b. 🔴 **Meldingen skal navngi veien ut** (gate-krav): *«Fant
ikke prosjektet fra posisjonen. Velg prosjekt i velgeren øverst og trykk Slutt dag på nytt.»* — dagen
står `aktiv`, så handlingen finnes; uten setningen sitter arbeideren med et utfall uten handling
(lærdom fra `kildeManglet`, lag 0b). ⚠️ **Dette fjerner `prosjekter[0]`-fallbacken før
bekreftelsesskjermen (lag 3) finnes.** Begrunnelse: fallbacken er H1 «stille feil» — en sedel på et
vilkårlig prosjekt er verre enn en åpen dag med melding. Orkestrator gater om det holder.

**Tester (vitest, shared):** A1 mot kjent avstand Narvik–Tromsø (±0,5 %) · A2 innenfor/utenfor/to
overlappende (nærmeste vinner)/kandidat uten radius avvises · A3 alle fire utfall + kontor-og-byggeplass
→ kontor · A5 alle fire grener, inkludert at primærbyggeplass **ikke** velges når prosjektet har to
byggeplasser med punkt.

## 3. Leveranse B — reiseberegningen (i `apps/mobile/src/utils/dagsforslag.ts`)

Lander i den rene `beregnDagsforslag` fra lag 0b. Karakteriseringstestene fra 0b **skal endres
bevisst** der V-reglene endrer svaret — hver endret forventning navngir regelen i testnavnet.

### B1 — etapper, ikke én mengde

Ny ren funksjon `beregnReiseEtapper(start: Startsted, slutt: Sluttsted, destinasjon, matrise, regel)`
→ `Etappe[]`, der `Etappe = { retning: "ut" | "retur", oppmotestedId, byggeplassId, kjoretidMin,
avstandM, kategori: "arbeidstid" | "reisetid", kilde: "matrise" }`.

| Regel | Etappe | Betingelse |
|---|---|---|
| V7 | **ut** | `start.type === "kontor"` og destinasjonen er en annen byggeplass enn den kontoret ligger i (V15: samme → avstand 0, ingen etappe) |
| V7 | **retur** | `slutt.type === "kontor"` → celle `(slutt.oppmotestedId, destinasjon.byggeplassId)`. Slutt annet sted → ingen retur, arbeid slutter ved slutt-GPS |
| V11 | ingen | `start.type ∈ { "byggeplass", "utenfor" }` → ingen ut-etappe |
| V12 | ingen + årsak | `start.type === "ukjent"` → `reiseAarsak: "posisjon_utilgjengelig"` |
| V10 | pr. etappe | `klassifiserReise` kalles **én gang pr. etappe** |
| V13 | ingen + årsak | Mangler matrisecelle, eller cellen er `-1` (uoppnåelig), eller km-enhet uten `avstandM` → ingen etappe, `reiseAarsak: "mangler_matrise" \| "uoppnaaelig" \| "mangler_avstand"`. **`estimerReisetidMin` og `avstandMeter`-fallbacken fjernes fra forslaget**; `estimerReisetidMin` slettes fra `reise.ts` med sine tester (ingen gjenværende kaller) |

**`klassifiserReise` (`reise.ts:85-101`) endres ikke i signatur**, men den stille grenen `:91`
(«mangler avstand → under-type») nås aldri lenger fra forslaget, fordi B1 gater før. Testene for grenen
beholdes og merkes «defensiv — forslaget kaller ikke med null».

### B2 — arbeidsvinduet følger etappene (V3, V5) — *rettet etter gate-avvik 2026-10-02*

🔴 **Én trekkmekanisme overlever: vinduet.** I dag trekkes reisen to steder, bevisst og riktig for
én etappe: timene (`dagsforslag.ts:558` `raaArbeid = totalTimer − reisetidTimer`) og vindusstarten
(`carveArbeidstid.ts:68` `startTid + reisetidTimer`). Med etapper i begge ender ville den kombinasjonen
trukket reisen to ganger. **Derfor:**

- `arbeidsstart = start-GPS + ut.kjoretidMin` når ut-etappen er **reisetid**; `= start-GPS` når den er
  **arbeidstid** (V3) eller ikke finnes.
- `arbeidsslutt = slutt-GPS − retur.kjoretidMin` når retur er reisetid; `= slutt-GPS` ellers.
- 🔴 **`arbeidstimer = arbeidsslutt − arbeidsstart − pause`** (rundet som før). **Subtraksjonen
  `totalTimer − reisetidTimer` FJERNES** — vinduet har allerede ekskludert begge etapper.
- `carveArbeidstider` får `startTid = arbeidsstart` og `reisetidTimer = 0` (eller parameteren fjernes).
  **Ingen `sluttKapp`:** carven legger segmenter forover og stopper når `seg.timer` er brukt
  (`carveArbeidstid.ts:72-85`) — er `arbeidstimer` regnet fra vinduet, summerer segmentene til nettopp
  det, og carven ender i `arbeidsslutt` av seg selv. *(Spesifikasjonen hadde `sluttKapp`; gaten viste
  at den var overflødig.)*
- 🔴 **Invariant-test:** `Σ carvede vinduer + pause = arbeidsslutt − arbeidsstart` for Dag A og Dag B.
  **Og én test som FEILER hvis reisen trekkes to ganger:** Dag A skal gi nøyaktig 8 t ordinær + 2 t
  OT50, ikke 6 + 2.
- **Dagsnormen anvendes på dette vinduet** (V5) — ikke på firmaets `standardStartTid`.
- 🔴 **Den tredje mekanismen fjernes også — bevisst, etter V1/V2** (re-gate 2026-10-02 fant den):
  `dagsforslag.ts:573-575` senker *dagsnormen* med reisetiden når `reisetidTellerOvertid` er på. Det er
  ikke et fradrag i timene, men i terskelen — og det er nøyaktig det Kenneth avviste: *«reisetid er
  aldri overtid»* (V1). **L1-B slutter å lese flagget**; normen er alltid `dagsnorm0`. Kolonnen
  deprecates og serverens overtidsgrunnlag rettes i lag 2 (V2) — men mobil-lesingen trekkes hit, ellers
  ville V7 (retur) gitt firmaer med flagget på en *midlertidig* større overtid fra L1-B til lag 2, som
  så reverseres. To lønnsendringer i rekkefølge er verre enn én. **«Én mekanisme» gjelder dermed både
  timene og terskelen: vinduet, og bare vinduet.** ⚠️ Kenneths testfirma har flagget PÅ i dag — etter
  L1-B endrer det ingenting, og det er meningen.
- **`fordelArbeidstidFradrag`** (`dagsforslag.ts:254-320`, midnatt-splitt) fordeler i dag reisen som et
  *fradrag* over segmentene. Med vinduet er reisen ikke lenger et fradrag: **ut-etappen hører til
  start-segmentet, retur-etappen til slutt-segmentet**, og funksjonen fordeler kun pausen. Reise-rader
  (B4) legges på det segmentet etappen hører til.
- Glemt-dag-vakten (M13): kapplengde = `ut.kjoretidMin + dagsnorm + pauseMin` (ikke bare `dagsnorm`).

### B3 — pausevinduet (V6)

Ny firmainnstilling `OrganizationSetting.pauseReferanse: "fastStart" | "ankomst"` (additiv kolonne,
`String @default("ankomst")`). `pauseFra` = `fastStart` → `pauseVinduFra(effektiv.startTid, X)` (firmaets
sesongjusterte starttid fra `ArbeidstidsKalender`) · `ankomst` → `pauseVinduFra(arbeidsstart, X)`.
`X = standardPauseEtterTimer`, lengde `standardPauseMin` — begge finnes (`schema.prisma:430-437`).
⚠️ **Default-valget er mitt, ikke Kenneths:** dagens oppførsel (M12, pause fra GPS-start) er ingen av
modusene og gir pause midt i reisen på en reisedag (start 05:00 → pause 09:00–09:30). `ankomst` er den
som aldri legger pausen i en reise. Orkestrator/Kenneth kan snu den. UI: ett valg på
`firma/innstillinger` under «Fast arbeidsdag», i18n ×15.

### B4 — reise-rader i lag 1

Én rad pr. reisetid-etappe (`erReise: true`, `retning` ført i `beskrivelse` eller nytt felt — orkestrator
velger), `projectId` = destinasjonens prosjekt, **`fraTid/tilTid` fortsatt `null`** (V8 er lag 2). Rad
med kategori `arbeidstid` opprettes ikke — tiden ligger i prosjektraden (V3).

### B5 — årsak synlig (V12, V13 → lag 3-forberedelse)

`Dagsforslag` får `reiseAarsak: ReiseAarsak | null` og `destinasjonAarsak`. I lag 1 vises de i
eksisterende varsel etter «Slutt dag» (den som i dag melder `blokkertSendt`/`kildeManglet`), i18n ×15.
Lag 3 flytter dem til bekreftelsesskjermen. **Ingen stille tomhet:** test som feiler hvis en dag uten
reise-forslag mangler årsak når `start.type === "kontor"`.

**Fasit-tester (fra helhetsplanen § 4b, kun det lag 1 kan regne):** Dag A → ut 05:00–07:00 (2 t,
reisetid), arbeidsvindu 07:00–17:30, retur 17:30–19:30 (slutt-GPS på kontor) · Dag B → ut 07:00–09:00,
arbeidsvindu 09:00–17:30 med pause 13:00–13:30 (`ankomst`) hhv. 11:00–11:30 (`fastStart`), retur
17:30–19:30 · Dag C (ny): start innenfor kontor OG byggeplass, destinasjon = samme byggeplass → ingen
etappe · **Dag E (ny, re-gate-krav): Dag A med `reisetidTellerOvertid = true` → nøyaktig samme svar som
Dag A (8 t ordinær + 2 t OT50, norm 8 t urørt), og testen FEILER hvis normen senkes med `ut + retur`** ·
Dag D (ny): start på kontor, byggeplass uten matrisecelle → ingen etappe, `reiseAarsak =
"mangler_matrise"`, **og testen feiler hvis en etappe likevel foreslås**.

## 4. Leveranse C — datagrunnlaget (V14, H21)

| # | Endring | Hvor |
|---|---|---|
| **C1** | 🔴 **Fjern prosjekt-arven i matrisen** (M6/H21): `b.latitude ?? b.project?.latitude` → kun `b.latitude`. Rader som i dag bygger på arv **slettes ved neste recompute** (de er gale). Returverdien utvides: `{ rader, manglerPunkt: { byggeplassId, navn, projectId }[], uoppnaaelige: number }` | `reisetidMatrise.ts:67-74`, `oppmotested.ts:139-144` |
| **C2** | **Adresse i opprett-dialogen** (feltet finnes i Zod/Prisma). Ved opprettelse med adresse: server kaller `sokAdresser` (Kartverket — samme kilde som modalen, M11); **nøyaktig ett treff** → `latitude/longitude` settes, `radiusM = 150` (oppmøtested-default), `geofenceKilde = "geokodet"`; null eller flere treff → ingen punkt, byggeplassen får merket i C4 | `page.tsx:960-967`, `:1239-1268`, `byggeplass.ts:91-105` |
| **C3** | **Ny kolonne `Byggeplass.geofenceKilde: "tegning" \| "manuell" \| "geokodet" \| "ukjent" \| null`** (M10). Additiv migrering med **backfill**: `latitude IS NOT NULL → 'ukjent'`, ellers `NULL`. **Garanti:** CHECK `(latitude IS NULL) = (geofence_kilde IS NULL)`. **Test som feiler** hvis en rad har punkt uten kilde. Skrivere: modal → `manuell`, «Beregn fra tegning» → `tegning`, auto fra `settGeoReferanse` → `tegning`, C2 → `geokodet` | `schema.prisma:1040-1045`, `byggeplass.ts:147-174`, `byggeplassGeofence.ts` |
| **C4** | **«Beregn fra tegning» overskriver aldri `manuell`** (kartvelgeren overstyrer alltid — dialog 2026-10-01). Overskriver `geokodet`, `tegning`, `ukjent`, `null`. Auto-utfylling forblir kun-hvis-tomt | `byggeplass.ts:127-144` (`kunHvisTom`-semantikk utvides til kilde) |
| **C5** | **Tre varsler (V14):** (a) byggeplasslista — tekstmerke «Mangler plassering — reise beregnes ikke» ved siden av `GeofenceKnapp` når Timer-modulen er aktiv for firmaet · (b) Reisetid-matrise-flaten — «N byggeplasser i aktive prosjekter mangler punkt» fra C1s `manglerPunkt`, og «M par uoppnåelige», begge klikkbare til lista · (c) arbeideren — B5. `reiseMatriseParUtenAvstand` (M15) erstattes av de to tellerne | `page.tsx:762-785`, `innstillinger/page.tsx:1634-1675`, `organisasjon.ts:1046-1048` |
| **C6** | **Ikke påkrevd.** Opprettelse uten adresse er fortsatt lov (byggeplasser i terreng). Ingen hard gate | — |
| **C7** | i18n-attribusjon rettes (M11): `lokasjoner.geofence.attribusjon` → Kartverket der søket er Kartverket | `nb.json:1686` + 14 språk (eksisterende nøkkel → slett i 13 målspråk først, CLAUDE.md-regel) |

**Migreringer i lag 1: to, begge additive, Kenneth-gatet:** `pauseReferanse` (B3) og `geofenceKilde` +
CHECK (C3). Stille-tomhet-regelen (CLAUDE.md) er oppfylt for C3: backfill (a), garanti (b), test (c).
`pauseReferanse` bærer ikke identitet — default er nok.

## 5. Leveranse D — rydding

- `apps/mobile/src/utils/geo.ts` slettes; `dagsforslag.ts:235` slettes; `ny.tsx:131-142` bruker A2 med
  byggeplass-geofencer i stedet for 500 m mot prosjektpunkt (H2). `identifiserOppmotested` og
  `identifiserByggeplass` blir tynne kallere av A2 (eller slettes til fordel for A3).
- `resolverPrimaerByggeplass` slettes (M4) — A5 erstatter den. `hentMatriseRadLokalt` beholdes.
- De tre kommentarene «KUN dokumentasjon — aldri lønn/reise/prosjektvalg» **står** (`useArbeidsdag.ts:69-70`,
  `:141-142`, `byggeplassKatalog.ts:70`, `schema.ts:374`) — helhetsplanen § 5 LAG 3 sier de reverseres
  der, med henvisning til bekreftelsessteget. Lag 1 legger til én linje under hver: *«Lag 1 (dato):
  GPS-treff brukes som FORSLAG til destinasjon via A5; arbeider-valg (`aktivtProsjektId`) går foran.»*
- `byggeplassKatalog.ts:10-12` («Ingen koordinater») rettes — den lyver.

## 6. Ordre-splitt (anbefaling til orkestrator)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **L1-C** | Leveranse C (api + web): C1–C7 | ingen | `geofenceKilde` |
| **L1-A** | Leveranse A (shared) + D-ryddingen av gjenkjenning (mobil) | ingen | — |
| **L1-B** | Leveranse B (mobil) + B3-innstillingen (api + web) | L1-A | `pauseReferanse` |

L1-C og L1-A kan gå parallelt. L1-B sist. ⚠️ **Begge migreringene ligger i `packages/db` og blir
sekvensielle fordi L1-B er sist — skriv rekkefølgen eksplisitt i ordrene (`geofenceKilde` før
`pauseReferanse`), så ingen kjører dem om hverandre.** **Hver ordre: regel 10 fire ledd, fasit-testene i § 3 som
DoD for L1-B, `pnpm install` etter pull (lag 0c-kanten). Mobil: OTA.**

## 6b. Gate-record

🟢 **GATET av orkestrator 2026-10-02** (`relay/inbox-fabel.md`), målt mot `9ff1ebce`: M6/H21 verifisert
ordrett med dato (`7d98b80a` 2026-06-11) · A5 styrker G1 (arbeiderens kontekst tilbake som ledd 2) ·
`ankomst`-default er dagens oppførsel på dager uten reise, endrer kun reisedager · C3 oppfyller
stille-tomhet (a/b/c) · ordre-splitten holder. **Ett AVVIK:** B2 dobbelttrakk reisen — rettet samme
dag (vinduet er eneste mekanisme, `sluttKapp` fjernet, invariant-test lagt til). **B2 til re-gate før
L1-B bestilles. L1-C og L1-A er uberørt og kan bestilles på Kenneths signal.**

🟢 **Re-gate B2 GATET 2026-10-02** med én presisering: orkestrator fant den tredje mekanismen (norm-fradraget
`dagsforslag.ts:573-575`) og mente den skulle overleve. **Den strider mot V1** — løst ved å trekke
mobil-delen av V2 inn i L1-B (over) og legge til Dag E. **L1-B kan bestilles når orkestrator har sett
denne løsningen.**

## 7. Åpne punkter for gaten

1. **Default `pauseReferanse = "ankomst"`** (B3) — mitt valg, begrunnet; kan snus.
2. **`prosjektUkjent` før lag 3** (§ 2) — fjerner `prosjekter[0]` nå; alternativet er å beholde
   fallbacken til bekreftelsesskjermen finnes. Jeg anbefaler å fjerne.
3. **C1 sletter arv-baserte matriserader** — de er gale, men en byggeplass som i dag «har reise» via arv
   mister den til punktet er satt. C5 gjør det synlig. Antall er ikke målt (krever SQL, Kenneth).
4. **Radius 150 m som geokodet default** (C2) — lånt fra oppmøtested. Alternativ: 75 m (modalens
   startverdi i skjermbildet 2026-10-01).
5. **Retning på reise-rad** (B4): `beskrivelse`-tekst eller nytt felt — lag 2 trenger uansett felt
   for kilde-markør (V8), så nytt felt kan vente dit.
