import { describe, it, expect } from "vitest";
import {
  MAKS_LINJE_CHIPS,
  filtrerVelgerLonnsarter,
  forhaandsvalgNyRad,
  grupperLinjeLonnsarter,
  linjerIDag,
  lonnsarterForLinje,
  ryddLonnsartPerLinje,
  utenLinje,
  velgLinjeLonnsart,
} from "./linjeLonnsart";
import { bruktAvNorm } from "./overtidMotDognet";
import type { DagsforslagLonnsart } from "./dagsforslag";

/**
 * ORDRE 2026-11-16 (28), spec `prosjektkort-kortid-spec.md` § 6.1 (a3) og § 10 B8.
 * T18 skrives etter V4-⚠️ (Kenneth B6 snudd): fravær ER med i velgeren.
 */

const art = (
  id: string,
  type: string,
  over: Partial<DagsforslagLonnsart> = {},
): DagsforslagLonnsart => ({ id, navn: id, type, overtidsnivaa: null, aktiv: true, rekkefolge: 0, ...over });

const TIMELONN = art("timelonn", "ordinaer", { rekkefolge: 0 });
const REGNING = art("regning", "ordinaer", { rekkefolge: 1 });
const OT50 = art("ot50", "ordinaer", { overtidsnivaa: 50, rekkefolge: 2 });
const OT100 = art("ot100", "ordinaer", { overtidsnivaa: 100, rekkefolge: 3 });
const EGENMELDING = art("egenmelding", "fravaer", { rekkefolge: 4 });
const FERIEPENGER = art("feriepenger", "feriepenger");
const DIETT = art("diett", "diett");
const REISE = art("reise", "ordinaer", { rekkefolge: 5 });
const INAKTIV = art("inaktiv", "ordinaer", { aktiv: false });

describe("T18 (etter V4-⚠️) — velgeren", () => {
  const erReise = (l: DagsforslagLonnsart) => l.id === "reise";
  const tilbudt = lonnsarterForLinje(
    [EGENMELDING, OT50, FERIEPENGER, DIETT, REISE, INAKTIV, TIMELONN, OT100, REGNING],
    erReise,
  ).map((l) => l.id);

  it("🔴 ordinær, overtid og fravær tilbys — i katalogorden", () => {
    expect(tilbudt).toEqual(["timelonn", "regning", "ot50", "ot100", "egenmelding"]);
  });
  it("🔴 reise, feriepenger, diett og inaktive tilbys ikke", () => {
    for (const id of ["reise", "feriepenger", "diett", "inaktiv"]) expect(tilbudt).not.toContain(id);
  });
  it("🔴 gruppert Ordinær · Overtid · Fravær", () => {
    const g = grupperLinjeLonnsarter([EGENMELDING, OT50, TIMELONN]);
    expect(g.map((x) => [x.gruppe, x.arter.map((a) => a.id)])).toEqual([
      ["ordinaer", ["timelonn"]],
      ["overtid", ["ot50"]],
      ["fravaer", ["egenmelding"]],
    ]);
  });
  it("chips når ≤ 6 aktuelle arter (V3)", () => {
    expect(MAKS_LINJE_CHIPS).toBe(6);
  });
  it("🔴 F-L2: et annet firmas arter er ikke med; uten firma som før", () => {
    const rader = [
      { id: "a", organizationId: "org1", aktiv: true },
      { id: "b", organizationId: "org2", aktiv: true },
      { id: "c", organizationId: "org1", aktiv: false },
    ];
    expect(filtrerVelgerLonnsarter(rader, "org1").map((r) => r.id)).toEqual(["a"]);
    expect(filtrerVelgerLonnsarter(rader, undefined).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("T17 — valg på linja (V1, V5, V6)", () => {
  const base = { rettDato: undefined, overtidFra: "15:00", arbeidFra: "07:00" };
  it("🔴 annen ordinær art på normaldelen huskes på linja", () => {
    expect(velgLinjeLonnsart({ ...base, linje: "normal", art: REGNING, naboArtId: OT50.id })).toEqual({
      lonnsartPerLinje: { normal: "regning" },
    });
  });
  it("🔴 ordinær art etter normen = overstyring, huskes på overtidslinja", () => {
    expect(velgLinjeLonnsart({ ...base, linje: "overtid", art: REGNING, naboArtId: TIMELONN.id })).toEqual({
      lonnsartPerLinje: { overtid: "regning" },
    });
  });
  it("🔴 samme art som naboen → én linje (overtiden av, «Overtid fra» huskes, overtidsvalget ryddes)", () => {
    expect(
      velgLinjeLonnsart({
        ...base,
        rettDato: { lonnsartPerLinje: { overtid: "regning" } },
        linje: "overtid",
        art: TIMELONN,
        naboArtId: TIMELONN.id,
      }),
    ).toEqual({ overtidAv: true, overtidFra: "15:00", lonnsartPerLinje: undefined });
  });
  it("🔴 overtidsart på overtidslinja = samme valg som nivå-chipsene (V5)", () => {
    expect(
      velgLinjeLonnsart({
        ...base,
        rettDato: { lonnsartPerLinje: { normal: "regning", overtid: "x" } },
        linje: "overtid",
        art: OT100,
        naboArtId: REGNING.id,
      }),
    ).toEqual({ overtidLonnsartId: "ot100", lonnsartPerLinje: { normal: "regning" } });
  });
  it("🔴 fravær kan velges på linja (V4-⚠️)", () => {
    expect(velgLinjeLonnsart({ ...base, linje: "normal", art: EGENMELDING, naboArtId: null })).toEqual({
      lonnsartPerLinje: { normal: "egenmelding" },
    });
  });
});

describe("T19 — linja uten lønnsart og valget som forsvinner med linja", () => {
  it("🔴 linja forsvinner → valget faller bort, aldri over på en annen linje", () => {
    const dag = { rader: [{ linje: "normal" as const }], linjerUtenLonnsart: [] };
    expect(linjerIDag(dag as never)).toEqual(new Set(["normal"]));
    expect(ryddLonnsartPerLinje({ normal: "regning", overtid: "regning" }, new Set(["normal"]))).toEqual({
      lonnsartPerLinje: { normal: "regning" },
    });
    expect(ryddLonnsartPerLinje({ overtid: "regning" }, new Set(["normal"]))).toEqual({ lonnsartPerLinje: undefined });
  });
  it("linja står → ingenting ryddes; linje uten lønnsart teller som linje", () => {
    expect(ryddLonnsartPerLinje({ normal: "x" }, new Set(["normal"]))).toBeNull();
    expect(ryddLonnsartPerLinje(undefined, new Set())).toBeNull();
    const dag = { rader: [], linjerUtenLonnsart: [{ linje: "overtid", fraTid: "15:00", tilTid: "16:00", timer: 1 }] };
    expect(linjerIDag(dag as never)).toEqual(new Set(["overtid"]));
  });
  it("utenLinje: tomt sett blir undefined", () => {
    expect(utenLinje({ overtid: "x" }, "overtid")).toBeUndefined();
    expect(utenLinje(undefined, "overtid")).toBeUndefined();
  });
});

describe("T20 — ny rad i prosjektkortets rad-vindu (V8)", () => {
  const katalog = [TIMELONN, OT50, OT100];
  const arbeid = (timer: number) => ({ timer, erReise: false });
  it("🔴 normen brukt → overtidsarten forhåndsvelges", () => {
    expect(forhaandsvalgNyRad({ dagsnorm: 7.5, rader: [arbeid(7.5)], katalog, standardId: "timelonn" })).toBe("ot50");
  });
  it("normen ikke brukt → standard (som før)", () => {
    expect(forhaandsvalgNyRad({ dagsnorm: 7.5, rader: [arbeid(6)], katalog, standardId: "timelonn" })).toBe("timelonn");
  });
  it("🔴 ukjent norm (L3) og firma uten overtidsart → standard", () => {
    expect(forhaandsvalgNyRad({ dagsnorm: 0, rader: [arbeid(9)], katalog, standardId: "timelonn" })).toBe("timelonn");
    expect(forhaandsvalgNyRad({ dagsnorm: null, rader: [arbeid(9)], katalog, standardId: "timelonn" })).toBe("timelonn");
    expect(forhaandsvalgNyRad({ dagsnorm: 7.5, rader: [arbeid(9)], katalog: [TIMELONN], standardId: "timelonn" })).toBe(
      "timelonn",
    );
  });
  it("🔴 B8: 7,5 t fravær bruker ikke normen → standard; reise teller heller ikke", () => {
    expect(
      forhaandsvalgNyRad({
        dagsnorm: 7.5,
        rader: [{ timer: 7.5, erReise: false, erFravaer: true }, { timer: 3, erReise: true }],
        katalog,
        standardId: "timelonn",
      }),
    ).toBe("timelonn");
  });
});

describe("B8 — fravær bruker ikke normen (Kenneth 2026-11-16)", () => {
  it("🔴 fravær teller ikke; arbeid gjør", () => {
    expect(bruktAvNorm([{ timer: 7.5, erReise: false, erFravaer: true }])).toBe(0);
    expect(bruktAvNorm([{ timer: 3, erReise: false }, { timer: 4.5, erReise: false, erFravaer: true }])).toBe(3);
  });
  it("udefinert erFravaer = arbeid (som før)", () => {
    expect(bruktAvNorm([{ timer: 7.5, erReise: false }])).toBe(7.5);
  });
});
