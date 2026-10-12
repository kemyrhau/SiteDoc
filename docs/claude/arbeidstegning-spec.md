---
name: arbeidstegning-spec
description: Produktspesifikasjon for arbeidstegning — DWG/DXF som verktøy på byggeplassen, ikke som bilde. Brukerhistorier (fagarbeider, bas, prosjektleder), sju funksjoner merket MÅ/BØR/KAN med akseptkriterier som kan kjøres på Kenneths tre ekte filer, avgrensning, seks spørsmål til Kenneth. Teknisk vei (A: ezdxf-SVG + egenskapsregister · B: DXF på klient) velges IKKE her — den avgjøres av Dokgens målte prøve mot § 3.
sist_verifisert_mot_kode: 2026-10-12
eier: fabel (plan-eier) — orkestrator gater spec; kode-ordrer gates av Kontrollør (§ 0 én gate)
status: ⚠️ UTKAST TIL GATE (2026-10-12) — ingenting under er bygget. Q1–Q6 til Kenneth.
---

# Arbeidstegning — DWG/DXF som verktøy, ikke bilde

> Hjemmel: **Kenneth 2026-10-12:** *«ved innzooming kan det være nødvendig å laste mer detaljer dersom brukeren trenger zoom
> for å skille ulike rør og materialer fra hverandre → det er nettopp poenget med en tegning → man skal se hva som skal
> utføres på byggeplass. DWG inneholder også metadata på linjer og objekter. disse bør også være klikkbare og kunne hentes
> opp. jeg hadde håpet dxf-sporet ville lede til det detaljerte grensesnittet som gjør dwg/dxf nyttig vs PDF»* + *«ja»* til
> spesifikasjon før noe mer bygges. Ordre: orkestrator 2026-10-12 (`relay/inbox-fabel.md`).

## 0. Hva dette er, og ikke er

Dette er **hva byggeplassbrukeren skal kunne gjøre** med en DWG/DXF-tegning på telefon og PC, med krav som kan testes på de
tre ekte filene i `DWG eksempelfiler/` (fixtures i `apps/api/test-fixtures/dwg/`). Den **velger ikke** teknisk vei. A (ezdxf-SVG
+ egenskapsregister) mot B (DXF tegnet på klient) avgjøres av Dokgens målte prøve mot akseptkriteriene i § 3. Bygger på
[tegning-dwg-spec.md](tegning-dwg-spec.md) (konvertering, enheter, layouts, strek) og rører ikke 3D/IFC/punktsky, PDF-veien
eller tegningsserie (T2).

## 1. Målt utgangspunkt (2026-10-12)

### 1a. Viseren i dag

| # | Fakta | Bevis |
|---|---|---|
| AT-M1 | **Klikk på objekt** (web, modus «Inspeksjon») viser bare *Lag · Type · Tekst*, lest fra `data-layer`/`data-type`/`textContent` på det trufne elementet. Ingen blokk, attributt, materiale, farge, lengde eller stabil id | `tegninger/page.tsx:1149-1168, :2450-2480` |
| AT-M2 | **Lagliste / lag av-på finnes ikke.** Eneste «lagfilter» er markørtyper (oppgaver/kontrollpunkter) + periode | `page.tsx:226-231, :1868-1898`; `grep -i layer` → kun CSS/inspeksjon |
| AT-M3 | **Søk i tegningen finnes ikke** (0 treff utover URL-param) | `page.tsx:236-244` |
| AT-M4 | **Måling:** linjal/polylinje/areal + 90°-lås + referanselinje + snap. `beregnSnap` snapper **kun mot egne målepunkter**, aldri mot tegningsgeometri (0 treff `getPointAtLength`/`isPointInStroke`/`elementFromPoint`). Målinger lagres ikke | `page.tsx:1754-1820, :971-1003`; `maaling.ts:595-635` |
| AT-M5 | **Markører = felt på dokumentet** (`Task`/`Checklist`/`KontrollplanPunkt`: `drawingId`, `positionX/Y` i %). Ingen markørtabell, ingen objektreferanse. Oppgave opprettes fra klikk (web+mobil), sjekkliste bare på web. **Sjekklister med posisjon vises ikke på tegningen.** Ingen avviks-/notatmarkør. Områder: `Omrade.polygon` | `schema.prisma:1377-1379, :1468-1470, :2600-2602, :1162-1185`; `page.tsx:1172-1278, :226-228`; `lokasjoner.tsx:555-618` |
| AT-M6 | **Zoom** 0,25–50 (web), bredde `zoom·100 %` på inline-SVG; strek dempes `zoom^0,5` klemt 0,5–4 px. Mobil: nettleser-pinch til 50×, demping ved settle | `page.tsx:150-152, :2219-2239, :588-602`; `TegningsVisning.tsx:188, :269-291` |
| AT-M7 | **Mobil har ingen objektklikk**, og mobilvarianten er farge-gruppert uten `data-layer` (vedtak C2: 12 775 mot 59 958 noder, pinch 39,6 mot 7,7 fps). Lupe er RN-overlay, bare i måling/flytt | `dwgKonvertering.ts:2293-2298`; `TegningsVisning.tsx:409, :706-751` |
| AT-M8 | **Offline:** tegningsfil lastes ned til `sitedoc-tegninger/`, men viseren leser alltid server-URL; `hentTegningLokalSti` har 0 brukere; «Forbered til offline»-menyen har tom handler. Måling bare med nett | `offlineKlargjoring.ts:55-112`; `lokasjoner.tsx:477-478`; `BACKLOG.md:57-59`; `mobil.md:320` |
| AT-M9 | **Stabil objekt-id finnes ikke i SVG-en:** `render.py` leser DXF-handle for å utlede type, men skriver ikke `data-handle` (0 treff). **Laginventar lagres ikke i DB** — `konverteringRapport` har bare `parsetPrType/tegnetPrType/ikkeTegnet` + `markor` | `render.py:80, :203-208, :479-513`; `dwgKonvertering.ts:950-971, :1364-1372` |
| AT-M10 | Tegningssiden har **ingen hjelpetekst** (?-ikon); bare tooltip-nøkler `maaling.*Hjelp` | `nb.json:1670-1678`; `grep HjelpKnapp tegninger/` → 0 |

### 1b. Hva de tre ekte filene faktisk bærer (ezdxf 1.4.4 på `dwg2dxf -y`-DXF, lokalt 2026-10-12)

| # | Fil | Fakta |
|---|---|---|
| AT-F1 | **Fallplan (ArchiCAD-eksport, AC1032, mm)** 24 074 entiteter, **55 lag i bruk**. Lagnavn bærer **NS 3451-bygningsdel** («231- Bærende yttervegger», «242- Ikke-bærende innervegger», «315- Utstyr for sanitærinstallasjoner») og **IFC/AIA-kategori** («A-WALL», «S-COLS», «P-SANR-FIXT» = sanitærutstyr, 7 847 el.). Suffiks «(Skravur)» / «(Nye konstruksjoner)» skiller flate fra kontur og nytt fra eksisterende. **60 rom som blokker med attributter `ROOM_NAME`/`ROOM_NUMBER`** («LAB. 12», «6V-18.03»). **Skravurmønster = materiale:** `Betong_strukturell` 413, `Gips` 183, `Lettklinker` 25, `Trefiber` 2, `Skrålinjer_1` 4 868, `Prikker_tett` 2 833. 37 MTEXT: koter («+42 000») og fallvinkler («1,35°»), 24 LEADER. Linjetyper i bruk: `Under snittplan`, `01 Stiplet 1 PKA`. **Alle entiteter ACI 7 / ByLayer-lw** (CTB-funn, lukket). 0 XDATA, 0 hyperlenker |
| AT-F2 | **Utomhus UTM32 (AC1032, m)** 749 entiteter, **29 lag**. Objekttypen ligger i lagnavnet med SOSI-liknende kode: «8250 Kum» 69, «8253 Sluk_rist» 30, «6013 Annet gjerde» 63, «88 Lampearmatur» 18, «5051 TrappBygg» 70, «7038 Topp kantstein forkant/bakkant». Ingen blokker, ingen tekst, 0 XDATA. Farge pr. entitet (8 ACI-verdier) |
| AT-F3 | **NTM6 (AC1032, m)** 761 entiteter på **ett lag «Diverse»**, skilt bare med farge (ACI 142/31/232/132 …). Hver entitet har extension dict `AEC_PROPERTY_SETS` (AutoCAD Architecture/Civil 3D egenskapssett, 3 definisjoner), men **libredwg 0.14 melder «Unhandled Class object AEC_PROPERTY_SET_DEF»** → settene finnes ikke i DXF-en. 🔴 Egenskapene går tapt i kjeden vår uansett vei A/B |
| AT-F4 | **Ingen av filene er MEP** (rør/kanaler/kabler fra MagiCAD/Revit). «Skille rør» er Kenneths hovedeksempel, men ingen fil med rørobjekter er målt. Blokk-/XDATA-rikdom på slike filer er ukjent → Q1 |

**Konsekvens:** på ekte filer kommer «hva er dette?» fra **lagnavn (fag/bygningsdel/objekttype), blokknavn + attributter
(rom), skravurmønster (materiale), tekst og linjetype** — ikke fra XDATA eller egenskapssett. Det er disse kildene § 3 bygger på.

## 2. Brukerhistorier

**Fagarbeider (telefon, står på plassen):** «Jeg står i rom 6V-18.03. Hvilken vegg er lettvegg, hvilken er betong? Hva er
kotehøyden her? Jeg vil trykke på veggen og få svar, og legge inn avviket på akkurat den veggen.» I dag: zoomer til streken
blir en svart bjelke, gjetter ut fra form, og setter markøren på et punkt som ikke vet hva det peker på.

**Bas/formann (telefon + PC):** «Vis meg bare rør-/sanitærlaget og veggene, resten av fagene forstyrrer. Finn rom 6W-20.01.
Hvor mange meter er denne veggen? Hvilke oppgaver henger på dette rommet?» I dag: ett bilde med alt, ingen filtrering,
søk finnes ikke, måling snapper ikke til veggen.

**Prosjektleder (PC):** «Tegningen kom i ny revisjon. Hva ligger av oppgaver og sjekklister på objekter som er endret? Legg
sjekklisten på rommet, ikke på et punkt.» I dag: sjekklister med posisjon vises ikke engang på tegningen (AT-M5).

**Hva en PDF gjør dårlig her:** en PDF er et utskriftsbilde. Ingen lag (eksport med PDF-lag er sjelden), ingen objektidentitet,
ingen attributter, strektykkelse låst til utskriftsmålestokk (tynn strek blir usynlig på telefon, tykk blir klump), ingen
enheter (krever kalibrering), søk bare om teksten er vektor. DWG bærer alt dette — hvis viseren bruker det. Gjør den ikke
det, er DWG **dårligere** enn PDF: like flatt, pluss konverteringsfeil (`tegning-dwg-spec.md` RETUR 1–6).

## 3. Funksjoner, prioritert, med akseptkriterier

Hvert kriterium kjøres på **fallplanen** (ARK, mm) og/eller **UTM32** (utomhus, m). «Telefon» = iPhone WebKit 390×844
(Kenneths telefon eller Playwright-WebKit-bevis som i C2). Kriterier merket **[A/B-prøve]** er de Dokgens prøve måles mot.

### F1 — Trykk på objekt → egenskaper · **MÅ** (web + mobil)

- Trykk/klikk på en strek, flate eller tekst viser et egenskapskort. **Felt, i denne rekkefølgen, bare de som har verdi:**
  1. **Hva** — tolket fra lagnavn: bygningsdel (NS 3451-kode + navn), objekttype (SOSI-kode + navn) eller IFC-kategori; rå lagnavn alltid synlig under
  2. **Rom/blokk** — blokknavn + attributter (`ROOM_NAME`, `ROOM_NUMBER`, …) når objektet er, eller ligger i, en blokk
  3. **Materiale** — skravurmønster oversatt («Betong_strukturell» → Betong), rå navn under
  4. **Tekst** — TEXT/MTEXT/ATTRIB-innhold
  5. **Mål** — lengde (strek) / areal (lukket flate) i tegningens enheter, **bare når `kanMale`** (`scaleKilde="dwg"`); ellers skjult, ikke «—»
  6. **Linjetype / farge** — bare når de avviker fra laget (ByLayer skjules)
  7. **Status** — «eksisterende» / «nytt» når lagnavnet bærer det («(Nye konstruksjoner)»)
- Kortet har én handling: **«Opprett her»** (→ F5). Ingen redigering av egenskaper.
- Trefftoleranse: minst 12 px (web) / 20 px (telefon) rundt streken, samme regel som inspeksjons-CSS-en (AT-M1), uavhengig av zoom.
- **Akseptkriterier:**
  - A1 Fallplan, web: klikk på en vegg på laget «242- Ikke-bærende innervegger» → kortet viser «Ikke-bærende innervegger · 242» og rå lagnavn.
  - A2 Fallplan: trykk på romstemplet «LAB. 12» → `ROOM_NAME = LAB. 12`, `ROOM_NUMBER = 6V-18.03`.
  - A3 Fallplan: klikk i en skravert flate med `Gips` → Materiale «Gips»; med `Betong_strukturell` → «Betong».
  - A4 UTM32: klikk på en kum → «Kum · 8250»; på et lampepunkt → «Lampearmatur · 88».
  - A5 Fallplan, **telefon** **[A/B-prøve]**: A1–A3 gjentatt med trykk; svar innen 300 ms etter trykk.
  - A6 Negativ: klikk i tomrom → ingen kort, ingen feil.
  - A7 NTM6: klikk → «Diverse» + farge; **ingen** AEC-egenskaper (AT-F3) — dokumentert tap, ikke bug.
- **Objektidentitet:** hvert objekt skal kunne refereres stabilt innen samme revisjon (DXF-handle, AT-M9). Kreves av F3/F5. Ved ny revisjon er identitet ikke garantert bevart (CAD-verktøy gir nye handles) — F5 håndterer det.

### F2 — Lag/fag av og på · **MÅ** (web + mobil)

- Lagpanel med to nivåer: **gruppe** (tolket: bygningsdel/fag/IFC-kategori, f.eks. «23 Yttervegger», «24 Innervegger», «31 Sanitær», «Skravur», «Tekst og mål», «Modullinjer») → **rå lag** under. Tolkningsregler: NS 3451-prefiks (2–3 siffer + «-»), AIA/IFC-prefiks (`A-`/`S-`/`P-`/`I-`/`Q-`), SOSI-kode (3–4 siffer + mellomrom), suffiks «(Skravur)»/«(Tekst)»/«(Nye konstruksjoner)». Lag uten treff → gruppe «Andre» med rå navn.
- Av/på pr. gruppe og pr. lag; «Bare dette»; «Alle på». Antall objekter pr. lag synlig.
- Oppsettet huskes pr. tegning på enheten (Q4 avgjør om det skal deles).
- **Akseptkriterier:**
  - B1 Fallplan: 55 lag i panelet, gruppert; slå av «242- Ikke-bærende innervegger» → de 258 + 169 (Skravur) elementene forsvinner; på igjen → tilbake. Måles ved telling av synlige elementer.
  - B2 Fallplan: «Bare dette» på «P-SANR-FIXT-OTLN» → bare sanitærutstyret (7 847 el.) vises.
  - B3 UTM32: slå av gruppe «Kummer og sluk» (8250/8253) → 99 elementer borte.
  - B4 **Telefon** **[A/B-prøve]**: B1 på fallplanen; bytte synlig innen 500 ms; pinch etterpå ≥ 30 fps (C2-målemetode).
  - B5 Lagvalget overlever bytte til annen tegning og tilbake (samme enhet).
  - B6 Markører (F5) følger ikke lag — de vises uansett.

### F3 — Søk etter objekt/system · **BØR** (web MÅ, mobil BØR)

- Ett søkefelt over tegningen: treffer **tekst** (TEXT/MTEXT/ATTRIB), **blokknavn/attributter** (romnummer) og **lagnavn**. Treff listes med type; valg sentrerer og markerer objektet, lag slås på om det er av.
- **Akseptkriterier:**
  - C1 Fallplan: søk «6V-18.03» → ett treff (rom) → viseren sentrerer på romstemplet og fremhever det.
  - C2 Fallplan: søk «+42 080» → kote-teksten, sentrert.
  - C3 Fallplan: søk «sanitær» → lag «315- Utstyr for sanitærinstallasjoner» + «P-SANR-FIXT» som lagtreff.
  - C4 UTM32: søk «kum» → lagtreff 8250/8253 (ingen tekst i fila).
  - C5 Søk uten treff → «Ingen treff», ingen feil.

### F4 — Detaljnivå ved zoom · **MÅ**

Dette er Kenneths kjernekrav: *«man skal se hva som skal utføres»*. Reglene (fra `tegning-dwg-spec.md` C1/C2) presiseres som krav, uavhengig av vei:

- **Oversikt (zoom ≤ 1):** alle konturer synlige; skravur og tekst under 3 px høyde kan utelates/forenkles for ytelse.
- **Arbeid (zoom 2–10):** skravurmønster skiller materialer (Gips ≠ Betong ≠ Lettklinker), dobbeltlinje i vegg er to linjer, tekst lesbar, linjetype (stiplet «Under snittplan») synlig som stiplet.
- **Detalj (zoom > 10):** ingen strek tykkere enn 4 px, ingen tynnere enn 0,5 px (gjeldende klem), ingen «svart klump» (RETUR 5 TILLEGG 2-saken).
- Aldri vise en «enklere» tegning enn kilden ved arbeids-/detaljnivå. Hvis klienten laster mer detaljer ved zoom, skal det skje uten synlig hopp i posisjon (BACKLOG `:5932`).
- **Akseptkriterier:**
  - D1 Fallplan, telefon, 400 % på en gipsvegg ved betongvegg **[A/B-prøve]**: skravurene er forskjellige og veggens to konturlinjer er atskilte (bevisbilde som `relay/ezdxf-visning/`).
  - D2 Fallplan, 1 000 %: maks strekbredde ≤ 4 px, målt i DOM/canvas.
  - D3 Fallplan, telefon: pinch fra 100 % → 800 % → 100 %, ingen frame under 30 fps ved settle, ingen posisjonshopp > 2 px **[A/B-prøve]**.
  - D4 Stiplet linjetype vises stiplet ved arbeidsnivå (i dag ukjent — motoren må måles).
  - D5 Fil-/minnebudsjett på telefon **[A/B-prøve]**: fallplanen med objektklikk (F1) og lag (F2) ≤ 3 s til første visning på 4G og ≤ 150 MB JS-heap. (C2 målte 9,3 MB/59 958 noder → 29 MB heap, pinch 7,7 fps for den ugrupperte SVG-en; det tallet er gulvet veien må slå.)

### F5 — Kobling til oppgave / sjekkliste / avvik fra et objekt · **MÅ** (oppgave, sjekkliste) · **BØR** (HMS/avvik)

- «Opprett her» på egenskapskortet (F1) oppretter oppgave (web+mobil), sjekkliste (web; mobil BØR) eller HMS-sak via dagens flyt (`opprettFraTegning.ts`), med **objektreferanse** i tillegg til posisjon: `{handle, lag, tekst/attributt, revisjon}`. Posisjon settes til objektets midtpunkt (strek: midt på; flate: sentroid; blokk: innsettingspunkt).
- Dokumentet viser referansen i klartekst («Vegg · 242 Ikke-bærende innervegg · rom 6V-18.03»).
- Fra objektet: egenskapskortet lister dokumentene som peker på det (antall + åpne).
- **Sjekklister med posisjon vises på tegningen** (lukker AT-M5-hullet) med egen lagbryter, som oppgaver/kontrollpunkter i dag.
- **Ny revisjon:** referansen beholder `handle` + lag + tekst; hvis handle ikke finnes i ny revisjon, vises markøren på lagret posisjon med merke «objekt ikke gjenfunnet i rev. X» — aldri slettet, aldri stille.
- **Akseptkriterier:**
  - E1 Fallplan, web: klikk vegg → «Opprett oppgave» → oppgaven har `drawingId`, posisjon på veggens midtpunkt og objektreferanse med lag «242- …». Test som feiler når referansen er tom.
  - E2 Samme på telefon for oppgave.
  - E3 Klikk på veggen igjen → kortet viser «1 oppgave» og åpner den.
  - E4 Sjekkliste opprettet med posisjon vises som markør på tegningen (web + mobil); test som feiler i dag (AT-M5).
  - E5 Ny revisjon av fallplanen lastes opp → eksisterende oppgave beholder posisjon; hvis handle finnes, følger den objektet; hvis ikke, merkes den. Test med en DXF der ett handle er fjernet.
  - E6 Objektreferanse er **tilleggsfelt**; dokumenter uten referanse (alle dagens) fungerer uendret.

### F6 — Måling og snap mot objekter · **BØR** (web) · **KAN** (mobil)

- Snap mot tegningsgeometri: endepunkt, midtpunkt, nærmeste punkt på strek, skjæring mellom to streker; tydelig snap-indikator; kan slås av (dagens bryter). Egne målepunkter + referanselinje snapper som i dag.
- Mål fra kortet (F1 felt 5) uten å tegne: strek → lengde; lukket polylinje/skravur → areal + omkrets.
- **Akseptkriterier:**
  - G1 Fallplan (mm, `scaleKilde="dwg"`): linjal med snap mellom to vegg-endepunkter gir samme lengde som DXF-koordinatene (±0,5 % — `kanMale`-vei fra D5).
  - G2 Fallplan: areal fra kortet på en `862- M___Nettoareal`-polylinje = polylinjens beregnede areal (±0,5 %).
  - G3 Snap slått av → ingen snap mot geometri (negativkontroll).
  - G4 Snap i synlig utsnitt bare (dagens regel, `page.tsx:971-982`), ≤ 16 ms pr. musebevegelse på fallplanen.

### F7 — Offline · **MÅ** (vise + lag + egenskaper) · **KAN** (søk, måling)

- «Forbered til offline» på en tegning laster ned **det viseren faktisk trenger** (visningsfil + lag-/objektinventar + markører) og viseren bruker den lokale kopien når nettet mangler (lukker BACKLOG `:57-59` og den tomme handleren `lokasjoner.tsx:477`).
- F1 og F2 virker offline på nedlastet tegning; F5 oppretter i offline-kø som i dag for oppgaver.
- **Akseptkriterier:**
  - H1 Telefon i flymodus etter «Forbered til offline»: fallplanen åpner, lag kan slås av/på, trykk på vegg gir kortet. Test som feiler når viseren henter fra nett.
  - H2 Ikke forberedt + flymodus → tydelig tilstand «Ikke tilgjengelig offline» (ikke brutt bilde, jf. D8).
  - H3 Oppgave opprettet offline fra objekt synkes med objektreferanse intakt.

### Prioritert rekkefølge (anbefaling)

F1 → F2 → F4 (ytelsesgaten) → F5 → F7 → F3 → F6. F1/F2/F4 er **én** prøve hos Dokgen (A mot B) fordi de deler samme
grunnspørsmål: kan telefonen bære objektidentitet og lag på fallplanen med ≥ 30 fps? Først når den er målt, bestilles bygging.

## 4. Avgrensning — ikke med

- **Redigering av tegningen** (flytte/slette/tegne CAD-objekter, endre lagstruktur, lagre tilbake til DWG).
- Redigering av egenskaper (kortet er lesning).
- **AEC-egenskapssett / proxy-objekter** (AT-F3): tapt i libredwg; ikke forsøkt gjenopprettet.
- Paper space / layouts: følger `tegning-dwg-spec.md` D6 (klippet under hovedtegningen); F1–F7 gjelder modelspace.
- 3D/IFC, punktsky, PDF-tegninger (PDF beholder dagens bilde-vei med kalibrering; F1–F3 gjelder ikke PDF).
- Georeferanse (DWG-3/D7) og tegningsserie (T2) — egne spor.
- Sammenligning av revisjoner (visuell diff) — KAN senere; F5 E5 dekker bare at markører overlever.
- Lagring av målinger (AT-M4) — uendret, ikke i denne spec-en.

## 5. Åpne spørsmål til Kenneth (med anbefaling)

| # | Spørsmål | Anbefaling |
|---|---|---|
| Q1 | **Ingen målt fil har rør/kanaler/kabler** (AT-F4). Kan du skaffe en MEP-DWG (MagiCAD/Revit-eksport, gjerne fra samme prosjekt) før Dokgens prøve? | **Ja, nødvendig.** Uten den spesifiseres «skille rør» bare fra lagnavn. Med den måles blokk-/attributtrikdom på det Kenneth faktisk mente. Legges i `DWG eksempelfiler/` som de tre andre |
| Q2 | Lagpanel: tolkede **grupper med rå lag under** (anbefalt), eller bare rå lagnavn (55 på fallplanen)? | **Grupper + rå under.** Fagarbeideren leter etter «sanitær», ikke «P-SANR-FIXT-OTLN.IFC-standardImport». Rå navn alltid synlig så ingenting skjules |
| Q3 | **Sjekklister med posisjon på tegningen** (vises ikke i dag, AT-M5) — ta det inn i F5 som MÅ? | **Ja.** Det er et hull, ikke et valg; samme lagbryter som oppgaver |
| Q4 | Lag-oppsett: **pr. bruker på enheten** (anbefalt) eller **delt pr. tegning** for hele prosjektet? | **Pr. bruker først** (ingen schema, ingen konflikt). Delt «standardvisning» pr. tegning som KAN etterpå |
| Q5 | Objektklikk på **mobil** er MÅ i § 3. Det kan koste større nedlasting/minne enn dagens fargegrupperte variant (AT-M7). Står MÅ, med D5-budsjettet som gate? | **Ja, MÅ.** Fagarbeideren står med telefonen. D5 (≤ 3 s, ≤ 150 MB, ≥ 30 fps) er gaten; klarer ingen vei det på fallplanen, meldes det tilbake med tall før nedprioritering |
| Q6 | Offline F7: holder **vise + lag + egenskaper** (MÅ) og søk/måling KAN? | **Ja.** Måling offline krever enheter som alt ligger i tegningen, så den kan komme gratis med vei B — men ikke lov det nå |

## 6. Hva Dokgens prøve må levere (gate for valg A/B — ikke bygging)

Én prøve, begge veier om mulig, på **fallplanen** og **UTM32**, på web (Chromium) og telefon (WebKit, 390×844): tallene for
A5, B4, D1, D3, D5 i § 3 + filstørrelse pr. tegning + hvor objektidentitet (handle) og laginventar bor. Rapport som tabell,
samme form som C2-tabellen i `tegning-dwg-spec.md`. Valget tas av orkestrator/Kenneth på tallene; deretter bestilles F1/F2/F4
som første byggeordre. Ingen kode merges fra prøven.

## 7. Tester som skal FEILE i dag (DoD, uavhengig av vei)

1. SVG/klient-modell bærer stabil objekt-id pr. element (AT-M9) — fallplan: antall ider = antall tegnede entiteter.
2. Laginventar finnes pr. tegning (navn, antall, gruppe) — fallplan: 55 lag, UTM32: 29.
3. Egenskapskort for rom «LAB. 12» gir `ROOM_NUMBER = 6V-18.03` (A2).
4. Skravurmønster → materiale: `Gips` → «Gips», ukjent mønster → rå navn (A3).
5. Lag av → elementer usynlige, på → tilbake (B1).
6. Oppgave opprettet fra objekt har ikke-tom objektreferanse (E1); eksisterende oppgaver uten referanse uendret (E6).
7. Sjekkliste med posisjon rendres som markør (E4).
8. Revisjon uten handle → markør merket, ikke slettet (E5).
9. Snap mot endepunkt gir DXF-koordinaten (G1); snap av → ingen (G3).
10. Offline: viseren leser lokal kopi når nett mangler (H1); ikke forberedt → tilstand, ikke brutt bilde (H2).
11. Strek ≤ 4 px ved 1 000 % (D2) — finnes delvis (`strek-skalering.test.ts`), utvides til DOM-måling.
