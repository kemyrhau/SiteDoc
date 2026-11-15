import { describe, it, expect } from "vitest";
import {
  velgTimerByggeplass,
  velgByggeplassUtenGjett,
  velgFilterByggeplass,
  rensLagretByggeplassValg,
} from "./standardByggeplass";

/** Verdien eldre app-versjoner lagret før TILLEGG (22) — testdata, ikke en eksport. */
const UTGAATT = "__hele_prosjektet__";

const liste = ["b1", "b2", "b3"];

/** (18) RETUR vilkår 2 — forbrukerverdien for Bekreft dag/innsjekk/ny timer-rad har ikke (c). */
describe("velgTimerByggeplass — uten (c) første", () => {
  it("null når bare (c) ville slått til", () => {
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: null, gpsNaermeste: null })).toBeNull();
  });
  it("lagret valg gjelder", () => {
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: "b2", gpsNaermeste: "b3" })).toBe("b2");
  });
  it("GPS gjelder uten lagret valg", () => {
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: null, gpsNaermeste: "b3" })).toBe("b3");
  });
  it("TILLEGG (22): utgått lagret verdi er intet valg → GPS", () => {
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: UTGAATT, gpsNaermeste: "b1" })).toBe("b1");
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: UTGAATT, gpsNaermeste: null })).toBeNull();
  });
  // Negativkontroll: tom liste returnerer lagret verdi rått — den utgåtte verdien slipper aldri ut.
  it("negativkontroll: utgått verdi slipper ikke ut ved tom liste", () => {
    expect(velgTimerByggeplass({ byggeplassIder: [], lagret: UTGAATT })).toBeNull();
  });
  it("GPS utenfor prosjektet → null, ikke første", () => {
    expect(velgTimerByggeplass({ byggeplassIder: liste, lagret: null, gpsNaermeste: "annet" })).toBeNull();
  });
  it("ukjent liste: lagret verdi som før", () => {
    expect(velgTimerByggeplass({ byggeplassIder: [], lagret: "x" })).toBe("x");
  });
});

describe("(20) velgByggeplassUtenGjett — dokumentopprettelse", () => {
  const ider = ["b1", "b2"];
  it("er samme funksjon som timeføringen (ingen kopi)", () => {
    expect(velgByggeplassUtenGjett).toBe(velgTimerByggeplass);
  });
  it("uten lagret valg og GPS → ingen byggeplass (aldri første)", () => {
    expect(velgByggeplassUtenGjett({ byggeplassIder: ider, lagret: null, gpsNaermeste: null })).toBeNull();
  });
  it("lagret valg → GPS → ingen", () => {
    expect(velgByggeplassUtenGjett({ byggeplassIder: ider, lagret: "b2", gpsNaermeste: "b1" })).toBe("b2");
    expect(velgByggeplassUtenGjett({ byggeplassIder: ider, lagret: null, gpsNaermeste: "b2" })).toBe("b2");
    expect(velgByggeplassUtenGjett({ byggeplassIder: ider, lagret: UTGAATT, gpsNaermeste: null })).toBeNull();
  });
});

/** ORDRE 2026-11-15 (22) — byggeplassfilteret: innsjekk → GPS → sist valgte → «Velg byggeplass». */
describe("velgFilterByggeplass — (22) nyeste hendelse vinner", () => {
  const ider = ["b1", "b2", "b3"];
  it("uten noe: null («Velg byggeplass»), aldri første", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider })).toBeNull();
  });
  it("uten manuelt valg: innsjekk før GPS", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, innsjekk: { id: "b2", tid: 1 }, gps: "b3" })).toBe("b2");
  });
  it("uten manuelt valg og innsjekk: GPS", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, gps: "b3" })).toBe("b3");
  });
  it("sist valgte når verken innsjekk eller GPS finnes", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, manuelt: { id: "b2", tid: 5 } })).toBe("b2");
  });
  it("TILLEGG: innsjekk nyere enn manuelt valg vinner", () => {
    expect(
      velgFilterByggeplass({ byggeplassIder: ider, innsjekk: { id: "b3", tid: 10 }, manuelt: { id: "b1", tid: 5 } }),
    ).toBe("b3");
  });
  it("manuelt valg etter innsjekken står", () => {
    expect(
      velgFilterByggeplass({ byggeplassIder: ider, innsjekk: { id: "b3", tid: 5 }, manuelt: { id: "b1", tid: 10 } }),
    ).toBe("b1");
  });
  it("GPS på samme byggeplass som da valget ble gjort overstyrer ikke valget", () => {
    expect(
      velgFilterByggeplass({ byggeplassIder: ider, gps: "b2", manuelt: { id: "b1", tid: 5, gpsVedValg: "b2" } }),
    ).toBe("b1");
  });
  it("GPS på en annen byggeplass enn ved valget vinner", () => {
    expect(
      velgFilterByggeplass({ byggeplassIder: ider, gps: "b3", manuelt: { id: "b1", tid: 5, gpsVedValg: "b2" } }),
    ).toBe("b3");
  });
  it("GPS-treff uten GPS ved valget vinner (ny hendelse)", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, gps: "b3", manuelt: { id: "b1", tid: 5 } })).toBe("b3");
  });
  it("id-er utenfor prosjektet teller ikke", () => {
    expect(
      velgFilterByggeplass({
        byggeplassIder: ider,
        innsjekk: { id: "fremmed", tid: 99 },
        gps: "fremmed2",
        manuelt: { id: "b2", tid: 1 },
      }),
    ).toBe("b2");
  });
  it("innsjekk uten byggeplass (prosjektnivå) teller ikke", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, innsjekk: { id: null, tid: 99 } })).toBeNull();
  });
  it("0 byggeplasser → null", () => {
    expect(velgFilterByggeplass({ byggeplassIder: [], manuelt: { id: "b1", tid: 1 } })).toBeNull();
  });
  // Negativkontroller
  it("negativkontroll: utgått lagret verdi som manuelt valg gir aldri verdien tilbake", () => {
    const v = velgFilterByggeplass({ byggeplassIder: ider, manuelt: { id: UTGAATT, tid: 1 } });
    expect(v).not.toBe(UTGAATT);
    expect(v).toBeNull();
  });
  it("negativkontroll: eldre innsjekk overstyrer ikke nyere manuelt valg", () => {
    expect(
      velgFilterByggeplass({ byggeplassIder: ider, innsjekk: { id: "b3", tid: 1 }, manuelt: { id: "b1", tid: 2 } }),
    ).not.toBe("b3");
  });
  it("negativkontroll: aldri første byggeplass som gjett", () => {
    expect(velgFilterByggeplass({ byggeplassIder: ider, gps: null, innsjekk: null, manuelt: null })).not.toBe("b1");
  });
});

describe("TILLEGG (22) rensLagretByggeplassValg", () => {
  it("utgått verdi → null", () => {
    expect(rensLagretByggeplassValg(UTGAATT)).toBeNull();
  });
  it("tom/udefinert → null", () => {
    expect(rensLagretByggeplassValg(undefined)).toBeNull();
    expect(rensLagretByggeplassValg("")).toBeNull();
  });
  // Negativkontroll: ekte byggeplass-id røres ikke.
  it("negativkontroll: byggeplass-id beholdes", () => {
    expect(rensLagretByggeplassValg("b1")).toBe("b1");
  });
});
