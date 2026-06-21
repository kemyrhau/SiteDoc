> **⚠️ ARBEIDSDOKUMENT — IKKE SANNHETSKILDE, IKKE I DOC-MAP.**
> Generert av kontroll-Claude fra drøfting med Kenneth 2026-06-08. Ingen YAML-forankring med vilje.
> Innholdet skal rutes ut i permanente sannhetskilder via **SPOR 2** (se OPUS-INSTRUKS 4),
> deretter kan denne arbeidsfila fjernes. Behandle som beslutningsgrunnlag Opus kan grunne
> SPOR 1–3 på — ikke som vedtatt dokumentasjon. Alle fil:linje er uavhengig verifisert mot kode.

# Oppsummering — Timer-arkitektur (reise, oppmøtested, ikke-prosjekt-tid, firma-isolasjon)

**Dato:** 2026-06-08 · **Kontekst:** Analyse for A.Markussen, drevet av Opus, uavhengig kontrollert mot kode av kontroll-Claude. Alle fil:linje under er verifisert mot faktisk kode. **Ingen kode eller branch er rørt — dette er beslutningsgrunnlag.**

---

## A. Arkitektur-fundamentet (den store erkjennelsen)

SiteDoc er **to produkter på én plattform**:

1. **Prosjekthotellet** — prosjektmoduler (sjekklister, tegninger, kontrollplan, HMS, PSI…). Data eies av et prosjekt. **Isolasjon på prosjekt.** Tilgang via `ProjectMember`. CLAUDE.md-regelen gjelder som den står.
2. **Firma-drift / timeregistrering** — firmamoduler (timer, maskin, vareforbruk, kompetanse, planlegger). Data eies av firma + arbeider, med prosjekt som en *valgfri etikett* på radene. **Isolasjon på organisasjon (firma).** Tilgang via firma-medlemskap.

Dette skillet finnes allerede halvveis i arkitekturen (prosjektmodul- vs firmamodul-taksonomien). Det som manglet: *isolasjonsmodellen fulgte aldri skillet*. Regelen ble skrevet for hotellet og fulgte ikke med da firmamodulene kom.

**Felt-nivå-skjerping:** Isolasjon er som standard på modulnivå, men enkelte *sensitive felt* bærer firma-isolasjon uansett hvilken modul som viser dem. **Fra/til (innsjekk/utsjekk-tidspunkt) er et slikt felt** — firma-isolert selv i den prosjekt-scopede PSI-modulen.

To isolasjonsmodeller på **én** plattform — ikke to kodebaser. Auth, brukere, organisasjoner deles. Beslutningen gjelder **alle** firmamoduler, ikke bare timer.

---

## B. Reise og oppmøtested

- **Oppmøtested = egen geo-entitet** (kjerne `packages/db`, søsken til `Avdeling:1902`): `lat`, `lng`, `radiusM` (geofence), valgfri `avdelingId?`. Firma bestemmer avdeling-kobling; A.Markussen lar stå tom. 3 kontorer: Narvik, Harstad, Tromsø.
- **Geofence** identifiserer kontor + logger inn/ut som *dokumentasjon* + kan *foreslå* starttid. Aldri auto-rad (`fase-0 T.8:983`). Lønn ankret på kontrakt (07:00 ferdig skiftet), ikke geofence.
- **Hjem→arbeidssted: ikke kompensert.** Kun kontor→byggeplass og byggeplass→byggeplass.
- **Reisetid = ordinær lønn** (lønnsart-rad, `timer.md:282`), **utenfor overtid**. IKKE avstands-/godtgjørelse-sats.
- **30-min-terskel = firmainnstilling** (konfigurerbart regelsett, ikke hardkodet, ikke en regelmotor). `<terskel` → arbeidstid, `>terskel` → reisetid. Presedens: `OrganizationSetting.overtidsmatTerskel` (`:238`). Foreslåtte felt: `reiseTerskelMin`, `reiseUnderTerskelType`, `reiseOverTerskelType`, `reisetidTellerOvertid`.
- **Reisetid-lengde:** GPS-faktisk som forslag, fast estimat som fallback. Alt forslag — arbeider bekrefter.
- **MVP på prosjekt-koordinater** (`Project.latitude/longitude:400-401` finnes, nullable). Byggeplass-GPS (`T.8:990`) er senere arbeid.
- ⚠️ **Korreksjon funnet:** auto-fordeling normaltid/overtid er *spec'd, men IKKE implementert* (`timer.md:172`). Reise-klassifisering må koordineres med den — anta ikke at motoren finnes.

---

## C. Ikke-prosjekt-tid (Alt C — vedtatt retning)

- **Én registrering.** SiteDoc registrerer arbeidet; lønnsprogram betaler; regnskap/ProAdm fordeler. Ingen dobbeltføring, ingen lønnsberegning, ingen fordelingsmotor i SiteDoc.
- **Alt C:** internt arbeid + maskinvedlikehold = **interne `Project`-rader**. `projectId` forblir NOT NULL → **T.2 (`:838`) gjenåpnes IKKE**, prosjekt-isolasjon urørt, ~185 `projectId`-bruksstedene urørt. 1–2 generiske interne prosjekter per firma («Internt», «Vedlikehold») — ikke ett per aktivitet.
- **`Project.type String @default("kunde")`** ("kunde" | "internt") — additivt. Filtreres ut av kundevendte lister (~4–5 liste-spørringer); timer-velgeren viser dem.
- **Den dynamiske intern-lista = eksisterende `Aktivitet`** (`db-timer:56`, firma-scoped: `{organizationId, navn, kode?, aktiv}`). Ingen ny katalog-tabell. «Tilbud» legges til som `Aktivitet` kun hvis firmaet vil.
- **`SheetTimer.vehicleId String?`** (nytt nullable, svak FK → `db-maskin.Equipment`) = kostnadsbærer (maskin). Ortogonalt til `projectId`.
- **Kontekst vs kostnadsbærer:** `projectId` = hvor (ekte byggeplass hvis vedlikehold skjer ute, ellers internt prosjekt); `vehicleId` = hvilken maskin bærer kostnaden.
- **Vedlikehold ≠ drift:** `SheetTimer.vehicleId` (mekaniker-timer mot maskin) er distinkt fra `SheetMachine.vehicleId:270` (drift/maskinfører). Må dokumenteres i `timer.md` + `maskin.md`.
- Maskinkost-fordeling = regnskap/ProAdm. Bygges ikke nå; modell holdes åpen («kan endre seg senere»).

---

## D. Firma-isolasjon for timer (sikkerhet)

- Timer-data er firma-eid: `DailySheet { organizationId, userId }` (`T.1:7` «eies av arbeider/firma»). Rapporter scoper på org (`rapport.ts:58` `primaryOrganizationId`).
- **Hull funnet:** (1) `tilfoyTimerRad` mangler firma-grense-sjekk på rad-`projectId` (skriver rått, `:70`); (2) `rapport.ts:80-92` filtrerer sedler kun på `projectId ∈ firmaets prosjekter`, **uten** `organizationId`-filter → cross-firma-lekkasje på delte prosjekter.
- **Vedtatt: streng firma-isolasjon.** Fiks: `rapport` må også filtrere `dailySheet.organizationId = orgId`; `tilfoyTimerRad` hardes med firma-grense-sjekk. Forankring: **SHA/arbeidsgiver-rapportering** — hvert firma rapporterer egne timer, aldri prosjekteier. Stemmer med CLAUDE.md «kryssorg: aldri pull».
- **To lag som ikke må blandes:** *sikkerhetslaget* (firma-grense, ufravikelig, server-side) vs *forretningslaget* (hvilke prosjekter innen firma en arbeider kan føre mot — policy).
- ✅ **Forretningslaget avklart (G1):** **firma-nivå tilgang** — en aktiv firma-ansatt kan føre mot et hvilket som helst av firmaets prosjekter. Den harde medlemskaps-gaten faller for eget firma. Kostnadskontroll ligger i attesteringen (`draft→sent→accepted`), ikke i velgeren. Prosjekt-velgeren er *smart, ikke begrensende*: prioriterer medlemsprosjekter + GPS-detektert nåværende plass øverst, men hele firmaets prosjekter er valgbare som fallback. **GPS = friksjonsfjerner + bevis, ikke en hard port** (GPS er upålitelig + arbeider må kunne etterregistrere). Avhengighet: GPS-på-byggeplass krever prosjekt-/byggeplass-koordinater (samme manglende bit som `T.8:990`).

---

## E. PSI vs Timer (tilstedeværelse vs timer)

- Byggherres §15-behov (mannskap på plassen) dekkes av **PSI (prosjektmodul, presence)** — IKKE timer. Byggherre ser tilstedeværelse på *sitt* prosjekt på tvers av firma, men det er metadata.
- **Fra/til (innsjekk/utsjekk-tidspunkt) er firma-isolert selv i PSI.** Byggherre OG byggherres SHA-KU ser **ikke** fra/til. De ser aggregert tilstedeværelse (§15: hvem/arbeidsgiver/HMS-kort), ikke klokkeslett.
- Faren å unngå: at noen senere dekker byggherres mannskaps-behov ved å lekke timer/fra-til. Svaret er alltid PSI-tilstedeværelse, aldri timer.

---

## F. Faseinndeling og leveranse

- **Fase 1** — Oppmøtested + GPS (uavhengig av alt annet, lavest risiko, rører ikke T.2). Kan starte først.
- **Fase 2** — Alt C (`Project.type`, `SheetTimer.vehicleId?`, intern-prosjekt-flyt) + firma-isolasjons-fiks (`rapport` + `tilfoyTimerRad`).
- **Fase 3** — Reise (regelsett på `OrganizationSetting`, kontor→byggeplass-forslag).
- Alt **additivt** (nullable/defaultet) → enkelt-stegs migrasjoner, ingen to-stegs-dans.
- Doc-forankring: `terminologi.md`/`arkitektur.md` (to-produkt-anker), `timer.md`, `maskin.md`, `planlegger.md`, `fase-0`, CLAUDE.md-regel annotert.
- Per fase: **test-deploy → funksjonell verifisering på test.sitedoc.no → prod-deploy.**

---

## G. Åpne punkter / parkert

| # | Punkt | Status |
|---|-------|--------|
| 1 | Forretningspolicy: hvilke prosjekter innen firma kan arbeider føre mot | ✅ **AVKLART:** firma-nivå tilgang + GPS-smart-velger (se § D) |
| 2 | Arbeider-prosjektvelger: tilbyr den et annet firmas prosjekt? (avgjør om lekkasjen er nåbar) | Opus skal verifisere |
| 3 | 30-min-terskel + retning; reisetid utenfor overtid lovlig? | Kun A.Markussen/regnskap/jurist kan bekrefte |
| 4 | Fra/til → HMS-register | Uavklart, kommer senere — designes ikke nå |
| 5 | Maskinkost-fordeling, ProAdm utgående eksport, per-maskin-vedlikeholdsrapport, planlegger-integrasjon | Datamodell holdes åpen, bygges ikke nå |
| 6 | **Aktivering/deaktivering av ansatt ↔ ProjectMember-livssyklus** | 🔬 **EGET RESEARCH-SPOR** — hull. Mest prosjekthotell-tema (delvis frikoblet fra timer av firma-nivå-modellen). Opus researcher |

---

## Appendiks — verifiserte fil:linje-referanser

| Påstand | Fil:linje |
|---------|-----------|
| `SheetTimer.projectId` NOT NULL | `db-timer/schema.prisma:197` |
| `SheetMachine.projectId` NOT NULL / `vehicleId` (drift) | `:272` / `:270` |
| `SheetTimer.aktivitetId` NOT NULL, `externalCostObjectId?` | `:186` / `:195` (ingen vehicleId i dag) |
| `Aktivitet` firma-scoped (dynamisk liste) | `db-timer:56` |
| T.2 låst (projectId NOT NULL) | `fase-0:838` |
| T.8 (GPS aldri auto-rad / byggeplass-koord ikke impl.) | `fase-0:983` / `:990` |
| Reisetid = lønnsart utenfor overtid | `timer.md:282` |
| Auto-fordeling normaltid/overtid IKKE implementert | `timer.md:172` |
| `Project.latitude/longitude` (finnes, nullable) | `db/schema.prisma:400-401` |
| `Project.status`, ingen `type`-felt i dag | `:408` |
| `Avdeling` (ingen lat/lng), `User.avdelingId` | `:1902` / `:122,128` |
| `OrganizationSetting` singleton + `overtidsmatTerskel` | `:218` / `:238` |
| `DailySheet` org-eid (ikke projectId) | `db-timer` (T.1) |
| Rapport scoper på org, mangler sedel-org-filter | `rapport.ts:58, 80-92` |
| Timer-aktivering = firmamodul-master + per-prosjekt | `moduleGate.ts:31-47` |
| Membership-gate kun ved `opprett`, ikke rad-skriving | `dagsseddel.ts:560` vs `:664+` |
