# Ordre: UP1 – Setting av kum i grunnen (ny mal)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b, §1, §6a, §7b, §8 og §8b.
**Runde C** — bygges sammen med `ordre-fb1-ny-mal-design-2026-09-20.md` i **én branch**: `feat/mal-runde-c` fra
`origin/develop` (@ `37864435` eller nyere).
**Gatet av Kenneth 2026-09-20:** avgrensning og feltliste.

Nytt kapittel `UP` i standarden `NS3420-U` (som finnes fra runde B). Etter denne malen er VA-kjeden komplett:
FD2 (graving) → UM1 (legging) → **UP1 (kum)** → FS3 (gjenfylling) → UU1 (prøving).

---

## 1. Normfakta — egen sammenstilling (NS 3420-U:2019, normside 339–355; PDF-side = normside + 14)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Før montering (s. 339):** grøftebunnen skal være fri for teledannelse, snø og is.

**Toleranser (s. 339, 352):**

| Hva | Krav |
|---|---|
| Kummens plassering i høyde | ±30 mm |
| Kummens plassering i side | ±100 mm |
| Lokkhøyde i vei og på plass | +0 / −10 mm |
| Lokkhøyde i grøntanlegg og grøfter | +10 / −100 mm |

**Utførelse (s. 340, 352):**
- Kum med mellomdekke: nedstigningsåpningene skal være forskjøvet i forhold til hverandre.
- Overdekning over topplata skal være minst 0,3 m. Samlet høyde av justeringsring og ramme bør ikke overstige 0,40 m.

**Sandfang (s. 349):** bør ikke ha sandvolum under 0,8 m³, og bør ha minst 1 m fra bunn til utløp.

**Materiell (s. 339, 341, 353–355):** der tetthet kreves, brukes T-merket kum. Lokk, rister og rammer har styrkeklasser
(A 15, B 125, C 250, D 400, F 900) — klassen står i beskrivelsen. Bunnseksjoner leveres med renneløp (rett løp eller
Y-løp, med eller uten plastliner), eller uten renneløp.

**Ledning inn i kum (fra UM, s. 251):** minst 100 mm mellom utvendig kumvegg og utvendig forbigående ledning.

## 2. Avgrensning (gatet av Kenneth)

**Med:** nedstigningskummer (UP1), sandfangkummer og hjelpesluk (UP3), inspeksjonskummer (UP2), med rammer,
justeringsringer, lokk og rister (UP8.1).
**Ute:** plasstøpte kummer · pumpestasjoner og utstyr (UO) · overløps- og regulatorkummer (UP7) · inntakselementer
(UP4) · prøving av kum (UU1) · frostsikring.

## 3. Malen

```
kapittelKode: "UP"
referanse:    "UP1"
navn:         "UP1 – Setting av kum i grunnen"
beskrivelse:  "Setting av nedstigningskum, sandfang og inspeksjonskum — fundament, plassering, skjøter, omfylling, ramme og lokk. Faglig grunnlag: NS 3420-U:2019, post UP1."
```

Nytt kapittel i `NS3420-U`: kode `UP`, navn «Kummer i grunnen», plassert før `UU` i normens rekkefølge (UM, UP, UU).
Eksporter som `UP1_MAL`.

### Kontroll FØR utførelse

**1. Type kum** — `valg`
- Nedstigningskum
- Sandfangkum
- Inspeksjonskum
- Annen kum

> Typen kum avgjør hvilke krav som gjelder under.

**2. Kum og deler kontrollert** — `valg`
- Riktig type og dimensjon, uskadd
- Avvik – feil type eller skadet

> Sjekk dimensjon, bunnseksjon og pakninger mot beskrivelsen. Der kummen skal være tett, skal den være T-merket. Skadde elementer settes ikke ned.

**3. Grøftebunn og fundament klare** — `trafikklys`

> Bunnen er fri for tele, snø og is, og fundamentet er avrettet så kummen får jevnt anlegg.

### Kontroll UNDER utførelse

**4. Plassering** — `valg`
- Innenfor ±30 mm høyde og ±100 mm side
- Avvik

> Kontroller kote og plassering mot tegningen før omfylling. Noter største avvik i kommentaren.

**5. Skjøter og gjennomføringer** — `valg`
- Pakninger på plass, tette skjøter
- Avvik

> Skjøter mellom elementene og gjennomføringer for ledninger skal ha pakning og sitte riktig. Hold minst 100 mm mellom kumveggen og ledninger som går forbi utenfor.

**6. Renneløp gjennom kummen** — `valg`
- Riktig løp og fall
- Ikke aktuelt
- Avvik

> Bunnseksjonen skal ha det løpet beskrivelsen angir, med jevnt fall gjennom kummen. Kum med mellomdekke skal ha nedstigningsåpningene forskjøvet i forhold til hverandre.

**7. Sandvolum og høyde til utløp** — `valg`
- Minst 0,8 m³ og 1 m
- Ikke sandfang
- Under kravet

> Gjelder sandfang: sandvolumet bør ikke være mindre enn 0,8 m³, og høyden fra bunn til utløp bør være minst 1 m.

**8. Omfylling rundt kummen** — `valg`
- Lagvis og komprimert, kummen står stødig
- Avvik

> Fyll og komprimer lagvis hele veien rundt, så kummen ikke forskyves eller kommer ut av lodd. Ikke tipp massene rett fra lasteplanet.

### Kontroll ETTER utførelse

**9. Justeringsringer og ramme** — `valg`
- Samlet høyde høyst 0,40 m
- Avvik

> Overdekningen over topplata skal være minst 0,3 m. Samlet høyde av justeringsringer og ramme bør ikke være over 0,40 m.

**10. Lokk eller rist** — `valg`
- Riktig styrkeklasse for stedet
- Avvik

> Styrkeklassen står i beskrivelsen: A 15, B 125, C 250, D 400 eller F 900. Lokk med lås eller pakning monteres der beskrivelsen krever det.

**11. Lokkhøyde mot dekket** — `valg`
- Vei eller plass: +0/−10 mm
- Grønt eller grøft: +10/−100 mm
- Avvik

> Mål mot ferdig dekke eller terreng. I vei og på plass skal lokket ikke stikke opp. I grøntanlegg og grøfter er kravet romsligere.

**12. Kummen er ren, innmålt og klar** — `trafikklys`

> Sand og slam er spylt ut, kummen er målt inn, og den er klar for prøving og overlevering. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

## 4. Rammer og DoD

- §7b-sjekk i `up1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `UP1 `, `Tabell U`, `figur U`, `NS-EN`,
  `NS 3420`, `NS 3139`, `NS 199` eller `VA/Miljø`. Styrkeklassene (A 15 … F 900) og «T-merket» er produktmerking og
  er tillatt — standarden bak dem navngis ikke.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Fasiten (§8) oppdateres i samme branch.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

**DoD:** som runde B, men for begge malene i runden samlet: steg 0 meldt · `UP1_MAL` og `FB1_MAL` ordrett · én testfil
per mal med §7b-sjekk, rød først · fasit oppdatert · gate-bygg med gate-tall (`pnpm exec turbo run test --force`) ·
lokal utskrift (`skriv-mal UP1 FB1`) limt i leveransen · SQL etter §8b (se § 5) · diff = `seed-bibliotek.ts`,
`up1-mal.test.ts`, `fb1-mal.test.ts`, `mal-fasit.snap.md` (+ generator bare hvis noe mangler — meld i så fall).

## 5. SQL

`generer-mal-sql.ts UP1 FB1 ny` → én fil, én transaksjon. Kapittel `UP` opprettes, `FB` finnes. Standard `NS3420-U` og
`NS3420-F` finnes begge (no-op).

**§8b:** generatoren endres ikke denne runden, men malene skal inn i test-arkivet — kjør derfor SQL-runden som vanlig.
Lag `runde-c-test.sql`, parse-test mot engangsdatabase, slett den etterpå, og lever de tre enlinjerne. **Ikke kjør mot
test selv.**
