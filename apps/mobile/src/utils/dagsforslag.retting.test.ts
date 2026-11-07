import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  beregnDagsforslag,
  leggTilOvertidRetting,
  overtidEditorFra,
  stegOvertidFra,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
} from "./dagsforslag";

/**
 * L3-A (spec § 10, ORDRE 30) — arbeiderens rettinger i `/timer/bekreft-dag`
 * regnes inn i den RENE `beregnDagsforslag` via `input.retting`. Skjermen
 * regner forslaget på nytt for hver retting; ingenting skrives før Bekreft.
 *
 *  - § 8 nr. 6: uten retting (og med tom retting) er utdata identisk med i dag.
 *  - § 8 nr. 4: prosjekt, fra/til, pause og «fjern rad» slår gjennom i radene.
 *  - A1: fra/til = arbeidsvinduet; reisen forankres i endepunktene (ut slutter
 *    ved arbeid-fra, retur starter ved arbeid-til). Reisereglene røres ikke.
 */

const L_NORMAL = "L-normal";
const L_OT50 = "L-ot50";
const L_REISE = "L-reise";

const SOMMER: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:30",
  pauseMin: 30,
  dagsnorm: 8,
};

/** Dag A fra L1-B-fasiten: ut 05:00–07:00, arbeid 07:00–17:30, retur 17:30–19:30. */
function lagInput(over: Partial<BeregnDagsforslagInput> = {}): BeregnDagsforslagInput {
  return {
    dag: {
      startAt: "2026-07-01T05:00:00",
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: "o1",
      byggeplassId: null,
    },
    sluttIso: "2026-07-01T19:30:00",
    endLat: 59.9,
    endLng: 10.7,
    kontekstByggeplassId: null,
    aktivtProsjektId: "p1",
    destinasjonProsjektId: "p1",
    sisteSegmentKilde: "bruker",
    prosjekter: [
      { id: "p1", lat: 59.9, lng: 10.7 },
      { id: "p2", lat: 60.1, lng: 10.9 },
    ],
    aktiviteter: [
      { id: "a1", navn: "Anleggsarbeid" },
      { id: "a2", navn: "Riving" },
    ],
    alleLonnsarter: [
      { id: L_NORMAL, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 },
      { id: L_OT50, overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 1 },
    ],
    standardLonnsartId: L_NORMAL,
    regel: {
      reiseTerskelEnhet: "minutter",
      reiseTerskelMin: 30,
      reiseTerskelM: null,
      reiseUnderTerskelType: "arbeidstid",
      reiseOverTerskelType: "reisetid",
      tidsrundingMinutter: null,
      standardPauseEtterTimer: 4.0,
    },
    reiseOppslag: {
      start: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
      slutt: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
      destinasjon: { type: "byggeplass", byggeplassId: "b1" },
      utCelle: { kjoretidMin: 120, avstandM: 50000 },
      returCelle: { kjoretidMin: 120, avstandM: 50000 },
      grensepunkter: [],
      fallbackReiseLonnsartId: L_REISE,
    },
    effektivPerDato: { "2026-07-01": SOMMER },
    eksisterendeSedelPerDato: {},
    ...over,
  };
}

const arbeid = (f: ReturnType<typeof beregnDagsforslag>) =>
  f.datoer.flatMap((d) => d.rader).filter((r) => !r.erReise);
const reise = (f: ReturnType<typeof beregnDagsforslag>, retning: "ut" | "retur") =>
  f.datoer.flatMap((d) => d.rader).find((r) => r.erReise && r.reiseRetning === retning);
const sum = (rader: { timer: number }[]) => rader.reduce((s, r) => s + r.timer, 0);

describe("L3-A § 8 nr. 6 — uten retting er forslaget uendret", () => {
  it("retting utelatt og retting {} gir identisk utdata", () => {
    const uten = beregnDagsforslag(lagInput());
    expect(beregnDagsforslag(lagInput({ retting: {} }))).toEqual(uten);
    expect(beregnDagsforslag(lagInput({ retting: { perDato: {} } }))).toEqual(uten);
  });
});

describe("L3-A § 8 nr. 4 — rettinger slår gjennom i radene", () => {
  it("prosjekt-retting vinner over destinasjonen og gjelder alle rader", () => {
    const f = beregnDagsforslag(lagInput({ retting: { prosjektId: "p2" } }));
    expect(f.prosjektId).toBe("p2");
    expect(f.datoer[0]!.rader.every((r) => r.projectId === "p2")).toBe(true);
  });

  it("prosjekt-retting løser prosjektUkjent", () => {
    const ukjent = lagInput({ aktivtProsjektId: null, destinasjonProsjektId: null });
    expect(beregnDagsforslag(ukjent).prosjektUkjent).toBe(true);
    const f = beregnDagsforslag({ ...ukjent, retting: { prosjektId: "p2" } });
    expect(f.prosjektUkjent).toBe(false);
    expect(f.prosjektId).toBe("p2");
    expect(arbeid(f).length).toBeGreaterThan(0);
  });

  it("aktivitet-retting gjelder hele dagen", () => {
    const f = beregnDagsforslag(lagInput({ retting: { aktivitetId: "a2" } }));
    expect(f.aktivitetId).toBe("a2");
    expect(f.datoer[0]!.rader.every((r) => r.aktivitetId === "a2")).toBe(true);
  });

  it("byggeplass-retting styrer sedelens byggeplass (null = ingen)", () => {
    const f = beregnDagsforslag(lagInput({ retting: { byggeplassId: "b9" } }));
    expect(f.datoer[0]!.byggeplassId).toBe("b9");
    const ingen = beregnDagsforslag(
      lagInput({ kontekstByggeplassId: "b1", retting: { byggeplassId: null } }),
    );
    expect(ingen.datoer[0]!.byggeplassId).toBeNull();
  });

  it("A1: fra/til flytter arbeidsvinduet, reisen forankres i endepunktene", () => {
    const f = beregnDagsforslag(
      lagInput({
        retting: { perDato: { "2026-07-01": { arbeidFra: "07:30", arbeidTil: "15:30" } } },
      }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("07:30");
    expect(rader[rader.length - 1]!.tilTid).toBe("15:30");
    // 8 t vindu − 0,5 t pause = 7,5 t → under normen, ingen overtid.
    expect(sum(rader)).toBeCloseTo(7.5, 5);
    expect(rader.some((r) => r.lonnsartId === L_OT50)).toBe(false);
    // Reisen er uendret i lengde (matrisen), men flyttet til endepunktene.
    const ut = reise(f, "ut")!;
    const retur = reise(f, "retur")!;
    expect([ut.fraTid, ut.tilTid]).toEqual(["05:30", "07:30"]);
    expect([retur.fraTid, retur.tilTid]).toEqual(["15:30", "17:30"]);
    expect(ut.timer).toBe(2);
    // Sedelens vindu følger: reise-ut-start → retur-slutt.
    expect(f.datoer[0]!.segmentStartIso).toBe(new Date("2026-07-01T05:30:00").toISOString());
    expect(f.datoer[0]!.segmentSluttIso).toBe(new Date("2026-07-01T17:30:00").toISOString());
  });

  it("pause-retting erstatter fordelt pause og regner summen om", () => {
    const f = beregnDagsforslag(
      lagInput({ retting: { perDato: { "2026-07-01": { pauseMin: 60 } } } }),
    );
    expect(f.datoer[0]!.pauseMin).toBe(60);
    // Vindu 07:00–17:30 = 10,5 t − 1 t pause = 9,5 t.
    expect(sum(arbeid(f))).toBeCloseTo(9.5, 5);
  });

  it("fjern rad fjerner arbeidsradene, reiseradene står (K12 a)", () => {
    const f = beregnDagsforslag(
      lagInput({ retting: { perDato: { "2026-07-01": { fjernArbeid: true } } } }),
    );
    expect(arbeid(f)).toHaveLength(0);
    expect(reise(f, "ut")).toBeDefined();
    expect(reise(f, "retur")).toBeDefined();
  });
});

describe("Dom (56) merknad 2 — kun «til» rettet", () => {
  it("arbeidTil alene flytter bare slutten; arbeid-fra og reise ut står", () => {
    const f = beregnDagsforslag(
      lagInput({ retting: { perDato: { "2026-07-01": { arbeidTil: "16:00" } } } }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("07:00");
    expect(rader[rader.length - 1]!.tilTid).toBe("16:00");
    const ut = reise(f, "ut")!;
    const retur = reise(f, "retur")!;
    expect([ut.fraTid, ut.tilTid]).toEqual(["05:00", "07:00"]);
    expect([retur.fraTid, retur.tilTid]).toEqual(["16:00", "18:00"]);
  });
});

describe("ORDRE 34 pkt 4 — arbeiderens overtid-retting", () => {
  const L_OT100 = "L-ot100";
  const medOt100 = () =>
    lagInput({
      alleLonnsarter: [
        { id: L_NORMAL, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 },
        { id: L_OT50, overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 1 },
        { id: L_OT100, overtidsnivaa: 100, aktiv: true, type: "ordinaer", rekkefolge: 2 },
      ],
    });

  it("uten retting: split ved dagsnorm (15:30)", () => {
    const ot = arbeid(beregnDagsforslag(medOt100())).find((r) => r.lonnsartId === L_OT50);
    expect(ot?.fraTid).toBe("15:30");
  });

  it("🔴 overtidFra 14:00 splitter ved 14:00 (pausen 11:00–11:30 trekkes fra normaltiden)", () => {
    const f = beregnDagsforslag({
      ...medOt100(),
      retting: { perDato: { "2026-07-01": { overtidFra: "14:00" } } },
    });
    const rader = arbeid(f);
    const normal = rader.filter((r) => r.lonnsartId === L_NORMAL);
    const ot = rader.find((r) => r.lonnsartId === L_OT50);
    expect(normal[normal.length - 1]!.tilTid).toBe("14:00");
    expect(sum(normal)).toBe(6.5);
    expect(ot).toMatchObject({ fraTid: "14:00", tilTid: "17:30", timer: 3.5 });
    // Total arbeid uendret — kun splitten flytter seg.
    expect(sum(rader)).toBe(10);
  });

  it("🔴 valgt nivå (100 %) brukes på overtidsradene", () => {
    const f = beregnDagsforslag({
      ...medOt100(),
      retting: { perDato: { "2026-07-01": { overtidLonnsartId: L_OT100 } } },
    });
    expect(arbeid(f).find((r) => r.fraTid === "15:30")?.lonnsartId).toBe(L_OT100);
  });

  it("🔴 lønnsart uten overtidsnivå avvises → standard overtid-valg", () => {
    const f = beregnDagsforslag({
      ...medOt100(),
      retting: { perDato: { "2026-07-01": { overtidLonnsartId: L_NORMAL } } },
    });
    expect(arbeid(f).find((r) => r.fraTid === "15:30")?.lonnsartId).toBe(L_OT50);
  });

  it("stegOvertidFra følger tidsrundingen og holder seg i arbeidsvinduet", () => {
    expect(stegOvertidFra("15:30", -1, "07:00", "17:30", 30)).toBe("15:00");
    expect(stegOvertidFra("15:30", 1, "07:00", "17:30", null)).toBe("15:45");
    expect(stegOvertidFra("07:00", -1, "07:00", "17:30", 15)).toBe("07:00");
    // ORDRE 35 C2: «+» når helt til `til` (0 timer overtid).
    expect(stegOvertidFra("17:15", 1, "07:00", "17:30", 15)).toBe("17:30");
    expect(stegOvertidFra("17:30", 1, "07:00", "17:30", 15)).toBe("17:30");
  });

  it("🔴 ORDRE 35 C2: «+» flytter aldri starten bakover (start etter `til`)", () => {
    expect(stegOvertidFra("18:00", 1, "07:00", "17:30", 15)).toBe("18:00");
    // «−» klemmes fortsatt inn i vinduet.
    expect(stegOvertidFra("18:00", -1, "07:00", "17:30", 15)).toBe("17:30");
  });

  it("🔴 ORDRE 35 C1 (O3/O12): overtidFra ved/etter arbeidsslutt → 0 timer overtid", () => {
    for (const overtidFra of ["17:30", "19:00"]) {
      const rader = arbeid(
        beregnDagsforslag({
          ...medOt100(),
          retting: { perDato: { "2026-07-01": { overtidFra } } },
        }),
      );
      expect(rader.some((r) => r.lonnsartId !== L_NORMAL)).toBe(false);
      expect(sum(rader)).toBe(10);
    }
  });

  it("🔴 ORDRE 35 C1 (O5): inaktiv overtid-lønnsart avvises → standard overtid-valg", () => {
    const f = beregnDagsforslag({
      ...lagInput({
        alleLonnsarter: [
          { id: L_NORMAL, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 },
          { id: L_OT50, overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 1 },
          { id: L_OT100, overtidsnivaa: 100, aktiv: false, type: "ordinaer", rekkefolge: 2 },
        ],
      }),
      retting: { perDato: { "2026-07-01": { overtidLonnsartId: L_OT100 } } },
    });
    expect(arbeid(f).find((r) => r.fraTid === "15:30")?.lonnsartId).toBe(L_OT50);
  });
});

describe("ORDRE 35 del B — «Legg til overtid» i Bekreft dag", () => {
  it("🔴 dag under normen (lørdag-tilfellet): overtidFra = arbeidsstart → kun OT-rader, 50 % som fallback", () => {
    // Arbeid 07:00–13:30 minus 30 min pause = 6 t < dagsnorm 8 → ingen overtid uten retting.
    const kort = { sluttIso: "2026-07-01T15:30:00" };
    expect(arbeid(beregnDagsforslag(lagInput(kort))).every((r) => r.lonnsartId === L_NORMAL)).toBe(true);
    const rader = arbeid(
      beregnDagsforslag(
        lagInput({ ...kort, retting: { perDato: { "2026-07-01": { overtidFra: "07:00" } } } }),
      ),
    );
    expect(rader.length).toBeGreaterThan(0);
    expect(rader.every((r) => r.lonnsartId === L_OT50)).toBe(true);
    expect(sum(rader)).toBe(6);
  });

  it("🔴 knappen: vises kun uten overtid og med nivå-valg; starter overtid fra arbeidsstart og åpner editoren", () => {
    const her = dirname(fileURLToPath(import.meta.url));
    const flat = readFileSync(join(her, "../../app/timer/bekreft-dag.tsx"), "utf-8").replace(/\s+/g, " ");
    const i = flat.indexOf('t("timer.bekreftDag.overtidLeggTil")');
    expect(i).toBeGreaterThan(0);
    const knapp = flat.slice(flat.lastIndexOf("{!forsteOt", i), i);
    expect(knapp).toContain("{!forsteOt && overtidValg.length > 0 ? (");
    expect(knapp).toContain("onRett(leggTilOvertidRetting(fra, alleLonnsarter, overtidValg));");
    expect(knapp).toContain("setRedigerOvertid(true);");
  });
});

describe("ORDRE 35 RETUR 1 — firma med OT100 uten OT50", () => {
  const L_OT100 = "L-ot100";
  const kunOt100 = [
    { id: L_NORMAL, overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 0 },
    { id: L_OT100, overtidsnivaa: 100, aktiv: true, type: "ordinaer", rekkefolge: 1 },
  ];
  const overtidValg = [{ id: L_OT100 }];
  const kort = { sluttIso: "2026-07-01T15:30:00", alleLonnsarter: kunOt100 };

  it("🔴 (a) «Legg til overtid» velger første nivå når OT50 mangler", () => {
    expect(leggTilOvertidRetting("07:00", kunOt100, overtidValg)).toEqual({
      overtidFra: "07:00",
      overtidLonnsartId: L_OT100,
    });
    const f = beregnDagsforslag(
      lagInput({
        ...kort,
        retting: { perDato: { "2026-07-01": leggTilOvertidRetting("07:00", kunOt100, overtidValg) } },
      }),
    );
    const rader = arbeid(f);
    expect(rader.length).toBeGreaterThan(0);
    expect(rader.every((r) => r.lonnsartId === L_OT100)).toBe(true);
    expect(sum(rader)).toBe(6);
    expect(f.datoer[0].raderDroppetUtenLonnsart).toBe(0);
  });

  it("negativkontroll: uten nivå-valget droppes arbeidet (fella som ble rettet)", () => {
    const f = beregnDagsforslag(
      lagInput({ ...kort, retting: { perDato: { "2026-07-01": { overtidFra: "07:00" } } } }),
    );
    expect(arbeid(f)).toHaveLength(0);
    expect(f.datoer[0].raderDroppetUtenLonnsart).toBeGreaterThan(0);
  });

  it("med OT50 settes ikke nivå — standardvalget gjelder som før", () => {
    const medOt50 = lagInput().alleLonnsarter;
    expect(leggTilOvertidRetting("07:00", medOt50, [{ id: L_OT50 }])).toEqual({ overtidFra: "07:00" });
  });

  it("🔴 (b) editoren får overtid-start fra rettingen når ingen overtidsrad finnes", () => {
    expect(overtidEditorFra(undefined, "07:00")).toBe("07:00");
    expect(overtidEditorFra("16:00", "07:00")).toBe("16:00");
    expect(overtidEditorFra(null, undefined)).toBeNull();
    const her = dirname(fileURLToPath(import.meta.url));
    const flat = readFileSync(join(her, "../../app/timer/bekreft-dag.tsx"), "utf-8").replace(/\s+/g, " ");
    expect(flat).toContain("const otFra = overtidEditorFra(forsteOt?.fraTid, rettetOvertidFra);");
    expect(flat).toContain("{redigerOvertid && otFra ? (");
    expect(flat).toContain("rettetOvertidFra={retting.perDato?.[d.dato]?.overtidFra}");
    expect(flat).not.toContain("redigerOvertid && forsteOt");
  });
});
