# Ordre: FS2 – Utlegging av masser i lag (omkoding av FD2 + revisjon)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b. Samme mønster som FD1-ordren (`ordre-fd1-omkoding-design-2026-09-19.md`).
**Branch:** `feat/mal-fs2-omkoding` fra `origin/develop` (@ `3616d140` eller nyere — FD1 er merget).
**Gatet av Kenneth 2026-09-19:** fylling og lag i én mal, og feltlista under.

Dagens «FD2 – Fylling og komprimering» ligger i FD (uttak av løsmasser), men utlegging hører til FS. Omkodingen frigjør
også `FD2` til den nye grøftemalen (neste ordre).

---

## 0. Mål før du bygger (meld i leveransen)

1. **Test-DB (via seed-kunnskap, ikke kjør mot test):** `FD2` finnes i kapittel `FD`, standard `NS3420-F`. Kapittel `FS`
   finnes **ikke** — bekreft ut fra seed og FD1-kjøringen.
2. **Generatoren:** omkodingssporet (`--fra`) oppretter i dag ikke manglende målkapittel (kapittelopprettelsen er
   «kun for modus `ny`»). Bekreft.

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 26 og 210–225; PDF-side = normside + 12)

Egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Felles for all utlegging (s. 210):** største stein er maks 2/3 av lagtykkelsen. Komprimering og kontroll gjøres etter
klassene i beskrivelsen. Lagtykkelsen endrer seg når laget komprimeres.

**Fylling (s. 212–213):** massene skal ikke være i en tilstand som skader fyllingen (f.eks. frosne). Underlaget skal være
uten snø og is.

| Krav til fylling | Verdi |
|---|---|
| Høyde på topp | ±100 mm |
| Kant på topp og fot | +150 / −0 mm |
| Lagtykkelse etter komprimering | snittet ikke over kravet; enkeltmålinger kan avvike ±20 % |

**Lag (s. 219):** ulike masser skal ikke blandes. Vei og plass følger vegvesenets krav i beskrivelsen.

| Type lag | Høyde | Jevnhet, 3 m rettholt |
|---|---|---|
| Underlag/bærelag for konstruksjon | ±20 mm | ±10 mm |
| Bærelag av forkilt pukk på idrettsplass | ±15 mm | – |

**Klasser i beskrivelsen (s. 26):** komprimering normal, lett eller ingen · kontroll begrenset, normal eller utvidet.

## 2. Avgrensning (gatet av Kenneth)

**Med:** fylling (FS1.1) og utlegging av løsmasser i lag (FS2).
**Ute:** fyllingsdam (FS1.3) · utlegging i grøft (FS3 — egen mal) · tilbakefylling mot konstruksjoner (FS4) · under vann
(FS7) · lette masser (FS8.5) · vei- og jernbanekrav som bare står i vegvesenets og Bane NORs regelverk.

## 3. Omkoding (obligatorisk)

Samme bibliotekrad, ny kode og nytt kapittel. Ingen ny rad og ingen sletting.

| Felt i `bibliotek_maler` | Før | Etter |
|---|---|---|
| `referanse` | `FD2` | `FS2` |
| kapittel | `FD` | `FS` (nytt) |
| `navn` | FD2 – Fylling og komprimering | FS2 – Utlegging av masser i lag |

**Nytt kapittel** i `NS3420-F`: kode `FS`, navn «Utlegging av løsmasser». Legg det i `KAPITTEL_DATA_F` med sortering
etter normens rekkefølge (FB, FD, FH, FS …) — rør ikke sorteringen til eksisterende kapitler i test-DB utover det
nye kapittelet.

**Kjent mellomtilstand (ikke rett her):** FD3 (grunnforsterkning) står fortsatt under «Uttak av løsmasser», FC1 og FE1
i sine gamle kapitler.

## 4. Malen

```
kapittelKode: "FS"
referanse:    "FS2"
navn:         "FS2 – Utlegging av masser i lag"
beskrivelse:  "Utlegging av fylling og lag — masser, lagtykkelse, komprimering og toleranser. Faglig grunnlag: NS 3420-F:2024, post FS1 og FS2."
```

Eksporter som `FS2_MAL` og bruk den i F-arrayet der FD2-blokken står i dag.

### Kontroll FØR utførelse

**1. Type lag** — `valg`
- Fylling
- Forsterkningslag
- Bærelag
- Underlag for konstruksjon
- Annet – se beskrivelsen

> Typen lag avgjør hvilken høydetoleranse som gjelder. For vei og plass gjelder vegvesenets krav i beskrivelsen.

**2. Masser** — `valg`
- Riktig masse – vareseddel kontrollert
- Stedlige masser – godkjent
- Avvik – feil masse

> Sjekk vareseddelen mot beskrivelsen. Massene skal ikke være frosne eller på annen måte skade laget. Største stein er maks 2/3 av lagtykkelsen.

**3. Underlaget er klart** — `trafikklys`

> Underlaget er uten snø, is, organisk materiale og stående vann, og er godkjent før laget legges.

### Kontroll UNDER utførelse

**4. Lagtykkelse** — `valg`
- Innenfor angitt tykkelse
- For tykt – rettes

> Tykkelsen etter komprimering skal i snitt ikke være større enn kravet i beskrivelsen. Enkeltmålinger kan avvike ±20 %. Husk at laget synker når det komprimeres.

**5. Komprimering** — `valg`
- Normal – utført
- Lett – utført
- Ingen komprimering angitt
- Ikke som angitt – avvik

> Komprimer lag for lag slik beskrivelsen angir (normal, lett eller ingen), med utstyr og antall overfarter etter komprimeringsplanen.

**6. Kontroll av komprimering** — `valg`
- Utført – resultat godkjent
- Ikke angitt i beskrivelsen
- Under krav – avvik

> Beskrivelsen sier hvor mye som skal kontrolleres (begrenset, normal eller utvidet). Legg ved måleresultatet.

**7. Massene er ikke blandet** — `trafikklys`

> Ulike masser og lag er holdt adskilt.

### Kontroll ETTER utførelse

**8. Høyde på topp** — `valg`
- Fylling – innenfor ±100 mm
- Underlag for konstruksjon – innenfor ±20 mm
- Bærelag på idrettsplass – innenfor ±15 mm
- Krav i beskrivelsen – oppfylt
- Utenfor – avvik

> Kontroller toppen mot prosjektert høyde flere steder. Velg linjen for typen lag. Står det strengere krav i beskrivelsen, gjelder de. Noter største avvik i kommentaren.

**9. Jevnhet på 3 m rettholt** — `valg`
- Innenfor ±10 mm
- Ikke aktuelt
- Utenfor – avvik

> Gjelder underlag og bærelag for konstruksjoner. Et lag som skal forkiles, må være jevnt før forkilingen.

**10. Kant på topp og fot** — `valg`
- Innenfor +150/−0 mm
- Ikke aktuelt
- Utenfor – avvik

> Gjelder fylling. Kanten kan ligge inntil 150 mm utenfor prosjektert linje, men ikke innenfor.

**11. Laget er godkjent før neste lag legges** — `trafikklys`

> Laget oppfyller kravene over og er klart for neste lag eller neste arbeid. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

**Utgår fra FD2:** «Massetype» (erstattet av 1–2) · «Lagtykkelse (cm)», «Komprimeringsgrad (%)» og «Planhet – avvik (mm)»
(tallfelt, bryter §1) · «Overflate og drenering» (fall står ikke i FS) · tallene «60/30/50 cm», «Proctor ≥95/97 %» og
«±30 mm» (ikke i normgrunnlaget vårt) · alle hjelpetekster med normkoder.

## 5. Generatoren (obligatorisk)

1. **Manglende målkapittel ved omkoding:** `--fra` skal opprette målkapittelet hvis det mangler, i samme transaksjon og
   før `UPDATE … referanse`, med samme WHERE NOT EXISTS-mekanisme som modus `ny`. Finnes kapittelet, er det en no-op.
2. **Test:** utvid `generer-mal-sql.test.ts`: `FS2 revisjon --fra FD2` gir kapittel-INSERT før `UPDATE … referanse`;
   `FD1 revisjon --fra FB2` er uendret bortsett fra no-op-kapittelblokken (eller byte-lik — du velger, men meld hvilket).
   Rød først.
3. Resten som FD1: guard (avbryt hvis `FD2` mangler eller `FS2` finnes), `version = version + 1`, `DELETE` + `INSERT`,
   `\x on`-utskrift med kapittelkode og -navn før `COMMIT`.

Lag `fs2-test.sql`. Parse-test mot engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

## 6. Rammer

- §7b-sjekk i `fs2-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FD2`, `FS1 `, `FS2 `, `Tabell F`,
  `figur F`, `NS-EN`, `NS 3420` eller `NS 3458`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 7. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. `FS2_MAL` med 11 felt som over, ordrett. Kapittel `FS` i `KAPITTEL_DATA_F`.
3. `fs2-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Generatoren etter § 5, med tester. Rød først.
5. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
6. `fs2-test.sql`, parse-testet. Lever de tre enlinjerne.
7. Diff mot develop: `seed-bibliotek.ts`, `fs2-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.
   Må du røre en annen fil (som `mal-7b.test.ts` i FD1), meld hvorfor.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design forhåndssjekker tekstene, Kenneth
kjører SQL-en, design gater utskriften.

## 8. Neste i Del F (til orientering)

FD2 – Graving av grøft (ny, modus `ny`) · FC1 → FH1 · FE1 → FS3 eller FV3 (avklares mot normen).
