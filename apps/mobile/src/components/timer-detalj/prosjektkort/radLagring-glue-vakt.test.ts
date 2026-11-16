import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE 36b (lagring C) — skrivesemantikken for timer- og maskinrader finnes i
// TO kopier: dagskortets seksjoner (`TimerSeksjon.tsx`/`MaskinSeksjon.tsx`,
// urørt) og prosjektkort-flytens `radLagring.ts`. Vakten FEILER hvis én kopi
// endrer nøkkelsettet i en skriving (.set/.values) eller antall av et kall/
// token den andre har. Fiks i én kopi skal vurderes i den andre
// (docs/claude/timer.md § Prosjektkort-rute).

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function region(kilde: string, fra: string, til: string): string {
  const i = kilde.indexOf(fra);
  const j = kilde.indexOf(til, i + fra.length);
  if (i < 0 || j < 0) throw new Error(`fant ikke region ${fra} … ${til}`);
  return utenKommentarer(kilde.slice(i, j));
}

const TIMER_KILDE = les("../TimerSeksjon.tsx");
const MASKIN_KILDE = les("../MaskinSeksjon.tsx");
const MODUL_KILDE = les("radLagring.ts");

const TIMER = region(TIMER_KILDE, "const leggTil = useCallback(", "return (\n    <View");
const MASKIN = region(MASKIN_KILDE, "const leggTil = useCallback(", "if (rader.length === 0) return null;");
const ORIGINAL = TIMER + MASKIN;
const MODUL = utenKommentarer(MODUL_KILDE);

/** Nøklene i hvert objekt etter `.set(`/`.values(`, sortert (shorthand = navnet). */
function skriveNokler(kilde: string): string[] {
  const nokler: string[] = [];
  for (const kall of [".set(", ".values("]) {
    let pos = kilde.indexOf(kall);
    while (pos >= 0) {
      const start = kilde.indexOf("{", pos);
      let dybde = 0;
      let slutt = start;
      for (; slutt < kilde.length; slutt++) {
        if ("{([".includes(kilde[slutt])) dybde++;
        if ("})]".includes(kilde[slutt])) dybde--;
        if (dybde === 0) break;
      }
      const kropp = kilde.slice(start + 1, slutt);
      let d = 0;
      let biten = "";
      const biter: string[] = [];
      for (const c of kropp) {
        if ("{([".includes(c)) d++;
        if ("})]".includes(c)) d--;
        if (c === "," && d === 0) {
          biter.push(biten);
          biten = "";
        } else biten += c;
      }
      biter.push(biten);
      for (const b of biter.map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)) {
        nokler.push(b.startsWith("...") ? b : b.split(":")[0].trim());
      }
      pos = kilde.indexOf(kall, slutt);
    }
  }
  return nokler.sort();
}

/** Kall og tokens som skal finnes like mange ganger i originalene og modulen. */
const TOKENS = [
  "settInnTimerRad(",
  "erReiseLonnsartLokalt(",
  "db.update(sheetTimerLocal)",
  "db.update(sheetMachineLocal)",
  "db.insert(sheetMachineLocal)",
  "tx.delete(sheetTimerLocal)",
  "tx.delete(sheetMachineLocal)",
  "tx.insert(slettedeRaderLocal)",
  "db.transaction(",
  ".onConflictDoNothing()",
  "randomUUID()",
  "Date.now()",
  'radType: "timer"',
  'radType: "maskin"',
  "serverVersjon: radForSletting?.serverVersjon ?? null",
  'tidKilde: "manuell" as const',
  'gammel?.reiseKilde === "matrise"',
  "(gammel.fraTid ?? null) !== (fraTid ?? null)",
  "(gammel.tilTid ?? null) !== (tilTid ?? null)",
  // NY BESLUTNING maskinkobling (2026-11-12): koblede maskiner skrives via
  // delt `kobledeMaskiner.ts` — begge kopier må avvise maskin over rad FØR
  // skriving og bare røre maskiner når endringer er sendt.
  "maskinerOverRadEtterLagring(db, radId, timer, maskiner)",
  "if (maskiner !== undefined)",
  "skrivKobledeMaskiner(",
  'grunn: "maskinOverRad" as const',
];
const flat = (s: string) => s.replace(/\s+/g, " ");
const tell = (kilde: string, token: string) => flat(kilde).split(flat(token)).length - 1;
const avvik = (a: string, b: string, tokens: string[]) =>
  tokens.filter((t) => tell(a, t) !== tell(b, t) || tell(a, t) === 0);

describe("ORDRE 36b — radLagring er en tro kopi av seksjonenes skrivesemantikk", () => {
  it("negativkontroll: regionene er lest og er de riktige", () => {
    expect(TIMER).toContain("const fjern = useCallback(");
    expect(TIMER).toContain("const handterHurtigVelg");
    expect(MASKIN).toContain('radType: "maskin"');
    expect(MODUL).toContain("export function fjernTimerRad");
    expect(skriveNokler(ORIGINAL).length).toBeGreaterThan(40);
  });

  it("🔴 likt nøkkelsett i alle .set/.values", () => {
    expect(skriveNokler(MODUL)).toEqual(skriveNokler(ORIGINAL));
  });

  it.each(TOKENS)("🔴 «%s» — like mange i originalene og modulen", (token) => {
    const a = tell(ORIGINAL, token);
    expect(a).toBeGreaterThan(0);
    expect(tell(MODUL, token)).toBe(a);
  });

  it("negativkontroll: ett endret token eller én fjernet nøkkel fanges", () => {
    expect(avvik(ORIGINAL, MODUL, TOKENS)).toEqual([]);
    const tombstoneDroppet = MODUL.replace('radType: "timer"', 'radType: "maskin"');
    expect(avvik(ORIGINAL, tombstoneDroppet, TOKENS)).toEqual(['radType: "timer"', 'radType: "maskin"']);
    const utenVersjon = MODUL.replace("serverVersjon: radForSletting?.serverVersjon ?? null,", "");
    expect(avvik(ORIGINAL, utenVersjon, TOKENS)).toEqual(["serverVersjon: radForSletting?.serverVersjon ?? null"]);
    expect(skriveNokler(utenVersjon)).not.toEqual(skriveNokler(ORIGINAL));
    const utenPause = MODUL.replace("      pauseMin,\n      ...reiseSet", "      ...reiseSet");
    expect(skriveNokler(utenPause)).not.toEqual(skriveNokler(ORIGINAL));
  });
});
