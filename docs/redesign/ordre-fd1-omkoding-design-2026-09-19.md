# Ordre: FD1 – Graving av byggegrop (omkoding av FB2 + revisjon)

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-19
**Metode:** MAL-METODE §1b, §1, §6a og §7b.
**Branch:** `feat/mal-fd1-omkoding` fra `origin/develop` (@ `f2867985` eller nyere).
**Gatet av Kenneth 2026-09-19:** omkoding av Del F, deling av gravemalen i FD1 (byggegrop) og FD2 (grøft), og
feltlista under.

Dette er første Del F-mal og første **omkoding**. Del F i seed ble bygget med koder som ikke finnes i normen
(verken 2008- eller 2024-utgaven): graving lå som «FB2» under FB, som er markrydding. Graving hører til FD
(uttak av løsmasser).

---

## 0. Mål før du bygger (meld i leveransen)

1. **Test-DB:** finnes `FB2` i standard `NS3420-F`, i hvilket kapittel, og hvilken `version`? Finnes kapitlene
   `FB` og `FD` med navnene «Graving, spunting, avstiving» og «Fylling og komprimering»?
2. **Lån:** hvor mange `organization_templates` har `laant_fra_bibliotek_mal_id` = FB2-malens id? (Bare tellingen.
   Koblingen går på id, så lånene beholder koblingen etter omkodingen.)
3. **Generatoren** har `STANDARD_KODE = "NS3420-K"` hardkodet. Bekreft at det er eneste hinder for Del F.

## 1. Normfakta — egen sammenstilling (NS 3420-F:2024, normside 44–51 og 56–58; PDF-side = normside + 12)

Skrevet med egne ord per valg i malen (§7b). Normsidene står for gatens skyld; de skal ikke inn i malen.

**Utførelse (FD generelt, s. 44):** gravingen skal ikke svekke stabiliteten i grunnen, ikke blande ulike masser,
ikke skade eksisterende ledninger, kabler og konstruksjoner, og ikke skade røtter til trær som skal stå.

**Toleranser:**

| Hva | Krav når beskrivelsen ikke sier noe annet | Normside |
|---|---|---|
| Sideavvik, all graving på land | ±150 mm | 47 |
| Bunnhøyde, graving til generelle gravenivåer | ±100 mm | 50 |
| Bunnhøyde, groper | ±100 mm | 57 |
| Strengere bunnkrav | løses med egen avretting etterpå | 51, 57 |

**Avstand fra skråning eller avstiving til fundament (s. 45–46):** fundament inntil 1,0 m høyt: minst 1,0 m.
Høyere fundament: minst 1,5 m. Gjelder betongvegger og -fundamenter, ikke rør og ledninger.

**Grunnforhold (s. 49):** beskrivelsen peker til geoteknisk rapport — jordart, kvikkleire, myr, grunnvann, fyllmasser,
fare for omrøring av leire og silt.

**Groper (s. 56):** lokale groper som fundament-, heis- og mastegroper, kummer og plantehull. Samme bunntoleranse
som over.

## 2. Avgrensning (gatet av Kenneth)

**Med:** graving til generelle gravenivåer (byggegrop, FD1.1) og groper (FD3.1).
**Ute:** grøft (FD2 — egen mal i neste ordre) · graving under vann (FD5) · forgraving (FD4) · avstivingssystemet selv
(egen normdel) · avretting (FF1).

## 3. Omkoding (obligatorisk)

Samme bibliotekrad, ny kode og nytt kapittel. **Ingen ny rad og ingen sletting** — lånene skal beholde koblingen.

| Felt i `bibliotek_maler` | Før | Etter |
|---|---|---|
| `referanse` | `FB2` | `FD1` |
| kapittel | `FB` | `FD` |
| `navn` | FB2 – Graving | FD1 – Graving av byggegrop |

Kapittelnavn i standard `NS3420-F` rettes til normen:

| Kode | Før | Etter |
|---|---|---|
| `FB` | Graving, spunting, avstiving | Markrydding |
| `FD` | Fylling og komprimering | Uttak av løsmasser |

**Kjent mellomtilstand (ikke rett her):** FB4 (spunt) blir stående under «Markrydding», og FD2 (fylling) og FD3
(grunnforsterkning) under «Uttak av løsmasser», til de omkodes i egne ordrer. FB4 og FD3 er parkert av Kenneth.

## 4. Malen

```
kapittelKode: "FD"
referanse:    "FD1"
navn:         "FD1 – Graving av byggegrop"
beskrivelse:  "Graving av byggegrop og groper — påvisning, sikring, bunn og toleranser. Faglig grunnlag: NS 3420-F:2024, post FD1 og FD3."
```

Eksporter som `FD1_MAL` og bruk den i F-arrayet der FB2-blokken står i dag. Kapittellista i seed får navnene fra § 3.
Seeden oppretter kun, som før.

### Kontroll FØR utførelse

**1. Kabler og ledninger påvist** — `valg`
- Påvist og merket i terrenget
- Ingen i området – bekreftet
- Ikke påvist – stopp graving

> Kabler og ledninger skal være påvist og merket før gravingen starter. Ledninger som blir avdekket, skal sikres. Ta bilde av merkingen.

**2. Grunnforhold** — `valg`
- Som i geoteknisk rapport
- Avvik fra rapporten – meldt til prosjekterende
- Ingen rapport – vurdert på stedet

> Sjekk jordart, grunnvann og fare for kvikkleire mot rapporten. Leire og silt kan miste fastheten når de røres opp — grav forsiktig der beskrivelsen krever det.

**3. Utstikking etter tegning** — `trafikklys`

> Gravegrense, skråning og bunnhøyde er stukket ut etter tegningen før gravingen starter.

### Kontroll UNDER utførelse

**4. Skråning og sikring** — `valg`
- Skråning etter tegning – stabil
- Avstivet
- Ustabil – stopp og sikre

> Gravingen må ikke svekke stabiliteten i grunnen. Groper dypere enn 2 m sikres med avstiving eller forsvarlig skråning. Vurder stabiliteten uansett dybde, og på nytt etter nedbør.

**5. Vannhåndtering** — `valg`
- Tørt – ingen tiltak
- Lensing/pumpe etablert – kontrollert
- Drenering/avskjæringsgrøft etablert
- Vanninntrengning – ustabil skråningsfot – stopp

> Vann i gropa graver ut skråningsfoten. Kontroller ved hver arbeidsstart og etter nedbør. Pump ut vannet før noen går ned.

**6. Masser holdt adskilt** — `trafikklys`

> Ulike typer masser er ikke blandet. Vekstjord er tatt av for seg før gravingen.

**7. Eksisterende anlegg og trær som skal stå, er ikke skadet** — `trafikklys`

> Ledninger, kabler, konstruksjoner og røtter til trær som skal bevares, er ikke skadet av gravingen.

### Kontroll ETTER utførelse

**8. Bunnhøyde** — `valg`
- Innenfor ±100 mm
- Strengere krav i beskrivelsen – oppfylt
- Utenfor – krever avretting

> Kontroller bunnen mot prosjektert høyde flere steder. Tillatt avvik er ±100 mm når beskrivelsen ikke sier noe annet. Trengs strengere krav, avrettes bunnen etterpå. Noter største avvik i kommentaren.

**9. Sideavvik** — `valg`
- Innenfor ±150 mm
- Utenfor – avvik

> Kontroller gravegrensen mot utstikkingen. Tillatt sideavvik er ±150 mm når beskrivelsen ikke sier noe annet.

**10. Avstand fra skråning til fundament** — `valg`
- Oppfyller minsteavstanden
- Ikke aktuelt – ingen fundament
- For smalt – avvik

> Fundament inntil 1,0 m høyt: minst 1,0 m fra fundamentkanten til skråningen eller avstivingen. Høyere fundament: minst 1,5 m. Beskrivelsen kan kreve mer. Gjelder ikke rør og ledninger.

**11. Bunnen er ren, ikke omrørt og klar for neste arbeid** — `trafikklys`

> Bunnen er fri for løse masser, ikke forstyrret eller frossen, og godkjent før fundament, ledning eller fylling legges. Ta bilde.

**Helpers:** `valg`, `trafikklys`. Ingen tallfelt, ingen hardkodet JSON.

**Utgår fra FB2:** «Graveprofil kontrollert» (erstattet av 3) · «Avvik fra prosjektert profil (mm)» (tallfelt, bryter
§1 — erstattet av 8 og 9) · «Gravebunn godkjent for neste operasjon» (inn i 11) · «Grøft sikret» (til FD2) ·
alle hjelpetekster med normkoder.

## 5. Generatoren (obligatorisk)

1. **Standard per mal:** generatoren skal finne standarden malen hører til (`NS3420-K` eller `NS3420-F`) i stedet for
   hardkodet `NS3420-K`. Velg selv mekanismen (felt på konstanten eller oppslag via F-/K-arrayet), men K-malene skal
   gi byte-lik SQL som i dag bortsett fra genereringstidspunktet.
2. **Omkoding:** `revisjon` får et valg for gammel referanse, f.eks.
   `generer-mal-sql.ts FD1 revisjon --fra FB2`. I samme transaksjon, før revisjonen:
   `UPDATE bibliotek_maler SET referanse = 'FD1', kapittel_id = <FD i NS3420-F> WHERE referanse = 'FB2'` innenfor
   standarden. Avbryt med klartekst hvis `FB2` ikke finnes, eller hvis `FD1` allerede finnes.
3. **Kapittelnavn:** `UPDATE` av `FB` og `FD` i `NS3420-F` til navnene i § 3, i samme fil. Håndskrevet eller
   generert, du velger — men ikke som generell generatorlogikk.
4. Resten som §6a: `version = version + 1`, `DELETE` + `INSERT` av objekt-radene, `\x on`-utskrift før `COMMIT`.
   Utskriften skal også vise kapittelkode og -navn for malen.
5. **Test:** utvid `generer-mal-sql.test.ts`: `--fra` gir `UPDATE … referanse` før `DELETE`; en K-mal gir fortsatt
   `NS3420-K`; FD1 gir `NS3420-F`. Rød først.

Lag `fd1-test.sql`. Parse-test den mot en engangsdatabase og slett den etterpå. **Ikke kjør mot test selv.**

## 6. Rammer

- §7b-sjekk i `fd1-mal.test.ts`: ingen hjelpetekst eller alternativ inneholder `FB2`, `FD1 `, `FD3 `, `Tabell F`,
  `figur F`, `NS-EN` eller `NS 3420`.
- Ingen eksterne NS-referanser i malen → ingen rad i NS-loggen. Kjør NS-sjekken og meld at den er tom.
- Ingen i18n-nøkler. Prod-gaten røres ikke.

## 7. Definition of Done

**Obligatorisk:**
1. Steg 0 meldt.
2. `FD1_MAL` med 11 felt som over, ordrett. Kapittelnavn i seed som § 3.
3. `fd1-mal.test.ts`: antall, rekkefølge, typer, faser, navn og §7b-sjekken. Rød først.
4. Generatoren etter § 5, med tester. Rød først.
5. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
6. `fd1-test.sql`, parse-testet. Lever de tre enlinjerne.
7. Diff mot develop: `seed-bibliotek.ts`, `fd1-mal.test.ts`, `generer-mal-sql.ts`, `generer-mal-sql.test.ts`.
   Ingenting annet.

**Valgfritt:** vise at `generer-mal-sql.ts KD2 ny` gir samme SQL som før endringen, bortsett fra tidspunktet.

Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Etter Kenneths kjøring limer han
utskriften til design, og design svarer «Designgatet – klar for merge» eller «Avvik: …».

## 8. Neste i Del F (til orientering, ikke del av ordren)

FD2 – Graving av grøft (ny) krever at dagens `FD2` (fylling) er omkodet først, ellers kolliderer referansen.
Rekkefølge: FD2 fylling → FS2 · FD2 grøft (ny) · FC1 → FH1 · FE1 → FS3 eller FV3 (avklares mot normen).
