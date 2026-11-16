import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T51 (spec prosjektkort-kortid § 12.7, ordre d2b-1): sorterpil, filternedtrekk,
 * bredde-håndtak og flytte-håndtak finnes ett sted hver og brukes av både `Table`
 * og `TimerRadTabell`. Tekstene i dem går via `t()` (kalleren sender dem som props).
 *
 * Rød før løftet: `table.tsx` hadde egne `SorterPilOpp`/`SorterPilNed`/`FilterDropdown`,
 * egen mousemove-dragning og hardkodet «Filtrer»/«Alle» (HM38 c).
 */
const rot = resolve(__dirname, "../../../..");
const les = (fil: string) => readFileSync(resolve(rot, fil), "utf8");

const VERKTOY = "packages/ui/src/tabellverktoy.tsx";
const TABLE = "packages/ui/src/table.tsx";
const FLYTT = "apps/web/src/components/FlyttbareKolonner.tsx";
const TIMER_TABELL = "apps/web/src/components/timer/TimerRadTabell.tsx";

describe("T51 — hodets verktøy finnes ett sted og deles", () => {
  it("tabellverktoy.tsx eier sorterpil, filternedtrekk og bredde-dragning", () => {
    const v = les(VERKTOY);
    for (const navn of ["export function SorterPil", "export function KolonneFilter", "export function useBreddeDragning", "export function BreddeHandtak"]) {
      expect(v, navn).toContain(navn);
    }
  });

  it("Table bruker de delte delene og har ingen egne kopier", () => {
    const t = les(TABLE);
    expect(t).toMatch(/from "\.\/tabellverktoy"/);
    expect(t).not.toMatch(/<svg/);
    expect(t).not.toMatch(/function FilterDropdown|function SorterPil/);
    expect(t).not.toMatch(/"mousemove"/);
    expect(t).not.toMatch(/cursor-col-resize/);
  });

  it("filterets tekster kommer som props — ingen hardkodet «Filtrer»/«Alle» i JSX", () => {
    const v = les(VERKTOY);
    expect(v).toContain("title={tekster.filtrer}");
    expect(v).toContain("{tekster.alle}");
    expect(v).not.toMatch(/title="Filtrer"/);
    expect(v).not.toMatch(/>\s*Alle\s*</);
    // Dagens norske tekst er standarden (T46): sider uten `tekster` er uendret.
    expect(v).toMatch(/STANDARD_FILTER_TEKSTER[^=]*=\s*\{ filtrer: "Filtrer", alle: "Alle" \}/);
  });

  it("flyttehåndtaket finnes ett sted (useFlyttbarKolonne) og brukes av Table-hodet", () => {
    const f = les(FLYTT);
    expect(f).toContain("export function useFlyttbarKolonne");
    expect(f.match(/useSortable\(/g)?.length).toBe(1);
    expect(f).toMatch(/function FlyttbartHode[\s\S]*useFlyttbarKolonne\(/);
  });

  it("TimerRadTabell bruker de samme delene (ingen egne kopier)", () => {
    expect(existsSync(resolve(rot, TIMER_TABELL)), TIMER_TABELL).toBe(true);
    const k = les(TIMER_TABELL);
    expect(k).toMatch(/from "@sitedoc\/ui"/);
    for (const navn of ["SorterPil", "KolonneFilter", "useBreddeDragning", "BreddeHandtak"]) {
      expect(k, navn).toMatch(new RegExp(`\\b${navn}\\b`));
    }
    expect(k).toMatch(/useFlyttbarKolonne/);
    expect(k).not.toMatch(/<svg|"mousemove"|useSortable\(|cursor-col-resize/);
    // Tekstene i verktøyene via t() (R20).
    expect(k).toMatch(/tekster=\{[^}]*t\(/);
  });
});
