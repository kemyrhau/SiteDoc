import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kontorAvstandStartverdier, tolkKontorAvstand } from "../kontorAvstandSkjema";

/** POST 2026-11-15 (16) punkt 3: «Rett avstand» kontor ↔ kontor sender både km og kjøretid. */
describe("tolkKontorAvstand", () => {
  it("🔴 begge feltene sendes", () => {
    expect(tolkKontorAvstand("251,5", "190")).toEqual({ avstandKm: 251.5, kjoretidMin: 190 });
  });
  it("manglende eller ugyldig felt → ugyldig", () => {
    expect(tolkKontorAvstand("", "190")).toBeNull();
    expect(tolkKontorAvstand("250", "")).toBeNull();
    expect(tolkKontorAvstand("0", "190")).toBeNull();
    expect(tolkKontorAvstand("250", "12.5")).toBeNull();
  });
});

describe("kontorAvstandStartverdier", () => {
  it("forhåndsutfyller km og kjøretid fra eksisterende rad", () => {
    expect(kontorAvstandStartverdier({ kjoretidMin: 190, avstandM: 251500 })).toEqual({ km: "251.5", min: "190" });
  });
  it("ukjent (negativ/null) verdi → tomt felt", () => {
    expect(kontorAvstandStartverdier({ kjoretidMin: -1, avstandM: null })).toEqual({ km: "", min: "" });
    expect(kontorAvstandStartverdier(null)).toEqual({ km: "", min: "" });
  });
});

describe("AvstanderFane — (16) vakt", () => {
  const kilde = readFileSync(
    join(__dirname, "../../app/dashbord/firma/oppmotesteder/AvstanderFane.tsx"),
    "utf-8",
  );
  it("🔴 kontor-dialogen bruker begge feltene og sender tolket km + kjøretid", () => {
    expect(kilde).toContain("tolkKontorAvstand(kontorKm, kontorMin)");
    expect(kilde).toMatch(/value=\{kontorKm\}/);
    expect(kilde).toMatch(/value=\{kontorMin\}/);
  });
});
