import { describe, it, expect } from "vitest";
import { erStrandet, utenAktivtKjørendeWhere, STRANDET_MS } from "./reprosessering";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 1: et dokument som henger i `processing`
 * etter prosess-crash ga «pågår» for alltid (knapp evig deaktivert) og ble hoppet
 * over av reprosesseringen. `erStrandet` skiller ferskt (kjører) fra strandet
 * (crashet), og `utenAktivtKjørendeWhere` slipper strandede inn igjen.
 */

const NAA = 1_000_000_000_000; // fast "nå" for determinisme

describe("erStrandet", () => {
  it("ferskt processing (nettopp oppdatert) → ikke strandet", () => {
    expect(erStrandet("processing", new Date(NAA - 1000), NAA)).toBe(false);
  });

  it("gammelt processing (> 15 min uten fremdrift) → strandet", () => {
    expect(erStrandet("processing", new Date(NAA - STRANDET_MS - 1000), NAA)).toBe(true);
  });

  it("gammelt pending → strandet (køen tok det aldri)", () => {
    expect(erStrandet("pending", new Date(NAA - STRANDET_MS - 1), NAA)).toBe(true);
  });

  it("nøyaktig på grensen (15 min) → strandet (>=)", () => {
    expect(erStrandet("processing", new Date(NAA - STRANDET_MS), NAA)).toBe(true);
  });

  it("completed er aldri strandet, uansett alder", () => {
    expect(erStrandet("completed", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });

  it("failed er aldri strandet", () => {
    expect(erStrandet("failed", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });

  it("unsupported er aldri strandet", () => {
    expect(erStrandet("unsupported", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });
});

describe("utenAktivtKjørendeWhere", () => {
  it("inkluderer strandede, ekskluderer ferske pending/processing og unsupported", () => {
    const w = utenAktivtKjørendeWhere({ projectId: "p1" }, NAA);
    // Beholder kalleren sitt filter + isActive
    expect(w.projectId).toBe("p1");
    expect(w.isActive).toBe(true);
    // To grener: ferdig-tilstander ELLER strandede (gamle) pending/processing
    expect(Array.isArray(w.OR)).toBe(true);
    const grener = w.OR as Array<Record<string, unknown>>;
    const ferdigGren = grener.find((g) => "processingState" in g && (g.processingState as { notIn?: string[] }).notIn);
    expect((ferdigGren!.processingState as { notIn: string[] }).notIn).toEqual([
      "pending",
      "processing",
      "unsupported",
    ]);
    const strandetGren = grener.find((g) => (g.processingState as { in?: string[] })?.in);
    expect((strandetGren!.processingState as { in: string[] }).in).toEqual(["pending", "processing"]);
    // Strandet-grensa er NAA - STRANDET_MS
    expect((strandetGren!.updatedAt as { lt: Date }).lt.getTime()).toBe(NAA - STRANDET_MS);
  });
});
