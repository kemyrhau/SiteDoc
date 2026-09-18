# Ordre: KD2 – Setting av kantstein (ny mal) + generell SQL-generator

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-18
**Metode:** MAL-METODE — les **§1b først** (felles regler for design og mal-Opus), deretter §1, §6, §6a og §7b.
**Branch:** `feat/mal-kd2-ny` fra `origin/develop` **etter at KD1 (`51caefda`) er merget**. KD2 skal ligge etter
`KD1_MAL` i fila, og uten KD1 i develop får du konflikt.
**Gatet av Kenneth 2026-09-18:** avgrensning og feltliste.

Dette er første **nye** mal (ikke revisjon) og første mal med den generelle generatoren. Begge deler er
obligatoriske.

---

## 1. Normfakta — egen sammenstilling (NS 3420-K:2024, normside 88–97)

Skrevet med egne ord per valg i malen (MAL-METODE §7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Hva som regnes som kant (s. 88):** kantstein med vishøyde over 300 mm regnes som mur (hører til KM2), ikke kant.

**Krav per kantsteinstype** (målelengde 3 m der det gjelder, s. 89):

| Kantsteinstype i malen | Linjeføring langs toppen | Planhet overside og visflate | Største sprang ved fuger | Frostmerking (s. 91, 94) |
|---|---|---|---|---|
| Naturstein – råkilt | innenfor 8 mm | innenfor 7 mm | 4 mm | F1 |
| Naturstein – gradet eller flammet | innenfor 6 mm | innenfor 5 mm | 3 mm | F1 |
| Betongkantstein | innenfor 5 mm | innenfor 4 mm | 3 mm | klasse 3, merket D |

**Utførelse (s. 88–89, 91):**
- Kantsteinen følger rette linjer eller jevne buer, både i høyde og til siden.
- Alle synlige flater, også endene, har samme struktur.
- Satt i betong: minst 100 mm betong under hele steinen. Forkant tilpasset vishøyden og tykkelsen på belegget.
  Bakkant så høy som mulig, tilpasset eventuelt belegg.
- For- og bakstøp pakkes og glattes så steinen får god støtte, og legges samtidig med settelaget og settingen så
  betongen herder jevnt.
- Der det fuges: fugemassen pakkes godt og glattes med svakt inntrukket overflate. Synlige flater rengjøres for
  fugemasse.
- Naturstein med presise fugesider settes med fugeavstand.
- Kurver med radius under 20 m: radiushogd stein anbefales (s. 91, merknad).
- Betong i settelag beskyttes mot uttørking og frost (KD-fellesdelen, s. 65).

**Montering (s. 95):** i betong, limt, spikret, annet.

## 2. Avgrensning (gatet av Kenneth)

**Med:** kantstein av naturstein (KD2.2) og betongkantstein (KD2.3).
**Ute:** plasstøpte/profilstøpte kanter (KD2.4 — ingen toleranser eller utførelseskrav i normen, annen metode) ·
stålkanter (KD2.5) · kanter av andre materialer (KD2.7) · referansefelt (KD2.1) · vishøyde over 300 mm (mur, KM2).

## 3. Malen

```
kapittelKode: "KD"
referanse:    "KD2"
navn:         "KD2 – Setting av kantstein"
beskrivelse:  "Setting av kantstein av naturstein og betong — fundament, linjeføring, planhet og fuger. Faglig grunnlag: NS 3420-K:2024, post KD2."
```

Eksporter som `KD2_MAL` (samme mønster som `KD1_MAL` og `KC31_MAL`) og legg den inn i K-arrayet rett etter KD1.
`verifisert: false` arves. Seeden oppretter kun (`opprettMalHvisMangler`).

### Kontroll FØR utførelse

**1. Kantsteinstype** — `valg`
- Naturstein – råkilt
- Naturstein – gradet eller flammet
- Betongkantstein
- Annet – se beskrivelsen

> Styrer kravene til linjeføring, planhet og sprang i feltene under. Kontroller frostmerkingen på pallen: naturstein F1, betong klasse 3 merket D. Ta bilde av pallelapp eller leveringsseddel. I kurver med radius under 20 m bør steinen være radiushogd.

**2. Montering** — `valg`
- I betong (for- og bakstøp)
- Limt
- Spikret
- Annet – se beskrivelsen

> Settes kantsteinen i betong, må betongen beskyttes mot uttørking og frost.

**3. Vishøyde iht. beskrivelsen** — `trafikklys`

> Vishøyden er det som står over ferdig terreng eller belegg. Er den over 300 mm, er det en mur og ikke en kant — bruk malen for mur.

### Kontroll UNDER utførelse

**4. Minst 100 mm betong under hele steinen** — `trafikklys`

> Gjelder kantstein satt i betong. Forkant tilpasset vishøyden og belegget, bakkant så høy som mulig. Ta bilde før gjenfylling.

**5. For- og bakstøp pakket, glattet og lagt samtidig med settingen** — `trafikklys`

> Gir god støtte for steinen og jevn herding. Legg for- og bakstøp i samme arbeidsgang som settelaget og steinen.

### Kontroll ETTER utførelse

**6. Linjeføring i høyde og side** — `valg`
- OK – innenfor 5 mm
- OK – innenfor 6 mm
- OK – innenfor 8 mm
- Avvik – utenfor toleransen for steintypen

> Målt langs toppen av visflaten over 3 m: betong 5 mm, gradet eller flammet naturstein 6 mm, råkilt naturstein 8 mm. Kantene skal følge rette linjer eller jevne buer. Ved avvik: noter største måling og sted i kommentaren.

**7. Planhet på overside og visflate** — `valg`
- OK – innenfor 4 mm
- OK – innenfor 5 mm
- OK – innenfor 7 mm
- Avvik – utenfor toleransen for steintypen

> Svanker og bulninger over 3 m: betong 4 mm, gradet eller flammet naturstein 5 mm, råkilt naturstein 7 mm. Ved avvik: noter største måling og sted i kommentaren.

**8. Største sprang ved fuger (mm)** — `heltall`, `{ enhet: "mm" }`, ingen `maks`

> Største tillatte sprang: betong og gradet eller flammet naturstein 3 mm, råkilt naturstein 4 mm. Før inn den største målingen (hele mm).

**9. Fuger og synlige flater** — `trafikklys`

> Fugene er godt pakket og svakt inntrukket, og synlige flater er rengjort for fugemasse. Naturstein med presise fugesider er satt med fugeavstand. Alle synlige flater, også endene, har samme struktur.

**10. Krav oppfylt og dokumentasjon levert** — `trafikklys`

> Kanten oppfyller kravene over og er klar for overlevering. Ta bilde av ferdig kant.

**Helpers:** `valg`, `trafikklys`, `heltall`. Ingen hardkodet JSON.

## 4. Generell SQL-generator (obligatorisk, MAL-METODE §1b pkt 4)

Lag **`packages/db/prisma/generer-mal-sql.ts`**, som erstatter engangsgeneratorer per mal:

- Kjøres som `pnpm --filter @sitedoc/db exec tsx prisma/generer-mal-sql.ts <REF> <modus>`, der `<modus>` er
  `ny` eller `revisjon`, og skriver `<ref>-test.sql` (gitignorert).
- Finner mal-konstanten for `<REF>` blant de eksporterte `*_MAL`-konstantene. Ukjent referanse: stopp med klartekst.
- Bygger objekt-radene med `byggBibliotekRader` — samme funksjon som seeden, så SQL og seed aldri kan skille lag.
- **`ny`:** `INSERT` i `bibliotek_maler` (kapittel slås opp på `bibliotek_kapitler.kode` = malens `kapittelKode`
  innenfor standarden NS3420-K; `version = 1`, `verifisert = false`, `mal_innhold = '[]'`) + `INSERT` av objekt-radene.
  Avbryt med klartekst hvis referansen allerede finnes.
- **`revisjon`:** som `kd1-test.sql`: metadata-`UPDATE` med `version = version + 1` (Int — **ikke** tekstfeltet
  `versjon`), `DELETE` av malens objekt-rader, `INSERT` av de nye. Avbryt hvis referansen ikke finnes.
- Begge: `BEGIN … COMMIT`, og før `COMMIT` full utskrift etter §6a (`\x on`, metadata + alle objekt-rader i
  rekkefølge med type, label, alternativer og hjelpetekst).
- **Test** (`generer-mal-sql.test.ts`, ren unit, ingen DB): for `ny` inneholder SQL-en `version`-verdi 1 og ingen
  `DELETE`; for `revisjon` inneholder den `version = version + 1` og `DELETE`; begge inneholder `\x on`. Rød først.

Lag `kd2-test.sql` med modus `ny`. Parse-test den mot en engangsdatabase slik du gjorde for KD1, og slett databasen
etterpå.

## 5. Rammer

- Normkoder aldri i hjelpetekster (§7b). Legg til samme sjekk som i `kd1-mal.test.ts`: ingen hjelpetekst i KD2
  inneholder `Tabell K`, `KD2 c` eller `NS-EN`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken likevel og meld at den er tom.
- Ingen i18n-nøkler (kun malinnhold).
- Seeden oppretter kun. Prod-gaten røres ikke.

## 6. Definition of Done

**Obligatorisk:**
1. `KD2_MAL` i `seed-bibliotek.ts` med 10 felt som over, ordrett.
2. `kd2-mal.test.ts`: antall, rekkefølge, typer, faser, navn, og §7b-sjekken. Rød først.
3. `generer-mal-sql.ts` + `generer-mal-sql.test.ts`. Rød først.
4. Gate-bygg (§6 pkt 5) med gate-tall i formatet `unit-mock · unit-ren · integrasjon · e2e`.
5. `kd2-test.sql` (modus `ny`), parse-testet. Lever de tre enlinjerne. **Ikke kjør mot test selv.**
6. Diff mot develop: `seed-bibliotek.ts`, `kd2-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.
   Ingenting annet.

**Valgfritt:** kjøre generatoren i modus `revisjon` for KD1 og vise at resultatet er likt dagens `kd1-test.sql`
bortsett fra genereringstidspunkt. **Ikke kjør den mot test** — KD1 er alt kjørt (§1b pkt 5).

Etter Kenneths kjøring limer han utskriften til design, og design svarer «Designgatet – klar for merge» eller
«Avvik: …».
