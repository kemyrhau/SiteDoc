# Ordre: KD1-revisjon — Utendørs belegg

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design-rollen (overtatt etter Fabel) · **Dato:** 2026-09-18
**Metode:** MAL-METODE (`docs/claude/MAL-METODE.md`) — §1 designregler, §6 steg for steg, §6a test-SQL, §7 NS-logg
**Fil:** `packages/db/prisma/seed-bibliotek.ts`, **kun KD1-blokken** (i dag ca. linje 411–433 på develop). `referanse: "KD1"` **RØRES IKKE**.
**Branch:** `feat/mal-kd1-revisjon` fra `origin/develop`
**Innhold gatet av Kenneth 2026-09-18:** avgrensning og feltliste. Feltformene er strammet inn mot MAL-METODE §1 etter gaten — se § 0.

---

## 0. To presiseringer etter Kenneths gate (meldt ham samtidig med denne ordren)

Feltlista Kenneth godkjente hadde fall og planhet som tallfelt, og tykkelse og fugebredde som heltall.
**MAL-METODE §1 sier at krav mot en flate som varierer besvares med samsvar, per kravnivå — ikke med tallfelt.**
Derfor:
- **Fall** → trafikklys (samme som KB2 v2).
- **Planhet** → enkeltvalg per kravnivå (samme som KB2 v2).
- **Tykkelse settelag** og **fugebredde** → enkeltvalg per kravnivå. Kravet er et intervall (20–40 mm osv.), ikke ett tall.
- **Største sprang ved fuger** forblir heltall: det er én veldefinert måling (den største).

Antall felt, navn og faser er uendret: 10 felt.

## 1. Normfakta (NS 3420-K:2024, normside 62–83)

Alt mal-Opus trenger. Ingen normtekst gjengis ordrett i hjelpetekstene (MAL-METODE §7a) — referer til post og tabell.

**Omfang (KD a1, a2):** belegg lagt i settelag av løsmasser eller betong. Prisen inkluderer settelag, komprimering, fuging.
**Asfalt hører IKKE til KD1** — KD1 henviser asfaltdekker til IH (normside 66).

**Tabell K9 — tykkelse på settelag (mm):**
| Type | Tykkelse |
|---|---|
| Storgatestein, smågatestein | 50–70 |
| Mosaikkstein, natursteinsplater, belegningsstein av naturstein, støtdempende | 30–50 |
| Belegningsstein av betong og tegl, betongheller | 20–40 |

c2: med snøsmelteanlegg gjelder leverandørens anvisning. **c8:** belegg på settelag av løsmasser settes med **overhøyde +3–5 mm** etter komprimering (alle unntatt gatestein). **c9:** gatestein **+8–12 mm**.

**Matrise KD:1 — settelag:** natursand · betong · knust 0/8 · knust 0/11 · knust 2/8 · knust 2/11 · annet.
Merknad: anbefalt 0/8 eller 0/11 til belegningsstein og gatestein · 2/8 til natursteinsplater og betongheller · 2/11 ved maskinlegging.
**Matrise KD1.74:1 (permeabelt):** knust 2/5 · 2/8 · 2/11.
**Betong i settelag:** Tabell K7. **KD c2:** betong og mørtel i settelag og fuger skal ikke utsettes for uttørking eller frost.

**Tabell K10 — fugebredde (mm):**
| Type | Fugebredde |
|---|---|
| Gatestein (stor, små, mosaikk), belegningsstein av naturstein med råhogde sider | knas |
| Belegningsstein av naturstein, sagde sider | 5–7 |
| Natursteinsplater, sagde sider, tykkelse < 80 | 5–8 |
| Natursteinsplater, sagde sider, tykkelse 80–150 | 9–12 |
| Betongheller, belegningsstein av betong | 2–5 |
| Natursteinsplater > 150 / råhogde kanter / bruddheller · permeable · tegl · støtdempende | angitt i posten |

**Toleranser (KD1 d1, d2):** natursteinsplater med sagde sider < 150 mm, klasse 1 etter NS-EN 1341: tillatt avvik på fugebredde ved enkeltsteiner **±2 mm**. Belegningsstein av naturstein: **±3 mm**.

**Tabell K11 — minste fall** (hvis ikke annet er angitt):
| Type | Kjøreareal | Gangareal |
|---|---|---|
| Gatestein | 3 % | 2 % |
| Permeable belegg | angitt i posten | angitt i posten |
| Øvrige belegg | 2,5 % | 2 % |

**Tabell K12 — planhet (svanker og bulninger, målelengde 3,0 m) og største vertikale sprang ved fuger (mm):**
| Type | Planhet kjøre | Planhet gang | Sprang kjøre | Sprang gang |
|---|---|---|---|---|
| Storgatestein | ±8 | ±5 | 8 | 5 |
| Smågatestein, mosaikkstein | ±5 | ±3 | 5 | 3 |
| Natursteinsplater, naturplan/råkilt/råhogd | ±10 | ±8 | 8 | 6 |
| Natursteinsplater, saget/flammet/gradhogd | ±8 | ±5 | 6 | 4 |
| Belegningsstein av naturstein, betongheller, belegningsstein av betong og tegl | ±5 | ±3 | 3 | 2 |
| Permeabelt dekke av maskinlagt betongstein (industri) | ±6 (±10) | ±3 | 3 (3) | 2 |
| Støtdempende belegg | – | ±3 | – | 3 |

**Utførelse, øvrig:** **c5** gjennomgående fuger danner rette linjer eller jevne kurver · **c6** striper danner rette linjer eller jevne kurver · **c7** steinene rengjøres for fugemateriale · **KD c1** tilpasningsstykker ikke mindre enn 30 % av normalstørrelsen · **KD1.22 c1/c2** gatestein settes i forband; rett forband forskyves minst 1/3 steinlengde, i buer (smågatestein) minst 1/5.

**Materialkrav (b) — frostklasse per type** (dokumenteres med pallelapp/leveringsseddel):
| Type | Standard | Frost |
|---|---|---|
| Gatestein, belegningsstein av naturstein | NS-EN 1342 | F1 |
| Natursteinsplater | NS-EN 1341 | F1 |
| Betongheller | NS-EN 1339 | klasse 3, merket D |
| Belegningsstein av betong | NS-EN 1338 | klasse 3, merket D |
| Belegningsstein av tegl | NS-EN 1344 | FP100 |

Utgave på NS-EN-standardene er **ikke oppgitt** i denne ordren. Referer uten årstall, og la NS-loggen flagge «utgave mangler» (MAL-METODE §7a pkt 2).

## 2. Avgrensning (gatet av Kenneth 2026-09-18)

**Med:** gatestein (KD1.22), natursteinsplater (KD1.23), belegningsstein av naturstein (KD1.25), betongheller (KD1.4), belegningsstein av betong (KD1.5) og tegl (KD1.6), permeabelt belegg (KD1.74).
**Utenfor:** støtdempende belegg (KD1.72, lekeplass) · terrasse av tre (KD1.75) · referansefelt (KD1.1) · merkostnader (KD1.81/82) · asfalt (IH). Kanter (KD2) blir egen mal.

## 3. Feil som rettes i dagens seed

| Dagens felt | Feil | Rettes til |
|---|---|---|
| Belegningstype: «Asfalt» | Asfalt er IH, ikke KD1 | Fjernes. Typelista følger Tabell K9–K12 |
| «Fall gangarealer (%)» og «Fall kjørearealer (%)» med `min` i config | To felt for ett krav, fast grense, mangler gatestein 3 %, blokkerer avvik | Ett trafikklys «Fall iht. Tabell K11» |
| «Planhet over 3 m (mm)» med `toleranse: 3` | Kravet varierer ±3 til ±10; tallfelt på varierende flate | Enkeltvalg per kravnivå |
| «Vertikalt sprang fuger (mm)» med `maks: 2` | Kravet varierer 2–8; `maks` blokkerer avvik | Heltall uten maks, navn «Største …» |
| «Underlag» (FØR) | Underlaget er FF1/FS8.2, ikke KD1 (normside 62 «Henvisninger») | Erstattes av «Settelag» |
| – | Mangler tykkelse settelag (K9), fugebredde (K10), areal, konklusjon | Legges til |
| Hjelpetekst «Tabell K12: belegningsstein gang ±3, kjøre ±5» | Dekker bare én rad | Full tabell i hjelpeteksten |

## 4. Full feltliste

**Navn:** `KD1 – Utendørs belegg` (normens tittel; i dag «Utendørsbelegg»).
**Beskrivelse:** `Legging av stein- og hellebelegg (KD1.2–KD1.6, KD1.74) — settelag, fuger, fall og planhet iht. Tabell K9–K12`

### Kontroll FØR utførelse

**1. Belegningstype** — `valg`
Alternativer:
- Storgatestein
- Smågatestein
- Mosaikkstein
- Natursteinsplater – sagde sider
- Natursteinsplater – råhogde kanter / bruddheller
- Belegningsstein av naturstein
- Betongheller
- Belegningsstein av betong
- Belegningsstein av tegl
- Permeabelt belegg
- Annet – se beskrivelsen

Hjelpetekst: «Styrer hvilken rad i Tabell K9–K12 som gjelder for settelag, fugebredde, fall og planhet. Kontroller frostklassen i merkingen: gatestein og naturstein F1 (NS-EN 1342/1341), betongheller og betongstein klasse 3 merket D (NS-EN 1339/1338), tegl FP100 (NS-EN 1344). Ta bilde av pallelapp eller leveringsseddel.»

**2. Areal** — `valg`
Alternativer: `Gangareal` · `Kjøreareal`
Hjelpetekst: «Styrer kravene til fall (Tabell K11) og planhet og sprang (Tabell K12). Kjøreareal har strengere fallkrav og videre planhetstoleranse.»

**3. Settelag** — `valg`
Alternativer:
- Natursand
- Betong
- Knust 0/8
- Knust 0/11
- Knust 2/8
- Knust 2/11
- Knust 2/5 (permeabelt)
- Annet – se beskrivelsen

Hjelpetekst: «Matrise KD:1. Anbefalt: 0/8 eller 0/11 til belegningsstein og gatestein, 2/8 til natursteinsplater og betongheller, 2/11 ved maskinlegging. Permeabelt belegg: 2/5, 2/8 eller 2/11. Betong i settelag: Tabell K7, og skal ikke utsettes for uttørking eller frost (KD c2).»

### Kontroll UNDER utførelse

**4. Tykkelse settelag** — `valg`
Alternativer:
- OK – 20–40 mm (betongstein, betongheller, tegl)
- OK – 30–50 mm (mosaikk, natursteinsplater, belegningsstein av naturstein)
- OK – 50–70 mm (stor- og smågatestein)
- OK – iht. leverandør (snøsmelteanlegg)
- Avvik – utenfor intervallet for belegningstypen

Hjelpetekst: «Tabell K9. På settelag av løsmasser: sett med overhøyde +3–5 mm etter komprimering, gatestein +8–12 mm (KD1 c8/c9). Ved avvik: noter målt tykkelse og sted i kommentaren.»

**5. Fall iht. Tabell K11** — `trafikklys`
Hjelpetekst: «Hvis ikke annet er angitt: gatestein 3 % kjøreareal / 2 % gangareal, øvrige belegg 2,5 % / 2 %. Permeable belegg: fall angitt i posten. Kontroller flere punkter. Ved avvik: noter målt fall og sted i kommentaren.»

*(Merk: fallet kontrolleres under legging, mens settelaget avrettes. Derfor UNDER, ikke ETTER som i KB2.)*

**6. Fuger og striper – rette linjer / jevne kurver** — `trafikklys`
Hjelpetekst: «KD1 c5/c6: gjennomgående fuger og striper danner rette linjer eller jevne kurver. Gatestein settes i forband, rett forband forskjøvet minst 1/3 steinlengde, i buer minst 1/5 (KD1.22 c1/c2). Tilpasningsstykker minst 30 % av normalstørrelsen (KD c1).»

### Kontroll ETTER utførelse

**7. Fugebredde** — `valg`
Alternativer:
- OK – knas (gatestein, råhogd naturstein)
- OK – 2–5 mm (betongheller, betongstein)
- OK – 5–7 mm (belegningsstein av naturstein, sagde sider)
- OK – 5–8 mm (natursteinsplater, sagde, under 80 mm)
- OK – 9–12 mm (natursteinsplater, sagde, 80–150 mm)
- OK – iht. beskrivelsen (tegl, permeabelt, bruddheller, over 150 mm)
- Avvik – utenfor kravet for belegningstypen

Hjelpetekst: «Tabell K10. Tillatt avvik ved enkeltsteiner: ±2 mm for sagde natursteinsplater klasse 1, ±3 mm for belegningsstein av naturstein (KD1 d1/d2). Ved avvik: noter målt bredde og sted i kommentaren.»

**8. Planhet – svanker/bulninger over 3 m** — `valg`
Alternativer:
- OK – innenfor ±3 mm
- OK – innenfor ±5 mm
- OK – innenfor ±6 mm
- OK – innenfor ±8 mm
- OK – innenfor ±10 mm
- Avvik – utenfor toleransen for type og areal

Hjelpetekst: «Tabell K12, gang/kjøre: betongstein, betongheller, tegl og belegningsstein av naturstein ±3/±5 · smågatestein og mosaikk ±3/±5 · storgatestein ±5/±8 · sagde natursteinsplater ±5/±8 · råhogde natursteinsplater ±8/±10 · permeabelt maskinlagt ±3/±6. Mål med 3 m rettholt på flere steder og velg raden som gjelder. Ved avvik: noter største måling og sted i kommentaren.»

**9. Største vertikale sprang ved fuger (mm)** — `heltall`, `{ enhet: "mm" }`, **ingen `maks`**
Hjelpetekst: «Tabell K12, gang/kjøre: betongstein, betongheller, tegl og belegningsstein av naturstein 2/3 · smågatestein og mosaikk 3/5 · storgatestein 5/8 · sagde natursteinsplater 4/6 · råhogde natursteinsplater 6/8. Før inn den største målingen (hele mm).»

**10. Krav oppfylt og dokumentasjon levert** — `trafikklys`
Hjelpetekst: «Belegget oppfyller kravene over, steinene er rengjort for fugemateriale (KD1 c7), og flaten er klar for overlevering. Ta bilde av ferdig belegg.»

**Helpers:** `valg`, `trafikklys`, `heltall` finnes alle i fila. Ingen nye helpers, ingen hardkodet JSON.

## 5. MK C-absorbering

| Rad | Felt | Blir |
|---|---|---|
| KD1 :306 | Fuger – rette linjer/jevne kurver | **Felt 6**, beholdt som trafikklys, utvidet med striper (c6) og forband. Raden strykes fra `kp-mk-c-konverteringsliste-2026-09-11.md` ved gate |

Ingen andre KD1-rader i lista.

## 6. Rammer (arves)

- Hjelpefunksjonene, aldri hardkodet JSON.
- `verifisert: false` arves fra seed-loopen. **Prod-gaten røres ikke.**
- Seeden oppretter kun (`opprettMalHvisMangler`). Revisjonen går til test via `.sql` (§6a).
- Ingen intern sjargong i kundetekst. Ingen «MK C», «fabel», «Vei B» i hjelpetekster.
- **Vedtaket 2026-09-18 (domene-arbeidsflyt.md):** sjekklisten dokumenterer utført arbeid og at objektet er klart for overlevering. Ingen felt om oppfølging i ettertid. Denne feltlista er kontrollert mot det.
- Ingen nye synlige strenger utenfor malinnholdet → ingen i18n-nøkler.

## 7. Definition of Done

1. Seed lokalt to ganger (idempotens), MAL-METODE §6 pkt 4. Slett lokal KD1-rad først.
2. Gate-bygg §6 pkt 5. **Gate-tall** i formatet `unit-mock · unit-ren · integrasjon · e2e`.
3. **Test som låser 10 felt** (samme mønster som `kc31-mal.test.ts`): antall, typer, faser, og at «Asfalt» ikke finnes. Kjør rød mot dagens 7-felts seed før du endrer.
4. `kd1-test.sql` (gitignorert, som kb2/kb4/kb6/kc31): målrettet `UPDATE bibliotek_maler … WHERE referanse='KD1'`, `BEGIN … COMMIT` med bekreftelses-`SELECT`. Lever de tre enlinjerne fra §6a. **Ikke kjør mot test selv.**
   🔴 **Rettet 2026-09-18 (mal-Opus hadde rett):** SQL-en skal treffe `bibliotek_mal_objekter`, ikke `mal_innhold` — se MAL-METODE §6a, presisering øverst. Metadata-UPDATE + DELETE av malens objekt-rader + INSERT generert fra `KD1_MAL` via `byggBibliotekRader`.
5. NS-logg (§7): fem nye eksterne referanser (NS-EN 1338/1339/1341/1342/1344) i felt 1, målbar verdi = ja (frostklasse), utgave mangler. Samme commit.
6. Etter Kenneths kjøring: importer KD1 på nytt i et testprosjekt (§6c) og ta skjermbilder: MalBygger med alle 10 felt i tre faser + utfyllingsvisning på mobil. **Maks 4 bilder.**
7. Diff mot develop: `seed-bibliotek.ts`, testfila, `mal-ns-standard-logg.md`. Ingenting annet.
8. Ett svar til Kenneth etter §6 pkt 8. «Klar for commit» sier design-rollen etter innholdsgaten.

**Avvik fra ordren meldes før du bygger, ikke etter.** Mangler et normfaktum her: stopp og meld. Gjett aldri normkrav.
