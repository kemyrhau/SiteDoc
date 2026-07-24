# Tooltip/hjelpetekst — universell stil-gjennomgang + mikrotekst-standard (fabel 2026-07-24, rev. 2)

TIL REPO: docs/claude/delplaner/tooltip-hjelpetekst-veileder.md. Blokkerer IKKE A-3b.

## 1. Dagens mønstre (målt i kode 2026-07-24)

| Mønster | Hvor | Vurdering |
|---|---|---|
| `Tooltip` (@sitedoc/ui/tooltip.tsx) | sidebar-ikoner | **For svak som universell:** `whitespace-nowrap` = kun én linje (lange tekster løper ut av skjermen), ingen vis-forsinkelse, kun hover (ikke tastatur-fokus, ikke touch — mobil er pilotens viktigste flate), kun side right/bottom |
| Nativ `title=` | Badge, table-filterikon, spredt | Ustyrt, ~1s browser-delay, usynlig på touch, inkonsistent med Tooltip-stilen |
| `HelpCircle` → `HjelpModal` | innstillinger, oppmøtesteder | God for SIDE-nivå-hjelp — beholdes |
| Inline mikro-hjelpetekst (`text-xs text-gray-500`) | skjemafelt (timer, malbygger, FeltWrapper) | God for FELT-nivå — beholdes |

**Konklusjon: forbedre — universelt.** Hullet er mellomnivået: rik hover/fokus-hjelp på ord, celler og handlinger. Dagens Tooltip kan ikke bære setnings-lange forklaringer, og `title=` er usynlig på mobil.

## 2. Forslag: tre-nivå hjelpetekst-standard (veileder-regel)

1. **Felt-nivå:** inline mikro-hjelpetekst under/ved feltet (som i dag). Alltid synlig — ikke bak hover.
2. **Ord/handling/celle-nivå: `Tooltip` v2** (oppgradering av eksisterende, samme API + nye props):
   - flerlinje: `max-width: 280px`, normal bryting, `text-wrap: pretty` — aldri nowrap
   - forsinkelse ~300 ms inn / 0 ut; posisjon auto-flip ved skjermkant (side-prop blir hint)
   - **tastatur:** vises ved `:focus-visible` (trigger får `tabindex` ved behov + `aria-describedby`)
   - **touch:** tap viser, tap utenfor lukker (long-press er udiskoverbart)
   - valgfri tittel-linje (fet) + brødtekst — dekker celle-tooltipene i flyt-matrisen («Overstyrt av … · Tilbakestill»)
   - All nåværende `title=`-bruk på interaktive/informative elementer migreres hit; `title=` forbys i veilederen.
3. **Side-nivå:** `HelpCircle` → `HjelpModal` (som i dag).

## 3. Flyt-matrisens handlings-hjelpetekster (Kenneths funn: coworks utkast sier ikke HVOR dokumentet flytter)

**Skriveregel (blir i18n-fasit `flytmatrise.handlinghjelp.*`):** hver tekst svarer på tre spørsmål — (1) **hvor** flytter dokumentet (fram / tilbake / stopper / blir hos deg), (2) **hvem** får ballen, (3) **hva** ser motparten. Roller omtales RELASJONELT («den som sendte det», «neste mottaker») — aldri faste rollenavn som kan mangle i en gitt flyt (Kenneths poeng: «hva om det ikke finnes en bestiller»).

| Handling (status) | → | Revidert hjelpetekst |
|---|---|---|
| Opprett (nytt) | Kladd | Oppretter et nytt dokument som kladd. Det ligger hos deg — kun du ser det til du sender. |
| Send (kladd) | Mottatt | Flytter dokumentet ett ledd fram: fra deg til neste mottaker i flyten. Hos dem står det som Mottatt; hos deg som Til behandling. |
| Slett (kladd) | Slettet | Sletter kladden din permanent. Mulig kun mens dokumentet ennå ligger hos deg — etter sending kan det bare trekkes tilbake. |
| Trekk tilbake (sendt) | Trukket tilbake | Henter dokumentet tilbake fra mottakeren før de har begynt. Flyten stopper; dokumentet avsluttes som Trukket tilbake hos begge. |
| Besvar (mottatt/under arbeid) | Besvart | Flytter dokumentet ett ledd fram: fra deg til den som skal godkjenne svaret. ⚠ cowork verifiserer: hvor går det når flyten ikke har godkjenner-ledd? Teksten må dekke målt fallback. |
| Avvis (mottatt/under arbeid) | Trukket tilbake | Stopper flyten: dokumentet avsluttes ubesvart, og den som sendte det ser det som avsluttet. |
| Send tilbake (under arbeid) | Sendt | Flytter dokumentet ett ledd tilbake: fra deg til den som sendte det, uten svar. Det havner i deres kø igjen. |
| Godkjenn (besvart) | Godkjent | Godtar svaret. Dokumentet flytter ikke videre — det står som Godkjent hos alle parter, klart til lukking. |
| Send tilbake (besvart) | Returnert | Flytter dokumentet ett ledd tilbake: fra godkjenner til den som svarte, for utbedring. Kommentar kreves så mottakeren ser hva som må rettes. |
| Gjenoppta (returnert) | Under arbeid | Dokumentet blir hos deg og går tilbake til Under arbeid — klart for retting og nytt svar. |
| Send på nytt (returnert) | Sendt | Flytter dokumentet fram igjen: fra deg til samme mottaker som sist, etter retting. |
| Lukk (returnert/godkjent) | Lukket | Avslutter flyten: dokumentet arkiveres som Lukket hos alle og flytter ikke videre. Gjenåpning krever egen rettighet. |
| Videresend (flere) | Videresendt | Flytter dokumentet sideveis: ut av denne flyten, til en person/faggruppe i en annen flyt (admin-verktøy for kryssflyt). |
| Gjenåpne (trukket tilbake) | Kladd | Henter et trukket-tilbake dokument tilbake til start: det blir kladd hos oppretteren, klart til redigering og ny sending. |

Merk: «Send (kladd) → blir straks Mottatt» i coworks utkast er riktig teknisk (auto-konvertering), men hjelpeteksten skal si hva BRUKEREN ser — derfor «hos deg som Til behandling» (perspektiv-tabellens A-kolonne). Presentasjon i matrisen: handlings-ordet får prikket understrek + Tooltip v2 med tittel «Send → Mottatt» og brødteksten over.

## 3a. Skriveregelen er UNIVERSELL (Kenneth 2026-07-24) — SiteDoc mikrotekst-standard

Regelen i § 3 gjelder ALL handlingstekst i SiteDoc, ikke bare flyt-matrisen: handlingsmenyer på dokumenter (web + mobil), bekreftelsesdialoger («Farlig sone»), toasts/kvitteringer (perspektiv-tabellens § 6), knapper i skjemaflyt, e-post-/varseltekster. **Enhver tekst som beskriver en handling svarer på:**
1. **Hvor** flytter/endrer handlingen noe (fram / tilbake / stopper / blir hos deg / permanent)
2. **Hvem** får ballen / berøres
3. **Hva** ser motparten etterpå

…med relasjonelle benevnelser («den som sendte det», «neste mottaker») — aldri faste rollenavn som kan mangle i en gitt flyt. Inn i veilederen (docs/claude/retningslinjer/) som mikrotekst-standard; nye i18n-nøkler for handlinger skal følge den, og eksisterende tekster oppgraderes flate for flate når de likevel røres (ingen big-bang-sweep — kvalitet der vi jobber).

## 4. Estimat (backlog)

- **Tooltip v2 + veileder:** liten–middels — én komponent-oppgradering (bakoverkompatibelt API) + sweep som migrerer `title=`-bruken (~håndfull steder målt). ~1 liten kloss.
- **Flyt-matrisens handlings-hjelpetekster:** liten — i18n-nøkler fra tabellen over + Tooltip v2 på Handling-kolonnen. Kan gå i samme runde som Tooltip v2, eller med `title=` som midlertidig bro hvis Kenneth vil ha tekstene ut før v2 (frarådes på mobil).
- **Mikrotekst-standarden (§ 3a):** null egen kloss — går inn i veilederen og håndheves i ordre-DoD (nye handlingstekster) + opportunistisk oppgradering.
- Rekkefølge: Tooltip v2 først, tekstene rett etter. Ingenting blokkerer A-3b.
