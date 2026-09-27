---
status: 🟢 ORDRE — klar for tildeling. Bestilt av Kenneth via cowork 2026-09-27
forfatter: design
oppdragstaker: ikke tildelt (cowork tildeler)
avhenger_av: fix/trafikklys-foreldreloes-verdi må ligge på develop FØRST
gjelder: apps/web, apps/mobile, packages/shared, apps/api
---

# Trafikklys med valgbart lyssett

## § 0 Bestillingen

**Kenneth vil ha trafikklys med tre lys OG trafikklys med fire lys.** 🔴 **Målingen viser at begge
allerede finnes i koden — og at ingen av dem rendrer riktig.**

## § 1 Funnet som avgjør hele ordren

**`type: "traffic_light"` er erklært 29 steder. 🔴 To av dem sender egne `options`:**

| Sted | Systemmal | Erklærer |
|---|---|---|
| `types/index.ts:568` | **«HMS-avvik»**, felt «Status» | 🔴 **TRE lys** — red=Åpent, yellow=Under behandling, green=Lukket |
| `types/index.ts:534` | **«Godkjenning»**, felt «Beslutning» | **FIRE lys** — green=Godkjent, yellow=Delvis godkjent, red=Avvist, gray=Ikke behandlet |

🔴 **Begge rendrer i dag som Godkjent/Anmerkning/Avvik/Ikke relevant.** Årsak, målt:

```ts
// apps/web/.../TrafikklysObjekt.tsx:15  — og identisk i apps/mobile
export function TrafikklysObjekt({ verdi, onEndreVerdi, leseModus }: RapportObjektProps) {
```

⚠️ **`RapportObjektProps` HAR `objekt: RapportObjekt` (`typer.ts:12`) — altså config. Rendereren
destrukturerer den bare ikke.** **`config.options` er uleselig for skjermen, og de to malene lyver.**

🟢 **Bestillingen er derfor ikke «bygg en ny mekanisme». Den er «les den som finnes».**

## § 2 Svar på cowork sine fire spørsmål

### 🟢 2a (Q1) ÉN type. Ikke `traffic_light_4`.

**Tre målte grunner, sterkeste sist:**

1. **Mekanismen finnes og brukes.** 2 av 29 erklæringer avhenger av den alt.
2. **Fargeflaten forblir én kilde.** **Fargene er nøklet på VERDI** (`FARGE` i web/mobil,
   `TRAFIKKLYS` hex i `packages/pdf/src/konstanter.ts`). **Et delmengde-valg rører dem ikke.** ⚠️ **To
   typer ville duplisert fem filer — cowork sin designbetingelse.**
3. 🔴 **Avgjørende: `oppdaterObjekt` kan ikke endre `type`.** Målt — `mal.ts:759-768` tar bare
   `label`, `required`, `config`, `parentId`.

   ⚠️ **Med to typer må et bytte fra fire til tre lys skje som SLETT + NYOPPRETT. Da er svaret borte,
   og endringsvernet på `:787` ser aldri endringen — det vokter `config` og `parentId`.**

   🟢 **Med én type er byttet en `config`-endring. `options` er ikke i `KOSMETISKE_CONFIG_NOKLER`, så
   vakten fyrer med antall berørte dokumenter. Gratis, i dag.**

**Det er svaret på Q4 også: modellvalget ER vakten.**

### 🟢 2b (Q2) Én liste. Delmengde per felt.

🔴 **`TRAFIKKLYS_VALG` (`standardtekster.ts:141`) blir IKKE to lister.** Den forblir **kanonisk
verdisett: de fire nøklene + standard i18n-etiketter.**

**Per felt bærer `config.options` to ting: HVILKE nøkler feltet tilbyr, i hvilken REKKEFØLGE — og
valgfritt en egen etikett per nøkkel** (det er det «HMS-avvik» trenger: `red` skal hete «Åpent»).

**Ingen ny fargeliste. Ingen ny etikettliste. Fargen følger nøkkelen, som i dag.**

### 🟢 2c (Q3) Ingen migrering. Ingen ny kolonne.

🟢 **De 27 feltene uten `options` faller til `TRAFIKKLYS_VALG` og beholder fire lys — uendret.**

🔴 **Cowork sin bekymring om «en type-kolonne som fødes tom» bortfaller: det finnes ingen kolonne å
føde.** ⚠️ **«Stille tomhet er forbudt» gjelder likevel, men i motsatt retning — plikten er at en
ERKLÆRT `options` ikke lenger kan ignoreres. Se § 4.**

### 🟢 2d (Q4) Vakten dekker det — fordi vi velger modellen der den gjør det.

**Besvart i 2a. 🔴 Ikke mål dette på nytt; det er målt: `mal.ts:759-768` (type ikke endrbar) +
`mal.ts:782-789` (vakten ser `config`).**

## § 3 Kravet

🔴 **Rendreren skal lese `objekt.config.options` når den finnes, og falle til `TRAFIKKLYS_VALG` når den
ikke gjør det.** **Web, mobil og `packages/pdf` — samme regel, samme rekkefølge, samme etiketter.**

**Validering av `options` (i `configSchema`, `mal.ts:162`):**
- 🔴 **hver `value` MÅ være én av de fire kanoniske nøklene** — en ukjent nøkkel har ingen farge og
  ville blitt et usynlig lys
- 🔴 **ingen duplikater**
- 🔴 **minst 2 oppføringer**

⚠️ **IKKE lås antallet til 3 eller 4.** **Det ville gjentatt feilen fra `bruk-er-ikke-behov.md`: å
lovfeste dagens behov som morgendagens grense.**

## § 4 Stille tomhet er forbudt — her er den omvendt

🔴 **Test som FEILER i dag og blir grønn av fiksen:** **rendre «HMS-avvik» sitt «Status»-felt og kreve
at det viser TRE lys med etikettene Åpent / Under behandling / Lukket.**

⚠️ **En test som bare sjekker at en konstruert config med tre nøkler gir tre lys, er svakere — den
beviser ikke at de to virkelige malene ble reparert.** **Bruk de virkelige.**

## § 5 Konsekvensen — samme verdi, nytt ord på et signert dokument

🔴 **Første versjon kalte dette «en retting, men synlig for brukere». Cowork avviste formuleringen, og
med rett. Den faktiske mekanismen:**

**Verdinøklene er de samme. Bare etikettene skifter.** ⚠️ **Et signert dokument beholder altså verdien
sin og får et nytt ORD på den.**

| Felt | Lagret verdi | Viser i dag | Viser etter |
|---|---|---|---|
| Godkjenning / «Beslutning» | `red` | «Avvik» | **«Avvist»** |
| HMS-avvik / «Status» | `green` | «Godkjent» | 🔴 **«Lukket»** |
| HMS-avvik / «Status» | `gray` | «Ikke relevant» | 🔴 **finnes ikke i settet — foreldreløs** |

🔴 **`green` på et HMS-avvik er motsatt ende av skalaen: i dag leses det som en godkjenning, etter
fiksen som et lukket avvik.** ⚠️ **Det er ordrett det endringsvernet finnes for å hindre —
`mal.ts:130-136`: «kan endringen gjøre at et allerede SIGNERT dokument sier noe ANNET om hva som ble
kontrollert mot?»**

🔴 **Og det skjer gjennom type-nivået, som er blindsonen cowork førte i BACKLOG 2026-09-27.**
**Endringsvernet står ikke ved den døren.**

**Låst/signert er målt:** `ER_TERMINAL_STATUS` (`packages/shared/src/utils/statusHandlinger.ts:181`) =
`approved`, `dismissed`, `closed`, `cancelled`, `rejected`. **Et utkast som skifter etikett er en
bagatell. Et terminalt dokument er det ikke.**

🟡 **§ 0-målingen avgjør om dette er akademisk. Ordren tildeles ikke før tallene finnes.**

## § 6 Rekkefølge mot konvensjonsordren — design sitt valg

🔴 **Konvensjonsordren (gul/rød med kommentarkrav) skal gå ETTER denne, ikke sammen med den.**

**De rører samme filer, og det er nettopp grunnen:** ⚠️ **to atferdsendringer i én gate gjør gaten
uleselig — du kan ikke se hvilken endring som flyttet hvilken test.** **Konfliktrisikoen løses av
streng rekkefølge; lesbarheten løses ikke av bunting.**

🟢 **Konvensjonen er dessuten ortogonal: gul betyr det samme i et tresett som i et firesett.** **Den
blir skrevet én gang, mot en kjent modell, i stedet for to ganger.**

## § 7 Utenfor ordren

🔴 **Ingen endring i `TRAFIKKLYS_VALG`.** **Ingen fjerning av `gray`.** **Ingen ny felttype.** **Ingen
UPDATE mot databasen.** **Rør ikke MK C (`acbe1bdf`) — opsjonsteksten bærer begrunnelsen der, og en
farge kan ikke det.**

🟡 **Meldt, ikke bestilt:** **`types/index.ts` og `standardtekster.ts` erklærer trafikklys-opsjonene
hver for seg. Paritetstesten dekker pdf↔shared, ikke types↔standardtekster.** **Ser du en billig
binding mens du er i filene — meld den.**

## § 8 To malbyggeobjekter — Kenneths krav 2026-09-27

🔴 **Malbyggerens palett SKAL tilby to trafikklys-objekter: ett med tre lys og ett med fire.**

🟢 **Det bryter ikke én-type-valget i § 2a.** **Begge oppretter `type: "traffic_light"`. De skiller seg
bare i `config.options` de sås med.** ⚠️ **Palett-valg, ikke typevalg — så `oppdaterObjekt` kan fortsatt
flytte et felt mellom settene som en `config`-endring, og endringsvernet fyrer.**

**Standard for de to:**
- **Fire lys:** `TRAFIKKLYS_VALG` uendret — Godkjent / Anmerkning / Avvik / Ikke relevant
- **Tre lys:** Godkjent / Anmerkning / Avvik — **`gray` utelatt**

🔴 **Tresettet skal IKKE hardkodes som en egen liste.** **Det er en delmengde av de fire kanoniske
nøklene, per § 2b.**

## § 9 Anbefaling hvis tallene IKKE er null — rangert

🔴 **Design bygger ingen av dem. Dette er rangeringen cowork ba om.**

### 🟢 1. (c) Rett HMS-avvik nå. Utsett Godkjenning.

**Begrunnelse: de to feltene er ikke like alvorlige, og i dag behandles de likt.**

- **HMS-avvik viser `green` som «Godkjent» der malen sier «Lukket».** ⚠️ **Det er ikke en annen etikett,
  det er en annen BETYDNING** — og feltet tilbyr i tillegg et `gray` malen aldri erklærte. 🔴 **Å la det
  stå er den større skaden: dokumentet sier noe annet enn malen i dag.**
- **Godkjenning viser «Avvik» der malen sier «Avvist».** **Nær-synonymt. Lav skade ved å vente, og
  ventingen kjøper en egen beslutning fra Kenneth.**

### 🟡 2. (a) Deploy alt, med varsel til berørt firma

**Riktig hvis målingen viser at Godkjenning-feltene er urørt eller bare i utkast.** 🔴 **Er
A.Markussen berørt på terminale dokumenter, er varsel ikke en høflighet — det er Kenneths beslutning
før deploy, ikke vår.**

### 🔴 3. (b) Frys etikettene ved signering — men IKKE som alternativ

⚠️ **(b) løser ikke dagens rader.** **Et snapshot av `options` ved signering hindrer GJENTAKELSE; det
gjør ingenting med dokumenter som alt er signert.** 🔴 **Den er derfor ikke et alternativ til (c) eller
(a) — den er en egen, senere ordre.**

🟢 **Men den bør skrives uansett utfall av målingen, fordi blindsonen på type-nivå består.** **Er
tallene null i dag, er det flaks, ikke vern.**
