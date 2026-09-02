# Til fabel — lokasjon: tre begreper, ett navn, og en sperret ordre

**Fra:** cowork · **Skrevet:** 2026-09-02 · **Status:** venter fabels designnotat

> **Kenneth 2026-09-02:** *«Fabel kan designe mer på lavere nivå.»*

Dette er den detaljerte saken som står lengst fremme og som er merket ditt domene i masterplanen
to steder. **En ordre er allerede stoppet på den** (`relay/inbox-lokasjon-autoapne.md`, ⛔ ON HOLD).

## [1] Tre ulike ting heter «lokasjon»

| Bærer | Hva det er | Hvor |
|---|---|---|
| `ReportTemplate.showLocation` | Fast felt på malen, utledes automatisk fra bygning/tegning | malbyggeren |
| `location`-rapportobjekt | Ren tekst, faller tilbake til prosjektadressen | rapportobjekt |
| `drawing_position`-rapportobjekt | Bærer `drawingId` + koordinater | rapportobjekt |

**Cowork-observasjon, ikke et vedtak:** *byggeplassen* er lokasjonen. Den eier tegningene
(`Drawing.byggeplassId`) og har koordinater fra georeferert tegning. De tre over er tre måter å
uttrykke det samme på, oppstått i hver sin runde.

## [2] Kenneths funn som stoppet ordren (2026-08-29)

> *«Dersom lokasjonsvelger alltid velges, da tar jeg bort muligheten å ikke ha med lokasjon i en
> rapport — noen ganger er det nyttig, da rapporten kan gjelde byggeplassen.»*

🔴 **`positionX`/`positionY` er `null` i to helt ulike tilfeller:** lokasjon *ikke satt ennå*, og
rapporten gjelder *bevisst hele byggeplassen*. Data kan ikke skille dem.

Ordren som ville auto-åpnet tegningen ved manglende markering er sperret nettopp derfor — den
ville bedt om en pin på dokumenter som ikke skal ha en.

## [3] Hva vi trenger fra deg

En begrepsavklaring konkret nok til at en ordre kan skrives ut av den:

1. **Skal «ingen lokasjon» være et eksplisitt valg** — og hvordan skiller det seg fra «ikke satt
   ennå», i data og på skjermen?
2. **Overlever de tre begrepene, eller kollapser de?** Er `location`-objektet nødvendig når
   byggeplassen finnes, eller er det en relikvi?
3. **Hva skal `showLocation` på malen bety** når rapporten gjelder hele byggeplassen?

## [4] 🔴 To nye rammer fra 2026-09-01 som binder designet

**Flateparitet** ([retningslinjer/ui-standarder.md § Flateparitet](../claude/retningslinjer/ui-standarder.md),
Kenneth-vedtak):

> *«Det vi viser på web/mobil → i mal, i ui og på pdf → vi må vise samme informasjon på alle
> flater. Dersom vi ønsker ekstra logg på utskrift, skal dette være et tillegg. Ikke slik at vi
> viser noe tilfeldig her og der bare fordi vi ikke klarer å kode dette rett.»*

Løsningen din må derfor svare for **alle fire flater** — malbygger, web, mobil, PDF — ikke bare
den ene du designer mot.

**PDF-en er fasit for lokasjonsvisning.** Kenneth 2026-09-01: *«Det eneste som er rett i denne
sjekklisten er faktisk PDF.»* Målt på BEF_-004: `POSISJON I TEGNING` rendres med tegningsutsnitt,
prikk på riktig sted, koordinater i prosent, og markørnummer koblet til oversiktsbildet på neste
side. **Det er den beste flaten i systemet for dette feltet** — web og mobil skal justeres mot
den, ikke omvendt.

## [5] Én ting til, samme familie — endringsloggen

Ikke din bestilling, men samme mønster og verdt at du kjenner det:

PDF-ens dokumenthistorikk kollapser endringene til **ett tall på statusovergangen** —
`Sendt (31 feltendringer)` — mens web og mobil rendrer hver rad i full lengde. Kenneth:
*«Endringslogg er ikke noe man trenger hele tiden → det er noe man skal ta frem dersom det er
konflikt/tvist.»*

PDF-en gjorde altså det riktige først, her også. Ført i
[BACKLOG.md](../claude/BACKLOG.md) § oppgavens endringslogg.

## [6] Andre fabel-saker som ligger usendt hos cowork

- `fabel-nav-gating-modellen.md`
- `fabel-eksport-arkivering.md`
- **PR arkivering** (masterplanens punkt 5) venter fortsatt på ditt designnotat om *arkivering
  framfor nedlasting*. Det harde premisset står: `Folder.projectId` er påkrevd, mens
  timer-rapporten er en **firma**-flate.
