import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// ORDRE 35 (I2) — glue-koden mellom skjerm og lagring/konflikt/forsoning finnes
// i TO kopier: dagskortet (`app/timer/[id].tsx`) og prosjektkortet
// (`useProsjektkortSedel.ts`). Vakten FEILER hvis én kopi bytter eller dropper
// et service-kall den andre har. Fiks i én kopi skal vurderes i den andre
// (docs/claude/timer.md § Prosjektkort-rute).

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");

const DAGSKORT = les("../../../../app/timer/[id].tsx");
const KORT = les("useProsjektkortSedel.ts");
const SKJERM = les("../../../../app/timer/[id]/prosjektkort.tsx");

/** Kall som begge kopier skal ha like mange av (lagring, konflikt, forsoning). */
const KALL = [
  "trpc.timer.dagsseddel.hentMedId.useQuery(",
  "trpc.timer.dagsseddel.forsonDagskort.useMutation(",
  "trpc.timer.dagsseddel.gjenaapneDagsseddel.useMutation(",
  "trpc.timer.dagsseddel.slett.useMutation(",
  "forsonMutation.mutateAsync(",
  "byggForsonOverlappKall(",
  "anvendForsonetLokalt(",
  "bekreftConflict(",
  "overlappSammenligning(",
  "dagskortSammenligning(",
  "lokalRadTilForson(",
  "raaTilForsonRad(",
  "hentOgCacheArbeidstidSvar(",
  "hentDagsnormLokalt(",
  "useReLesVedSynk(",
  "db.delete(sheetTimerLocal)",
  "db.delete(sheetTilleggLocal)",
  "db.delete(sheetMachineLocal)",
  "db.delete(sheetUtleggLocal)",
  "db.delete(dagsseddelLocal)",
];

const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const tell = (kilde: string, kall: string) =>
  utenKommentarer(kilde).split(kall).length - 1;
/** Kall der kopiene avviker (eller som mangler i begge). */
const avvik = (a: string, b: string) =>
  KALL.filter((k) => tell(a, k) !== tell(b, k) || tell(a, k) === 0);

describe("ORDRE 35 — to kopier av glue kaller samme service-funksjoner", () => {
  it("negativkontroll: begge kildene er lest og er riktige filer", () => {
    expect(DAGSKORT).toContain("ProsjektGruppe");
    expect(KORT).toContain("export function useProsjektkortSedel");
  });

  it.each(KALL)("🔴 «%s» — like mange kall i begge kopier", (kall) => {
    const a = tell(DAGSKORT, kall);
    expect(a).toBeGreaterThan(0);
    expect(tell(KORT, kall)).toBe(a);
  });

  it("negativkontroll: droppet og byttet kall fanges", () => {
    expect(avvik(DAGSKORT, KORT)).toEqual([]);
    const droppet = KORT.replace("bekreftConflict(", "ikkeBekreft(");
    expect(avvik(DAGSKORT, droppet)).toEqual(["bekreftConflict("]);
    const byttet = KORT.replace("anvendForsonetLokalt(", "annenForsoning(");
    expect(avvik(DAGSKORT, byttet)).toEqual(["anvendForsonetLokalt("]);
    // Et kall som bare er kommentert ut, teller ikke.
    const kommentert = KORT.replace("byggForsonOverlappKall(", "// byggForsonOverlappKall(");
    expect(avvik(DAGSKORT, kommentert)).toEqual(["byggForsonOverlappKall("]);
  });

  it("🔴 prosjektkort-skjermen bruker hooken og sender tilbake når ikke kortmodus", () => {
    expect(SKJERM).toContain("useProsjektkortSedel(sheetId)");
    const flat = SKJERM.replace(/\s+/g, " ");
    expect(flat).toMatch(/if \(!s\.kortModus\) \{ return <Redirect href=\{\{ pathname: "\/timer\/\[id\]"/);
  });
});
