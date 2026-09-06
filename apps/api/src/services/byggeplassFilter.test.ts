import { describe, it, expect } from "vitest";
import {
  byggeplassFilterViaTegning,
  byggeplassFilterDirekte,
} from "./byggeplassFilter";

const BP = "11111111-1111-1111-1111-111111111111";

describe("byggeplassFilterViaTegning (form A — Task via tegning)", () => {
  it("🔴 setningen som ikke holdt: oppgave på PROSJEKT-tegning er MED når en byggeplass er valgt", () => {
    const f = byggeplassFilterViaTegning(BP);
    // Ledd (2) — drawing uten byggeplass — MÅ finnes, ellers forsvinner oppgaver på
    // prosjekt-tegninger (klassen dette uttrekket lukker).
    expect(f?.OR).toContainEqual({ drawing: { byggeplassId: null } });
  });

  it("har alle TRE ledd (valgt byggeplass, prosjekt-tegning, uten tegning)", () => {
    const f = byggeplassFilterViaTegning(BP);
    expect(f?.OR).toEqual([
      { drawing: { byggeplassId: BP } },
      { drawing: { byggeplassId: null } },
      { drawingId: null },
    ]);
  });

  it("string[]-variant (firma-oversikt) bruker { in } og beholder prosjekt-tegning-leddet", () => {
    const f = byggeplassFilterViaTegning([BP, "22222222-2222-2222-2222-222222222222"]);
    expect(f?.OR?.[0]).toEqual({
      drawing: { byggeplassId: { in: [BP, "22222222-2222-2222-2222-222222222222"] } },
    });
    expect(f?.OR).toContainEqual({ drawing: { byggeplassId: null } });
    expect(f?.OR).toContainEqual({ drawingId: null });
  });

  it("tom id → null (kallstedene beholder ...(x ?? {}))", () => {
    expect(byggeplassFilterViaTegning(undefined)).toBeNull();
    expect(byggeplassFilterViaTegning(null)).toBeNull();
    expect(byggeplassFilterViaTegning("")).toBeNull();
    expect(byggeplassFilterViaTegning([])).toBeNull();
  });
});

describe("byggeplassFilterDirekte (form B — Checklist/Drawing direkte)", () => {
  it("to ledd: valgt byggeplass ELLER byggeplass-løs (prosjekt-dokument)", () => {
    expect(byggeplassFilterDirekte(BP)?.OR).toEqual([
      { byggeplassId: BP },
      { byggeplassId: null },
    ]);
  });

  it("string[]-variant bruker { in } og beholder null-leddet", () => {
    const f = byggeplassFilterDirekte([BP]);
    expect(f?.OR).toEqual([{ byggeplassId: { in: [BP] } }, { byggeplassId: null }]);
  });

  it("tom id → null", () => {
    expect(byggeplassFilterDirekte(undefined)).toBeNull();
    expect(byggeplassFilterDirekte([])).toBeNull();
  });
});
