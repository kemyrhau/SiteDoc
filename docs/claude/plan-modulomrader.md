# Plan: modulområder i `docs/claude/`

🟡 **Forslag — ingen filer er flyttet.** Skrevet av Fabel 2026-11-26 på bestilling (TILLEGG 3 til
ordren SAMARBEIDSREGLER-FASIT). Målt i `SiteDoc-fabel` på `docs/samarbeidsregler-fasit`, som står
på `origin/develop` @ `657ad4d8`.

> **FASIT (Kenneth 2026-11-26):** «Bare hendelseslogger, datoforklaringer og dobbelt innhold kuttes.
> -> dette har ingen ting i samarbeidsregler å gjøre -> dette skal heller fordeles loggfiler som
> omhandler temaet vi koder på. Moduler bør deles opp i egne områder eks. Timer bør ha sitt eget
> "område" Maskin bør ha sitt område»

Planen svarer på tre ting: hvilke filer hører til hvilket område, hvor loggen til hvert område skal
bo, og hva det koster i brutte lenker å lage områdene som mapper kontra som indeks.

## 1 · Slik er det i dag (målt)

| Mål | Tall |
|---|---|
| Oppføringer rett i `docs/claude/` | 148 (136 filer + 12 mapper) |
| Sporede filer under `docs/claude/` | 575 |
| Markdown-lenker i repoet som peker inn i `docs/claude/` | 1 537 (23 er døde i dag, i 6 filer) |
| Sti-omtaler `docs/claude/<navn>` utenom lenker (docs, kode, skript) | 352 |
| Filer som er en logg for én modul | 0 |

**Ingen modul har egen logg i dag.** Hendelser ligger pr. måned, på tvers av moduler, i sju
`historikk-YYYY-MM.md` (1 158 938 tegn, 603 overskrifter) pluss `historikk-docs.md` (32 783 tegn).
Modulfilene har statusavsnitt (`timer.md:35`, `kontrollplan.md:1525`, `dokumentflyt.md:28`), ikke logg.

## 2 · Områdene

Ni områder har nok filer til å bli egne. Tallene bak hvert navn er (markdown-lenker inn + sti-omtaler).

### Timer — 34 oppføringer

`timer.md` (143+19) · `vedtak-timer-web.md` (58+2) · `web-timeforing-plan.md` (36+5) ·
`skisser-web-timeforing/` (35+1) · `web-timeforing/` (32+1) · `prosjektkort-kortid-spec.md` (10+9) ·
`smartdok-undersokelse.md` (14+1) · `dagsseddel-design.md` (11+2) · `timer-gps-helhetsplan.md` (12+1) ·
`timer-gps-lag3-4-spec.md` (7+4) · `OPPSUMMERING-timer-arkitektur.md` (10+0) ·
`timer-gps-prosjekt-utredning.md` (8+0) · `timer-geofence-avreise-ankomst-spec.md` (5+0) ·
`mobil-dagsseddel-ui-spec.md` (4+0) · `timer-gps-lag1-spec.md` (2+2) · `timer-pause-en-kilde-spec.md` (4+0) ·
`maaling-v17-geofence-2026-10-03.md` (2+1) · `v17-geofence-spec.md` (3+0) · `skjermbilder-del6-live/` (0+3) ·
`skisser-timer-gps-lag3/` (1+1) · `dagsoversikt-beskrivelse-spec.md` (2+0) ·
`timer-funn-fra-screening-2026-04-27.md` (2+0) · `timer-gps-lag2-spec.md` (2+0) ·
`timer-mobil-f2f3f5-spec.md` (2+0) · `timer-overlapp-pc-mobil-spec.md` (2+0) ·
`na-rapport-attestering-2026-08-20.md` (1+1) · `smartdok-undersokelse-2026-04-25.md` (2+0) ·
`skisser-dagsoversikt/` (1+0) · `skjermbilder-timer-nynav/` (0+1) · `tillegg-utlegg-prosjektkort-spec.md` (1+0) ·
`timer-underentreprenor-utredning.md` (1+0) · `qa-rapport-2026-05-17.md` (1+0) ·
`na-rapport-reisetid-2026-09-07.md` (0+0) · `maskin-vare-kontroll-spec.md` (0+0)

### Maskin — 1 oppføring

`maskin.md` (17+7)

### Varelager — 1 oppføring

`steg-4b-plan.md` (1+4). Det finnes ingen `varelager.md`.

### Mannskap og PSI — 2 oppføringer

`mannskap.md` (13+0) · `psi-geofence-handhevning-utredning.md` (1+1)

### Dokumentflyt — 9 oppføringer

`domene-arbeidsflyt.md` (24+8) · `dokumentflyt.md` (25+6) · `dokumentgenerering-plan.md` (2+3) ·
`lese-okt-a1-b1-2026-07-17.md` (4+0) · `funn21-omfang.sql` (1+1) · `na-rapport-flytmodell-2026-08-21.md` (0+1) ·
`funn21-strukturkopi-maaling.md` (1+0) · `adaptiv-sok-plan.md` (1+0) ·
`naa-rapport-del6b-sjekklister-oppgaver-hms-2026-07-16.md` (0+0)

### HMS — 1 oppføring

`hms-domenemodell.md` (21+0)

### Kontrollplan og maler — 11 oppføringer

`kontrollplan.md` (17+2) · `MAL-METODE.md` (2+13) · `migrering-reporttemplate.md` (2+6) · `MAL-PLAN.md` (0+6) ·
`mal-ns-standard-logg.md` (1+1) · `faseM-3a-felttype-matrise.md` (2+0) ·
`fase-M-forarbeid-testmaler-ns3420-malbygger-2026-07-16.md` (1+0) · `bibliotek.md` (0+0) ·
`ns3420-dok-inventar-raw.json` · `ns3420-dok-inventar.json` · `ns3420-mal-dump-raw.json` (0+0 hver)

### Økonomi og søk — 7 oppføringer

`okonomi.md` (7+0) · `ai-sok.md` (2+0) · `ai-integrasjon.md` (2+0) · `k13-sokdekning-rapport.md` (1+1) ·
`skjermbilder-k13/` (0+2) · `dokumentsok-visning-spec.md` (0+0) · `proadm-sporsmaal-2026-09-17.md` (0+0)

### Tegning og 3D — 4 oppføringer

`3d-agent-prinsipper.md` (3+5) · `tegning-dwg-spec.md` (3+0) · `arbeidstegning-spec.md` (1+0) ·
`tegning-serieopplasting-spec.md` (0+0)

### Blir stående på rot — 78 oppføringer

Alt som gjelder flere moduler: styring (`SAMARBEIDSREGLER.md`, `STATUS.md`, `STATUS-AKTUELT.md`,
`FUNKSJONSENDRINGER.md`, `DOC-MAP.md`, `BACKLOG.md`, `dokumentasjons-standard.md`,
`parallell-arbeid-lock.md`, `historikk-*.md`), drift (`DEPLOY-RUNBOK.md`, `deploy-detaljer.md`,
`infrastruktur.md`, `lokal-dev.md`, `eas-build-veileder.md`, `simulator-*.md`), lagene (`api.md`, `web.md`,
`mobil.md`, `shared-pakker.md`, `arkitektur.md`, `terminologi.md`, `sikkerhet.md`, `hjelpetekster.md`),
`retningslinjer/`, `delplaner/` og resten. `planlegger.md`, `varsling.md` og `aktivitetsfeed.md` er én fil
hver og blir stående til de vokser.

### Usikker plassering

| Oppføring | Hvorfor usikker | Foreslått |
|---|---|---|
| `maskin-vare-kontroll-spec.md` | gjelder Timer, Maskin og Varelager | Timer (0 lenker inn — plasseringen koster ingenting) |
| `skjermbilder-del6-live/` | maskin vist i timerdialogen | Timer |
| `skjermbilder-del5-live/` | timer og firmanavigasjon, ingen lenker inn | rot |
| `smartdok-undersokelse*.md` | grunnlag for Timer, men også import generelt | Timer |
| `dokumentgenerering-plan.md`, `adaptiv-sok-plan.md` | arkivmal/utskrift og søk i lister, brukt av flere dokumenttyper | Dokumentflyt |
| `proadm-sporsmaal-2026-09-17.md` | underlag fra Kenneth, område ikke lest ut av fila | Økonomi og søk |
| `delplaner/` (181 filer, 117+36) | prefikser FABEL 19, hms 6, flytmodell 6, N3 5 — blandet | rot, ikke delt |
| Mannskap og PSI | eget område, eller del av Timer | eget |

## 3 · Områdets logg, og hva som skjer med `historikk-YYYY-MM.md`

**Forslag: én `logg.md` pr. område.** Nyeste øverst. Én post pr. merge eller hendelse: dato, navn, hash,
hva som endret seg, og bakgrunnen («hvorfor») som ikke hører hjemme i en regel- eller spec-fil.

| Område | Loggfil ved mapper | Loggfil uten flytting |
|---|---|---|
| Timer | `timer/logg.md` | `timer-logg.md` |
| Maskin | `maskin/logg.md` | `maskin-logg.md` |
| Varelager | `varelager/logg.md` | `varelager-logg.md` |
| Mannskap og PSI | `mannskap/logg.md` | `mannskap-logg.md` |
| Dokumentflyt | `dokumentflyt/logg.md` | `dokumentflyt-logg.md` |
| HMS | `hms/logg.md` | `hms-logg.md` |
| Kontrollplan og maler | `kontrollplan-mal/logg.md` | `mal-ns-standard-logg.md` finnes for maler; kontrollplan får egen |
| Økonomi og søk | `okonomi-sok/logg.md` | `okonomi-sok-logg.md` |
| Tegning og 3D | `tegning-3d/logg.md` | `tegning-3d-logg.md` |

**`historikk-YYYY-MM.md`:**

1. **De sju månedsfilene fryses som arkiv og deles ikke.** Grovmål (regex på overskrifter) viser at de er
   blandet: av 603 overskrifter treffer 57 timer-ord, 16 maskin, 50 dokumentflyt, 23 HMS, 36
   mal/kontrollplan, 30 tegning/3D — resten er tverrgående eller treffer ikke. Å dele dem er ~600
   skjønnsvurderinger for tekst ingen skriver i lenger.
2. **Fra innføringsdatoen går modulhendelser til områdets logg.** Tverrgående hendelser (deploy,
   server, merge-kjeden, samarbeid) fortsetter i `historikk-YYYY-MM.md`.
3. **Tre steder må rettes for at dette skal gjelde:** `CLAUDE.md` (siste linje under Ufravikelige regler:
   «Deployet arbeid flyttes fra STATUS-AKTUELT til `historikk-YYYY-MM.md`»), `DOC-MAP.md:14` og
   `DOC-MAP.md:29`. `CLAUDE.md` endres bare av Kenneth.

## 4 · Konsekvens

### Alternativ 1 — mapper med flytting

Brutte referanser hvis alle ni områder flyttes samtidig:

| Område | Lenker til området | Lenker ut fra området | Sti-omtaler | Sum |
|---|---|---|---|---|
| Timer | 169 | 56 | 54 | 279 |
| Dokumentflyt | 57 | 35 | 19 | 111 |
| Kontrollplan og maler | 22 | 2 | 28 | 52 |
| HMS | 21 | 13 | 0 | 34 |
| Maskin | 17 | 6 | 7 | 30 |
| Mannskap og PSI | 14 | 3 | 1 | 18 |
| Økonomi og søk | 12 | 0 | 3 | 15 |
| Tegning og 3D | 6 | 4 | 5 | 15 |
| Varelager | 1 | 4 | 4 | 9 |
| **Sum** | **319** | **123** | **121** | **563** |

- **563 referanser i 127 filer** må rettes: 442 markdown-lenker i 77 filer og 121 sti-omtaler i 62 filer.
  Flyttes ett område om gangen, blir tallet pr. steg litt annerledes (en lenke mellom to områder rettes to ganger).
- **`CLAUDE.md`:** 2 lenker (`CLAUDE.md:26` → `3d-agent-prinsipper.md`, `CLAUDE.md:106` → `dagsseddel-design.md`).
- **`DOC-MAP.md`:** 0 markdown-lenker, men 17 bare filnavn for 15 flyttede oppføringer må få mappenavn foran.
- **`STATUS.md`:** 0 markdown-lenker, men 438 bare filnavn for 56 flyttede oppføringer. Registerradene
  må få mappenavn; logglinjene er historie og står.
- **Kode:** 22 sti-omtaler i kommentarer i 14 kodefiler (`apps/api` 7, `apps/mobile` 3, `apps/web` 4).
  Retting rører kodefiler og går derfor gjennom kode-gate, eller de står med gammel sti.
- **Historikk:** 60 referanser i 7 historikkfiler.
- **Utenfor git, rettes ikke av noe skript:** 18 omtaler i 10 minnefiler; 355 omtaler i `relay/*.md`
  (gitignorert historie, står).
- **Åpne brancher:** 12 er ikke merget til `develop`. Tre har rørt `docs/claude` siste 14 dager:
  `docs/fabel` (11 filer), `docs/skisse-attestering-prosjektnavn` (5) og denne. Git følger selve flyttingen,
  men en lenke skrevet med gammel sti på en åpen branch blir død ved merge.

**Slik rettes det:** `git mv` pr. område, og et skript som regner ut ny relativ sti for hver lenke og
bytter `docs/claude/<navn>` med `docs/claude/<område>/<navn>`. Det er samme utregning som ga tallene
over. Kontroll: antall døde lenker inn i `docs/claude/` skal være 23 før og 23 etter. Skriptet kjøres på
nytt etter hver merge av en branch som var åpen da flyttingen skjedde.

**Løser ikke:** `timer.md` er 554 030 tegn. En mappe gjør den ikke mindre; deling av den er en egen jobb.

### Alternativ 2 — indeks pr. modul uten flytting

- **0 brutte lenker.** Ingen kodefiler, ingen åpne brancher og ingen minnefiler berøres.
- Nytt: en liste pr. område (ni filer, eller ni avsnitt i `DOC-MAP.md` uten ny fil) og loggfilene i § 3.
- Mappa har fortsatt 148 oppføringer i én flate. Området finnes bare som tekst som må holdes ved like,
  og ingenting hindrer at en ny fil havner utenfor lista.

## 5 · Rangert anbefaling

1. **Mapper med flytting, ett område pr. commit, minste først** (Varelager 9 → Økonomi/søk 15 →
   Tegning/3D 15 → Mannskap 18 → Maskin 30 → HMS 34 → Kontrollplan/maler 52 → Dokumentflyt 111 → Timer 279).
   Området blir da noe filsystemet håndhever, ikke en liste noen må lese. Konsekvensen er mekanisk og kan
   telles til null. `logg.md` opprettes i mappa i samme commit. Timer tas sist og først når `docs/fabel`
   er merget.
2. **Indeks i `DOC-MAP.md` + loggfiler på rot.** Null risiko og kan gjøres i én commit, men gir ikke et
   område — bare en liste til.

**Felles for begge:** loggfil pr. område (§ 3) kan innføres med en gang og er uavhengig av valget.

## 6 · Rekkefølge etter et ja (alternativ 1)

Pr. område, én commit:

1. Mål at ingen åpen branch rører områdets filer.
2. `git mv` filene til `docs/claude/<område>/`.
3. Kjør retteskriptet; kontroller at døde lenker er 23 før og etter.
4. Rett `DOC-MAP.md` og registerradene i `STATUS.md`.
5. Opprett `logg.md` med første post (flyttingen).
6. Kodekommentarene (22) rettes samlet i én kode-commit til slutt, eller står.

Ikke i planen: deling av `timer.md`, deling av `delplaner/`, og endringen i `CLAUDE.md` (Kenneths).
