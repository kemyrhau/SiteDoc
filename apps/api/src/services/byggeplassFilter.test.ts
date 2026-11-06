import { describe, it, expect } from "vitest";
import {
  byggeplassFilterViaTegning,
  byggeplassFilterDirekte,
} from "./byggeplassFilter";

const BP = "11111111-1111-1111-1111-111111111111";

describe("byggeplassFilterViaTegning (form A — Task: egen byggeplass, ellers via tegning)", () => {
  it("🔴 setningen som ikke holdt: oppgave på PROSJEKT-tegning er MED når en byggeplass er valgt", () => {
    const f = byggeplassFilterViaTegning(BP);
    // Ledd (3) — drawing uten byggeplass — MÅ finnes, ellers forsvinner oppgaver på
    // prosjekt-tegninger (klassen dette uttrekket lukker).
    expect(f?.OR).toContainEqual({ byggeplassId: null, drawing: { byggeplassId: null } });
  });

  it("🔴 ORDRE 28: oppgave med EGEN byggeplass (uten tegning) treffer valgt byggeplass", () => {
    // BEF-029: opprettet på HABU uten tegning → før falt den kun i «uten tegning»-leddet.
    expect(byggeplassFilterViaTegning(BP)?.OR?.[0]).toEqual({ byggeplassId: BP });
  });

  it("har alle FIRE ledd; tegnings-leddene gjelder kun rader uten egen byggeplass", () => {
    const f = byggeplassFilterViaTegning(BP);
    expect(f?.OR).toEqual([
      { byggeplassId: BP },
      { byggeplassId: null, drawing: { byggeplassId: BP } },
      { byggeplassId: null, drawing: { byggeplassId: null } },
      { byggeplassId: null, drawingId: null },
    ]);
  });

  it("string[]-variant (firma-oversikt) bruker { in } og beholder prosjekt-tegning-leddet", () => {
    const ider = [BP, "22222222-2222-2222-2222-222222222222"];
    const f = byggeplassFilterViaTegning(ider);
    expect(f?.OR?.[0]).toEqual({ byggeplassId: { in: ider } });
    expect(f?.OR?.[1]).toEqual({ byggeplassId: null, drawing: { byggeplassId: { in: ider } } });
    expect(f?.OR).toContainEqual({ byggeplassId: null, drawing: { byggeplassId: null } });
    expect(f?.OR).toContainEqual({ byggeplassId: null, drawingId: null });
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
