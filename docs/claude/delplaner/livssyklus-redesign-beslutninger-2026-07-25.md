---
name: livssyklus-redesign-beslutninger
status: 🟠 KENNETH-BESLUTNINGER mottatt 2026-07-25 — input til fabel livssyklus-design. Ikke implementert.
eier: cowork (fanger beslutninger + gater) · fabel (designer ny statusmaskin) · kode-Opus (implementerer i faser)
opphav: Kenneth-gjennomgang av mikrotekst-hoveren på test 2026-07-25 (11 punkter) → beslutninger under
relatert: [BACKLOG § Livssyklus-overgangs-design](../BACKLOG.md) · [mikrotekst-flyt-flater-spec](mikrotekst-flyt-flater-spec-2026-07-25.md) · statusmaskin `packages/shared/src/utils/index.ts` VALID_TRANSITIONS + `statusHandlinger.ts` + `perspektivEtikett.ts`
---

# Livssyklus-redesign — Kenneth-beslutninger 2026-07-25

Kenneth gikk gjennom mikrotekst-hoveren på test og fant at flere tekster avdekket underliggende flyt-design-problemer, ikke bare ordlyd. Beslutningene under omdefinerer deler av statusmaskinen. **Dette er input til en fabel-design-gjennomgang** — ikke en ferdig spec. fabel designer ny statusmaskin (statuser, overganger, matrise-rader, perspektiv-etiketter) fra disse; cowork gater mot kode; kode-Opus implementerer i faser.

## Beslutninger (vedtatt av Kenneth)

1. **Fjern `in_progress` («Under arbeid»).** Kenneth: «bare forstyrrelse». Erstattes av én samlet åpne/gjenåpne-mekanisme. Ringvirkning: `gjenoppta` (`rejected→in_progress`) bortfaller; fantom-raden `received→in_progress` (fyrer aldri i dag) bortfaller; retur-/rettingsflyt går uten mellomstatus.

2. **Trekk tilbake → redigerbar kladd hos avsender** (ikke terminal «Avbrutt»). Kenneths modell: «jeg sender → ser at det er feil → trekk tilbake → utfør endring → send». Så `trekk tilbake` skal lande dokumentet tilbake som redigerbar kladd hos den som sendte, ikke parkere det som terminal cancelled.

3. **Ny «Avvist»-status** — distinkt fra Trukket tilbake. I dag ruter `avvis → cancelled` (samme som trekk tilbake), så «avvis» og «trekk tilbake» smelter sammen. Kenneth: avvist skal være avvist, **begrunnet**, og mottaker ser det som «Avvist» — ikke «avsluttet». Krever ny status + egne overganger + perspektiv-etikett + matrise-rader.

4. **Slett myk (soft delete).** I dag er Slett hard (`checklist.delete()`/`task.delete()` — raden fjernes; «deleted» er ingen status). Vedtak: Slett blir en status («deleted» e.l.), raden beholdes, dokumentet er gjenåpnbart. Egen **«slett endelig»** (hard) for faktisk fjerning. Mikroteksten slutter å si «permanent» for vanlig Slett. Mer i tråd med data-disiplinen («ALDRI slett eksisterende data»). Datamodell (status-enum vs `deletedAt`-felt) avgjøres i design/kode.

5. **Samlet gjenåpne fra alle avsluttede statuser** (Lukket, Avvist, Trukket tilbake, Slettet). Kenneth: «gjenåpning må jeg som admin kunne bruke på alle statuser og grupper» — alternativt at alt avsluttet **eies av godkjenner-gruppen** som gjenåpner derfra. **Åpent for fabel:** hvem kan gjenåpne (admin-global vs godkjenner-gruppe-eid), og hvorhen et gjenåpnet dokument rutes (til kladd hos oppretteren, eller tilbake dit det var). Merk #9-funn: gjenåpne returnerer «til oppretteren» (= registrator, Opprett er låst dit), så retten hører logisk hos registrator + admin — ikke bestiller slik dagens matrise viser.

6. **Send = alltid fram/høyre; Videresend = ut til annen flyt.** To distinkte retninger. **Vi gjenbruker den eksisterende Send-funksjonen — ingen ny handling.** Regelen (Kenneth-presisering): **Send aktiveres overalt der Videresend aktiveres** (paret tilgjengelighet — der du kan hoppe ut av flyten, kan du også sende fram i flyten). `Videresend` forblir kryssflyt, og **hoveren skal si eksplisitt at Videresend betyr å sende PÅ TVERS AV DOKUMENTFLYTER**. Teknisk konsekvens fabel/kode wirer: paringen gir fram-overganger fra statusene der Videresend finnes (received/responded/approved) — men konseptuelt er det gjenbruk av Send, ikke en ny handling.

7. **Videresend fra Godkjent — la stå** (dagens: Godkjenner + Prosjektadmin). Sjelden kryssflyt-handling; ingen endring nå (#11).

8. **Perspektiv-etikett i mikroteksten** — «hos dem»-ordlyden må matche ballinnehaverens **perspektiv-etikett**, ikke det nøytrale statusnavnet. Målt i `perspektivEtikett.ts`: mottaker av `send` ser «Til behandling» (ikke «Mottatt»); mottaker av `besvar` (godkjenner) ser «Til godkjenning» (ikke «Besvart»). Gjelder Send-, Besvar- (#2/#5) og alle «hos dem står det som X»-tekster. Foldes inn i redesignets mikrotekst siden statusene endres uansett.

## Åpne spørsmål fabel avgjør (ikke blokkerende)

- Hvem kan gjenåpne + hvorhen rutes gjenåpnet dokument (beslutning 5).
- «Avvist» sine gyldige overganger (gjenåpne fra avvist → hvor? begrunnelse påkrevd?).
- Datamodell for soft delete (beslutning 4) — status-enum «deleted» vs `deletedAt`-felt. Teknisk; cowork/kode gater.
- Konsekvens av å fjerne `in_progress` for eksisterende data (migrering av rader som står i in_progress i dag — test/prod).

## Kenneth-gate runde 2 (2026-07-25, etter fabel-spec)

- **Trekk tilbake beholdes (fabels innstilling):** en *sendt* hendelse trekkes tilbake til avsender **før mottaker har svart**, lander som redigerbar kladd (`received→draft`). (Kenneth vurderte «før lest»-gate men valgte fabels enklere «før svart».) Handlingen består i matrisen.
- **De 3 fabel-gate-punktene: JA** — (1) cancelled utfases som produserbar, (2) påkrevd begrunnelse ved Avvis, (3) hard delete kun prosjektadmin (+ sitedoc-bypass).
- **Soft delete = 90-dagers papirkurv:** `deletedAt` + **auto-hardslett etter 90 dager**; «slett endelig» kan kjøres manuelt før det (prosjektadmin). Mikrotekst reflekterer 90-dagers-vinduet. **Papirkurv-visningen er tilgjengelig for prosjektadmin, prosjekt-bredt** (Kenneth 2026-07-25 — ser alle slettede i prosjektet), i tillegg til at oppretteren ser sine egne. Bygges i F0.
- **`in_progress` («Under arbeid») BEHOLDES (Kenneth-vedtak, snur beslutning 1):** «Under arbeid» overlever som utbedrings-tilstanden. **Send tilbake går direkte til «Under arbeid»** hos utfører — den manuelle **Gjenoppta forsvinner**. «Returnert» (`rejected`) og «Under arbeid» (`in_progress`) **smelter til én tilstand** (label «Under arbeid»; fabel velger enum). Fantom-raden `received→in_progress` fjernes fortsatt. Migrerings-nyansen (in_progress-rader) bortfaller siden statusen består.
- **STYRENDE PRIORITET (Kenneth):** matrisen og hoveren skal stemme **overens som én sammenhengende beskrivelse** av mål-statusmaskinen. Dagens SiteDoc-UI/kode er IKKE føringen — redesignet definerer målet; koden bringes til det. Gate måler intern koherens (matrise-rader ↔ hover-tekster ↔ statusmaskin), ikke samsvar med dagens oppførsel.

## Rekkefølge

Statusmaskin-endring er inngripende (ny status, fjernet status, endret ruting, myk delete, migreringer). Tas som **fabel-design → cowork-gate → kode-Opus i faser**, ikke direkte koding. Dagens mikrotekst-hover (på develop/test) beskriver dagens flyt og står til redesignet lander.
