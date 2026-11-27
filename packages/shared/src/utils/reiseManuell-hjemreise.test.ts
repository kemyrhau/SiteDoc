/**
 * Runde 4 timer (Kenneth 2026-11-26: «annet sted, foreslå hjemmreise men ikke bloker annen
 * registrering»): hjemreisen fra et «Annet sted» foreslås — retning retur, Fra = stedet, Til =
 * oppmøtestedet utreisen startet fra.
 */
import { describe, expect, it } from "vitest";
import { annetStedTekst, finnApenAnnetStedReise, løsAnnetStedHjemreise, løsAnnetStedKort } from "./reiseManuell";
import type { AnnetStedReiseRad } from "./reiseManuell";
import type { ReiseRegelsett } from "./reise";

const REGEL: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};
const basis = {
  fraOppmotestedId: "tromso",
  sted: "Bergen",
  regel: REGEL,
  grensepunkter: [],
  resolverLonnsartId: "lr",
  standardLonnsartId: "l1",
};

describe("VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 2–6 i testpanelet, runde 4) — runde 4 — løsAnnetStedHjemreise", () => {
  it("retning retur, oppmøtestedet er Til, stedet i sporet", () => {
    const r = løsAnnetStedHjemreise({ ...basis, startTid: "15:00", sluttTid: "18:30" });
    expect(r).toMatchObject({ fraTid: "15:00", tilTid: "18:30", timer: 3.5, sperre: null });
    expect(r.spor).toMatchObject({ erReise: true, reiseRetning: "retur", reiseOppmotestedId: "tromso", reiseKjoretidMin: null });
    expect(annetStedTekst(r.spor!.reiseRegel)).toBe("Bergen");
  });

  it("utreisen er urørt (retning ut)", () => {
    const r = løsAnnetStedKort({ ...basis, startTid: "06:00", sluttTid: "09:30" });
    expect(r.spor?.reiseRetning).toBe("ut");
  });

  it("uten tider: ingen sperre, ingen spor (tidene føres selv)", () => {
    expect(løsAnnetStedHjemreise(basis)).toMatchObject({ fraTid: null, tilTid: null, sperre: null, spor: null });
  });
});

const rad = (o: Partial<AnnetStedReiseRad>): AnnetStedReiseRad => ({
  dato: "2026-11-23",
  fraTid: "06:00",
  tilTid: "09:30",
  erReise: true,
  reiseRetning: "ut",
  reiseRegel: { annetSted: { sted: "Bergen" } },
  reiseOppmotestedId: "tromso",
  projectId: "internt",
  externalCostObjectId: null,
  ...o,
});

describe("VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 2–6 i testpanelet, runde 4) — runde 4 — finnApenAnnetStedReise", () => {
  it("utreise uten hjemreise → forslaget med sted, oppmøtested og prosjekt", () => {
    expect(finnApenAnnetStedReise([rad({})])).toEqual({
      sted: "Bergen",
      oppmotestedId: "tromso",
      projectId: "internt",
      externalCostObjectId: null,
      dato: "2026-11-23",
    });
  });

  it("hjemreise senere dag (annen skrivemåte) lukker forslaget", () => {
    const hjem = rad({ dato: "2026-11-25", fraTid: "15:00", tilTid: "18:00", reiseRetning: "retur", reiseRegel: { annetSted: { sted: " bergen " } } });
    expect(finnApenAnnetStedReise([rad({}), hjem])).toBeNull();
  });

  it("hjemreise samme dag etter utreisen lukker; før utreisen gjør det ikke", () => {
    const etter = rad({ fraTid: "16:00", tilTid: "19:00", reiseRetning: "retur" });
    const foer = rad({ fraTid: "04:00", tilTid: "05:00", reiseRetning: "retur" });
    expect(finnApenAnnetStedReise([rad({}), etter])).toBeNull();
    expect(finnApenAnnetStedReise([rad({}), foer])).not.toBeNull();
  });

  it("hjemreise fra et annet sted lukker ikke", () => {
    const hjem = rad({ dato: "2026-11-24", reiseRetning: "retur", reiseRegel: { annetSted: { sted: "Oslo" } } });
    expect(finnApenAnnetStedReise([rad({}), hjem])?.sted).toBe("Bergen");
  });

  it("vanlige reiser og erstattede rader teller ikke", () => {
    expect(finnApenAnnetStedReise([rad({ reiseRegel: {} })])).toBeNull();
    expect(finnApenAnnetStedReise([rad({ attestertStatus: "erstattet" })])).toBeNull();
  });

  it("utreise ført som arbeidstid (arbeidReiseRetning) foreslås også", () => {
    expect(finnApenAnnetStedReise([rad({ erReise: false, reiseRetning: null, arbeidReiseRetning: "ut" })])?.sted).toBe("Bergen");
  });

  it("siste utreise vinner", () => {
    const ny = rad({ dato: "2026-11-26", reiseRegel: { annetSted: { sted: "Oslo" } } });
    expect(finnApenAnnetStedReise([rad({}), ny])?.sted).toBe("Oslo");
  });
});
