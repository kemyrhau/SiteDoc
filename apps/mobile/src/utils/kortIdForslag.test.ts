import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-sqlite", () => ({ openDatabaseSync: () => null }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "x" }));
vi.mock("../db/database", () => ({ erDatabaseTilgjengelig: () => false, hentDatabase: () => null }));
import { utledKortId } from "@sitedoc/shared";
import type { Dagsforslag, DagsforslagDag, DagsforslagRad } from "./dagsforslag";
import { tildelKortIder, delTilEgetKort, delingsVindu, angreKortDeling } from "./kortIdForslag";
import { kortMedArbeid, beskrivelseForRad, foreldreloseBeskrivelser } from "./beskrivelseKort";

/**
 * Ordre c, prosjektkort-kortid-spec § 5.1 / § 9 T10: Bekreft dag bærer kort-id
 * pr. kort, og «Del til eget kort» gir to kort på samme prosjekt.
 */

const DATO = "2026-11-16";
const USER = "user-1";
const P = "prosjekt-a";

function rad(over: Partial<DagsforslagRad>): DagsforslagRad {
  return {
    projectId: P,
    lonnsartId: "normal",
    aktivitetId: "akt",
    timer: 0,
    fraTid: null,
    tilTid: null,
    pauseMin: 0,
    erReise: false,
    reiseRetning: null,
    reiseOppmotestedId: null,
    byggeplassId: null,
    reiseKjoretidMin: null,
    reiseAvstandM: null,
    reiseKilde: null,
    reiseRegel: null,
    tidKilde: "manuell",
    ...over,
  };
}

function dag(rader: DagsforslagRad[], over: Partial<DagsforslagDag> = {}): DagsforslagDag {
  return {
    dato: DATO,
    erStartSegment: true,
    segmentStartIso: `${DATO}T07:00:00`,
    segmentSluttIso: `${DATO}T17:00:00`,
    blokkert: false,
    eksisterendeStatus: null,
    erNy: true,
    harEksisterendeRader: false,
    byggeplassId: null,
    pauseMin: 30,
    deltVedMidnatt: false,
    sluttTidKilde: "bruker",
    normStatus: "server",
    normSnapshot: null,
    vekForOverlapp: [],
    raderDroppetUtenLonnsart: 0,
    rader,
    ...over,
  };
}

/** 07–17 med 30 min pause, norm 7,5: 07–15 normal (7,5 t), 15–17 overtid (2 t). */
function dagSyvTilFem(): DagsforslagDag {
  return dag([
    rad({ fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5, radIndeks: 0, linje: "normal" }),
    rad({ fraTid: "15:00", tilTid: "17:00", timer: 2, lonnsartId: "overtid50", radIndeks: 1, linje: "overtid" }),
    rad({ fraTid: "06:30", tilTid: "07:00", timer: 0.5, erReise: true, lonnsartId: "reise", byggeplassId: "bp-x" }),
  ]);
}

function forslagAv(datoer: DagsforslagDag[], beskrivelse?: Record<string, string>): Dagsforslag {
  return {
    prosjektId: P,
    aktivitetId: "akt",
    kappet: false,
    prosjektUkjent: false,
    reiseAarsak: null,
    destinasjonAarsak: null,
    normStatus: "server",
    datoer,
    ...(beskrivelse ? { beskrivelsePerKort: beskrivelse } : {}),
  };
}

const UTLEDET = utledKortId({ userId: USER, dato: DATO, nokkel: { projectId: P, byggeplassId: null, ecoId: null } });

describe("tildelKortIder — kort-id pr. kort (§ 5.1)", () => {
  it("arbeidsrader får utledet id; reise får ingen", () => {
    const [d] = tildelKortIder([dagSyvTilFem()], { userId: USER, eksisterendeSedelPerDato: {}, kortDeling: [] });
    const arbeid = d!.rader.filter((r) => !r.erReise);
    expect(arbeid.map((r) => r.kortId)).toEqual([UTLEDET, UTLEDET]);
    expect(d!.rader.find((r) => r.erReise)?.kortId).toBeUndefined();
  });

  it("kort som alt finnes på sedelen (samme prosjekt + byggeplass) beholder sin id", () => {
    const [d] = tildelKortIder([dagSyvTilFem()], {
      userId: USER,
      eksisterendeSedelPerDato: {
        [DATO]: {
          finnes: true,
          status: "draft",
          eksisterendeRader: [],
          kort: [
            { kortId: "annet-prosjekt", projectId: "p-b", byggeplassId: null },
            { kortId: "eldst", projectId: P, byggeplassId: null },
            { kortId: "yngre", projectId: P, byggeplassId: null },
          ],
        },
      },
      kortDeling: [],
    });
    expect(d!.rader.filter((r) => !r.erReise).every((r) => r.kortId === "eldst")).toBe(true);
  });

  // T12 (spec § 7 rad «+ Nytt prosjektkort»): prosjektet har alt et kort med
  // samme byggeplass — det nye kortet får ny id, aldri det eksisterende.
  it("T12: «+ Nytt prosjektkort» på prosjekt som alt har kort → ny id, stabil ved omregning", () => {
    const eks = {
      [DATO]: {
        finnes: true,
        status: "draft",
        eksisterendeRader: [],
        kort: [{ kortId: "eldst", projectId: P, byggeplassId: null }],
      },
    };
    const regn = () =>
      tildelKortIder([dagSyvTilFem()], { userId: USER, eksisterendeSedelPerDato: eks, kortDeling: [], nyttKort: "frø-1" })[0]!
        .rader.filter((r) => !r.erReise)
        .map((r) => r.kortId);
    const ider = regn();
    expect(new Set(ider).size).toBe(1);
    expect(ider[0]).not.toBe("eldst");
    expect(ider[0]).not.toBe(UTLEDET);
    expect(regn()).toEqual(ider);
    // Nytt frø = nytt kort (to «+ Nytt prosjektkort» samme dag blir to kort).
    const annet = tildelKortIder([dagSyvTilFem()], { userId: USER, eksisterendeSedelPerDato: eks, kortDeling: [], nyttKort: "frø-2" })[0]!
      .rader.find((r) => !r.erReise)!.kortId;
    expect(annet).not.toBe(ider[0]);
  });

  it("uten userId: ingen kort-id (ingenting gjettes)", () => {
    const [d] = tildelKortIder([dagSyvTilFem()], { userId: undefined, eksisterendeSedelPerDato: {}, kortDeling: [] });
    expect(d!.rader.every((r) => r.kortId === undefined)).toBe(true);
  });
});

describe("T10 — «Del til eget kort» kl. 12 på 07–17", () => {
  const deling = { dato: DATO, fraKortId: UTLEDET, fra: "12:00", kortId: "nytt-kort" };
  const [d] = tildelKortIder([dagSyvTilFem()], { userId: USER, eksisterendeSedelPerDato: {}, kortDeling: [deling] });
  const arbeid = d!.rader.filter((r) => !r.erReise);

  it("to kort, to id-er", () => {
    expect(new Set(arbeid.map((r) => r.kortId))).toEqual(new Set([UTLEDET, "nytt-kort"]));
  });

  it("kort 1 = 07–12, kort 2 = 12–15 normal + 15–17 overtid (overtid som linje i kort 2)", () => {
    const kort1 = arbeid.filter((r) => r.kortId === UTLEDET);
    const kort2 = arbeid.filter((r) => r.kortId === "nytt-kort");
    expect(kort1.map((r) => [r.fraTid, r.tilTid, r.linje])).toEqual([["07:00", "12:00", "normal"]]);
    expect(kort2.map((r) => [r.fraTid, r.tilTid, r.linje])).toEqual([
      ["12:00", "15:00", "normal"],
      ["15:00", "17:00", "overtid"],
    ]);
    expect(kort2.every((r) => r.egetKort)).toBe(true);
    expect(kort1.some((r) => r.egetKort)).toBe(false);
  });

  it("timene summerer som før; pausen står i delen som rommer den", () => {
    const sum = arbeid.reduce((s, r) => s + r.timer, 0);
    expect(sum).toBeCloseTo(9.5, 5);
    const del1 = arbeid.find((r) => r.fraTid === "07:00")!;
    const del2 = arbeid.find((r) => r.fraTid === "12:00")!;
    expect(del1.pauseMin).toBe(30);
    expect(del1.timer).toBeCloseTo(4.5, 5);
    expect(del2.pauseMin).toBe(0);
    expect(del2.timer).toBeCloseTo(3, 5);
  });

  it("nye deler får egen, stabil radIndeks (maskin/varer følger ikke med til kort 2)", () => {
    const indekser = arbeid.map((r) => r.radIndeks);
    expect(new Set(indekser).size).toBe(indekser.length);
    expect(arbeid.find((r) => r.fraTid === "07:00")!.radIndeks).toBe(0);
    expect(arbeid.find((r) => r.fraTid === "15:00")!.radIndeks).toBe(1);
  });

  it("hvert kort krever sin egen beskrivelse", () => {
    const forslag = forslagAv([d!], { [P]: "Grøft" });
    const kort = kortMedArbeid(forslag);
    expect(kort.map((k) => k.kortId)).toEqual([UTLEDET, "nytt-kort"]);
    // Kort 1 beholder nøkkelen fra før (prosjektet); kort 2 nøkles på sin id.
    expect(kort.map((k) => k.nokkel)).toEqual([P, "nytt-kort"]);
    const kort2Rad = arbeid.find((r) => r.kortId === "nytt-kort")!;
    expect(beskrivelseForRad(forslag, kort2Rad, d!)).toBeNull();
    const medTekst = forslagAv([d!], { [P]: "Grøft", "nytt-kort": "Skifer" });
    expect(beskrivelseForRad(medTekst, kort2Rad, d!)).toBe("Skifer");
    expect(beskrivelseForRad(medTekst, arbeid[0]!, d!)).toBe("Grøft");
  });

  it("et delt kort kan deles igjen (1–30 kort)", () => {
    const [d3] = tildelKortIder([dagSyvTilFem()], {
      userId: USER,
      eksisterendeSedelPerDato: {},
      kortDeling: [deling, { dato: DATO, fraKortId: "nytt-kort", fra: "16:00", kortId: "tredje" }],
    });
    const ar = d3!.rader.filter((r) => !r.erReise);
    expect(ar.map((r) => [r.fraTid, r.tilTid, r.kortId])).toEqual([
      ["07:00", "12:00", UTLEDET],
      ["12:00", "15:00", "nytt-kort"],
      ["15:00", "16:00", "nytt-kort"],
      ["16:00", "17:00", "tredje"],
    ]);
  });

  it("deling utenfor kortets tid gir ikke noe tomt kort", () => {
    const [dx] = tildelKortIder([dagSyvTilFem()], {
      userId: USER,
      eksisterendeSedelPerDato: {},
      kortDeling: [{ dato: DATO, fraKortId: UTLEDET, fra: "18:00", kortId: "tomt" }],
    });
    expect(dx!.rader.some((r) => r.kortId === "tomt")).toBe(false);
  });
});

describe("delTilEgetKort — legger til deling i rettingen", () => {
  it("legger en deling til og lar eksisterende stå", () => {
    const ut = delTilEgetKort({ kortDeling: [] }, { dato: DATO, fraKortId: "a", fra: "12:00" }, () => "ny");
    expect(ut.kortDeling).toEqual([{ dato: DATO, fraKortId: "a", fra: "12:00", kortId: "ny" }]);
  });
});

describe("T14 — tekst som ikke finner kort, droppes aldri stille", () => {
  it("nøkkel uten kort er foreldreløs; kortenes nøkler er det ikke", () => {
    const [d] = tildelKortIder([dagSyvTilFem()], { userId: USER, eksisterendeSedelPerDato: {}, kortDeling: [] });
    const forslag = forslagAv([d!], { [P]: "Grøft", "borte-kort": "Skifer", "tom": "  " });
    expect(foreldreloseBeskrivelser(forslag)).toEqual(["borte-kort"]);
  });
});

describe("delingsVindu — hvor et kort kan deles", () => {
  it("07–17 med steg 15: 07:15–16:45, forslag midt på (12:00)", () => {
    expect(delingsVindu(dagSyvTilFem().rader, null)).toEqual({ fra: "07:15", til: "16:45", forslag: "12:00" });
  });
  it("kortere enn to steg → null; reise teller ikke", () => {
    expect(delingsVindu([rad({ fraTid: "07:00", tilTid: "07:20" })], 15)).toBeNull();
    expect(delingsVindu([rad({ fraTid: "06:00", tilTid: "09:00", erReise: true })], 15)).toBeNull();
  });
  it("firmaets tidsrunding styrer steget", () => {
    expect(delingsVindu([rad({ fraTid: "07:00", tilTid: "08:00" })], 30)).toEqual({ fra: "07:30", til: "07:30", forslag: "07:30" });
  });
});

describe("angreKortDeling — slår kortet sammen igjen", () => {
  it("fjerner delingen og delinger av det utdelte kortet", () => {
    const r = {
      kortDeling: [
        { dato: DATO, fraKortId: "a", fra: "10:00", kortId: "b" },
        { dato: DATO, fraKortId: "b", fra: "12:00", kortId: "c" },
        { dato: DATO, fraKortId: "a", fra: "08:00", kortId: "d" },
      ],
    };
    expect(angreKortDeling(r, "b").kortDeling?.map((d) => d.kortId)).toEqual(["d"]);
  });
});
