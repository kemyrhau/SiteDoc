import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * TF10 glue-vakt (prosjektkort-kortid-spec § 11.2): sedelens prosjekt arves for
 * en timerrad bare i `radProsjektId` (shared). En ny `?? sedel.projectId`
 * ville lagt fraværskortets rader på sedelens prosjektkort.
 *
 * Sperrehake: forekomstene under er målt 2026-11-16 etter c2 — de gjelder
 * maskin, tillegg, utlegg, vare, reise, dagskort-modus (F6, urørt) og
 * synk-fallbacken for prosjektrader (`utenProsjektSynk.ts`). Tallet pr. fil kan
 * synke (rett tallet ned), aldri øke, og ingen ny fil får en.
 */
const MOENSTER = /(\?\?|\|\|) ?(sedel|dag\.sedel|serverSedel)\??\.projectId|(\?\?|\|\|) ?sedelProjectId/g;

const TAK: Record<string, number> = {
  "app/timer/[id].tsx": 4,
  "app/timer/[id]/kort/[projectId].tsx": 0,
  "src/components/timer-detalj/prosjektkort/DagSeksjon.tsx": 2,
  "src/components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx": 5,
  "src/components/timer-detalj/prosjektkort/kortRadFlytt.ts": 2,
  "src/components/timer-detalj/prosjektkort/useProsjektkortSedel.ts": 1,
  "src/lib/konfliktWebUsendte.ts": 2,
  "src/lib/prosjektkortMobil.ts": 3,
  "src/services/timerSync.ts": 6,
  "src/services/vareforbrukSync.ts": 1,
  "src/utils/bekreftDagTillegg.ts": 1,
  "src/utils/utenProsjektSynk.ts": 1,
};

const ROT = join(__dirname, "..", "..");

function filer(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : filer(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

export function tellFallbacks(kilde: string): number {
  return (kilde.match(MOENSTER) ?? []).length;
}

describe("TF10 — ingen ny `?? sedel.projectId` utenfor radProsjektId", () => {
  const funn = [...filer(join(ROT, "src")), ...filer(join(ROT, "app"))]
    .map((p) => ({ fil: relative(ROT, p), antall: tellFallbacks(readFileSync(p, "utf8")) }))
    .filter((f) => f.antall > 0);

  it("ingen fil over taket, ingen ny fil", () => {
    const over = funn.filter((f) => f.antall > (TAK[f.fil] ?? 0));
    expect(over).toEqual([]);
  });

  it("negativkontroll: mønsteret fanger formene som finnes", () => {
    expect(tellFallbacks("const p = r.projectId ?? sedel.projectId;")).toBe(1);
    expect(tellFallbacks("projectId: t.projectId || sedel.projectId || undefined")).toBe(1);
    expect(tellFallbacks("x ?? sedelProjectId; y ?? dag.sedel.projectId")).toBe(2);
    expect(tellFallbacks("radProsjektId(r, sedel)")).toBe(0);
  });
});
