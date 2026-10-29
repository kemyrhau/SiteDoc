---
name: dokumentsok-visning-spec
description: Spesifikasjon for visning av treff i dokumentsøket (/sok) — rangering, utsnitt til venstre, markering, høyre rute med fokus på valgt treff. Målt mot develop 2f156820 (re-målt 2026-10-22; første måling 5b86d8f0 14.10) etter sidetall-fiksen. S1–S6 merket reparasjon/funksjonsendring, akseptkriterier på testdokumentene i «Dokumentsøk-bevis», ordre SØK-1 (reparasjon) → SØK-2 (hjemmel), tester som skal feile. Inkluderer ett sikkerhetsfunn (hentDokumentChunks uten medlemskapssjekk).
sist_verifisert_mot_kode: 2026-10-22
eier: fabel (plan-eier) — orkestrator gater spec; kode-ordrer gates av Kontrollør (§ 0 én gate)
status: ⚠️ SØK-1 (S6a, S1a, S2, S4, S5, S6c + T1–T9) bygget på branch `fix/sok1-visning` 2026-10-28, venter Kontrollør-gate/merge — SØK-2 (S3, S1b) ikke bygget. Spec-tekst 2026-10-14, § 1 re-målt 2026-10-22 mot `2f156820` etter `544f0125`. Q1–Q3 besvart 2026-10-22: hjemmel for S1b og S3; filnavn-klem venter på måling.
---

# Dokumentsøk — visning av treff

> Hjemmel: **Kenneth 2026-10-14**, designet med hans ord: *«vise treffene med kort kontekst til venstre. treffene rangeres best
> til dårligst. best øverst. til høyre → vise hele teksten til valgt treff fra venstre rad. fokus på kontekstområdet til valgt
> treff. Treff markeres med gul for å skille treff fra øvrig tekst»* + *«ja, skriv spec-en når søket fungerer»*. Forutsetning
> oppfylt 14.10: sidetall-fiksen `feca5bc4` (pdf.js `pagerender`, bevis `relay/dokumentsok-bevis/06-…side1-side3.png`) og
> reekstraksjon `618dcdab` merget. Ordre: orkestrator 14.10 (`relay/inbox-fabel.md` § POST: dokumentsøk-visning-spec).

## 0. Hva dette er, og ikke er

Dette er **hvordan treff skal rangeres, vises og finnes igjen** i dokumentsøket på web (`/dashbord/[prosjektId]/sok`), begge
moduser (AI-søk og Tekstsøk). Det rører **ikke** ekstraksjon/chunking (ftd-prosessering, nettopp rettet), embedding-modeller,
RAG, mobil (ingen dokumentsøk finnes der) eller dokumentlista. Alle krav under skal kunne testes på mappa «Dokumentsøk-bevis»:
`tilbud-kontrakt-b12.pdf` (3 sider: s. 2 dagmulkt, s. 3 vernerunde/SJA), `teknisk-beskrivelse-b12.docx`, `testdok-sidetall.pdf`.

## 1. Målt utgangspunkt (develop `2f156820`, re-målt 2026-10-22; første måling `5b86d8f0` 14.10)

| # | Fakta | Bevis |
|---|---|---|
| S-M1 | **AI-søk viser aldri mer enn ett treff pr. dokument:** etter rangering beholdes bare beste chunk pr. dokument (`bestPerDok`), så «N treff i M dokumenter» er alltid N = M. Tekstsøk gir inntil 5 chunks pr. dokument. De to modusene oppfører seg ulikt uten at brukeren ser hvorfor | `ai-sok-service.ts:448-457`; `ftdSok.ts:55-90` (`MAKS_PR_DOK`) |
| S-M2 | **Leksikalsk kandidatuttak i AI-søk er tilfeldig:** `plainto_tsquery('norwegian')` med `LIMIT ${kandidatK}` (300) **uten ORDER BY**. Vektorsiden sorterer (`<=>`, topp 300). På store prosjekter kan det beste tekstlige treffet mangle før rangeringen starter | `ai-sok-service.ts:362-385` (:384), `:284`; vektor `:340-358` |
| S-M3 | **Score** = 0,6·simNorm + 0,4·reRankNorm + 0,2·latencyNorm (min-max). `beregReRank`: frase/term, heading, sideposisjon (1,0 for s. 1–3, 0,5 for s. 4–10), **filnavn +0,15 pr. treff maks 0,45**, tall ±0,3, NS-straff −0,15. `bm25Weight`/`qualityWeight` definert og tatt imot i Zod, **ubrukt**. Rene vektortreff < 0,30 kastes; «begge»/leksikalsk beholdes alltid. topK 20 | `:58-66` (`DEFAULT_VEKTER`: bm25Weight 0,06 / qualityWeight 0,03 definert, 0 lesere), `:134-200` (`beregReRank`, filnavn `:164`, NS `:191`), `:407-408` (`SIM_TERSKEL`), `:440-442`, `:283`; `aiSok.ts:31, :33` |
| S-M4 | **Utsnitt til venstre er ulikt i de to modusene:** Tekstsøk = `ts_headline` vindu rundt treffet (MaxWords 32, MinWords 12, HighlightAll=FALSE); **AI-søk = de første 240 tegnene av chunken** (`(utdrag ?? chunkText).slice(0, 240)`), uten vindu, uten ellipse, + `line-clamp-3`. Bilde 14.10: «… Det tas forbehold om fjell i» kuttet midt i setningen, søkeordet langt ute | `ftdSok.ts:30, :76`; `treff-liste.tsx:57-77` (`Utdrag`: `:76` slice) |
| S-M5 | **Posisjonsetikett:** «side N» vises når `pageNumber > 0` (nå riktig for PDF etter `feca5bc4`); «avsnitt N» = `chunkIndex + 1` (1-indeksert fra 14.10), løpende gjennom dokumentet. DOCX har `pageNumber: null` → bare «avsnitt N». `sectionTitle` (3 første linjer, nummerert/ALL CAPS) vises som etikett **og** står i teksten → ordet markeres dobbelt («3. Frostsikring Frostsikring …») | `treff-liste.tsx:165-173`; `ftd-prosessering.ts:1678, :2032, :3140-3157`; `nb.json:4950, :4954` |
| S-M6 | **Markering:** server-headline → `<mark>` med norsk stemming (Tekstsøk); klient `HighlightTekst` = søkestreng delt på mellomrom, termer > 2 tegn, regex `gi`, **ingen stemming/stoppord/frase**. **Rent semantiske treff markeres ikke** (ordet finnes ikke) — brukeren ser et treff uten å se hvorfor | `treff-liste.tsx:57-77`; `fulltekst.tsx:136-160` |
| S-M7 | **Høyre rute scroller til første `<mark>` på siden, ikke til valgt chunk;** valgt treff skilles bare i venstre liste (`bg-blue-50`); i høyre rute er alle `<mark>` like gule. `pageNumber` null (DOCX) → **ingen scroll**, DOCX havner på `data-side="0"` uten sidehode. Ingen neste/forrige, sidevelger eller tastaturnavigasjon. Kommentar «0/null = ingen scroll» stemmer ikke med koden (bare null) | `fulltekst.tsx:11, :25-30, :107-110, :157`; `treff-liste.tsx:160`; `page.tsx:233` |
| S-M8 | **Filteret** (Prosjektdokumenter / Alle / ett referansedokument) sendes **bare til `aiSok.sok`**, ikke til `ftdSok.sokDokumenter` som alltid kjøres → Tekstsøk og fallback ignorerer filteret | `page.tsx:64-70, :77-83, :88-91` |
| S-M9 | **Fallback-kjeder:** AI-feil/0 treff → leksikalske treff + gult varsel; embedding-feil → `leksikalskSok` DISTINCT ON dokument som **ignorerer** `dokumentIder`/`ekskluderMappeIder`; Tekstsøk 0 treff → ILIKE `%q%` med rank 1,0 **sortert på filnavn**, ikke relevans | `page.tsx:93-110, :209-212`; `ai-sok-service.ts:314-329, :484-520`; `ftdSok.ts:93-125` (`:124` ORDER BY filename) |
| S-M10 | **Sidehodet** i høyre rute bruker i18n-nøkkelen `firma.timer.rapport.pdf.footerSide` (lånt fra timer-rapport) | `fulltekst.tsx:110` |
| S-M11 | **Tester:** sidetall har 7 + 2 + 2 + 1 tester (`pdf-sideattribusjon.test.ts`, reekstraksjon); **1** for `hybridSok` (timeout-fallback, `sok-embedding-timeout.test.ts:43-44`, fra `544f0125`). **0 tester** for rangering, `ftdSok.ts`, `aiSok.ts`, `treff-liste`, `fulltekst`, `sok/page` | `find`/`grep` 22.10 |
| S-M12 | 🔴 **Sikkerhet:** `ftdSok.hentDokumentChunks` (hele dokumentteksten til høyre rute) har **ingen medlemskaps-/prosjektsjekk** — tar `documentId` og returnerer alle chunks. En innlogget bruker kan lese tekstinnholdet i et hvilket som helst dokument-id på tvers av prosjekter. Bryter prosjektisolerings-regelen (CLAUDE.md § Viktige regler) | `ftdSok.ts:138-145` (uendret 22.10) |
| S-M13 | **Nytt siden 14.10 (`544f0125`): query-embedding har timeout 8 s uten retry** (`fetchMedTimeout`, `QUERY_EMBEDDING_TIMEOUT_MS`); feiler den, returnerer `hybridSok` `{ treff: leksikalskSok(...), aiSøkUtilgjengelig: true }` og klienten viser `sok.fallbackVarselFeilet` i stedet for stille tekstsøk. Lukker «stille tomhet» for nedetid, **men** fallbacken er fortsatt `leksikalskSok` (DISTINCT ON dokument, ignorerer `dokumentIder`/`ekskluderMappeIder`, S-M9) og utsnittet er fortsatt `slice(0, 240)` (S-M4) | `ai-sok-service.ts:6-9, :205-230, :314-329`; `page.tsx:96-97, :209-212`; `sok-embedding-timeout.test.ts` |

**Konsekvens:** designet (venstre kontekst, best øverst, høyre fokus på valgt treff, gul markering) er bygget i skjelettet, men fire
av fire deler svikter på ekte dokumenter: rangeringen mister treff (S-M1/M2), utsnittet viser ikke treffet (S-M4), markeringen
mangler for semantiske treff (S-M6), og høyre rute finner ikke frem til valgt treff (S-M7). I tillegg ett sikkerhetshull (S-M12). Re-måling 22.10: alle tolv funn står; det eneste som er endret siden 14.10 er timeout-fallbacken (S-M13), som ikke rører S1–S6.

## 2. Brukerhistorie

**Bas/prosjektleder (PC):** «Jeg søker «dagmulkt» i prosjektet med 40 dokumenter. Jeg vil se de stedene det står, best først,
med setningen rundt. Klikker jeg et treff, vil jeg lande på akkurat det stedet i dokumentet, se det tydelig, og hoppe til neste
forekomst. Søker jeg «bot ved forsinkelse», vil jeg forstå hvorfor dagmulkt-avsnittet kom opp.» I dag: ett treff pr. dokument i
AI-søk, utsnitt fra starten av avsnittet, scroll til første forekomst på siden, ingen markering for semantiske treff.

## 3. Regler S1–S6 (reparasjon = retter designet som er bygget · funksjonsendring = trenger Kenneths hjemmel før ordre)

### S1 — Høyre rute: fokus på valgt treff · **MÅ**

- **S1a (reparasjon):** ved klikk på et treff scroller høyre rute til **den valgte chunken** (`data-chunk=<chunkIndex>`), ikke første `<mark>` på siden; chunken plasseres i øvre tredjedel av ruta. Gjelder også DOCX (`pageNumber` null) — scroll på chunk, ikke side. Den valgte chunkens markeringer får **sterkere farge** (f.eks. `bg-amber-300` + ramme) enn øvrige forekomster (`bg-yellow-200`). Valg i venstre liste og fokus i høyre rute er alltid samme chunk. **F3 (reparasjon, relay 2026-10-29, branch `fix/sok-visning`):** rullingen skjer KUN i høyre rute (`rullTilChunk` → `scrollTo` på `[data-rullebeholder]`, aldri `scrollIntoView`), og siden måler egen høyde til bunnen av `main` (`useHoydeTilBunn`) fordi `h-full` løste til auto under prosjekt-layouten — målt 29.10: `main` rullet søkefeltet ut av syne, siden var 174 892 px. Ruter har `min-w-0 break-words`.
- **S1b (funksjonsendring, Q1):** «Forrige/neste forekomst» i høyre rute (knapper + `↑/↓`-tast), teller «3 av 7», hopper mellom alle `<mark>` i dokumentet og oppdaterer valgt treff i venstre liste når forekomsten tilhører en annen chunk.
- Sidehodet får egen i18n-nøkkel (`ftdSok.sideHode`), ikke timer-rapportens (S-M10). DOCX får ingen sidehode (riktig i dag) men chunk-ankre.
- **Akseptkriterier:**
  - A1 `tilbud-kontrakt-b12.pdf`, søk «vernerunde» (Tekstsøk): klikk treffet → høyre rute viser side 3 med «vernerunde» i øvre tredjedel, markert sterkere enn andre forekomster; test som feiler når scroll-målet er første `<mark>` på siden.
  - A2 `teknisk-beskrivelse-b12.docx` (ingen sidetall), søk «frostsikring»: klikk et treff → scroll til chunken (i dag ingen scroll).
  - A3 (S1b) «neste» fra forekomst 1 → forekomst 2 i samme dokument, teller «2 av N»; siste → første (rundgang); tastatur `↓`.
  - A4 Negativ: treff uten `<mark>` i chunken (semantisk, før S5) → scroll til chunken likevel, ingen feil.

### S2 — Utsnitt til venstre: kontekst rundt treffet, likt i begge moduser · **MÅ** (reparasjon)

- Utsnittet er et **vindu rundt første markerte forekomst** i chunken (ca. 32 ord, som `ts_headline` i dag), med «…» foran/bak når det er kuttet, i **begge** moduser. AI-treff som har leksikalsk kilde bruker server-headline; rene semantiske treff bruker S5-setningen; finnes ingen av delene, første 240 tegn + «…».
- Posisjonsetikett: **«side N»** når sidetall finnes; **«avsnitt N»** bare når sidetall mangler (DOCX). Aldri begge. `sectionTitle` vises som etikett, og **fjernes fra starten av utsnittet** når utsnittet begynner med den (S-M5 dobbeltmarkering).
- Tellingen «N treff i M dokumenter» = antall chunks med treff / antall dokumenter — uendret, men N ≠ M må kunne skje (S3).
- **Akseptkriterier:**
  - B1 AI-søk «dagmulkt» i `tilbud-kontrakt-b12.pdf`: utsnittet inneholder «dagmulkt» markert, med «…» i begge ender; test som feiler når utsnittet er de første 240 tegnene.
  - B2 Tekstsøk samme: identisk utsnittslogikk (samme funksjon), etikett «side 2», ingen «avsnitt».
  - B3 DOCX «frostsikring»: etikett «3. Frostsikring · avsnitt 4» (1-indeksert), utsnittet starter ikke med overskriften gjentatt; ordet markert én gang i overskriften og én gang i teksten — ikke to ganger på rad.
  - B4 Treff uten ellipse-behov (kort chunk) → ingen «…».

### S3 — Flere treff pr. dokument i AI-søk, gruppert · **BØR** (funksjonsendring, Q2)

- AI-søk beholder **inntil 5 chunks pr. dokument** (som Tekstsøk), rangert; dokumentet rangeres på beste chunk, chunkene listes under dokumenthodet i score-rekkefølge, topK 20 chunks totalt. «Vis flere» pr. dokument når det finnes flere enn 5.
- Kenneths design-ord «treffene rangeres best til dårligst» gjelder treff, ikke dokumenter — dagens N = M er en avkortning, ikke designet.
- **Akseptkriterier:**
  - C1 Et dokument med søkeordet i 3 chunks (lag med `testdok-sidetall.pdf` eller `tilbud-kontrakt-b12.pdf` «SHA» s. 1 + s. 3) → 3 treff under ett dokumenthode i AI-søk; «3 treff i 1 dokument». Test som feiler mot `bestPerDok`.
  - C2 Dokumentrekkefølgen er etter beste chunk; chunkene innen dokumentet etter egen score.
  - C3 topK teller chunks, aldri flere enn 5 pr. dokument uten «vis flere».

### S4 — Rangering: deterministisk kandidatuttak og ryddet formel · **MÅ** (reparasjon)

- Leksikalsk kandidatuttak sorteres med `ts_rank(...) DESC` **før** `LIMIT 300` (S-M2). ILIKE-fallbacken i Tekstsøk sorteres på rank/antall forekomster, ikke filnavn (S-M9).
- `bm25Weight`/`qualityWeight`: **fjernes** fra service og Zod (ubrukt, S-M3) — eller tas i bruk med måling; anbefaling fjern (ingen måling finnes).
- Filnavn-bonusen (maks 0,45) kan overstyre tekstlikhet; 🟡 klem til maks 0,15 er UTSATT (Q3, 2026-10-22: vent på måling på ekte prosjekt).
- `leksikalskSok`-fallback respekterer `dokumentIder`/`ekskluderMappeIder` (S-M9). Filteret sendes også til `ftdSok.sokDokumenter` (S-M8).
- **Akseptkriterier:**
  - D1 Enhetstest på SQL-en: leksikalsk spørring inneholder `ORDER BY` før `LIMIT`; 301 syntetiske chunks der den beste er nr. 301 → den kommer med.
  - D2 Filter «ett referansedokument» i Tekstsøk → bare treff fra det dokumentet (i dag ignorert).
  - D3 `bm25Weight` finnes ikke lenger i Zod/service (grep = 0), eller er målt og dokumentert i `ai-sok.md`.
  - D4 ILIKE-fallback: dokument med 3 forekomster rangeres over dokument med 1, uavhengig av filnavn.

### S5 — Semantiske treff: vis hvorfor · **MÅ** (reparasjon av «treff markeres gult»)

- For treff med kilde `semantisk` (ingen ordtreff) markeres **setningen i chunken som ligger nærmest spørringen** (setnings-embedding mot spørrings-embedding, eller enklest: setningen med høyest term-/synonym-overlapp fra re-rank) med **egen stil** (f.eks. stiplet understrek + etikett «semantisk treff»), ikke gult. Gult er forbeholdt ordtreff.
- Badge «Semantisk» beholdes; etiketten forklarer markeringen. Mangler setning (tom chunk) → utsnitt fra start + badge, ingen markering.
- **Notat relay 2026-10-29 kveld (`fix/sok-markering-valgt-treff`):** «mangler setning» er vanligere enn «tom chunk» — målt på test `e8aac60a` (Røstbakken «dagmulkt») hadde alle ni semantiske treff `semantiskSetning: null`, fordi `finnBesteSetning` krever leksikalsk overlapp (ordstart/stamme) og rene vektornaboer ikke har det. Derfor markeres nå hele det valgte avsnittet uansett (blå bakgrunn + venstre strek, `VALGT_AVSNITT_KLASSE` i `fulltekst.tsx`), slik at høyre rute aldri står umarkert etter klikk. S5-setningen kommer i tillegg når den finnes.
- **Akseptkriterier:**
  - E1 AI-søk «bot ved forsinkelse» → `tilbud-kontrakt-b12.pdf` kommer opp (semantisk), setningen «Ved forsinkelse påløper dagmulkt …» er markert med semantisk stil i både utsnitt og høyre rute; test som feiler når ingen markering finnes for et treff med kilde «semantisk».
  - E2 Ordtreff beholder gult; et treff med kilde «begge» får gult, ikke semantisk stil.

### S6 — Sikkerhet og robusthet · **MÅ** (reparasjon)

- **S6a** `hentDokumentChunks` krever prosjektmedlemskap via dokumentets prosjekt (`harProsjektTilgang`), som alle andre prosjekt-ruter (S-M12). Føres i `sikkerhet.md` ved ordre (DOC-MAP).
- **S6b** `rank`/score-visning forblir admin/dev-gatet (`?debug`).
- **S6c** Kommentaren «0/null» i `fulltekst.tsx:11` rettes til koden, eller koden til kommentaren (S1a gjør begge irrelevante: scroll på chunk).
- **Akseptkriterier:**
  - F1 Bruker uten medlemskap kaller `hentDokumentChunks` med gyldig id fra annet prosjekt → FORBIDDEN; test som feiler i dag.
  - F2 Medlem → chunks som før.

### Prioritert rekkefølge og ordre

| Ordre | Innhold | Gate | Hjemmel |
|---|---|---|---|
| **SØK-1 (reparasjon, nå)** | S6a først (sikkerhet) · S1a · S2 · S4 · S5 · S6c + tester T1–T9 | Kontrollør (regel 10) | ingen ny hjemmel — retter designet Kenneth beskrev 14.10 |
| **SØK-2 (funksjonsendring)** | S3 flere treff pr. dokument · S1b forrige/neste (filnavn-klem utsatt, Q3) | Kontrollør | 🟢 hjemmel Q1+Q2 2026-10-22 |

Begge er web + api, ingen schema, ingen migrering. Agent: redesign (eier dokumentsøk-flaten, jf. `inbox-redesign-docx-sok.md`).

## 4. Avgrensning — ikke med

- Chunking/ekstraksjon (nettopp rettet), embedding-modell/NorBERT-rebuild (`BACKLOG.md:4751`), RAG/svargenerering (`ai-sok.md:117-123`), `aiSok.blokkSok` (E5, ubrukt).
- Nye filtre (dokumenttype, dato, språk), søkehistorikk, mobil-dokumentsøk — egne saker.
- NS-referansedokumenter som ikke ekskluderes (`BACKLOG.md:1991-1995`) — eget punkt, men S4 D2 gjør filteret konsistent.

## 5. Åpne spørsmål til Kenneth (med anbefaling)

| # | Spørsmål | Anbefaling |
|---|---|---|
| Q1 | S1b forrige/neste forekomst i høyre rute (ny knapp + tast) — ta med i SØK-2? | 🟢 2026-10-22 Kenneth: **Ja** (anbefalingen). **Ja.** Det er slik en leser finner alle steder i et 40-siders dokument; uten den må han scrolle |
| Q2 | S3 flere treff pr. dokument i AI-søk (i dag ett). Endrer tellingen «N treff i M dokumenter» synlig | 🟢 2026-10-22 Kenneth: **Ja**, tak 5 + «vis flere» (anbefalingen). **Ja.** «Treffene rangeres best til dårligst» forutsetter at alle treff vises. Tak 5 pr. dokument + «vis flere» holder lista kort |
| Q3 | Filnavn-bonus maks 0,45 → klem til 0,15 nå, eller vent på måling? | 🟢 2026-10-22 Kenneth: **Vent** (anbefalingen) — ingen klem i SØK-2. **Vent på måling** på et ekte prosjekt (A.Markussen) før formelen røres; S4 fjerner bare det som er ubrukt |

## 6. Tester som skal FEILE i dag (DoD)

1. Scroll-mål er valgt chunk, ikke første `<mark>` på siden (A1); DOCX scroller (A2).
2. Valgt chunks `<mark>` har annen klasse enn øvrige (A1).
3. AI-utsnitt er vindu rundt treffet med ellipse, samme funksjon som Tekstsøk (B1/B2).
4. Etikett viser «side N» eller «avsnitt N», aldri begge; overskrift ikke gjentatt i utsnittet (B3).
5. Leksikalsk kandidat-SQL har `ORDER BY ts_rank … DESC` før `LIMIT` (D1).
6. Filter sendes til `ftdSok.sokDokumenter` (D2); `leksikalskSok`-fallback respekterer `dokumentIder`.
7. `bm25Weight` borte fra Zod/service (D3).
8. Semantisk treff har markert setning (E1); «begge» → gult (E2).
9. `hentDokumentChunks` uten medlemskap → FORBIDDEN (F1).
10. (SØK-2) AI-søk gir 3 chunks for ett dokument (C1); forrige/neste teller «2 av N» (A3).
11. (Reparasjoner relay 2026-10-29, `fix/sok-visning`) F3: valgt chunk ruller bare `[data-rullebeholder]`, `scrollIntoView` kalles aldri (`fulltekst-scroll.test.tsx` «F3 — forfedre rulles ikke»); sidehøyde = `main`-bunn − sidetopp (`useHoydeTilBunn.test.ts`). F2: gab-chunker uten RTF/GUID/kontrollord og uten 1000-tegns ord; post-beskrivelsen byte for byte som før (`gab-chunker.test.ts`, «låsetest R1»). F1b: rent semantisk kandidat under 20 tegn utelates, ordtreff beholdes (`ai-sok-rangering.test.ts` «F1b»).
12. (F1a, relay 2026-10-29, `fix/sok-ingen-ordtreff-varsel`) Varselet «Ingen dokumenter inneholder ordet …» vises når alle treff er rent semantiske, og skjules ved minst ett ordtreff (`tekst`/`begge`), ved tom liste og når `metode` mangler (leksikalsk fallback) — `ingen-ordtreff.test.ts`.
13. (Hel-avsnitt-markering, relay 2026-10-29 kveld, `fix/sok-markering-valgt-treff`) Valgt `[data-chunk]` i høyre rute har `VALGT_AVSNITT_KLASSE`, naboen ikke; virker med `semantiskSetning={null}` og uten ordtreff; bare ett avsnitt om gangen og følger `valgtChunkIndex`; chunken er fortsatt `<span>` (inline) og klassen bruker `box-decoration-clone`, aldri `block`/gul/lilla (`fulltekst-scroll.test.tsx` «Hel-avsnitt-markering»). Låsetest: `finnBesteSetning` gir eksakt delstreng også med `\t` inni og `\n` rundt, og null for målt gab-chunk 1036 uten ordet (`ai-sok-rangering.test.ts`).
