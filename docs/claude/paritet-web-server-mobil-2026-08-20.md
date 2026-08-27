---
name: paritet-web-server-mobil-2026-08-20
description: Paritetskartlegging av handlingsmønster mellom web, server og mobil — 24 avvik, 7 av dem høy alvorlighet. Målt mot kode 2026-08-20.
sist_verifisert_mot_kode: 2026-08-20
sist_endret: 2026-08-23
---

# Paritet web ↔ server ↔ mobil — 24 avvik (målt 2026-08-20)

**Bestilt av Kenneth 2026-08-20** etter en dag med funn der samme handling oppførte seg
ulikt avhengig av flate. Spørsmålet var: *hvor mange flater har ulikt handlingsmønster?*

**Svar: 24 avvik.** 7 høy, 12 middels, 5 lav.

> **Metode:** kartlagt mot kode, ikke mot dokumentasjon. Hvert avvik har fil:linje på alle
> tre flater. Punkter merket «usikker» er ikke verifisert til bunns og skal re-måles før
> de brukes som beslutningsgrunnlag.

## Det viktigste først: kjernen er samstemt

Flytmodellens kjerne er **reelt delt** — ingen av klientene har egen ballberegning igjen.
Begge normaliserer flytmedlemmer til `RaFlytMedlem` og bygger leddene med
`byggPosisjonsLedd` fra `packages/shared/src/utils/flytPosisjon.ts`. Det samme gjelder
`hentPosisjonFiltrertHandlinger`, statusmaskinen (`isValidStatusTransition`,
`statusKreverBegrunnelse`) og timer-beregningen (`effektiveTimerFraSpenn`,
`pauseOverlappMin`, `finnOverlappendeTidsrom`).

**Avvikene ligger i lagene rundt kjernen, ikke i den.** Det er en god nyhet: dette er
ikke en arkitekturfeil som må rives opp, men et vedlikeholdsetterslep der én flate har
fått en fiks eller en funksjon som den andre aldri fikk.

---

## HØY (8)

### H1 · HMS-behandling er umulig fra mobil ✅ LØST (2026-08-26, branch `feat/mobil-h1-hms`)
Web har `HmsHandlingsflate` (Besvar/Lukk/Gjenåpne). Mobil hadde **kun melder-siden** → en
HMS-behandler falt til den generelle `DokumentHandlingslinje` (feil løp).
**Fiks:** ny `HmsBehandlingsflate` (RN-port av web-flaten) — **Besvar** (obligatorisk begrunnelse,
`hmsBesvar`) · **Lukk** (valgfri kommentar, `hmsLukk`) · **Gjenåpne** (valgfri kommentar,
`hmsGjenapne`). `erHmsAdmin` fra server-queryen. Mount-en i `sjekkliste/[id].tsx` er nå
`erHms ? (melder-banner ELLER behandler-flate) : DokumentHandlingslinje` — den generelle menyen
vises ALDRI for HMS-dok.
**«Returner» UTELATT med vilje:** web har knappen, men `sjekkliste.hmsReturner` finnes ikke på
serveren (H7) — en alltid-feilende knapp replikeres ikke.
**🔴 dokumentflytId-unntaket respektert:** behandler-mutasjonene tar `{id, begrunnelse/kommentar}`,
aldri `dokumentflytId` (verifisert mot `sjekkliste.ts:345` FØR klientkallet).
**⚠️ Simulator-verifisering gjenstår.**

### H2 · «Trekk tilbake» forsvinner på mobil for alle som ikke er admin ✅ LØST (2026-08-23, branch `fix/mobil-paritet-h2345`)
Mobil gater handlingen på `erAdmin` (`DokumentHandlingslinje.tsx:206-208`), web gjør det
ikke (`DokumentHandlingsmeny.tsx:454-465`). Serveren tillater den for avsenderleddet
(`tilgangskontroll.ts:876`).
**Konsekvens:** avsender kan angre en sending på web, men ikke på mobil.
**Fiks:** `erAdmin`-gaten på `adminHandlinger` fjernet — `øvrige` er allerede den AUTORISERTE
mengden (`hentPosisjonFiltrertHandlinger` = server-speil via retningsrett), så autoriserte
admin-statuser (Trekk tilbake for avsenderleddet) vises uten admin-flagg, som web.

### H3 · Mobil tilbyr «Videresend» som serveren alltid avviser ✅ LØST (2026-08-23)
Mobil rendrer videresend-raden ubetinget uten mottaker
(`DokumentHandlingslinje.tsx:205,449-451`); web gater den på `!harFlyt`
(`DokumentHandlingsmeny.tsx:416-419`). Serveren kaster BAD_REQUEST «Videresending krever
en mottaker» (`sjekkliste.ts:1171`).
**Konsekvens:** knappen finnes, trykkes, og feiler hver gang.
**Fiks:** `videresendHandlinger = harFlyt ? [] : …` — vises kun for flyt-LØSE dok, som web.
Den alltid-feilende knappen på flyt-BUNDNE dok er borte. **MELDT (restanse):** mobil mangler
web sin mottaker-velger (`recipientOppforinger`) for flyt-LØSE forwarding, så den grenen
kan fortsatt sende uten mottaker → egen liten oppfølger, ikke i denne runden.

### H4 · Firma-admin-fantomet er fikset på web, ikke på mobil ✅ LØST (2026-08-23)
Web sender `erAdmin: adminNiva !== null` (`useFlytKontekst.ts:167`) med en kommentar om at
dette «erstatter det gamle erAdmin-flagget som viste firma-admin et fantom-menyvalg
serveren avviste». Mobil sender fortsatt det gamle flagget
(`sjekkliste/[id].tsx:276`, `oppgave/[id].tsx:186`).
**Konsekvens:** firma-admin utenfor flyten får handlingslinje på mobil der web viser
lesevisning — og en Videresend serveren nekter.
**Fiks:** de 4 side-beregningene per side (`minRolle`/`retningsrett` via `utledMinRolle`/
`retningsrettigheter`) bruker nå `minFlytInfo.adminNiva !== null` i stedet for det gamle
`minFlytInfo.erAdmin`, på begge sider. Komponenten fikk allerede `adminNiva` korrekt.

### H5 · Mobil har egen, buggy endringslogg-formatering ✅ LØST (2026-08-23)
Web og arkiv-PDF bruker `ekspanderEndring` fra `@sitedoc/pdf`. Mobil har lokal
`formaterLoggVerdi` (`apps/mobile/app/sjekkliste/[id].tsx:69-81`) der
`Array.isArray(parsed) → parsed.join(", ")`.
**Konsekvens:** repeater-endringer vises som `[object Object], [object Object]`,
vær-objekter som rå JSON, og kanoniske no-ops gir falske logglinjer som web og arkiv-PDF
filtrerer bort. Observert i drift 2026-08-20.
**Fiks (MÅL FØRST bekreftet):** mobil KAN importere `ekspanderEndring` — den importerer alt
`byggSjekklisteHtml` fra `@sitedoc/pdf` (null-deps, mobil-bundlet). `formaterLoggVerdi` slettet;
endringsloggen bruker nå `ekspanderEndring` + `byggKolonnerPerFelt` + `segmenterTilTekst`, hopper
over no-ops (tom liste), og én logglinje kan bli flere diff-rader (per endret repeater-celle).
**Merk:** mobilens `EndringsloggRad`-type mangler `fieldId`, så repeater-KOLONNE-labels faller
til generiske når fieldId ikke er i dataen — kjernebuggene (JSON/[object Object]/no-op) er borte.

### H6 · Bildekomprimering finnes kun på mobil
Mobil komprimerer til 300–400 KB / maks 1920 px (`src/services/bilde.ts:13-99`). Web
sender filen rått (`FeltDokumentasjon.tsx:54-82`). Serveren begrenser ingenting utover
magic-bytes og et 500 MB-tak (`upload.ts:139`).
**Konsekvens:** samme foto blir ~350 KB fra mobil og potensielt 10–40 MB fra web.
Regelen i CLAUDE.md håndheves altså kun på én av tre flater.

### H7 · Web-sjekkliste har en «Returner»-knapp uten handler og uten endepunkt
`HmsHandlingsflate` legger til `returner` for alle dokumenttyper
(`HmsHandlingsflate.tsx:91`), men sjekkliste-sidens `utforHmsHandling` har ingen
`returner`-gren, og `sjekkliste.hmsReturner` finnes ikke på serveren (oppgave-varianten
gjør).
**Konsekvens:** HMS-admin trykker Returner på en SJA, skriver spørsmål, sender —
ingenting skjer, ingen feilmelding.

### H8 · Mobil kan ikke sette tegningsposisjon på repeater-rader ✅ LØST (2026-08-24, branch `feat/mobil-h8-tegningsposisjon`)

`TegningPosisjonObjekt` var en placeholder («funksjonen er tilgjengelig i en kommende
oppdatering»). Nå: modal med `TegningsVelger` (bygning→tegning) + `TegningsVisning` (tapp for
å plassere markør) + bekreft → lagrer `{drawingId, positionX, positionY, drawingName}`. Siden
feltet rendres per repeater-rad, kan mobil nå sette markør PER RAD — D2b-dataen mobilen ikke
kunne produsere finnes nå. Default-tegning: radens egen (`verdi.drawingId`), ellers velgeren.
**Rest (liten oppfølger):** «dokumentets tegning» som mellom-default i kjeden radens→dokumentets→
full velger krever en ny prop threadet fra detaljsiden — ikke i denne runden. **Simulator-verifisering
gjenstår.**

~~Mobilappen støtter kun dokumentets **hovedlokasjon**. Web støtter i tillegg
`drawing_position` som barnefelt i en repeater — markøren per rad.~~

**Konsekvens:** et dokument utfylt på mobil kan aldri få radmarkører. Hele D2b-sporet
bygget 2026-08-21 (nummererte markører, helside, detaljutsnitt i radkortet) hviler på
data mobilen ikke kan produsere. En befaring registrert i felt — altså på mobil, som er
poenget med feltregistrering — gir en rapport uten de punktene rapporten er laget for å vise.

⚠️ Ikke målt: om mobil *viser* radmarkører satt på web, eller om den også taper dem i
visning og lokal PDF. Det avgjør om dette er en mangel eller også et datatap. Mål før ordre.

### Tegningsvisning · mobil viste kun oppgavemarkører ✅ LØST (2026-08-23, branch `feat/mobil-tegningsvisning`)

Mobil-lokasjonsfanen (`apps/mobile/app/(tabs)/lokasjoner.tsx`) hentet kun
`oppgave.hentForTegning`. Web-tegningssiden viser i tillegg **kontrollpunkt-markører**
(`kontrollplan.hentForTegning`, tilstandsfarget) og **områder** (`omrade.hentForTegning`,
polygoner), med **lag-brytere** (oppgaver/kontrollpunkter/områder) og et **periodefilter**
på markørenes `createdAt`/`opprettet`.
**Fiks:**
- Delt logikk løftet til `@sitedoc/shared/utils`: `periode.ts` (hurtigvalg-sett + grensematte,
  enekilde web+mobil, `HURTIGVALG_STANDARD` modul-konstant) og `kontrollplanFremdrift.ts`
  (`avledPunktTilstand`/`isoUkeRef` → identisk tilstandsfarge som web). Web re-eksporterer begge
  for bakoverkompat (importørene urørt).
- Ny RN `PeriodeFilter` (Pressable-chips + DateTimePicker) som konsumerer den delte logikken —
  ikke en kopi, så settet kan ikke drifte.
- `TegningsVisning` utvidet: Markør-form `fylt`/`kantFarge` (tilstand + over-frist-rød kant) +
  ny `omrader`-prop med SVG-polygon-overlay i WebView-en.
- `lokasjoner.tsx`: to nye queries, tre lag-brytere + periodefilter i et sammenleggbart panel,
  kontrollpunkt-tap → koblet sjekkliste.
- Shared-test `periode.test.ts` (+12) låser den delte kontrakten.
⚠️ **Gjenstår: simulator-verifisering** (docs/claude/simulator-runbook.md § 1) — typecheck 11/11
+ tester grønne, men ikke kjørt på simulator ennå.

---

## MIDDELS (12)

| # | Avvik | Kjerne |
|---|---|---|
| M1 | Flyt-løse dokumenter | Web gir hele handlingsuniverset, mobil gir null (`DokumentHandlingslinje.tsx:224`) |
| M2 | Påkrevde felt | Blokkerer kun på mobil; **ingen server-backstop** |
| M3 | Annotering | Mobil-only; erstatter originalen (`FeltDokumentasjon.tsx:410-437`) |
| M4 | Auto-genererte timerader | Mobil-only → **web-førte timer får aldri overtidslønnsart automatisk** |
| M5 | Attestering | Mobil mangler gjenåpne, redigering og ECO-flytting |
| M6 | Prosjektleder-attestering | Mobil har kun firma-kontekst |
| M7 | Timer-splitt | Mobil er ren lokal Drizzle-operasjon som **omgår server-valideringen** |
| M8 | Dagsnorm | Web **detaljside** flat, mobil sesongjustert → ulikt trafikklys samme dag. **Presisert 2026-08-20:** web `/timer/ny` **har** t4-oppslaget (`page.tsx:72`) — hullet er detaljsiden alene, ikke web som flate |
| M9 | Oppgave-endringslogg | Skrives av serveren, vises ingen steder — data uten leser |
| M10 | Papirkurv | Web-only; sletter du på mobil har du ingen vei tilbake |
| M11 | Vedleggssignering | Mobil-only; leder på web kan ikke signere |
| M12 | `byttEier` | Server-handling ingen klient eksponerer (usikker — kan være bevisst) |

## LAV (5)

Deaktiverte handlinger med begrunnelse (web-only) · ulik bekreftelsesfriksjon (ett klikk
på web, to på mobil) · `tilErEtterFra` duplisert inline i web · arbeidstid-prefill har to
uavhengige implementasjoner (offline krever det, men sommertidsregler kan drifte) ·
`perspektivEtikett` brukes kun av web.

---

## Mønsteret bak avvikene

Tre gjentakende årsaker, i synkende hyppighet:

1. **Fiks landet på én flate.** H4 og H5 er begge fikser som ble gjort på web med en
   forklarende kommentar, mens mobil beholdt den gamle koden. Ingenting fanget at den
   andre flaten sto igjen.
2. **Funksjon bygget for én flate, aldri portert.** H1, M3, M4, M5, M10, M11.
3. **Regel håndheves i klienten uten server-backstop.** M2 og M7 er de farlige: regelen
   ser ut til å gjelde, men kan omgås ved å bruke den andre flaten.

**Kategori 3 er den som bør lukkes først** — ikke fordi avvikene er flest, men fordi de
er de eneste der en bruker kan skrive data som bryter en regel systemet later som det
håndhever.

---

# Åpne feil observert i drift 2026-08-20

Funnet ved bruk samme dag, i tillegg til paritetsavvikene over. Alle er observert i prod.
Ingen er fikset.

### D1 · Mobil krasjer når avsender sender et dokument videre 🔴
Bruker KMY (registrator, ikke admin) trykket «Send til 2 · A.Markussen Ledere» på mobil.
Appen krasjet; dokumentet forble `draft` — serveren fikk aldri kallet. Samme handling fra
web gikk gjennom uten problemer.
**Avkreftet hypotese:** ikke tilgangstap. `byggTilgangsFilter`
(`apps/api/src/trpc/tilgangskontroll.ts:1080-1090`) gir lesetilgang til alle dokumenter i
flyter brukeren er medlem av, uavhengig av ballposisjon — i tråd med Kenneths prinsipp:
**medlem av flyt beholder lesetilgang, mister kun redigering.**
**Gjenstår å måle:** kan KMY åpne dokumentet fra lista etterpå, eller krasjer det også?
Det skiller gjengivelsesfeil fra tilstandsfeil.

### D2 · Mobil låser seg ved opprettelse av sjekkliste i prosjekt 998 🔴
Prosjekt 998 har 3 faggrupper, 5 flyter, 15 ledd. Prosjekt 999, som fungerer, har 1/2/4.
Mistanke: `OpprettDokumentModal` må la brukeren velge kandidat når det finnes flere
flyter, og snubler i presentasjonsovergangen — samme sted som freeze-fiksen `a29f89b2`
traff, men en annen gren. Ikke bekreftet.

### D3 · «Mine timer» fordeler timer på feil aktivitet ✅ LØST (2026-08-27)
**Rotårsak:** `apps/mobile/app/timer/mine.tsx` tilskrev hele sedelens timesum til **sedelens**
`aktivitetId`, mens aktivitet ligger **per rad** (`SheetTimer.aktivitetId`, vedtatt i
[dagsseddel-design.md](dagsseddel-design.md)). Fører du 4 t graving og 4 t anleggsarbeid på
en sedel merket «Anleggsarbeid», ble det rapportert 8 t anleggsarbeid og 0 t graving.
Totalen var riktig; fordelingen ikke. Rapporten ble bygget før aktivitet flyttet ned på
radnivå og fulgte aldri etter.
**Fiks:** `lesDataLokalt` summerer nå per rad-aktivitet (`sheet_timer_local.aktivitet_id`)
innen hver sedel og bærer per-rad-fordelingen; `perAktivitet`-aggregatet og detaljlistens
aktivitetsetikett leser fra den. Sedelens egen `aktivitetId` brukes ikke lenger i «Mine timer».

### D4 · Sletting på server propagerer ikke til mobil 🔴
Etter at 18 dagssedler ble slettet i prod, viste mobilen dem fortsatt — lokal SQLite fikk
aldri beskjed. Tombstone-mekanismen fra juli (`slettede_rader`) dekker **rader slettet
gjennom appen**, ikke **sedler som forsvinner på serversiden**.
**Konsekvens:** enhver ryddejobb i databasen etterlater spøkelser på telefonene. En
arbeider kan se timer som ikke finnes og tro at de er ført. Gjelder all serverside-sletting,
ikke bare manuell rydding.

### D5 · Sjekkliste i «Mottatt» kan ikke slettes av noen ✅ LØST (2026-08-21)
**Rotårsak:** slettevakten var `draft` || `cancelled`, men `cancelled` er uoppnåelig (0 prod-rader)
— så alt utenom Utkast havnet i en tilstand ingen, heller ikke systemadmin, fikk slettet uten SQL.
**Fiks (Lukk-som-slette-port, Kenneth-vedtak):** slettevakten er nå `draft` || `closed` (både
sjekkliste + oppgave), og «Lukk» (KUN admin) er gjeninnført som `approved→closed` / `dismissed→closed`.
Det gir alltid en vei til sletting: et dokument i Mottatt rutes Avvis → Lukk → Slett (eller
Godkjenn → Lukk → Slett); et Godkjent/Avvist dokument Lukkes → slettes. Feilmeldingen er endret til
«Lukk dokumentet først, så kan det slettes». Bevisst tostegs-vern: dokumenter i AKTIV flyt slettes
aldri direkte — de må Lukkes (synlig, gjenåpnbart) → papirkurv (90 dagers angrefrist).
Se [`delplaner/flytrettigheter-evaluering-2026-07-26.md § H6-REVISJON`](delplaner/flytrettigheter-evaluering-2026-07-26.md).
**Restanse (uendret, egen sak):** FK-ene `images` og `document_transfers` mangler `onDelete` og
**blokkerer** myk-sletting av dokumenter med bilder/overføringer; `checklist_change_log` kaskaderer,
`tasks` settes til null. Lukk-porten løser status-gaten, ikke FK-blokkeringen.

### D6 · Annotering lager duplikat i visningen + ukomprimert fil 🟡
Et annotert bilde vises som to miniatyrer (01 original, 02 annotert) i samme rad. Målt i
prod: originalen 290 KB JPEG, annoteringen **1,98 MB PNG** — syv ganger større, og langt
over 300–400 KB-regelen i CLAUDE.md. Henger sammen med H6 (komprimering finnes kun på
mobil) og M3 (annotering er mobil-only).

### D7 · GPS-markering på georeferert kart virker ikke 🟡
Etter brukerbytte til `kemyrhau@gmail.com` lot det seg ikke gjøre å sette markør med
mobilens GPS på et georeferert kart (Sommerfeldtsgt 65). **Ikke diagnostisert.** For å
komme videre trengs: mangler markøren helt eller lar den seg ikke flytte, og skjer det
samme på et annet georeferert kart? Det skiller tilgangsproblem fra georeferanseproblem.

### D8 · Duplikate faggrupper og flyter med nesten samme navn 🟡
A.Markussen har både faggruppen `A.Markussen` (punktum) og `A-Markussen` (bindestrek),
hver med sin flyt — `A.Markussen Ansatte. -> A.Markussen ledelse` og
`A.Markussen Ansatte -> ledelse`. Ulike maler henger på hver. Kenneth 2026-08-20:
*«jeg har mistet oversikt på hvor jeg setter premiss for funksjon.»*
**Årsaken er strukturell:** én funksjon — hvem får dette dokumentet — settes fire steder
som ikke ser hverandre: faggruppen på prosjektets dokumentflytside, flyten på faggruppen,
leddene på flyten, og tilgangsgruppene under prosjektmedlemmer. Bør ryddes til én
faggruppe og én flyt per reell arbeidsdeling, og oppsettsflaten bør vise helheten ett sted.

## Relaterte funn samme dag

- Dokumentflyt-ledd får `steg = 1` som default og UI setter det ikke → flyt stopper hos
  registrator. Se [dokumentflyt.md](dokumentflyt.md).
- ~~Sjekkliste i «Mottatt» kan ikke slettes; statusen «Avbrutt» som feilmeldingen viser til
  finnes ikke i UI.~~ ✅ LØST 2026-08-21 (Lukk-som-slette-port) — se D5 over.
- Annotert PNG lagres ukomprimert (1,98 MB mot originalens 290 KB) — henger sammen med H6.
- `recipient_user_id`/`recipient_group_id` på `checklists` settes aldri; posisjonsmodellen
  har overtatt. Relikvier.
- Faggruppe-tabellen heter fortsatt `dokumentflyt_parts` i databasen etter
  entreprise→faggruppe-renamet.
