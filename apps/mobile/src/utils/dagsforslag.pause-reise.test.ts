import { describe, it, expect } from "vitest";
import {
  beregnDagsforslag,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
} from "./dagsforslag";

/**
 * ORDRE 2026-11-14 «reise teller mot 5,5-grensen (som gammel kode)».
 * Kenneth: «I utgangspunktet var den gamle koden rett.»
 *
 *  - Dagens brutto mot 5,5-grensen = arbeid + ført reisetid (reisetid-etappene
 *    i Bekreft dag + lagrede `erReise`-rader på sedelen).
 *  - Uendret: pausen bæres av arbeidsraden, aldri av en reise-rad.
 *
 * MUTANT (skal gi RØDT): la Bekreft dag ignorere reisen —
 *   `nyReiseTimer: nyReiseMin / 60` → `nyReiseTimer: 0` i dagsforslag.ts.
 */

const L_NORMAL = "L-normal";
const L_OT50 = "L-ot50";
const L_REISE = "L-reise";
const DATO = "2026-07-01";

const SOMMER: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:30",
  pauseMin: 30,
  dagsnorm: 8,
};

function lagInput(
  startAt: string,
  sluttIso: string,
  celler: { ut: number | null; retur: number | null } | null,
  over: Partial<BeregnDagsforslagInput> = {},
): BeregnDagsforslagInput {
  return {
    dag: {
      startAt,
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: "o1",
      byggeplassId: null,
    },
    sluttIso,
    endLat: 59.9,
    endLng: 10.7,
    kontekstByggeplassId: null,
    aktivtProsjektId: "p1",
    destinasjonProsjektId: "p1",
    sisteSegmentKilde: "bruker",
    prosjekter: [{ id: "p1", lat: 59.9, lng: 10.7 }],
    aktiviteter: [{ id: "a1", navn: "Anleggsarbeid" }],
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
    reiseOppslag: celler
      ? {
          start: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
          slutt: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
          destinasjon: { type: "byggeplass", byggeplassId: "b1" },
          utCelle: celler.ut === null ? null : { kjoretidMin: celler.ut, avstandM: 50000 },
          returCelle:
            celler.retur === null ? null : { kjoretidMin: celler.retur, avstandM: 50000 },
          grensepunkter: [],
          fallbackReiseLonnsartId: L_REISE,
        }
      : null,
    effektivPerDato: { [DATO]: SOMMER },
    eksisterendeSedelPerDato: {},
    ...over,
  };
}

const rader = (f: ReturnType<typeof beregnDagsforslag>) => f.datoer.flatMap((d) => d.rader);
const arbeid = (f: ReturnType<typeof beregnDagsforslag>) => rader(f).filter((r) => !r.erReise);
const reise = (f: ReturnType<typeof beregnDagsforslag>) => rader(f).filter((r) => r.erReise);
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

describe("Bekreft dag — reise teller mot 5,5-grensen (ORDRE 2026-11-14)", () => {
  it("🔴 1 t ut + 5 t arbeid + 1 t retur = 7 t → pause; bæreren er arbeidsraden, arbeid = 4,5 t", () => {
    const f = beregnDagsforslag(
      lagInput(`${DATO}T06:00:00`, `${DATO}T13:00:00`, { ut: 60, retur: 60 }),
    );
    const a = arbeid(f);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ fraTid: "07:00", tilTid: "12:00", pauseMin: 30, timer: 4.5 });
    const r = reise(f);
    expect(r.map((x) => [x.reiseRetning, x.fraTid, x.tilTid, x.timer, x.pauseMin])).toEqual([
      ["ut", "06:00", "07:00", 1, 0],
      ["retur", "12:00", "13:00", 1, 0],
    ]);
    expect(f.datoer[0]!.pauseMin).toBe(30);
  });

  it("1 t reise + 4,5 t arbeid = 5,5 t (ikke over) → ingen pause", () => {
    const f = beregnDagsforslag(
      lagInput(`${DATO}T06:00:00`, `${DATO}T11:30:00`, { ut: 60, retur: null }),
    );
    const a = arbeid(f);
    expect(sum(a.map((x) => x.pauseMin))).toBe(0);
    expect(sum(a.map((x) => x.timer))).toBe(4.5);
    expect(reise(f).map((x) => x.timer)).toEqual([1]);
  });

  it("lagret reise-rad 1 t + ny arbeidsrad 07:00–12:00 → pause på den nye raden", () => {
    const f = beregnDagsforslag(
      lagInput(`${DATO}T07:00:00`, `${DATO}T12:00:00`, null, {
        eksisterendeSedelPerDato: {
          [DATO]: {
            finnes: true,
            status: "draft",
            eksisterendeRader: [{ fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true }],
          },
        },
      }),
    );
    const a = arbeid(f);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ fraTid: "07:00", tilTid: "12:00", pauseMin: 30, timer: 4.5 });
  });

  it("uten reise: 5 t arbeid alene er fortsatt under grensen → ingen pause", () => {
    const f = beregnDagsforslag(lagInput(`${DATO}T07:00:00`, `${DATO}T12:00:00`, null));
    expect(arbeid(f)[0]).toMatchObject({ pauseMin: 0, timer: 5 });
  });

  it("arbeidstid-etapper (under terskel) ligger i arbeidsraden og telles ikke to ganger", () => {
    // 20 min ut + 20 min retur = arbeidstid → økta 06:40–12:20 er 5:40 arbeid i
    // én rad (> 5,5 t → pause). Hadde etappene blitt talt i tillegg, ville en
    // 5:10-økt (06:55–12:05, 10+10 min etapper) feilaktig passert grensen.
    const f = beregnDagsforslag(
      lagInput(`${DATO}T06:55:00`, `${DATO}T12:05:00`, { ut: 10, retur: 10 }),
    );
    expect(reise(f)).toHaveLength(0);
    expect(arbeid(f)[0]).toMatchObject({ fraTid: "06:55", tilTid: "12:05", pauseMin: 0 });
  });
  it("🔴 midnatt: lagret reise 06–07 teller ikke i de 4 arbeidstimene → bæreren er dag 1 (passererGrensen)", () => {
    // Lagret 01.07: reise 06–07 + arbeid 07–10 (3 t arbeid). Ny økt 18:00 → 02.07 02:00.
    // Arbeid før økta = 3 t → grensen (4 t) passeres 19:00 på 01.07 → pausen på dag 1.
    // Teller reisen som arbeid (mutant), er grensen passert før økta og bæreren blir feil.
    const f = beregnDagsforslag(
      lagInput(`${DATO}T18:00:00`, "2026-07-02T02:00:00", null, {
        effektivPerDato: { [DATO]: SOMMER, "2026-07-02": SOMMER },
        eksisterendeSedelPerDato: {
          [DATO]: {
            finnes: true,
            status: "draft",
            eksisterendeRader: [
              { fraTid: "06:00", tilTid: "07:00", pauseMin: 0, erReise: true },
              { fraTid: "07:00", tilTid: "10:00", pauseMin: 0 },
            ],
          },
        },
      }),
    );
    const dag1 = f.datoer.find((d) => d.dato === DATO)!;
    const dag2 = f.datoer.find((d) => d.dato === "2026-07-02")!;
    expect(dag1.rader.filter((r) => !r.erReise)).toEqual([
      expect.objectContaining({ fraTid: "18:00", tilTid: "23:59", pauseMin: 30 }),
    ]);
    expect(sum(dag2.rader.map((r) => r.pauseMin))).toBe(0);
  });
});
