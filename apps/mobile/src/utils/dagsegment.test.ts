import { describe, it, expect } from "vitest";
import { splittVedMidnatt, kappGlemtDagSlutt } from "./dagsegment";

/**
 * Mobil-harness runde (2026-09-16): `splittVedMidnatt` er lønns-sensitiv logikk som til nå
 * KUN var verifisert manuelt med `tsx` (BACKLOG :3843/:3845). Casene her er fra BACKLOG :3845.
 * Ren utils (ingen DB/IO) → ekte enhetstest, ingen mock. Lokal-ISO (uten Z) brukes bevisst:
 * funksjonen regner i lokal tid, og datoene under ligger utenfor norsk DST-overgang.
 */

/** Timer i et segment (tz-uavhengig differanse). */
function timer(seg: { startIso: string; sluttIso: string }): number {
  return (new Date(seg.sluttIso).getTime() - new Date(seg.startIso).getTime()) / 3_600_000;
}

describe("splittVedMidnatt (BACKLOG :3845)", () => {
  it("nattskift 19→07 blir to segmenter 5t + 7t = 12t (sum = reell total)", () => {
    const seg = splittVedMidnatt("2026-01-10T19:00:00", "2026-01-11T07:00:00");
    expect(seg).toHaveLength(2);
    expect(timer(seg[0])).toBe(5);
    expect(timer(seg[1])).toBe(7);
    expect(timer(seg[0]) + timer(seg[1])).toBe(12);
    expect(seg.map((s) => s.dato)).toEqual(["2026-01-10", "2026-01-11"]);
    expect(seg.map((s) => s.erStartSegment)).toEqual([true, false]);
  });

  it("dagskift innenfor én dag er ett uendret segment", () => {
    const seg = splittVedMidnatt("2026-01-10T07:00:00", "2026-01-10T15:00:00");
    expect(seg).toHaveLength(1);
    expect(timer(seg[0])).toBe(8);
    expect(seg[0].dato).toBe("2026-01-10");
    expect(seg[0].erStartSegment).toBe(true);
  });

  it("degenerert (slutt ≤ start) gir ett 0-segment på start-dagen", () => {
    const likt = splittVedMidnatt("2026-01-10T08:00:00", "2026-01-10T08:00:00");
    expect(likt).toHaveLength(1);
    expect(timer(likt[0])).toBe(0);
    expect(likt[0].erStartSegment).toBe(true);

    const bakover = splittVedMidnatt("2026-01-10T10:00:00", "2026-01-10T08:00:00");
    expect(bakover).toHaveLength(1);
    expect(bakover[0].dato).toBe("2026-01-10");
  });

  it("fler-døgn (glemt dag) gir N segmenter der summen er lik total", () => {
    const seg = splittVedMidnatt("2026-03-02T10:00:00", "2026-03-05T14:00:00");
    expect(seg).toHaveLength(4); // delvis startdag + 2 fulle + delvis sluttdag
    const sum = seg.reduce((acc, s) => acc + timer(s), 0);
    const total =
      (new Date("2026-03-05T14:00:00").getTime() - new Date("2026-03-02T10:00:00").getTime()) /
      3_600_000;
    expect(sum).toBe(total); // 76 t
    expect(seg.map((s) => s.dato)).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
    expect(seg[0].erStartSegment).toBe(true);
    expect(seg.slice(1).every((s) => !s.erStartSegment)).toBe(true);
  });
});

describe("kappGlemtDagSlutt — glemt-avslutning kappes før splitt", () => {
  it("et legitimt nattskift (< deteksjonsTimer) slipper urørt gjennom", () => {
    const r = kappGlemtDagSlutt("2026-01-10T19:00:00", "2026-01-11T07:00:00", {
      deteksjonsTimer: 16,
      kappLengdeTimer: 9,
    });
    expect(r.kappet).toBe(false);
    expect(r.sluttIso).toBe("2026-01-11T07:00:00");
  });

  it("et fler-døgns spenn (> deteksjonsTimer) kappes til start + kappLengdeTimer", () => {
    const r = kappGlemtDagSlutt("2026-03-02T10:00:00", "2026-03-05T14:00:00", {
      deteksjonsTimer: 16,
      kappLengdeTimer: 9,
    });
    expect(r.kappet).toBe(true);
    // start 10:00 + 9t = 19:00 samme dag (UTC-normalisert ISO).
    expect(new Date(r.sluttIso).getTime()).toBe(
      new Date("2026-03-02T10:00:00").getTime() + 9 * 3_600_000,
    );
  });
});
