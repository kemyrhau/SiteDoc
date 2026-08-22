# Designnotat — Arkivmal PDF (dokumentgenerering, spor DG)
**Fra:** fabel · **Dato:** 2026-08-21 · **Status:** til Kenneths godkjenning → deretter ordre til kode-agent
**Designreferanse:** `Arkivmal PDF Mockup.dc.html` (cowork-prosjektet «Sitedoc redesign tips», rev. 21.08 — 13 sider)

## 1. Bakgrunn (prod-funn 20.–21.08, BHO-002)
Arkiv-PDF-en taper innhold stille: brukeren ser bilde/kommentar/tegningsmarkering på web, laster ned PDF — og innholdet er borte uten varsel. I dokumentet som skal være etterprøvbart. I tillegg dekket ikke forrige mockup alle malobjekter og manglet tegningsutskrift.

## 2. Kodeverifiserte fakta (målt 21.08.2026 mot `packages/pdf`)
- `src/felt.ts` — brukes av arkivmalen via `arkivmal/innhold.ts`:
  - `location` og `drawing_position` → `return ""` (faller helt ut).
  - `info_text`, `info_image`, `video`, `quiz` → `return ""` (faller helt ut).
  - Øvrige typer rendres (inkl. weather-«Ikke registrert»-vedtaket 2026-08-16).
- `src/tegning.ts` — `byggTegningPosisjon` (oversikt + 4×-detalj med markør) **finnes ferdig**, men kalles aldri fra arkivstien.
- `arkivmal/repeater.ts` — `byggRepeaterTabell(objekt, verdi, label)` leser kun rad-arrayet. **F7:** kommentar/vedlegg festet direkte på repeater-objektet (uten «Legg til rad») tapes. Tom repeater viser korrekt «Ingen rader registrert» — men objektnivå-innholdet vises ingen steder.
- Malobjekt-universet er 26 typer (`packages/shared/src/types/index.ts`, `REPORT_OBJECT_TYPES`).

## 3. Designbeslutninger (fabel)
**D1 — F7, innhold på repeater-objektnivå:** vises som egen merket blokk **«Registrert utenfor rader»** rett OVER tabellen. Aldri som «rad 0» (forfalsker radtellingen), aldri utelatt (stille datatap). Gjelder også når repeateren HAR rader — blokken står da over tabellen med samme merking. Mockupside «Repeater F7».

**D2 — Tegninger i arkivet:** `drawing_position` rendres som oversikt + 4×-detalj per markering, gruppert per tegning — **gjenbruk `byggTegningPosisjon`**, ikke ny renderer. Dokumentnivå-lokasjon rendres **øverst i PDF-en på side 1, rett under dokumenthodet** (Kenneth 21.08). **Korrigert premiss (cowork-verifisert 21.08): dokument-lokasjon er en TEGNINGSMARKØR — drawingId + positionX/Y, ingen lat/lng, ingen server-side kartgenerator.** («Kart»-inntrykket i BEF-001 var en georeferert flyfoto-tegning.) Rendringen er derfor identisk med drawing_position: hele tegningen m/markør til venstre, 4× detaljutsnitt til høyre — **14:9; endret plassering endrer ALDRI format** (Kenneth 21.08). Tekstlinje under: bygning · byggeplass · tegningsnavn («punkt satt av hvem/når» finnes ikke som felt og utelates; kan ev. utledes fra changelog som egen sak). Gjelder ALLE dokumentklasser. Regel: **uten markering utelates hele seksjonen** — aldri tom boks. Mockupsider: sjekkliste s. 1, RUH, «Tegninger i arkivet».

**D2b — Helside tegningsprint (Kenneth-funn 21.08; REVIDERT 2026-08-22 → KUN tegning med ≥2 markører, se `velgHelsider`/D2b-ordren):** per tegning med 2+ markører skrives ÉN helside med hele tegningen i størst mulig format (roteres til liggende når tegningen er bredere enn høy) og ALLE markører nummerert mot punktnumrene, med markør→punkt-tabell under. En befaringsrapport uten tegningen er halv dokumentasjon — markørene er hele poenget med georefereringen. D2 (oversikt/detalj per punkt) supplerer helsiden, erstatter den ikke. Uten markeringer på en tegning skrives ingen tegningsside. Mockupside «Helside tegningsprint».

**D2b-utvidelse — detaljutsnitt i tabellraden** (cowork-vedtak, fabel-ratifisert 21.08): detaljen flytter fra egen blokk INN i markør→punkt-tabellen på helsiden. Rad = markør# · punkttekst · **detaljutsnitt** (· resultat kun når malen har status-kolonne — bekreftet fraværende i BEF-002). **Per-rad oversikt+detalj-blokk er AVVIST** — oversikten ville vært identisk på hver rad. **Frittstående `drawing_position` beholder blokk-formen fra D2 uendret.** REGEL: blokk-form for enkeltfelt, helside + radutsnitt for repeater-markører — to presentasjonsformer for samme felttype er vedtatt, ikke inkonsistens. Fire gates (fabel): (1) **bilde-bevisst paginering** — rad med utsnitt splittes aldri over sidegrense (20 markører → flerbords tabell); (2) **fast utsnitts-spek** — 4×-zoom, fast fysisk størrelse, crop klemt innenfor tegningskanten ved markør nær kant; (3) **moderat DPI** per utsnitt, ikke print-DPI; (4) **«gjenbruk» verifiseres** — tar utsnitts-funksjonen målstørrelse som parameter? Hvis ikke er det ny kodeflate, ikke gjenbruk. Tilhørende krav: **drawingId-innsamling REKURSIV** (ikke ett nivå ned — repeater kan nestes), flat nummerering per tegning i denne runden, negativ-test markør på tegning A + doc-lokasjon på tegning B → begge tegninger ut. Kilde: `tillegg-designnotat-arkivmal-d2b-fabel-2026-08-21.md`.

🔴 **D2b-utvidelsen DELVIS OMGJORT (Kenneth 21.08, etter å ha sett resultatet på test).** Detaljutsnittet flyttes fra helsidens markør→punkt-tabell **inn i repeater-tabellen i rapportkroppen** — «Posisjon i tegning»-cellen viser koordinattekst + croppet utsnitt under. Følger av at tegningen skal leses sammen med punktet den hører til. **Avvisningen av per-rad OVERSIKT står uendret** — det var gjentagelsen av et identisk oversiktsbilde som var innvendingen, og den gjelder fortsatt. Tre følger: (1) helsidens markør→punkt-tabell er **fjernet** som duplikat — helsiden er nå tegning + nummererte markører, nummer = radnummer i repeater-tabellen; (2) **`resultat`-kolonnen utgår** som eget begrep — repeater-tabellen viser allerede alle malens kolonner, inkludert en eventuell status-kolonne; (3) tegningssidene flyttes **inn i rapportkroppen**: innhold → tegningsside(r) → dokumenthistorikk → endringslogg → signatur. Det halvtomme arket før tegningssiden forsvinner som følge, ikke som egen fiks.

**D3 — Instruksjonstyper:** info_text/info_image vises grått som instruksjonskontekst (byggherre skal se hva utfører leste); video som referanselinje (tittel + URL); quiz som spørsmål + avgitt svar + riktig/feil — avgitt svar er dokumentasjonsdata. Mockupside «Malobjekt-revisjon» (rad-for-rad-vedtak for alle 26 typer).

**D4 — Knappenavn:** «Last ned arkiv-PDF» utgår → **«Last ned PDF»** (splittknapp). Klikk = standardvariant; pil åpner meny:
- **Med logg** (standard) — innhold, tegninger, dokumenthistorikk, endringslogg, signaturer
- **Uten logg** — innhold, tegninger, signaturer
- **Lagre i prosjektmappe** (Kenneth 21.08) — PDF-en arkiveres i dokumentmappen i prosjektet i stedet for nedlasting
- **Send til …** — e-post m/PDF-vedlegg (eksisterende funksjon flyttes hit)
Samme knapp på sjekkliste, oppgave og HMS. Mockupside «Nedlastingsvalg».

**D5 — Oppgave-PDF:** egen dokumentklasse i arkivformen (beskrivelse, ansvarlig/frist/prioritet, kilde-referanse, tegningsposisjon, dokumentasjon, opprettet/lukket-signatur). Mockupside «Oppgave-PDF».

**D6 — Samlerapporter** (startes fra listevisning, ikke enkeltdokument):
- Dokumentliste og tabellrapport (eksisterende mockupsider) — kompaktform, aldri logg/signaturblokk
- **Samlerapport blandet** — SJ + OPG + HMS i én PDF: oversikt per dokumenttype først, deretter hvert dokument i kompaktform. Mockupside «Samlerapport».
- **Sluttoppgjør — oppgaveliste** — alle tilhørende oppgaver m/kilde-kolonne (sjekklistepunkt/befaringspunkt/RUH/manuell), telleblokk lukket/under arbeid/åpen; åpne oppgaver vises rødt men blokkerer ikke utskrift. Mockupside «Sluttoppgjør».
- **Arbeidsliste håndverker (Kenneth 21.08)** — «gå ut og fiks disse»: 6 oppgaver per A4 **liggende**; per rad: oppg.nr + emne/første tekstblokk (avkortet) + første bilde + tegningsutsnitt rundt markøren — begge i opprinnelig format (4:3), ~3 cm høye — + **utført/kommentar-kolonne som fylles ut FOR HÅND** (Utført ja/nei + kommentarlinjer): listen er til håndverkere utenfor prosjektet uten SiteDoc-tilgang. Manglende bilde/markering → stiplet tom celle, raden beholder høyden. Mockupside «Arbeidsliste».
- **Excel-eksport (Kenneth 21.08)** — samme utvalg som tabellrapporten som .xlsx, **kun data** (dok.nr, tittel, status, hos, ansvarlig, datoer, punktverdier); bilder og tegninger utelates — refereres med bildeNr/tegningsnavn. Fabel-vurdering: riktig — innbakte bilder gjør regnearket ubrukelig som datagrunnlag.

**D7 — HMS-varianter:** SJA og Avvik følger samme arkivramme som RUH-siden; egne mockupsider kun hvis Kenneth ber om det.

## 4. Prioritet og rekkefølge
1. **D2 + D2b (tegninger) — først, ubetinget.** Klient-utskriften ble fjernet 20.08 (F2, d92ece42) og var eneste vei til tegningsutskrift; arkiv-PDF-en kan ikke erstatte den før D2/D2b er bygget. Kodefakta (cowork-verifisert 21.08): felt.ts:36 utelater location/drawing_position EKSPLISITT — aldri implementert i arkivstien, ikke gått i stykker; byggTegningPosisjon kalles kun fra gammel PDF-vei (sjekkliste.ts:156).
2. **F7** — rett etter. BEF-001-testen avgjør kun om det er regresjon eller dokumentforskjell (påvirker hast, ikke at tegning går først). Kenneth kjører.
3. D4 (knapp/varianter) + D3 (instruksjonstyper).
4. D5–D6 (oppgave-PDF, samlerapporter, sluttoppgjør).

**F7 — regresjon eller dokumentforskjell (uavklart):** repeater.ts er uendret siden 16.08; de tre commitene som traff packages/pdf gjelder rolleetikett og endringslogg. Test: last ned BEF-001 på nytt (verifisert mandag med 73 bilder). Kommer bildene fortsatt → BHO-002 er et annet datatilfelle (innhold på repeater-objektnivå uten rader) og F7 er en eksisterende mangel. Mangler de → regresjon (hastegrad opp). Testen påvirker ikke lenger at tegning går først. Kenneth kjører testen.

**Gate-status (cowork 21.08):** D-kjernen gatet. D1 og D2b godkjent som skrevet; D2 verifisert m/presiseringen over; delt packages/pdf-sti m/web+mobil-verifisering notert som exit-kriterium.

Krav til ordren (kvalitet foran fart): gjenbruk delte primitiver (esc/formatering/TRAFIKKLYS/byggTegningPosisjon) — ingen duplisert logikk; `felt.ts`' repeater-case er frosset (mobil-sti), arkiv-endringer skjer i `arkivmal/`; test per felttype mot de 26 typene, inkl. tomme-tilstander.

**Krav (Kenneth 2026-08-21): PDF-motoren skal virke for både web og mobil.** Alle D1–D6-endringer bygges i den delte `packages/pdf`-stien slik at web og mobil produserer samme PDF — ingen web-only-fiks. Der mobil i dag har egen form (felt.ts' frosne repeater-case), skal ordren eksplisitt avklare om mobil går over på arkivformen eller beholder sin, og F7/tegningsutskrift skal verifiseres fra BEGGE flater før exit.

## 5. Masterplan
Sporet er tatt inn i `REDESIGN-MASTERPLAN.md` som rad **DG** (21.08) med 0b-plass i rekkefølgen. Kodesporet F1b–F7 lever fortsatt i `docs/claude/dokumentgenerering-plan.md` — DG gir det plass i prioriteringen.
