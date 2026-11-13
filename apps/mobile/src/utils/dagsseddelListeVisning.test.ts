import { describe, it, expect, vi } from "vitest";
import {
  dedupPerDato,
  haandterStatusbarTrykk,
  velgEldsteKonflikt,
  type DedupRad,
} from "./dagsseddelListeVisning";

/** Ordre 2026-11-13 pkt. 3 — konflikt-sedelen skal kunne finnes. */

const rad = (
  id: string,
  dato: string,
  syncStatus: string,
  harInnhold: boolean,
): DedupRad & { id: string } => ({ id, dato, syncStatus, harInnhold });

describe("dedupPerDato — konflikt skjules aldri", () => {
  it("🔴 tom konflikt-sedel ved siden av sedel med innhold vises (feltcaset)", () => {
    const ut = dedupPerDato([
      rad("lokal", "2026-11-12", "pending", true),
      rad("konflikt", "2026-11-12", "conflict", false),
    ]);
    expect(ut.map((r) => r.id)).toContain("konflikt");
    expect(ut.map((r) => r.id)).toContain("lokal");
  });

  it("🔴 konflikt-sedel med innhold ved siden av tom plassholder vises", () => {
    const ut = dedupPerDato([
      rad("tom", "2026-11-12", "ok", false),
      rad("konflikt", "2026-11-12", "conflict", true),
    ]);
    expect(ut.map((r) => r.id)).toEqual(["konflikt"]);
  });

  it("🔴 to tomme hoder der det ene er konflikt → konflikt beholdes", () => {
    const ut = dedupPerDato([
      rad("tom", "2026-11-12", "ok", false),
      rad("konflikt", "2026-11-12", "conflict", false),
    ]);
    expect(ut.map((r) => r.id)).toEqual(["konflikt"]);
  });

  it("vakt: tom plassholder skjules fortsatt uten konflikt", () => {
    const ut = dedupPerDato([
      rad("innhold", "2026-11-12", "ok", true),
      rad("tom", "2026-11-12", "ok", false),
    ]);
    expect(ut.map((r) => r.id)).toEqual(["innhold"]);
  });

  it("vakt: ekte divergens vises med markering", () => {
    const ut = dedupPerDato([
      rad("a", "2026-11-12", "ok", true),
      rad("b", "2026-11-12", "pending", true),
    ]);
    expect(ut.map((r) => [r.id, r.divergens])).toEqual([
      ["a", true],
      ["b", true],
    ]);
  });
});

describe("velgEldsteKonflikt", () => {
  it("🔴 flere konflikter → eldste dato", () => {
    expect(
      velgEldsteKonflikt([
        rad("ny", "2026-11-13", "conflict", true),
        rad("ok", "2026-11-01", "ok", true),
        rad("eldst", "2026-11-10", "conflict", true),
      ]),
    ).toBe("eldst");
  });

  it("ingen konflikt → null", () => {
    expect(velgEldsteKonflikt([rad("ok", "2026-11-01", "ok", true)])).toBeNull();
  });
});

describe("haandterStatusbarTrykk", () => {
  it("🔴 konflikt-banner: åpner konflikt-sedelen OG starter synk", () => {
    const aapneSedel = vi.fn();
    const startSync = vi.fn();
    haandterStatusbarTrykk({
      visningErKonflikt: true,
      finnKonfliktSedelId: () => "eldst",
      aapneSedel,
      startSync,
    });
    expect(aapneSedel).toHaveBeenCalledWith("eldst");
    expect(startSync).toHaveBeenCalledTimes(1);
  });

  it("vakt: annen banner-tilstand åpner ingenting, starter synk", () => {
    const aapneSedel = vi.fn();
    const startSync = vi.fn();
    const finn = vi.fn(() => "x");
    haandterStatusbarTrykk({
      visningErKonflikt: false,
      finnKonfliktSedelId: finn,
      aapneSedel,
      startSync,
    });
    expect(aapneSedel).not.toHaveBeenCalled();
    expect(finn).not.toHaveBeenCalled();
    expect(startSync).toHaveBeenCalledTimes(1);
  });

  it("konflikt-banner uten lokal konflikt-sedel → ingen navigering, synk startes", () => {
    const aapneSedel = vi.fn();
    const startSync = vi.fn();
    haandterStatusbarTrykk({
      visningErKonflikt: true,
      finnKonfliktSedelId: () => null,
      aapneSedel,
      startSync,
    });
    expect(aapneSedel).not.toHaveBeenCalled();
    expect(startSync).toHaveBeenCalledTimes(1);
  });
});
