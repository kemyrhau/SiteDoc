import { describe, it, expect } from "vitest";
import { sluttEtterStartIJobb, type KantFlyttRad } from "./reiseManuell";

// O21 (vedtak-timer-web.md § Reisevinduet pkt 27): Start inne i jobben → Slutt = Start + kjøretid.
const normal: KantFlyttRad = { id: "n", fraTid: "07:00", tilTid: "15:00", erReise: false, kortId: "K" };
const overtid: KantFlyttRad = { id: "o", fraTid: "15:00", tilTid: "17:30", erReise: false, kortId: "K" };
const grunn = { sluttTid: "07:00", kjoretidMin: 4, folger: false, kortId: "K", rader: [normal, overtid] };

describe("sluttEtterStartIJobb", () => {
  it("Kenneths tilfelle: Start 07:00 ≥ Slutt 07:00 inne i jobben 07:00–17:30 → 07:04", () => {
    expect(sluttEtterStartIJobb({ ...grunn, startTid: "07:00" })).toBe("07:04");
  });

  it("jobben er normal + overtid: Start 16:00 (i overtidsraden) → 16:04", () => {
    expect(sluttEtterStartIJobb({ ...grunn, startTid: "16:00" })).toBe("16:04");
  });

  it("pkt 6: Start før jobben → Slutt står", () => {
    expect(sluttEtterStartIJobb({ ...grunn, startTid: "06:30" })).toBeNull();
  });

  it("pkt 24: Start på eller etter jobbens slutt → Slutt står", () => {
    expect(sluttEtterStartIJobb({ ...grunn, startTid: "17:30" })).toBeNull();
    expect(sluttEtterStartIJobb({ ...grunn, startTid: "19:00" })).toBeNull();
  });

  it("arbeiderens Slutt etter Start står", () => {
    expect(sluttEtterStartIJobb({ ...grunn, sluttTid: "07:50", startTid: "07:10" })).toBeNull();
  });

  it("Slutt satt av regelen følger også når Start < Slutt (mellomverdi i tidsfeltet)", () => {
    expect(sluttEtterStartIJobb({ ...grunn, sluttTid: "08:00", folger: true, startTid: "07:00" })).toBe("07:04");
  });

  it("uten kjøretid, uten kort eller uten jobb i kortet → Slutt står", () => {
    expect(sluttEtterStartIJobb({ ...grunn, kjoretidMin: null, startTid: "07:00" })).toBeNull();
    expect(sluttEtterStartIJobb({ ...grunn, kortId: null, startTid: "07:00" })).toBeNull();
    expect(sluttEtterStartIJobb({ ...grunn, kortId: "annet", startTid: "07:00" })).toBeNull();
    const reise: KantFlyttRad = { id: "r", fraTid: "07:00", tilTid: "17:30", erReise: true, kortId: "K" };
    expect(sluttEtterStartIJobb({ ...grunn, rader: [reise], startTid: "07:00" })).toBeNull();
  });

  it("erstattet rad teller ikke som jobb", () => {
    const erstattet = { ...normal, attestertStatus: "erstattet" };
    expect(sluttEtterStartIJobb({ ...grunn, rader: [erstattet], startTid: "07:00" })).toBeNull();
  });
});
