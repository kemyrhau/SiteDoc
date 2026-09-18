# TILLEGG til KD1-ordren — malen skal fremstå med egne krav, ikke som standarden

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`, branch `feat/mal-kd1-revisjon`, ikke committet)
**Fra:** design-rollen · **Dato:** 2026-09-18
**Gjelder:** `ordre-kd1-revisjon-fabel-2026-09-18.md`. Ordren står ellers uendret. Dette er et tillegg, ikke en ny ordre.
**Grunnlag:** Kenneth-vedtak 2026-09-18, nå skrevet inn i **MAL-METODE §7b** (les den først, hovedtreet:
`/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/docs/claude/MAL-METODE.md`).

Kort: standarden er opphavsrettsbeskyttet. Malene skal være SiteDocs egne sjekklister med egne krav. **Koden beholdes
i navnet** (den brukes i beskrivelser og fremdriftsplaner), men teksten etter koden er vår egen. Ingen tabell- eller
punktkoder i hjelpetekstene, én linje «Faglig grunnlag» i beskrivelsen, og ingen (nesten-)ordrett tekst fra standarden.

---

## Hva som endres

**Kun tekst.** Feltene, rekkefølgen, fasene, felttypene og alle **alternativene** er uendret. `referanse: "KD1"` og
`kapittelKode: "KD"` er uendret — kodene er både datanøkler og det brukeren kjenner igjen fra beskrivelse og fremdriftsplan.

### Navn og beskrivelse

| | Fra | Til |
|---|---|---|
| `navn` | `KD1 – Utendørs belegg` | `KD1 – Belegg av stein og heller` |
| `beskrivelse` | `Legging av stein- og hellebelegg (KD1.2–KD1.6, KD1.74) — settelag, fuger, fall og planhet iht. Tabell K9–K12` | `Legging av belegg av naturstein, betong og tegl, også permeabelt belegg — settelag, fuger, fall og planhet. Faglig grunnlag: NS 3420-K:2024, post KD1.` |

### To feltnavn

| Felt | Fra | Til |
|---|---|---|
| 5 | `Fall iht. Tabell K11` | `Fall mot avrenning` |
| 6 | `Fuger og striper – rette linjer / jevne kurver` | `Fuger og striper i rette linjer eller jevne buer` |

Øvrige åtte feltnavn er uendret.

### Hjelpetekstene — erstatt alle ti med disse

**1. Belegningstype**
> Velg typen som er lagt — den avgjør kravene til settelag, fuger, fall og planhet i feltene under. Kontroller frostklassen i merkingen på pallen: naturstein og gatestein F1, betongheller og betongstein klasse 3 (merket D), tegl FP100. Ta bilde av pallelapp eller leveringsseddel.

**2. Areal**
> Kjøreareal har strengere krav til fall og romsligere toleranse for planhet enn gangareal.

**3. Settelag**
> Anbefalt: 0/8 eller 0/11 under belegningsstein og gatestein, 2/8 under natursteinsplater og betongheller, 2/11 ved maskinlegging. Permeabelt belegg: 2/5, 2/8 eller 2/11. Beskytt betong i settelag og fuger mot uttørking og frost.

**4. Tykkelse settelag**
> Legg med overhøyde, slik at belegget ender i riktig høyde etter komprimering: 3–5 mm, for gatestein 8–12 mm. Med snøsmelteanlegg gjelder leverandørens tykkelse. Ved avvik: noter målt tykkelse og sted i kommentaren.

**5. Fall mot avrenning**
> Minst 2 % på gangareal. Kjøreareal: minst 2,5 %, for gatestein minst 3 %. Permeabelt belegg: fallet står i beskrivelsen. Angir beskrivelsen noe annet, gjelder den. Kontroller flere punkter. Ved avvik: noter målt fall og sted i kommentaren.

**6. Fuger og striper i rette linjer eller jevne buer**
> Gatestein legges i forband, forskjøvet minst 1/3 stein, i buer minst 1/5. Ingen tilpassede biter mindre enn 30 % av en hel stein.

**7. Fugebredde**
> Enkeltsteiner kan avvike ±2 mm (sagde natursteinsplater) eller ±3 mm (belegningsstein av naturstein). Ved avvik: noter målt bredde og sted i kommentaren.

**8. Planhet – svanker/bulninger over 3 m**
> Toleranse gang/kjøre, målt med 3 m rettholt: betongstein, betongheller, tegl og belegningsstein av naturstein ±3/±5 · smågatestein og mosaikk ±3/±5 · storgatestein ±5/±8 · sagde natursteinsplater ±5/±8 · råhogde natursteinsplater ±8/±10 · permeabelt maskinlagt ±3/±6. Mål flere steder og velg raden som gjelder. Ved avvik: noter største måling og sted i kommentaren.

**9. Største vertikale sprang ved fuger (mm)**
> Største tillatte sprang gang/kjøre: betongstein, betongheller, tegl og belegningsstein av naturstein 2/3 · smågatestein og mosaikk 3/5 · storgatestein 5/8 · sagde natursteinsplater 4/6 · råhogde natursteinsplater 6/8. Før inn den største målingen (hele mm).

**10. Krav oppfylt og dokumentasjon levert**
> Belegget oppfyller kravene over, overflaten er feid ren for fugemasse, og flaten er klar for overlevering. Ta bilde av ferdig belegg.

Tallene er de samme som i ordren. Bare ordlyden og kodene er endret.

---

## Følger for resten av leveransen

1. **Testen** (`kd1-mal.test.ts`): låser den navn eller feltnavn, oppdater til de nye. Behold låsen på antall, typer,
   faser og at «Asfalt» ikke finnes. **Legg til én sjekk:** ingen hjelpetekst i KD1 inneholder `Tabell K` eller et
   mønster som `KD1 c`. Den skal feile mot dagens tekster før du endrer dem (rød først).
2. **`kd1-test.sql`:** generer på nytt fra `KD1_MAL` via `byggBibliotekRader` (objekttabell-veien, MAL-METODE §6a).
   Navn og beskrivelse er med i metadata-UPDATE-en.
3. **NS-loggen:** hjelpetekstene nevner ikke lenger NS-EN 1338/1339/1341/1342/1344 — bare produktmerkingen (F1,
   klasse 3 D, FP100). **Fjern KD1-radene du la til i Kategori 1.** Beskrivelsens «Faglig grunnlag: NS 3420-K:2024»
   teller ikke (MAL-METODE §7 pkt 3). Rettingen av loggens egen SQL mot `bibliotek_mal_objekter` fra forrige svar
   står fortsatt.
4. **Gate-bygg og rapport** som i ordren. Diff mot develop fortsatt kun `seed-bibliotek.ts`, testfila og
   `mal-ns-standard-logg.md`.

## Utenfor dette tillegget

- De fem andre malene (KA7, KB2, KB4, KB6, KC3.1). De får egen samlet ordre etter KD1-gaten. **Ikke rør dem nå.**
- Standard- og kapittelnavnene i biblioteket (`bibliotekStandard`, kapittelnavn i seeden). Det er en egen sak for
  cowork. **Ikke rør dem nå.**

Deretter: lever SQL-enlinjerne til Kenneth, skjermbilder etter hans kjøring (§6c, maks 4), og design-rollen gir
«klar for commit».
