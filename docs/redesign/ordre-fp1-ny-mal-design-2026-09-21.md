# Ordre: FP1 – Sikring av berg (ny mal)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-21
**Metode:** MAL-METODE §1b, §1, §6a, §6b, §7b, §8 og §8b.
**Runde E** — bygges sammen med `ordre-fj1-ny-mal-design-2026-09-21.md` i **én branch**: `feat/mal-runde-e`.
Rammer, DoD og SQL står i FJ1-ordren §4–5 og gjelder hele runden.
**Gatet av Kenneth 2026-09-21:** avgrensning og feltliste.

Nytt kapittel `FP` i `NS3420-F`. Hører sammen med sprengningsmalen FH1: det som er sprengt ut, skal sikres.

---

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 190–199; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Omfang (s. 190):** midlertidig og permanent stabilitetssikring av skråninger og skjæringer i berg, i dagen og under
jord.

**Rensk (s. 191–192):** rensk for stabilitetssikring gjøres manuelt eller maskinelt. Et manuelt renskelag er minst to
personer, i tillegg til eventuelt hjelpemannskap.

**Bolter (s. 193–194):**
- Hullets diameter og lengde tilpasses boltetypen.
- Forskjellen mellom bolt og hull: minst 10 mm for fullt innstøpte bolter, og 5–15 mm for bolter som forankres med
  syntetisk lim.
- Fullt innstøpte bolter skal være helt omhyllet av innstøpingsmassen.
- Endeforankrede bolter tiltrekkes med 50 kN.
- Mørtel til innstøping skal være minst fasthetsklasse B20, med ekspanderende tilsetning.
- Boltene leveres med sfærisk skive (150 mm), mutter og halvkule.

**Prøving og kontroll (s. 194):**
- Endeforankrede bolter: prøvetrekk minst halvparten av de første 100. Blir mer enn 5 % underkjent, prøvetrekkes
  halvparten av de neste 100, helt til underkjenningen er under 5 %. Deretter 50 bolter per 1000 satte, med samme
  kriterium. Det trekkes til 10 % over dimensjonerende last.
- Fullt innstøpte bolter kontrolleres visuelt: riktig boltevinkel, at halvkula ligger riktig an, mørtelrester under
  platen eller i returslangen, og at det er brukt riktig mørteltype.

**Nett og bånd (s. 191, 197):** typene som brukes er steinsprangnett 80 × 100 × 2,7 mm og flettverksnett
50 × 50 × 2,7 mm. Festeboltene har egne dimensjoner. Hva som gjelder, står i beskrivelsen.

## 2. Avgrensning (gatet av Kenneth)

**Med:** rensk for stabilitetssikring og ekstrarensk (FP1.1), sikringsbolter og etterstramming (FP1.3), og sikring med
bergbånd og nett (FP1.5).
**Ute:** arbeid med klatrelag (FP1.7) · sikring av løsmasser (FP2) · fanggjerder og snøsikring (FP3) · sprøytebetong ·
injeksjon.

## 3. Malen

```
kapittelKode: "FP"
referanse:    "FP1"
navn:         "FP1 – Sikring av berg"
beskrivelse:  "Rensk, sikringsbolter og nett i bergskjæring — borhull, innstøping, prøvetrekking og kontroll. Faglig grunnlag: NS 3420-F:2024, post FP1."
```

Nytt kapittel i `NS3420-F`: kode `FP`, navn «Sikring av berg og løsmasser», plassert etter `FJ` og før `FS`. Bruk
`--sorter` om plassen er opptatt, og meld hva du flytter. Eksporter som `FP1_MAL`.

### Kontroll FØR utførelse

**1. Type sikring** — `valg`
- Rensk
- Bolter
- Bånd og nett
- Flere av delene

> Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle.

**2. Sikringsplanen foreligger** — `trafikklys`

> Det skal være prosjektert hva som skal sikres, hvor, og med hvilken bolttype, lengde og eventuelt nett. Midlertidig sikring skal også være planlagt.

**3. Materiell kontrollert** — `valg`
- Som spesifisert – uskadd
- Avvik – feil type eller skadet

> Sjekk bolttype, lengde og korrosjonsbeskyttelse mot beskrivelsen. Boltene skal leveres med sfærisk skive, mutter og halvkule. Nett: steinsprangnett eller flettverksnett etter beskrivelsen.

### Kontroll UNDER utførelse

**4. Rensk før sikring** — `valg`
- Manuell rensk
- Maskinell rensk
- Ikke aktuelt
- Avvik

> Løs stein tas ned før bolting og nett monteres. Et manuelt renskelag er minst to personer, i tillegg til hjelpemannskap.

**5. Borhull** — `valg`
- Diameter og lengde tilpasset boltetypen
- Avvik

> Hullet skal passe til bolten: minst 10 mm større enn bolten for fullt innstøpte, og 5–15 mm større når bolten forankres med syntetisk lim.

**6. Innstøping og forankring** — `valg`
- Fullt innstøpt – helt omhyllet
- Endeforankret – tiltrukket 50 kN
- Ikke aktuelt
- Avvik

> Fullt innstøpte bolter skal være helt omhyllet av massen. Mørtelen skal være minst fasthetsklasse B20 med ekspanderende tilsetning. Endeforankrede bolter tiltrekkes med 50 kN.

**7. Bånd og nett** — `valg`
- Montert etter planen, god kontakt med berget
- Ikke aktuelt
- Avvik

> Nettet skal ligge inntil berget og følge ujevnhetene, og festeboltene settes slik planen viser.

### Kontroll ETTER utførelse

**8. Prøvetrekking av endeforankrede bolter** — `valg`
- Utført etter planen – godkjent
- Mer enn 5 % underkjent – utvidet prøving
- Ikke aktuelt

> Prøvetrekk minst halvparten av de første 100 boltene, til 10 % over dimensjonerende last. Blir mer enn 5 % underkjent, prøves halvparten av de neste 100 til underkjenningen er under 5 %. Deretter 50 bolter pr. 1000 satte.

**9. Visuell kontroll av fullt innstøpte bolter** — `valg`
- Kontrollert – vinkel, halvkule og mørtel i orden
- Ikke aktuelt
- Avvik

> Se etter at bolten står med riktig vinkel, at halvkula ligger riktig an, at det er mørtelrester under platen eller i returslangen, og at sekkene viser riktig mørteltype.

**10. Dokumentasjon** — `trafikklys`

> Plassering og antall bolter, prøveresultater og hvilken mørtel som er brukt, er ført. Legg ved måleresultatene.

**11. Sikringen er godkjent og området frigitt** — `trafikklys`

> Sikringen er kontrollert og området kan slippes til videre arbeid. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer

§7b-sjekk i `fp1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FP1 `, `Tabell F`, `figur F`, `Matrise`,
`NS-EN`, `NS 3420`, `NS 3576` eller `NFF`. Fasthetsklassen «B20» er en materialbetegnelse og er tillatt — standarden bak
navngis ikke.

**Retting 2026-09-21 (design, etter mal-Opus' flagg):** hjelpeteksten i felt 8 sa «50 bolter per 1000». Husstilen
(CLAUDE.md) bruker **«pr.»** i satser og enheter, så teksten skal lyde «Deretter 50 bolter pr. 1000 satte.» Rettet i
feltlista over. Mal-Opus flagget riktig i stedet for å endre en gatet ordlyd selv.

Ellers gjelder rammene, DoD-en og SQL-avsnittet i FJ1-ordren for hele runden.
