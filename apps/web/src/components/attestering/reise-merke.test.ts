import { describe, it, expect } from "vitest";
import { reiseMerkeNokkel } from "./reise-merke";

// LAG 2-C RETUR 1 avvik 1: en reise-rad UTEN retning skal aldri vise «Reise ut».
// FEILER uten fiksen (gammel kode returnerte merkeUt for retning=null).

describe("reiseMerkeNokkel — aldri «ut» uten faktisk retning", () => {
  const UT = "timer.attestering.reise.merkeUt";

  it("backfill-rad (retning=null, kilde=null) → nøytral «Reise», aldri «ut»", () => {
    const n = reiseMerkeNokkel({ reiseRetning: null, reiseKilde: null });
    expect(n).toBe("timer.attestering.reise.merke");
    expect(n).not.toBe(UT);
  });

  it("manuell rad (valg A: kilde=manuell, retning=null) → «Reise (manuell)», aldri «ut»", () => {
    const n = reiseMerkeNokkel({ reiseKilde: "manuell", reiseRetning: null });
    expect(n).toBe("timer.attestering.reise.merkeManuell");
    expect(n).not.toBe(UT);
  });

  it("manuell vinner over en ev. retning (defensiv — B4 sier retning=null)", () => {
    expect(reiseMerkeNokkel({ reiseKilde: "manuell", reiseRetning: "ut" })).toBe(
      "timer.attestering.reise.merkeManuell",
    );
  });

  it("ut/retur uendret for matrise-rader", () => {
    expect(reiseMerkeNokkel({ reiseRetning: "ut", reiseKilde: "matrise" })).toBe(UT);
    expect(reiseMerkeNokkel({ reiseRetning: "retur", reiseKilde: "matrise" })).toBe(
      "timer.attestering.reise.merkeRetur",
    );
  });
});
