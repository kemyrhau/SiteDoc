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

## § 5 Brukersynlig konsekvens — Kenneth må vite den

🟡 **«HMS-avvik» og «Godkjenning» er systemmaler i bruk. Etter fiksen viser de andre etiketter og
«HMS-avvik» viser tre lys i stedet for fire.** **Det er en retting, men det er synlig.**

🔴 **Og et lagret `gray` på et «HMS-avvik»-felt blir foreldreløst i samme øyeblikk** — **derfor er
`fix/trafikklys-foreldreloes-verdi` en HARD forutsetning, ikke en anbefaling.** **Uten den forsvinner
svaret stille, og vi har bygget skaden med åpne øyne.**

🟡 **Design bestiller ikke opprydding av slike verdier. Fallbacken gjør dem synlige; hva de skal bli er
Kenneths valg.**

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
