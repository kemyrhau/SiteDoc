---
name: tegning-serieopplasting-spec
description: Spesifikasjon for serieopplasting av 2D-tegninger — mange filer samtidig, detaljer etterpå, tegningsnummer/type kun ved entydig treff, fag-sortering, ny revisjon på web (T1, ingen schema); deretter Tegningsserie som merk-og-flytt-gruppering med egne metadata (T2, additiv). Kenneth-krav 2026-10-06 (20 ark-tegninger lastet én og én).
sist_verifisert_mot_kode: 2026-10-07
eier: fabel (plan-eier) — orkestrator gater
status: 🟢 T1 IMPLEMENTERT 2026-10-06 (branch `feat/tegning-serieopplasting-t1`) — R1–R8 + R11 (delvis) bygget (web+api+shared, ingen schema). **T1b IMPLEMENTERT 2026-10-07 (branch `feat/tegning-t1b`):** R4 «Rediger flere»-inngangen fra tegningslista (var ikke koblet i T1) + rediger én tegning pr. rad + «vis og tilbake» (skjult overlay bevarer ulagrede endringer) + kollapsbare fag-/etasje-grupper (localStorage pr. byggeplass). **T1c IMPLEMENTERT 2026-10-07 (branch `feat/tegning-t1c`):** Fag- + Rådgiver-kolonne i detaljtabellen (redigerbar, `discipline`/`originator` via `tegning.oppdater`) + utvidet tegningsnummer-mønster for ekte 6-segments ARK-filnavn (`B3-06-A-20-31-02`). T2 (R9–R10, Tegningsserie) ❌ IKKE IMPLEMENTERT. Gate-vilkår § 6.1 (R3-mønsteret) løst: `packages/shared/src/utils/tegningMetadata.ts`. Omfang (T1 → T2) godkjent av Kenneth 2026-10-06
---

# Tegninger: serieopplasting, detaljer etterpå, serier

> Hjemmel: **Kenneth 2026-10-06:** *«jeg har 20 tegninger fra ark som skal lastes opp på en byggeplass → jeg må laste dem
> opp en og en»* · *«Hva om vi laster opp alle tegninger først og legger inn detaljer etterpå?»* · *«kan vi merke tegninger
> i UI → flytte dem inn i en mappe som en serie? … gi mapper nye navn/metadata etterpå»* · *«jeg må kunne sortere
> tegninger pr fag»* · *«tegninger revideres ikke i serier, men enkeltvis»* · *«det er ikke alle tegninger man trenger
> målestokk på»*. Omfanget T1 → T2 godkjent samme dag. **Alt under er spesifikasjon.**

## 0. Hva dette er, og ikke er

Én flyt for å få en **serie** tegninger fra én rådgiver inn på en byggeplass uten 20 modaler, og én lett gruppering
(serie) etterpå. Rører **ikke** konvertering (PDF→PNG, DWG→SVG), georeferanse, markører, Mapper-modulen (`Folder`) eller
måleverktøyet. Målestokk forblir valgfri (§ 2 R7).

## 1. Målt utgangspunkt (2026-10-06, develop `efa7807c`)

| # | Fakta | Bevis |
|---|---|---|
| T-M1 | 🔴 **Én fil pr. opplasting:** filfeltet har ikke `multiple`, `handleFilValgt` leser `files[0]`, og hver fil får sin egen modal «Tegningsdetaljer» | `oppsett/byggeplasser/page.tsx:466-472, :293-319, :645-739` |
| T-M2 | **Bare navn er påkrevd.** Nummer, fag, type, revisjon (default «A»), etasje, målestokk, opphav, beskrivelse er valgfrie. Byggeplass settes implisitt til den du står på | `page.tsx:654-705, :327`; Zod `tegning.ts:176-200`, `createDrawingSchema` `validation/index.ts:233-249` |
| T-M3 | **Ingen bulk i API:** `tegning.opprett` tar én tegning; `/api/upload` tar én fil (`req.file()`); eneste batch er `rekonverterPdf` | `tegning.ts:176-372`, `upload.ts:115`, `tegning.ts:688-779` |
| T-M4 | **Rediger-dialog finnes** (admin): navn, nummer, fag, type, etasje, status, opphav, beskrivelse. Utelater målestokk (egen flate), revisjon, utgitt-dato, byggeplass | `RedigerTegningModal.tsx:17-21, :35-45, :87-145`; `tegning.oppdater` `tegning.ts:375-400` |
| T-M5 | **Målestokk:** fritekst ved opplasting; for PDF leses side 1 med `pdftotext` og «Mål/Målestokk/Scale» gir et **forslag** (`scaleKilde = "tittelfelt"`) kun når brukeren ikke skrev noe; settes/bekreftes/kalibreres i viewer-panelet; måleverktøyet er låst til kilden er `manuell`/`kalibrert`/`georeferanse`. DWG: ingen utledning | `tegning.ts:49-56, :340-342`, `maaling.ts:50-65, :126-134, :142-155`, `tegninger/page.tsx:862-882, :1163-1250` |
| T-M6 | **Metadata fra fil leses ikke** for tegninger: 0 treff `getMetadata`/XMP/exif/tittelblokk i api, web, shared. `pdfinfo` brukes til papirstørrelse, `pdftotext` kun til målestokk. IFC: `trekUtIfcMetadata` fyller fag/opphav hvis tomme | agent-måling 2026-10-06; `tegning.ts:35-56, :293-316` |
| T-M7 | **Lister:** `DRAWING_DISCIPLINES` (ARK, LARK, RIB, RIV, RIE, RIG, RIBr, RIAku) og `DRAWING_TYPES` (plan, snitt, fasade, detalj, oversikt, skjema, montering) finnes i shared; i DB er begge `String?` | `validation/index.ts:213-231`, `schema.prisma:899-900` |
| T-M8 | **Sortering:** `hentForByggeplass` sorterer fag → nummer; `hentForProsjekt` filtrerer på fag/byggeplass; panelet grupperer bygning → etasje, søk treffer fag | `tegning.ts:111-151`, `TegningerPanel.tsx:50-110` |
| T-M9 | **Revisjon er pr. tegning og modellert:** `Drawing.revision/version` + `DrawingRevision`-historikk + `lastOppRevisjon` (arkiverer, oppdaterer fil). 🔴 **Ingen web-kaller** — eneste treff er en kommentar. Ny revisjon må i dag lastes som ny tegning | `schema.prisma:901-902, :1020`, `tegning.ts:403-452`, `RedigerTegningModal.tsx:20` |
| T-M10 | **Ingen gruppering av tegninger finnes.** `Folder` er Mapper-modulens (dokumenter, tilgang, språk), kun relasjon til `FtdDocument`; `Drawing` har ingen mappe/serie-felt | `schema.prisma:1572-1596`, `model Drawing :893-935` |
| T-M11 | Lagring: `uploads/<uuid><ext>`, 500 MB-grense; PDF → PNG 200 DPI asynkront, `fileUrl` byttes til PNG | `upload.ts:133-171`, `server.ts:105-107`, `tegning.ts:329-355` |

## 2. Reglene

| # | Regel | Lukker |
|---|---|---|
| **R1** | 🔴 **Mange filer, ett skjema.** Filfeltet får `multiple` (samme `accept`). Ett skjema «Tegningsserie» for hele utvalget med **felles felt satt én gang**: fag, rådgiver/opphav, etasje (valgfritt), byggeplass (den du står på, kan endres). Revisjon er **ikke** felles-felt — den står pr. rad (T-M9) med «A» som default pr. tegning | T-M1 |
| **R2** | **Last opp først, detaljer etterpå.** Hver fil opprettes straks som tegning med `name` = filnavn uten endelse, status `utkast`, felles-feltene fra R1, og **ingenting annet**. Raden er gyldig (T-M2). Detaljene fylles i en tabell (R4) — nå eller senere | Kenneth |
| **R3** | 🔴 **Forhåndsutfylling kun ved entydig treff — ellers tomt.** Kilder i rekkefølge: (a) filnavn, (b) PDF-`Title` (`pdfinfo`), (c) tittelfelt-tekst side 1 (`pdftotext`, finnes alt). **Tegningsnummer:** ett mønster `^[A-Z]{1,4}[- ]?\d{2,3}[- ]?\d{2,4}` (ARK-konvensjon «A-20-101», «ARK-P-101») i filnavn eller Title; to ulike treff = tomt. **Type:** ordtreff på `DRAWING_TYPES`-navn (plan/snitt/fasade/detalj/oversikt/skjema/montering) i filnavn/Title/tittelfelt; flere ulike = tomt. **Fag:** kun fra felles-feltet (R1), aldri gjettet. Alt forhåndsutfylt merkes «foreslått» i tabellen til brukeren lagrer raden; **ingenting skrives til `Drawing` før brukeren har sett tabellen** (forslagene lever i klienten). Mønstrene bor i shared `tegningMetadata.ts` (rene funksjoner, testet) | Kenneth: «hvis det er usikkert → ikke fyll ut» |
| **R4** | **Etterfyllings-tabell:** én rad pr. tegning med navn, nummer, type, revisjon, etasje, målestokk (valgfritt), status pr. fil (laster/konverterer/feilet/klar) og «Prøv igjen» pr. fil. Lagring pr. rad via dagens `tegning.oppdater` (T-M4 → feltene finnes). Tabellen kan åpnes igjen senere fra tegningslista («Rediger flere»): samme komponent, samme mutasjon | Kenneth |
| **R5** | **Parallell opplasting mot dagens endepunkter** — ingen ny bulk-prosedyre: `POST /api/upload` × N (maks 4 samtidig), `tegning.opprett` × N. Feil på én fil stopper ikke de andre; feilede rader står i tabellen med årsak. DWG med flere layouts gir flere rader som i dag (T-M11) | T-M3 |
| **R6** | **Sortering pr. fag:** tegningslista får gruppering **byggeplass → fag → (serie, T2) → tegningsnummer** som standard, med veksel til dagens etasje-gruppering. Fag uten verdi grupperes sist som «Uten fag». Ingen ny prosedyre: `hentForByggeplass` sorterer alt fag → nummer | T-M8 |
| **R7** | **Målestokk er valgfri, og ingen flate maser.** Ikke påkrevd i R1/R4; tittelfelt-forslaget lagres som i dag (`scaleKilde = tittelfelt`) og vises stille i viewer-panelet; måleverktøyet ber om målestokk **første gang noen vil måle** på akkurat den tegningen (dagens `kanMale`-lås, uendret). Ingen banner, ingen «mangler målestokk»-liste | Kenneth: «ikke alle tegninger trenger målestokk» |
| **R8** | 🔴 **Ny revisjon på web** (T-M9): «Last opp ny revisjon» på tegningens rad og i rediger-dialogen → `lastOppRevisjon` (finnes). Serveren må **starte konvertering** for den nye fila (PDF→PNG / DWG→SVG) på samme vei som `opprett` — i dag gjør `lastOppRevisjon` det ikke (T-M9) → ny revisjon ville vist gammel PNG. Revisjonskode foreslås som neste bokstav, redigerbar. Revisjon er alltid pr. tegning — aldri på serie | T-M9 |
| **R9** | **T2 — Tegningsserie:** ny modell `Tegningsserie` (`id, projectId, byggeplassId?, name, discipline?, originator?, description?, createdAt, updatedAt`) + `Drawing.serieId String?` (FK, `onDelete: SetNull`). **Tom `serieId` = «ikke i serie» — gyldig tilstand** (som standalone-prosjekt), ingen backfill; DB-garanti = FK + `@@index([serieId])`; test (c) = sletting av serie nuller koblingen, aldri tegningen. **Merk-og-flytt:** avkryssing i lista → «Ny serie fra valgte» (navn foreslått = felles fag + rådgiver) / «Flytt til serie» / «Ta ut av serie». Serien kan få nytt navn og metadata etterpå | Kenneth: «mapper som serie» |
| **R10** | **Seriens metadata er standardverdier, aldri stille overstyring:** nye tegninger lastet inn i en serie får seriens fag/rådgiver/byggeplass som forslag i R1. Å skrive seriens verdier på eksisterende tegninger er en eksplisitt knapp «Bruk på alle i serien» med telling («12 tegninger får fag ARK») — ingen automatikk. Serien har **ikke** revisjon, målestokk eller status | Kenneth: «revideres enkeltvis» |
| **R11** | **Byggeplass:** opplasting skjer i byggeplass-kontekst (som i dag); «Flytt til byggeplass» finnes for valgte tegninger (`tilknyttByggeplass` finnes, `tegning.ts:468`). Smart utledning av byggeplass fra fil gjøres **ikke** (ingen pålitelig kilde) | Kenneth: «sortere pr byggeplass smart» |

## 3. Leveranser

- **T1-W (web):** R1 flervalg + felles-skjema · R2/R4 tabell (ny komponent `TegningSerieTabell`, gjenbrukes fra lista
  som «Rediger flere») · R3 forhåndsutfylling fra filnavn/Title (Title hentes fra ny lesing i `opprett`-svaret, se T1-A)
  · R5 parallell kø m/ fremdrift · R6 fag-gruppering + veksel · R8 «Last opp ny revisjon» · R7 ingen nye målestokk-krav.
  i18n ×15.
- **T1-A (api):** `opprett` returnerer `metadataForslag: { drawingNumber?, drawingType?, kilde }` fra shared
  `tegningMetadata.ts` anvendt på filnavn + `pdfinfo`-Title + eksisterende `pdftotext`-tekst — **skrives ikke** på raden
  (R3) · `lastOppRevisjon` starter konvertering (R8) · ingen nye prosedyrer ellers.
- **T1-S (shared):** `tegningMetadata.ts`: `finnTegningsnummer(tekster[]) → string|null`, `finnTegningstype(tekster[]) →
  DrawingType|null` — rene, «to ulike treff = null», testet (§ 4).
- **T2 (db + api + web):** R9 migrering (additiv, to-stegs ikke nødvendig: nye objekter) · prosedyrer `tegningsserie.
  opprett/oppdater/slett/flyttTegninger` · `hentForByggeplass` inkluderer `serieId` + serier · lista grupperer fag →
  serie · merk-og-flytt · «Bruk på alle i serien» (R10).

## 4. Tester som skal FEILE (DoD)

1. Filfeltet uten `multiple` / `handleFilValgt` leser bare `files[0]` (T1-W) · 2. `finnTegningsnummer(["A-20-101_Plan 1 etg.pdf"]) ≠ "A-20-101"`; `["A-20-101.pdf","ARK-P-102"]` (to ulike) ≠ `null`; `"Fasade nord.pdf"` ≠ `null` · 3. `finnTegningstype(["Plan 2. etasje"]) ≠ "plan"`; `["Plan og snitt"]` ≠ `null` · 4. `opprett` **skriver** `drawingNumber`/`drawingType` fra forslaget (skal: kun returnere `metadataForslag`) · 5. én feilet fil av fem stopper de fire andre (skal: fire `klar`, én `feilet` m/ «Prøv igjen») · 6. etterfyllings-tabellen sender et felt brukeren ikke rørte (skal: kun endrede felt, `byggRedigerTegningInput`-mønsteret) · 7. R7: en ny banner/tekst «mangler målestokk» dukker opp noe sted (grep-vakt på nøkkel) · 8. `lastOppRevisjon` etterlater `fileUrl` på gammel PNG / starter ikke konvertering for PDF/DWG (skal: samme konverteringsvei som `opprett`) · 9. revisjons-felt eller -knapp på serie (skal: finnes ikke) · 10. T2: sletting av serie sletter tegninger (skal: `serieId = null`) · 11. T2: «Flytt til serie» endrer tegningens fag/rådgiver (skal: urørt uten «Bruk på alle») · 12. T2: `hentForByggeplass` returnerer tegninger uten `serieId`-felt (skal: med, null tillatt).

## 5. Ordre (anbefaling)

| Ordre | Innhold | Avhenger av | Migrering |
|---|---|---|---|
| **T1** | T1-S + T1-A + T1-W (én ordre, web+api+shared, ingen schema) | ingen | — |
| **T2** | Tegningsserie (R9–R10) | T1 merget (tabell og gruppering gjenbrukes) | `packages/db` additiv (`tegningsserier` + `drawings.serie_id`) |

**T1 først.** Den fjerner de 20 modalene og gir detaljer-etterpå uten en eneste schema-endring; T2 legger grupperingen oppå.

## 6. Åpne punkter

1. **Mønsteret for tegningsnummer (R3)** er skrevet for ARK-konvensjon. Andre rådgivere (RIB «B-xx», RIE «E-xx») treffer
   samme regex; eksotiske nummerserier gir tomt — det er ønsket atferd. Utvides når målt mot ekte filnavn fra Kenneth.
   🔴 **GATE-AVVIK (orkestrator 2026-10-06), løses i T1:** mønsteret `^[A-Z]{1,4}[- ]?\d{2,3}[- ]?\d{2,4}` treffer **ikke**
   specens eget eksempel «ARK-P-101» (bokstavsegmentet «P» passer ikke inn), og ankeret `^` gjør at et nummer midt i et
   filnavn («20251001_A-20-101.pdf») eller midt i tittelfelt-teksten aldri treffes. Konsekvens: test 2 («A-20-101.pdf» +
   «ARK-P-102» → `null`) kan ikke bli grønn, fordi bare det ene nummeret treffes. **Vilkår for T1:** mønsteret skal treffe
   alle eksemplene i § 2/§ 4 (også «ARK-P-101») uten `^`-anker (ordgrenser i stedet), og testene skal ha med ett
   nummer midt i et filnavn og ett i tittelfelt-tekst.
   🟢 **LØST T1 2026-10-06** (`packages/shared/src/utils/tegningMetadata.ts`): `TEGNINGSNUMMER_MONSTER` =
   `(?<![A-Za-z0-9])[A-Z]{1,4}-(?:[A-Z]|\d{1,3})-\d{1,4}(?![A-Za-z0-9])` med `g`-flagg — tre bindestrek-separerte
   segmenter (fagprefiks · bokstav ELLER sifre · løpenummer), ordgrenser via lookbehind/lookahead (ikke `^`).
   Treffer «A-20-101», «ARK-P-101», nummer midt i filnavn («20251001_A-20-101.pdf») og i tittelfelt-tekst; to ulike
   treff → `null`. Bindestrek kreves mellom segmentene så «PLAN A-20» (mellomrom) ikke gir falskt treff. 14 tester i
   `tegningMetadata.test.ts`.
   🟢 **UTVIDET T1c 2026-10-07** mot Kenneths ekte ARK-filnavn («B3-06-A-20-31-02 Himlingsplan …», 6-segments firma-kode):
   `TEGNINGSNUMMER_MONSTER` = `(?<![A-Za-z0-9])[A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4}){2,6}(?![A-Za-z0-9])` med `g` — 3–7
   bindestrek-separerte segmenter à 1–4 tegn (STORE bokstaver/sifre). Småbokstavsord treffer aldri (ingen `i`-flagg).
   Kravet om BÅDE bokstav og siffer i treffet håndheves i `finnTegningsnummer` (stenger dato «2025-10-07» og rene
   bokstavs-løp «AS-IS-X»). Alle T1-tester fortsatt grønne; 9 nye (5 ekte filnavn, en-dash-uten-nummer, dato, bokstavs-løp,
   to ulike firma-koder). 23 tester totalt.
   ⚠️ **TYPE-FORSLAG, meldt ikke endret (T1c):** `finnTegningstype` bruker `\bplan\b` (helt ord), så sammensatte
   «Himlingsplan»/«Møbleringsplan»/«Gulvbehandlingsplan»/«Fallplan» gir INGEN type i dag. De ER semantisk planer;
   redesign anbefaler å la «…plan»-suffiks gi `plan`, men endret det IKKE i T1c (ordren: mål og meld, ikke endre uten
   klarsignal — det endrer forslaget og må gates av Kenneth/fabel).
2. **Sletting av tegninger etterlater filer på disk** (BACKLOG :958) blir mer synlig med 20 om gangen — ikke del av T1.
3. **DWG-tittelblokk** parses ikke (T-M6). Kan gi nummer/type for DWG senere; T1 gir tomt for DWG utover filnavn.
