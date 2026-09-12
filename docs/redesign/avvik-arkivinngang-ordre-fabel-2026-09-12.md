# AVVIK + KORRIGERENDE ORDRE: Arkivinngang på mallistene — fabel 2026-09-12

**Til:** cowork/redesign-Opus (Kenneth relayer). **Bakgrunn:** Kenneths skjermbilder fra test.sitedoc.no 2026-09-12 stemmer ikke med fabels mockup. Fabel har verifisert mot develop @85f5651b FØR denne ordren (fakta-først).

## Faktastatus (verifisert i kode — ikke fra skjermbilder alene)

**Bygget og OK (AM4-ordren av 2026-09-04):**
- `firmamal.*`-ruter inkl. `laanFraSentralarkiv`, `kopierTilProsjekt`, `promoter`, `oppdaterFraArkiv` + tilgangsmatrise (`tilgangskontroll.ts:1746→`, testet)
- Firma-arkivside `/dashbord/firma/malarkiv` med faner, versjon, bruk-teller, standard-toggle, «Lån fra SiteDoc-arkivet», «Ny firmamal»
- Promotering + badges i MalBygger; badges «Fra firmaarkivet»/«Erstatter standardmal» i MalListe
- FirmaarkivVelger («Importer fra firma») i Legg til-dropdownen på Oppsett › Produksjon

**Avvik — presiseringene av 2026-09-12 er IKKE bygget** (README-mockup.md + mockup-hent-fra-arkiv-fabel-2026-09-12.dc.html i `til-repo-2026-09-12-1600/`, arkivredigering-designnotat i `til-repo-2026-09-12-1700/` — begge Kenneth-vedtatt):

1. **«Hent fra arkiv»-knappen mangler.** Vedtaket: egen knapp VED SIDEN AV «Legg til» på mallistene, som åpner modal med faner **Firmaarkiv / SiteDoc-arkiv**. I dag ligger henting gjemt som «Importer fra firma» i dropdownen, og SiteDoc-fanen finnes ikke i det hele tatt — dette er grensesnittet Kenneth etterlyser mellom firma og sentralarkiv.
2. **Synlighetsregelen vises ikke:** prosjektadmin skal se SiteDoc-fanen LÅST med forklaring («arkivet er to nivåer opp — prosjektet henter fra firmaarkivet»); firmaadmin ser den aktiv med hent-til-firmaarkiv. Mockupen viser alle tilstandene (rollebryter).
3. **Arkivredigeringsmønsteret (1700-notatet):** checkbokser + samlehandling «Hent kopi (N)», «Rediger» i ⋮-meny + dobbeltklikk, **versjonspublisering** (arbeidskopi → «Publiser som vX.Y», aldri direkte lagring), desktop-kun. Ikke gjenfunnet i `malarkiv/page.tsx` (har rediger-modal + direkte mutasjoner).

**Sannsynlig rotårsak:** 1600/1700-leveransene er datert ETTER at AM4 ble bygget, og ser ikke ut til å ligge i repoet. Steg 0 under fikser det.

## Ordre

**Steg 0 — leveransene inn i repo først:** kopier inn fra `~/Documents/Programmering/SiteDoc/Fra fabel/`:
- `til-repo-2026-09-12-1600/docs/redesign/README-mockup.md` + `mockup-hent-fra-arkiv-fabel-2026-09-12.dc.html` + `mockup-bilder/`
- `til-repo-2026-09-12-1700/docs/redesign/arkivredigering-designnotat-fabel-2026-09-12.md`

**Steg 1 — «Hent fra arkiv» på mallistene** (mockupen er fasit for layout/tekster):
- Knapp «Hent fra arkiv» ved siden av «Legg til» i `MalListe.tsx` (alle tre faner: sjekkliste/oppgave/HMS) OG på prosjektsiden `/dashbord/[prosjekt]/maler` (Kenneths skjermbilde 1 — samme modal, samme regler).
- Modal med faner Firmaarkiv / SiteDoc-arkiv. Firmaarkiv-fanen gjenbruker FirmaarkivVelger-logikken (flyttes, ikke dupliseres — delte kilder). «Hent kopi» = eksisterende `kopierTilProsjekt` (V5: kopi, aldri referanse).
- SiteDoc-fanen: synlighet per matrisen (`MalArkivNivaa`-funksjonen finnes allerede — bruk den, ikke ny logikk). Prosjektadmin: låst tilstand med forklaringstekst fra mockupen. Firmaadmin+: liste fra sentralarkivet, «Hent kopi til firmaarkiv» = eksisterende `laanFraSentralarkiv`.
- «Importer fra firma» FJERNES fra Legg til-dropdownen når den nye inngangen er på plass — aldri to veier til samme handling.
- Klikk-budsjett består: hente firmamal ≤ 3 klikk. Synlig Avbryt.

**Steg 2 — arkivsiden justeres til 1700-notatet:**
- Checkbokser + bunnlinje «Hent kopi (N)» ved valg; enkeltrad «Hent kopi» som før.
- «Rediger» i radens ⋮-meny + dobbeltklikk åpner malbyggeren; vises kun med redigeringsrett på nivået.
- **Versjonspublisering:** malbyggeren åpner arbeidskopi; arkivmalen røres ikke før «Publiser som vX.Y». Nivå-badge (FIRMAMAL / SENTRAL MAL) i tittellinjen. Utfører MÅLER først hvordan versjoner lagres rundt ReportTemplate/OrganizationTemplate i dag og foreslår arbeidskopi-mekanikk (utkast-rad vs. klienttilstand) FØR bygging — rapporter til fabel-gate, ikke bygg på antakelse.
- Mobil: ingen redigeringsinnganger rendres (desktop-kun-vedtaket).

**Rammer:** rotårsak fremfor plaster; i18n på alle nye strenger; ingen intern sjargong i kundetekst; ingenting utenfor disse flatene røres uten å melde tilbake først.

## Definition of Done
1. Build grønn + eksisterende tester grønne.
2. Skjermbilder per rolle: prosjektadmin (Firmaarkiv aktiv + SiteDoc låst), firmaadmin (begge faner), hentet kopi synlig i mallisten med badge — mot mockupens fire nøkkeltilstander.
3. Steg 2-måling levert som egen rapport FØR versjonspublisering bygges (kan gates separat).
4. Klikk-budsjett rapportert med faktiske tall.
5. Fabel-designgate før «klar for commit» — aldri lukket på build alene.
