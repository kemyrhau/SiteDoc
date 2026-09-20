# Ordre: FB1 – Markrydding og avtaking av vekstjord (ny mal)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b, §1, §6a, §7b, §8 og §8b.
**Runde C** — bygges sammen med `ordre-up1-ny-mal-design-2026-09-20.md` i **én branch**: `feat/mal-runde-c`.
Rammer, DoD og SQL står i UP1-ordren og gjelder hele runden.
**Gatet av Kenneth 2026-09-20:** avgrensning og feltliste.

Kapittel `FB` («Markrydding») står tomt etter omkodingen av Del F. Denne malen fyller det, og dekker det som skjer
først på jobben.

---

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 27–36; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Rydding (s. 27, 31–32):**
- Vegetasjonsdekket fjernes til 2,0 m utenfor prosjektert skjæringstopp eller fyllingsfot, om ikke annet er angitt.
- Arbeidet skal gjøres så ulike masser ikke blandes.
- Trær langs grensen for området planlegges så de ikke blir stående utsatt til på en kant eller for tett inntil et
  område der masser skal legges ut.

**Fremmede arter (s. 27, 32, 35):** der de kan forekomme, skal det være gjort en risikovurdering og laget en rapport med
tiltaksplan. Masser med og uten fremmede arter skal holdes fra hverandre, og hauger eller ranker merkes etter hvilket
område jorda kommer fra.

**Vekstjord (s. 34–35):**
- Skal ikke blandes med andre materialer eller med massene under, og skal ikke forringes.
- Komprimering skal unngås.
- Om ikke annet er angitt: tippes eller legges i løse hauger eller ranker med høyde inntil 2 m.
- Skal vegetasjonsdekket brukes til naturlig revegetering, stiller beskrivelsen krav om skånsom avtaking.

**Behandling av kvist, stubber og røtter (s. 34):** fliskutting, oppkutting eller sortering.

## 2. Avgrensning (gatet av Kenneth)

**Med:** vegetasjonsrydding (FB1), felling, stubbebehandling og avtaking av vegetasjonsdekke (FB1.2–FB1.5), og avtaking
av vekstjord til ranke eller depot (FB2).
**Ute:** rydding under vann (FB5) · flytting av eksisterende vegetasjon · opplasting og transport bort fra anlegget (FM)
· drift av depot (FU5) · ugressbehandling i ranke eller depot.

## 3. Malen

```
kapittelKode: "FB"
referanse:    "FB1"
navn:         "FB1 – Markrydding og avtaking av vekstjord"
beskrivelse:  "Rydding av vegetasjon og avtaking av vekstjord — ryddegrense, fremmede arter, masseskille og opplegging. Faglig grunnlag: NS 3420-F:2024, post FB1 og FB2."
```

Eksporter som `FB1_MAL` og legg den først i F-arrayet, foran `FD1_MAL`.

### Kontroll FØR utførelse

**1. Hva ryddes** — `valg`
- Vegetasjonsdekke og busker
- Trær
- Begge deler
- Bare vekstjord

> Sier hva jobben omfatter, og styrer hvilke felt under som er aktuelle.

**2. Fremmede arter** — `valg`
- Ingen registrert
- Registrert – tiltaksplan følges
- Ikke undersøkt – avklar

> Er det fare for fremmede arter, skal det finnes en rapport med tiltaksplan, og massene skal håndteres etter den. Masser med og uten fremmede arter holdes fra hverandre.

**3. Ryddegrensen er merket** — `trafikklys`

> Grensen går 2,0 m utenfor prosjektert skjæringstopp eller fyllingsfot når beskrivelsen ikke sier noe annet. Trær og vegetasjon som skal stå, er merket og beskyttet.

### Kontroll UNDER utførelse

**4. Trær og stubber** — `valg`
- Felt, stubber tatt opp
- Stubber frest
- Ikke aktuelt
- Avvik

> Felte trær, stubber og røtter kjøres til oppsamlingsplass eller behandles på stedet. Trær i kanten av området felles så de som blir stående, tåler å stå fritt.

**5. Massene holdes adskilt** — `trafikklys`

> Vegetasjonsdekke, vekstjord og øvrige masser legges hver for seg, og blandes ikke.

**6. Vekstjorda tatt av uten innblanding** — `valg`
- Tatt av ren
- Blandet med massene under – avvik
- Ingen vekstjord på stedet

> Vekstjorda skal ikke blandes med massene under eller andre materialer, og skal ikke forringes. Skal den brukes til revegetering, tas den av skånsomt slik beskrivelsen sier.

**7. Opplegging** — `valg`
- Løse hauger eller ranker, høyst 2 m
- Høyere enn 2 m – avvik
- Kjørt til depot

> Vekstjorda legges løst og høyst 2 m høyt når beskrivelsen ikke sier noe annet. Unngå komprimering — ikke kjør på jorda.

**8. Behandling av kvist og stubber** — `valg`
- Fliskuttet
- Oppkuttet
- Sortert
- Kjørt bort
- Ikke aktuelt

> Velg det beskrivelsen angir. Masser som kjøres bort, håndteres etter tiltaksplanen når fremmede arter er registrert.

### Kontroll ETTER utførelse

**9. Området er ryddet til avtalt grense** — `trafikklys`

> Ryddingen følger den merkede grensen, og vegetasjon som skulle stå, er uskadd. Ta bilde.

**10. Vekstjorddepotet er merket** — `valg`
- Merket etter plan
- Ikke aktuelt
- Mangler merking

> Der det er fare for fremmede arter, merkes hauger og ranker etter hvilket område jorda kommer fra, så massene ikke blandes senere.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer

§7b-sjekk i `fb1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FB1 `, `FB2 `, `Tabell F`, `figur F`,
`NS-EN` eller `NS 3420`. Ellers gjelder rammene, DoD-en og SQL-avsnittet i UP1-ordren for hele runden.
