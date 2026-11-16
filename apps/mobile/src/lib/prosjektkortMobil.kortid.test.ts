import { describe, it, expect } from "vitest";
import {
  kortNokler,
  kortNokkel,
  kortForRute,
  kortRute,
  raderPaaKort,
  radHorerTilKort,
  utenIdTilKort,
  type KortRad,
  type SedelKortKontekst,
} from "./prosjektkortMobil";
import { linjerForProsjekt, type OversiktTimerRad } from "../utils/dagsoversikt";

/**
 * Ordre c, prosjektkort-kortid-spec § 5.2 / § 9 T11: dagskortet og kortskjermen
 * grupperer på kort-id. To kort med lik (prosjekt, byggeplass, underprosjekt)
 * er to kort; overtid står som linje i kortet sitt; «Uten rad» (linjer uten id,
 * f.eks. varer fra serveren) står i det første kortet med lik nøkkel.
 */

const SEDEL: SedelKortKontekst = { projectId: "p1", byggeplass: null };
const SORT = { byggeplassNavn: (id: string) => id, ecoNokkel: (id: string) => id };

const timer = (over: Partial<OversiktTimerRad> & { id: string }): OversiktTimerRad => ({
  projectId: "p1",
  byggeplassId: null,
  timer: 1,
  fraTid: null,
  tilTid: null,
  beskrivelse: "x",
  erReise: false,
  overtidsnivaa: null,
  attestertStatus: null,
  ...over,
});

// Dagen etter «Del til eget kort» kl. 12: kort A 07–12, kort B 12–15 + overtid 15–17.
const RADER = [
  timer({ id: "t1", kortId: "A", fraTid: "07:00", tilTid: "12:00", timer: 4.5 }),
  timer({ id: "t2", kortId: "B", fraTid: "12:00", tilTid: "15:00", timer: 3 }),
  timer({ id: "t3", kortId: "B", fraTid: "15:00", tilTid: "17:00", timer: 2, overtidsnivaa: 50 }),
];
const VARE_UTEN_ID = { id: "v1", projectId: "p1", antall: 2, vare: { navn: "Pukk", enhet: "t" } };

describe("T11 — dagskortet: to kort med lik nøkkel", () => {
  const kort = kortNokler(SEDEL, [RADER], [], SORT);

  it("vises som to kort, i tidsrekkefølge, med hver sin id", () => {
    expect(kort.map((k) => k.kortId)).toEqual(["A", "B"]);
    expect(new Set(kort.map(kortNokkel)).size).toBe(2);
  });

  it("tidsrekkefølge gjelder selv om radene kommer i annen orden", () => {
    const omvendt = kortNokler(SEDEL, [[...RADER].reverse()], [], SORT);
    expect(omvendt.map((k) => k.kortId)).toEqual(["A", "B"]);
  });

  it("overtid står som linje i kort B, ikke i kort A", () => {
    const utenId = utenIdTilKort(SEDEL, [RADER]);
    const [a, b] = kort.map((valg) =>
      linjerForProsjekt({
        projectId: "p1",
        timer: RADER,
        maskin: [],
        varer: [VARE_UTEN_ID],
        utlegg: 0,
        harEquipmentCache: false,
        harVarelager: true,
        kort: { valg, sedel: SEDEL, utenId },
      }),
    );
    expect(a!.arbeid.map((r) => r.id)).toEqual(["t1"]);
    expect(a!.overtid).toEqual([]);
    expect(b!.arbeid.map((r) => r.id)).toEqual(["t2"]);
    expect(b!.overtid.map((r) => r.id)).toEqual(["t3"]);
    // «Uten rad»: varen uten id står i det første kortet, bare der.
    expect(a!.varer.map((v) => v.id)).toEqual(["v1"]);
    expect(b!.varer).toEqual([]);
  });

  it("rader uten id (før normalisering) lager ikke et tredje kort", () => {
    const medGammel = kortNokler(SEDEL, [[...RADER, { projectId: "p1", byggeplassId: null }]], [], SORT);
    expect(medGammel.map((k) => k.kortId)).toEqual(["A", "B"]);
  });

  it("tomt kort uten id med lik nøkkel slås sammen med kortet som har rader", () => {
    const k = kortNokler(SEDEL, [RADER], [{ projectId: "p1", byggeplassId: null, ecoId: null }], SORT);
    expect(k.map((x) => x.kortId)).toEqual(["A", "B"]);
  });

  it("uten kort-id: som før (én nøkkel = ett kort)", () => {
    const gamle: KortRad[] = [
      { projectId: "p1", byggeplassId: null },
      { projectId: "p1", byggeplassId: null },
    ];
    expect(kortNokler(SEDEL, [gamle], [], SORT)).toHaveLength(1);
  });

  it("fraværskortet nøkles som før, uansett id (spec § 11.2)", () => {
    const fravaer: KortRad[] = [
      { projectId: null, utenProsjekt: true, kortId: "F1" },
      { projectId: null, utenProsjekt: true, kortId: "F2" },
    ];
    expect(kortNokler(SEDEL, [fravaer], [], SORT)).toHaveLength(1);
  });
});

describe("T11 — radHorerTilKort", () => {
  const utenId = utenIdTilKort(SEDEL, [RADER]);
  const A = { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "A" };
  const B = { ...A, kortId: "B" };

  it("begge med id: lik id", () => {
    expect(radHorerTilKort(RADER[1]!, SEDEL, A)).toBe(false);
    expect(radHorerTilKort(RADER[1]!, SEDEL, B)).toBe(true);
  });
  it("rad uten id → bare det første kortet med lik nøkkel", () => {
    expect(radHorerTilKort(VARE_UTEN_ID, SEDEL, A, utenId)).toBe(true);
    expect(radHorerTilKort(VARE_UTEN_ID, SEDEL, B, utenId)).toBe(false);
  });
  it("kort uten id (tomt kort fra ruten) → nøkkeltreff som før", () => {
    expect(raderPaaKort(RADER, SEDEL, { projectId: "p1", byggeplassId: null, ecoId: null })).toHaveLength(3);
  });
});

describe("T11 — kortskjermens rute `kort=<kortId>`", () => {
  it("ruten bærer kort-id når kortet har det; bp/up står", () => {
    expect(kortRute("s1", { projectId: "p1", byggeplassId: null, ecoId: null, kortId: "B" })).toBe(
      "/timer/s1/kort/p1?bp=ingen&up=ingen&kort=B",
    );
    expect(kortRute("s1", { projectId: "p1", byggeplassId: "bp", ecoId: null })).toBe(
      "/timer/s1/kort/p1?bp=bp&up=ingen",
    );
  });

  it("`kort=B` åpner kort B; gammel lenke (bp/up) åpner det første", () => {
    const args = { projectId: "p1", bp: null, up: null, rader: RADER, sedel: SEDEL };
    expect(kortForRute({ ...args, kortParam: "B" }).kortId).toBe("B");
    expect(kortForRute({ ...args, kortParam: null }).kortId).toBe("A");
    // Rute uten bp (eldste lenkeform): prosjektets første rad.
    expect(kortForRute({ ...args, bp: undefined, kortParam: null }).kortId).toBe("A");
  });

  it("`kort=` uten rader = tomt kort med den id-en (nye rader føres der)", () => {
    const v = kortForRute({ projectId: "p1", bp: null, up: null, rader: RADER, sedel: SEDEL, kortParam: "NY" });
    expect(v).toEqual({ projectId: "p1", byggeplassId: null, ecoId: null, kortId: "NY" });
    expect(raderPaaKort(RADER, SEDEL, v)).toEqual([]);
  });
});
