import { describe, it, expect } from "vitest";
import {
  erKonverteringStrandet,
  erKonverteringPågår,
  erRekonverterbarOriginal,
  KONVERTERING_STRANDET_MS,
} from "./tegningRekonvertering";

/**
 * Samme mønster som reprosessering.ts (erStrandet/STRANDET_MS), men for
 * `drawings.conversion_status` (pending/converting/done/failed/stale) i stedet
 * for `ftd_documents.processing_state`. En tegning som henger i pending/converting
 * etter prosess-crash skal regnes som strandet etter KONVERTERING_STRANDET_MS,
 * ellers blir «Oppdater alle tegninger»-knappen evig deaktivert (samme felle som
 * RETUR 2026-10-15 i reprosessering).
 */

const NAA = 1_000_000_000_000;

describe("erKonverteringStrandet", () => {
  it("ferskt converting → ikke strandet", () => {
    expect(erKonverteringStrandet("converting", new Date(NAA - 1000), NAA)).toBe(false);
  });

  it("gammelt converting (> grensen) → strandet", () => {
    expect(
      erKonverteringStrandet("converting", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(true);
  });

  it("gammel pending → strandet", () => {
    expect(
      erKonverteringStrandet("pending", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(true);
  });

  it("nøyaktig på grensen → strandet (>=)", () => {
    expect(erKonverteringStrandet("pending", new Date(NAA - KONVERTERING_STRANDET_MS), NAA)).toBe(
      true,
    );
  });

  it("done er aldri strandet, uansett alder", () => {
    expect(
      erKonverteringStrandet("done", new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA),
    ).toBe(false);
  });

  it("failed er aldri strandet", () => {
    expect(
      erKonverteringStrandet("failed", new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA),
    ).toBe(false);
  });

  it("null (ikke-DWG/DXF, aldri konvertert) er aldri strandet", () => {
    expect(erKonverteringStrandet(null, new Date(NAA - KONVERTERING_STRANDET_MS * 10), NAA)).toBe(
      false,
    );
  });
});

describe("erKonverteringPågår", () => {
  it("fersk pending/converting → pågår", () => {
    expect(erKonverteringPågår("pending", new Date(NAA - 1000), NAA)).toBe(true);
    expect(erKonverteringPågår("converting", new Date(NAA - 1000), NAA)).toBe(true);
  });

  it("strandet pending/converting → IKKE pågår (teller som feilet, ikke evig pågår)", () => {
    expect(
      erKonverteringPågår("converting", new Date(NAA - KONVERTERING_STRANDET_MS - 1), NAA),
    ).toBe(false);
  });

  it("done/failed → ikke pågår", () => {
    expect(erKonverteringPågår("done", new Date(NAA - 1000), NAA)).toBe(false);
    expect(erKonverteringPågår("failed", new Date(NAA - 1000), NAA)).toBe(false);
  });
});

describe("erRekonverterbarOriginal", () => {
  it("originalFileUrl som ender på .dwg → rekonverterbar", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.dwg")).toBe(true);
  });

  it("originalFileUrl som ender på .DXF (store bokstaver) → rekonverterbar", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.DXF")).toBe(true);
  });

  it("originalFileUrl som ender på .pdf → IKKE rekonverterbar (annen vei: rekonverterPdf)", () => {
    expect(erRekonverterbarOriginal("/uploads/a/plan.pdf")).toBe(false);
  });

  it("null (mangler originalfil) → IKKE rekonverterbar", () => {
    expect(erRekonverterbarOriginal(null)).toBe(false);
  });
});
