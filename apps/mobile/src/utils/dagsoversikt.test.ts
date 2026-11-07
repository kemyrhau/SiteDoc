import { describe, it, expect } from "vitest";
import {
  linjerForProsjekt,
  statusOrd,
  dagsoversiktSum,
  type OversiktTimerRad,
  type OversiktMaskinRad,
  type OversiktVare,
} from "./dagsoversikt";

// ORDRE 36b — dagsoversiktens rene regler (spec dagsoversikt-beskrivelse-spec.md § 2.1/§ 2.3).

const P = "p1";

function arbeid(o: Partial<OversiktTimerRad> = {}): OversiktTimerRad {
  return {
    id: "t1",
    projectId: P,
    byggeplassId: null,
    timer: 4,
    fraTid: "07:00",
    tilTid: "11:00",
    beskrivelse: null,
    erReise: false,
    overtidsnivaa: null,
    attestertStatus: null,
    ...o,
  };
}

function maskinRad(o: Partial<OversiktMaskinRad> = {}): OversiktMaskinRad {
  return { id: "m1", projectId: P, byggeplassId: null, vehicleId: "v1", timer: 2, attestertStatus: null, ...o };
}

function vare(o: Partial<OversiktVare> = {}): OversiktVare {
  return { id: "x1", projectId: P, antall: 3, vare: { navn: "Pukk", enhet: "tonn" }, syncStatus: null, ...o };
}

const linjer = (o: Partial<Parameters<typeof linjerForProsjekt>[0]> = {}) =>
  linjerForProsjekt({
    projectId: P,
    timer: [arbeid()],
    maskin: [],
    varer: [],
    utlegg: 0,
    harEquipmentCache: false,
    harVarelager: false,
    ...o,
  });

describe("linjerForProsjekt — Maskin vises når utstyr finnes ELLER maskin er ført", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])("harEquipmentCache=%s, maskin ført=%s → %s", (cache, fort, forventet) => {
    expect(linjer({ harEquipmentCache: cache, maskin: fort ? [maskinRad()] : [] }).visMaskin).toBe(forventet);
  });

  it("maskin på et annet prosjekt teller ikke", () => {
    expect(linjer({ maskin: [maskinRad({ projectId: "p2" })] }).visMaskin).toBe(false);
  });
});

describe("linjerForProsjekt — Varer vises når varelager finnes ELLER varer er ført", () => {
  it.each([
    [false, false, false],
    [true, false, true],
    [false, true, true],
    [true, true, true],
  ])("harVarelager=%s, varer ført=%s → %s", (lager, fort, forventet) => {
    expect(linjer({ harVarelager: lager, varer: fort ? [vare()] : [] }).visVarer).toBe(forventet);
  });

  it("avvist varelinje vises, men gjør ikke Varer aktuell og telles ikke", () => {
    const l = linjer({ varer: [vare({ syncStatus: "avvist" })] });
    expect(l.visVarer).toBe(false);
    expect(l.varer).toHaveLength(1);
    expect(l.summer.varer).toBeNull();
  });
});

describe("linjerForProsjekt — «Mangler» (K3)", () => {
  it("arbeid > 0 uten beskrivelse → mangler", () => {
    expect(linjer().mangler).toBe(true);
  });

  it("ingen arbeid → ikke mangler (selv uten beskrivelse)", () => {
    expect(linjer({ timer: [] }).mangler).toBe(false);
    expect(linjer({ timer: [arbeid({ timer: 0 })] }).mangler).toBe(false);
  });

  it("beskrivelse på én av arbeidsradene holder", () => {
    const l = linjer({ timer: [arbeid(), arbeid({ id: "t2", fraTid: "12:00", beskrivelse: "Forskaling" })] });
    expect(l.mangler).toBe(false);
    expect(l.beskrivelser).toEqual(["Forskaling"]);
  });

  it("bare blanke tegn er ingen beskrivelse", () => {
    expect(linjer({ timer: [arbeid({ beskrivelse: "   " })] }).mangler).toBe(true);
  });

  it("reise alene gir ikke «Mangler»", () => {
    expect(linjer({ timer: [arbeid({ erReise: true })] }).mangler).toBe(false);
  });
});

describe("linjerForProsjekt — arbeid, overtid, reise og beskrivelser", () => {
  it("deler ordinær arbeid, overtid og reise, sortert på fraTid", () => {
    const l = linjer({
      timer: [
        arbeid({ id: "b", fraTid: "12:00" }),
        arbeid({ id: "a", fraTid: "07:00" }),
        arbeid({ id: "o", fraTid: "14:30", overtidsnivaa: 50 }),
        arbeid({ id: "r", fraTid: "06:30", erReise: true }),
      ],
    });
    expect(l.arbeid.map((r) => r.id)).toEqual(["a", "b"]);
    expect(l.overtid.map((r) => r.id)).toEqual(["o"]);
    expect(l.reise.map((r) => r.id)).toEqual(["r"]);
    expect(l.forsteArbeidsradId).toBe("a");
  });

  it("distinkte, trimmede beskrivelser i radrekkefølge", () => {
    const l = linjer({
      timer: [
        arbeid({ id: "b", fraTid: "12:00", beskrivelse: "Armering" }),
        arbeid({ id: "a", fraTid: "07:00", beskrivelse: " Forskaling " }),
        arbeid({ id: "c", fraTid: "13:00", beskrivelse: "Forskaling" }),
      ],
    });
    expect(l.beskrivelser).toEqual(["Forskaling", "Armering"]);
  });

  it("erstattede rader og andre prosjekter er utenfor", () => {
    const l = linjer({ timer: [arbeid({ attestertStatus: "erstattet" }), arbeid({ id: "x", projectId: "p2" })] });
    expect(l.arbeid).toEqual([]);
    expect(l.summer.arbeid).toBe(0);
  });

  it("status og summer følger delte regler", () => {
    const l = linjer({
      timer: [arbeid({ attestertStatus: "returnert" }), arbeid({ id: "r", erReise: true, timer: 1 })],
      maskin: [maskinRad()],
      varer: [vare(), vare({ id: "x2", antall: 2 })],
    });
    expect(l.status).toBe("returnert");
    expect(l.summer).toEqual({ arbeid: 4, maskin: 2, reise: 1, varer: { type: "mengde", antall: 5, enhet: "tonn" } });
  });
});

describe("statusOrd", () => {
  it.each([
    ["draft", "timer.dagsoversikt.ikkeSendt", true],
    ["sent", "timer.dagsoversikt.sendt", false],
    ["returned", "timer.dagsoversikt.returnert", true],
    ["accepted", "timer.dagsoversikt.attestert", false],
  ])("%s → %s (amber=%s)", (status, nokkel, amber) => {
    expect(statusOrd(status)).toEqual({ nokkel, amber });
  });
});

describe("dagsoversiktSum", () => {
  it("summerer prosjektene; maskin bare når aktuelt et sted", () => {
    const a = linjer({ timer: [arbeid({ timer: 5 })] });
    const b = linjerForProsjekt({
      projectId: "p2",
      timer: [arbeid({ projectId: "p2", timer: 3 }), arbeid({ id: "r", projectId: "p2", erReise: true, timer: 0.5 })],
      maskin: [],
      varer: [],
      utlegg: 0,
      harEquipmentCache: false,
      harVarelager: false,
    });
    expect(dagsoversiktSum([a, b])).toEqual({ arbeid: 8, maskin: null, reise: 0.5 });
    const c = linjer({ harEquipmentCache: true });
    expect(dagsoversiktSum([c, b]).maskin).toBe(0);
  });
});
