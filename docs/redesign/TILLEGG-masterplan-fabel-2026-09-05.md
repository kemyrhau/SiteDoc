# TILLEGG til REDESIGN-MASTERPLAN.md — fabel 2026-09-05 (cowork fletter og eier stien)

> Merkede tillegg, aldri helfil. Ingen statuskopier — status lever der den står
> (§ AVSTEMT MOT KODE 2026-09-04 og verifiseringsloggene). Svar på
> `docs/redesign/til-fabel/BESTILLING-masterplan-2026-09-04.md`.

## 1) Nye rader i del-oversikten (fire saker fra 04.09-kvelden)

| # | Del | Status | Kilde/logg |
|---|-----|--------|------------|
| EX | **Eksport og navngiving** (PDF/Excel/CSV fra app OG web — velge, preview, dele; rename «Arkiv-PDF»→eksport-språk; «arkiver» reserveres for fremtidig handling = PR-sporet) | Designsak hos fabel. Fakta og Kenneth-sitater: BESTILLING-masterplan-2026-09-04.md § 2A — gjentas ikke her | designnotat kommer (fabel) |
| BL | **Byggeplass-livssyklus** (tilstand/start/slutt/arkivering; velger-skala v/500 byggeplasser; hva skjer med PSI/mannskap ved avslutning) | Designsak hos fabel. Premiss avklart: Project ER beholderen, intet nytt nivå (BESTILLING § 2B). Sluker to av de åpne funnene: chip-tekst som lover avgrensning + tegninger-hardt/dokumenter-mykt filter (beslutning hører hjemme i samme scoping-modell) | designsak kommer (fabel); utredning: domene-arbeidsflyt.md |
| LP | **lokasjonOmfang nivå 3: «hele prosjektet»** (i dag: byggeplassId=null tvetydig — gatelys-eksemplet ett trinn opp) | Liten sak — additivt på nettopp levert lokasjonOmfang-spor (ordre 04.09 + L9). Fakta: BESTILLING § 2C | tillegg til lokasjon-ordren (fabel) |
| AG | **Ansvarsgrensen** — produkttekst om hva SiteDoc leverer vs. hva bedriften eier (eksponeringsregister-korreksjonen) | Teksten skrives av FABEL, gates av Kenneth — aldri cowork/kodeagent (juridisk-nær). Plassering (onboarding/hjelpetekst/egen side) avgjøres i notatet | designnotat kommer (fabel) |

## 2) Ny rekkefølge — erstatter punktlisten i «Rekkefølge (justert 2026-08-28)»

> Bygger på § AVSTEMT MOT KODE 2026-09-04. Alt design-først; køen til kodeagentene
> fylles i denne rekkefølgen. OTA (i drift 04.09) er priset inn: mobilarbeid i JS
> koster ikke lenger byggkvote — derfor designes alle brukervendte saker under
> web+mobil SAMTIDIG, aldri «web først, mobil senere».

1. **LP — «hele prosjektet»-omfang.** Først fordi den rir på det ferske
   lokasjonOmfang-sporet (samme utfører-kontekst, samme test-matrise utvides) og
   lukker siste null-tvetydighet mens modellen er varm.
2. **EX — eksport-designsak.** Størst pilot-verdi: PDF-en er leveransen kunden
   faktisk mottar, og eksport fra APP er nettopp blitt billig (OTA + delt
   packages/pdf). To ledd: navnevedtaket (raskt, låser språket før flere flater
   bygger på «arkiv») → flaten (velge/preview/dele, web+mobil i samme ordre).
   PR-sporets «arkivering framfor nedlasting» folder inn her som navnereservasjon
   — egen bygging fortsatt nedprioritert (timer-flaten ubrukt, målt 27.08).
3. **AG — ansvarsgrense-notatet.** Parallelt med EX (blokkerer ingen kode; fabel-
   tekst + Kenneth-gate). Kommer foran BL fordi piloten møter HMS-flatene fra dag én.
4. **BL — byggeplass-livssyklus.** Designsak m/kodeverifisert nå-rapport først
   (Byggeplass-modellens faktiske felter og alle velger-/filter-lesere). Første
   reelle bruk av det reserverte «arkiver»-ordet fra EX-navnevedtaket — derfor
   ETTER navnevedtaket, aldri før.
5. **AM 2 attestering/40-timers** — står nedprioritert med målt begrunnelse
   (§ AVSTEMT, «Ikke prioritert nå»-avsnittet). Re-vurderes når piloten fører timer.
6. **Restkø uendret:** PM interim-guard → 10a fase 2 · P2 · Del 7 · Del 8 · Del 9,
   10/K11 (+K14), K15 — begrunnelser står i eksisterende rekkefølge-tekst.

Fabels egen kø for C/D fra 04.09-morgenbestillingen: tidslinje+endringslogg-fletting
(én kronologisk logg) tas som del av EX-designsaken hvis loggvalget («Med logg/Uten
logg») berører samme utskriftsflate — ellers egen sak etter BL.

## 3) Én linje i AM-raden (del-oversikten), legg til:
`· AM 4: bolk 1+2 på test 04.09, venter fabel-designgate (DoD pkt 3)`
