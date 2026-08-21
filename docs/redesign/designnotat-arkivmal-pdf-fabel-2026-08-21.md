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

**D2 — Tegninger i arkivet:** `drawing_position` rendres som oversikt + 4×-detalj per markering, gruppert per tegning — **gjenbruk `byggTegningPosisjon`**, ikke ny renderer. Dokumentnivå-lokasjon (kartpunkt fra «Velg lokasjon») rendres som kartutsnitt m/punkt + bygning/byggeplass/koordinat. Regel: **uten markering utelates hele seksjonen** — aldri tom kartboks. Mockupside «Tegninger i arkivet».

**D2b — Helside tegningsprint (Kenneth-funn 21.08):** per tegning som har markeringer i dokumentet skrives ÉN helside med hele tegningen i størst mulig format (roteres til liggende når tegningen er bredere enn høy) og ALLE markører nummerert mot punktnumrene, med markør→punkt-tabell under. En befaringsrapport uten tegningen er halv dokumentasjon — markørene er hele poenget med georefereringen. D2 (oversikt/detalj per punkt) supplerer helsiden, erstatter den ikke. Uten markeringer på en tegning skrives ingen tegningsside. Mockupside «Helside tegningsprint».

**D3 — Instruksjonstyper:** info_text/info_image vises grått som instruksjonskontekst (byggherre skal se hva utfører leste); video som referanselinje (tittel + URL); quiz som spørsmål + avgitt svar + riktig/feil — avgitt svar er dokumentasjonsdata. Mockupside «Malobjekt-revisjon» (rad-for-rad-vedtak for alle 26 typer).

**D4 — Knappenavn:** «Last ned arkiv-PDF» utgår → **«Last ned PDF»** (splittknapp). Klikk = standardvariant; pil åpner meny:
- **Med logg** (standard) — innhold, tegninger, dokumenthistorikk, endringslogg, signaturer
- **Uten logg** — innhold, tegninger, signaturer
- **Send til …** — e-post m/PDF-vedlegg (eksisterende funksjon flyttes hit)
Samme knapp på sjekkliste, oppgave og HMS. Mockupside «Nedlastingsvalg».

**D5 — Oppgave-PDF:** egen dokumentklasse i arkivformen (beskrivelse, ansvarlig/frist/prioritet, kilde-referanse, tegningsposisjon, dokumentasjon, opprettet/lukket-signatur). Mockupside «Oppgave-PDF».

**D6 — Samlerapporter** (startes fra listevisning, ikke enkeltdokument):
- Dokumentliste og tabellrapport (eksisterende mockupsider) — kompaktform, aldri logg/signaturblokk
- **Samlerapport blandet** — SJ + OPG + HMS i én PDF: oversikt per dokumenttype først, deretter hvert dokument i kompaktform. Mockupside «Samlerapport».
- **Sluttoppgjør — oppgaveliste** — alle tilhørende oppgaver m/kilde-kolonne (sjekklistepunkt/befaringspunkt/RUH/manuell), telleblokk lukket/under arbeid/åpen; åpne oppgaver vises rødt men blokkerer ikke utskrift. Mockupside «Sluttoppgjør».

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
