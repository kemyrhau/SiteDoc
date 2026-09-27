---
status: 🟢 ORDRE — klar for tildeling. Utskilt fra `73f2e913` (trukket ordre)
forfatter: design
oppdragstaker: ikke tildelt (cowork tildeler)
gjelder: apps/web, apps/mobile, packages/pdf
---

# Et lagret svar skal aldri forsvinne stille

## § 1 Bakgrunn — hvorfor denne lever videre alene

**Denne ordren var del E av en ordre om å fjerne det fjerde trafikklyset. 🔴 Den ordren er trukket
(`73f2e913`) — premisset var feil og ingenting fjernes.**

🟢 **Del E overlever likevel, fordi den aldri handlet om `gray`.** **Den handler om at rendereren mister en
lagret verdi den ikke kjenner igjen** — **uansett hvorfor den ikke kjenner den igjen.**

## § 2 Feilen, målt

**`apps/web/src/components/rapportobjekter/TrafikklysObjekt.tsx`:**

```ts
const valgtVerdi = typeof verdi === "string" ? verdi : null;
// ...
{TRAFIKKLYS_VALG.map(({ value, i18nKey }) => {
  const erValgt = valgtVerdi === value;
```

🔴 **Er `valgtVerdi` en streng som ikke finnes i `TRAFIKKLYS_VALG`, blir `erValgt` falsk for alle brikkene.**
⚠️ **Feltet ser UBESVART ut, mens databasen har et svar.** **Samme kode i `apps/mobile`.**

**Det trenger ingen malendring for å inntreffe.** **Det er nok at en verdi er eldre enn verdisettet, eller
skrevet av en versjon som siden er rullet tilbake.**

## § 3 Kravet

🔴 **Er den lagrede verdien ukjent, skal feltet VISE det. Det skal ikke se ubesvart ut.**

**Form — agenten velger, men den skal være synlig og lesbar:**
- en ekstra, deaktivert brikke med den rå verdien, eller
- en linje under kontrollen: «Lagret verdi: `<verdi>` — ikke et gyldig valg»

⚠️ **Ikke en toast. Ikke et banner. Det skal stå der verdien står.**

## § 4 Arkiv-PDF-en er den viktigste flaten

🔴 **`packages/pdf` rendrer `felt.verdi`. Sjekk at en ukjent verdi ikke faller ut der heller.**

⚠️ **Et signert dokument som mister et svar er det dyreste utfallet vi har.** **`packages/pdf` har null
avhengigheter — fallbacken må skrives uten å innføre noen.**

## § 5 Tre flater, én sannhet

**`TRAFIKKLYS_VALG` (`packages/shared/src/standardtekster.ts:141`) leses av web, mobile og pdf.**
🔴 **Fallbacken skal oppføre seg likt på alle tre.** **`pdf-shared-tvilling-paritet.test.ts` finnes —
utvid den hvis den kan dekke dette.**

## § 6 Stille tomhet er forbudt

🔴 **Test som FEILER hvis fallbacken mangler:** **lagre en verdi som ikke finnes i `TRAFIKKLYS_VALG`, rendre
feltet, og kreve at den rå verdien står i utdataet.** ⚠️ **En test som bare sjekker at det ikke kastes, er
ikke en test — den er en tillatelse.**

## § 7 Utenfor ordren

🔴 **Ingen UPDATE mot databasen. Ingen migrering. Ingen endring i `TRAFIKKLYS_VALG` eller META-defaulten.**
**Den ene test-raden med `gray` skal ikke ryddes** — **med fallbacken på plass er den synlig, og `gray` er
fortsatt et gyldig valg.**

🟡 **Meldt, ikke bestilt:** **`types/index.ts` og `standardtekster.ts` erklærer trafikklys-opsjonene hver for
seg, uten test som binder dem. Ser du en billig måte å binde dem mens du er i filene — meld den. Ikke bygg
den her.**
