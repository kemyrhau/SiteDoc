import { describe, it, expect } from "vitest";
import { aktiveTimerRader, beskrivOverlapp, linjeKanFlyttes, reiseUtenforArbeid } from "./returSedel";
import { finnOverlappendeTidsrom } from "./tidsromValidering";

/**
 * R1 (Kenneth 2026-11-23). Kenneths dag fra sitedoc_test: 07–10 (K1), 10–12 (K2, slettet senere),
 * reise 12–15 + arbeid 15–19 i Narvik-kortet (K3). 10:00–15:00 på K2 traff reisen, men meldingen
 * pekte på «en annen rad» og hodet på K3 viste bare 15:00–19:00.
 */
const K1 = { id: "a", kortId: "K1", fraTid: "07:00", tilTid: "10:00", erReise: false, byggeplassId: "bpB12", projectId: "P" };
const REISE = { id: "r", kortId: "K3", fraTid: "12:00", tilTid: "15:00", erReise: true, byggeplassId: "bpNarvik", projectId: "P" };
const NARVIK = { id: "n", kortId: "K3", fraTid: "15:00", tilTid: "19:00", erReise: false, byggeplassId: "bpNarvik", projectId: "P" };
const DAG = [K1, REISE, NARVIK];

describe("R1 (a) — overlappmeldingen sier hva og hvor", () => {
  it("10:00–15:00 treffer reisen 12:00–15:00 i kortet Narvik · 15:00–19:00", () => {
    const treff = finnOverlappendeTidsrom("10:00", "15:00", DAG.filter((r) => r.kortId !== "K1"));
    expect(treff?.id).toBe("r");
    expect(beskrivOverlapp(treff!, DAG)).toEqual({
      hva: "reise",
      fra: "12:00",
      til: "15:00",
      kort: { byggeplassId: "bpNarvik", projectId: "P", fra: "15:00", til: "19:00" },
    });
  });

  it("arbeidsrad gir «rad», og kortet er arbeidets fra–til", () => {
    expect(beskrivOverlapp(NARVIK, DAG)).toMatchObject({ hva: "rad", kort: { fra: "15:00", til: "19:00" } });
  });

  it("reise ført som arbeidstid er også reise", () => {
    const r = { ...NARVIK, arbeidReiseRetning: "ut" };
    expect(beskrivOverlapp(r, [r]).hva).toBe("reise");
  });

  it("kort med bare reise: kortets fra–til er reisens", () => {
    expect(beskrivOverlapp(REISE, [REISE]).kort).toMatchObject({ fra: "12:00", til: "15:00" });
  });

  it("kort med flere byggeplasser: byggeplass null (kalleren viser prosjektet)", () => {
    const annen = { ...NARVIK, id: "n2", fraTid: "19:00", tilTid: "20:00", byggeplassId: "bpAnnen" };
    expect(beskrivOverlapp(REISE, [REISE, NARVIK, annen]).kort).toMatchObject({ byggeplassId: null, til: "20:00" });
  });

  it("rad uten kort: kort null", () => {
    expect(beskrivOverlapp({ ...K1, kortId: null }, DAG).kort).toBeNull();
  });
});

describe("R1 (a) — kortets hode viser reisen utenfor arbeidet", () => {
  it("Narvik: reise 12:00–15:00 før arbeidet 15:00–19:00", () => {
    expect(reiseUtenforArbeid([REISE, NARVIK])).toEqual([{ fra: "12:00", til: "15:00" }]);
  });
  it("kort uten arbeid: ingenting (hodet viser alt reisens klokke)", () => {
    expect(reiseUtenforArbeid([REISE])).toEqual([]);
  });
  it("reise uten tider tas ikke med", () => {
    expect(reiseUtenforArbeid([{ ...REISE, fraTid: null }, NARVIK])).toEqual([]);
  });
});

describe("R1 (a) — samme utvalg som serveren", () => {
  it("erstattet rad tas bort, alle andre står", () => {
    const erstattet = { ...K1, id: "x", attestertStatus: "erstattet" };
    const rader = [{ ...K1, attestertStatus: "pending" }, { ...REISE, attestertStatus: "returnert" }, erstattet];
    expect(aktiveTimerRader(rader).map((r) => r.id)).toEqual(["a", "r"]);
  });
});

describe("R1 b1 — egne returnerte linjer kan flyttes, attesterte ikke", () => {
  const egenReturnert = { status: "returned", egenSedel: true };
  it("pending og null kan alltid flyttes", () => {
    expect(linjeKanFlyttes("pending", { status: "draft", egenSedel: true })).toBe(true);
    expect(linjeKanFlyttes(null, { status: "sent", egenSedel: false })).toBe(true);
  });
  it("returnert på egen returnert sedel: lov", () => {
    expect(linjeKanFlyttes("returnert", egenReturnert)).toBe(true);
  });
  it("attestert: sperret, også på egen returnert sedel", () => {
    expect(linjeKanFlyttes("attestert", egenReturnert)).toBe(false);
  });
  it("returnert hos leder (ikke egen sedel) eller på sedel som ikke er returnert: sperret", () => {
    expect(linjeKanFlyttes("returnert", { status: "returned", egenSedel: false })).toBe(false);
    expect(linjeKanFlyttes("returnert", { status: "draft", egenSedel: true })).toBe(false);
  });
});
