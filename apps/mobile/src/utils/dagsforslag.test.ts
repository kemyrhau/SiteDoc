import { describe, it, expect } from "vitest";
import {
  beregnDagsforslag,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
} from "./dagsforslag";

/**
 * LAG 0b karakteriseringstester (2026-10-02). `beregnDagsforslag` er den rene
 * utregningen skilt ut fra `StartSluttDagKort.genererForslag`. Disse pinner
 * dagens atferd 1:1 — vakten mot at skrive-/lese-splitten endrer regnestykket
 * stille. De skal være GRØNNE både før og etter rekkefølge-fiksen (H7).
 *
 * Ren utils (ingen DB/RN) → ekte enhetstest, ingen mock. Lokal-ISO (uten Z)
 * brukes bevisst: carve + midnatt-splitt regner i lokal tid (samme konvensjon
 * som `dagsegment.test.ts`), og datoene ligger utenfor norsk DST-overgang.
 */

const L_NORMAL = "L-normal";
const L_OT50 = "L-ot50";
const L_REISE = "L-reise";

const STD_EFFEKTIV: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:00",
  pauseMin: 30,
  dagsnorm: 7.5,
};

/** Bygg et minimalt input; overstyr feltene hver test bryr seg om. */
function lagInput(
  over: Partial<BeregnDagsforslagInput> & {
    effektivPerDato?: Record<string, DagsforslagEffektiv>;
  } = {},
): BeregnDagsforslagInput {
  return {
    dag: {
      startAt: "2026-10-01T07:00:00",
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: null,
      byggeplassId: null,
    },
    sluttIso: "2026-10-01T15:00:00",
    endLat: 59.9,
    endLng: 10.7,
    kontekstByggeplassId: null,
    aktivtProsjektId: null,
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
      reisetidTellerOvertid: false,
      standardPauseEtterTimer: 4.0,
    },
    reiseOppslag: null,
    effektivPerDato: over.effektivPerDato ?? { "2026-10-01": STD_EFFEKTIV },
    eksisterendeSedelPerDato: {},
    ...over,
  };
}

/** Sum av arbeids-rad-timer (ekskl. reise) over alle datoer. */
function arbeidsTimer(f: ReturnType<typeof beregnDagsforslag>): number {
  return f.datoer
    .flatMap((d) => d.rader)
    .filter((r) => !r.erReise)
    .reduce((s, r) => s + r.timer, 0);
}

describe("beregnDagsforslag — karakterisering (1:1 med dagens genererForslag)", () => {
  it("1. dag med reise: egen reise-rad med null-tider (REISE-UNNTAK) + arbeids-rad", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T07:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: "o1",
          byggeplassId: null,
        },
        reiseOppslag: {
          matriseRad: { kjoretidMin: 45, avstandM: 30000 },
          grensepunkter: [],
          fallbackReiseLonnsartId: L_REISE,
        },
      }),
    );

    expect(f.prosjektId).toBe("p1");
    expect(f.aktivitetId).toBe("a1");
    expect(f.datoer).toHaveLength(1);
    const rader = f.datoer[0]!.rader;

    const reise = rader.find((r) => r.erReise);
    expect(reise).toBeDefined();
    // REISE-UNNTAK: reise beholder null-tider (matrise-/GPS-mengde, ikke klokke-vindu).
    expect(reise!.fraTid).toBeNull();
    expect(reise!.tilTid).toBeNull();
    expect(reise!.lonnsartId).toBe(L_REISE);
    expect(reise!.timer).toBeCloseTo(0.75, 5); // 45 min

    const arbeid = rader.filter((r) => !r.erReise);
    expect(arbeid).toHaveLength(1);
    // 8t brutto − 0,5t pause − 0,75t reise = 6,75t arbeid, carvet med klokke.
    expect(arbeid[0]!.timer).toBeCloseTo(6.75, 5);
    expect(arbeid[0]!.fraTid).toBe("07:45"); // forskjøvet av reise-tiden
    expect(arbeid[0]!.tilTid).toBe("15:00");
    expect(arbeid[0]!.lonnsartId).toBe(L_NORMAL);
    expect(arbeid[0]!.pauseMin).toBe(30); // bæreren av lunsjpausen
  });

  it("2. midnatt-splitt: én dagsseddel per kalenderdag, timene summerer til reell total", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T19:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-02T07:00:00", // 12t, krysser midnatt
        effektivPerDato: {
          "2026-10-01": STD_EFFEKTIV,
          "2026-10-02": STD_EFFEKTIV,
        },
      }),
    );

    expect(f.kappet).toBe(false);
    expect(f.datoer).toHaveLength(2);
    expect(f.datoer.map((d) => d.dato)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(f.datoer.every((d) => d.deltVedMidnatt)).toBe(true);
    // 12t brutto − 0,5t pause (dagstotal > 5,5t) = 11,5t arbeid fordelt på to dager.
    expect(arbeidsTimer(f)).toBeCloseTo(11.5, 5);
  });

  it("3. pause-fordeling: terskelgate (<5,5t ⇒ 0 pause) + pause lander på lengste segment", () => {
    // 3a: kort dag under 5,5t-terskelen ⇒ ingen pause trekkes.
    const kort = beregnDagsforslag(
      lagInput({ sluttIso: "2026-10-01T12:00:00" }), // 5t
    );
    expect(arbeidsTimer(kort)).toBeCloseTo(5.0, 5);
    expect(kort.datoer[0]!.pauseMin).toBe(0);

    // 3b: dag over terskelen ⇒ 30 min pause trekkes.
    const lang = beregnDagsforslag(
      lagInput({ sluttIso: "2026-10-01T13:00:00" }), // 6t
    );
    expect(arbeidsTimer(lang)).toBeCloseTo(5.5, 5);
    expect(lang.datoer[0]!.pauseMin).toBe(30);

    // 3c: midnatt-splitt [5t, 7t] ⇒ pausen lander HELT på det lengste segmentet.
    const delt = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T19:00:00",
          startLat: null,
          startLng: null,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-02T07:00:00",
        effektivPerDato: {
          "2026-10-01": STD_EFFEKTIV,
          "2026-10-02": STD_EFFEKTIV,
        },
      }),
    );
    // seg0 = 5t (19→24), seg1 = 7t (00→07): pause→lengste (seg1).
    expect(delt.datoer[0]!.pauseMin).toBe(0);
    expect(delt.datoer[1]!.pauseMin).toBe(30);
  });

  it("4. kappet glemt-dag: spenn > 16t kappes til start + dagsnorm, kilde = 'system'", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T07:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-03T20:00:00", // ~61t ⇒ tolkes som glemt avslutning
      }),
    );

    expect(f.kappet).toBe(true);
    expect(f.datoer).toHaveLength(1); // kappet til 7,5t ⇒ ingen midnatt-splitt
    expect(f.datoer[0]!.dato).toBe("2026-10-01");
    // Kappet ⇒ siste (eneste) segments kilde tvinges "system" (gjettet tid).
    expect(f.datoer[0]!.sluttTidKilde).toBe("system");
    // Kappet til start + dagsnorm (7,5t). Måler varighet, ikke eksakt ISO —
    // `.toISOString()` gir UTC og er dermed runner-TZ-avhengig.
    const spennTimer =
      (new Date(f.datoer[0]!.segmentSluttIso).getTime() -
        new Date(f.datoer[0]!.segmentStartIso).getTime()) /
      3_600_000;
    expect(spennTimer).toBeCloseTo(7.5, 5);
    // 7,5t brutto − 0,5t pause = 7,0t arbeid.
    expect(arbeidsTimer(f)).toBeCloseTo(7.0, 5);
  });

  it("5. UF-1 append: play viker for overlappende manuell rad, sedelen er pre-fylt", () => {
    const f = beregnDagsforslag(
      lagInput({
        eksisterendeSedelPerDato: {
          "2026-10-01": {
            finnes: true,
            status: "draft",
            eksisterendeRader: [{ fraTid: "08:00", tilTid: "10:00" }],
          },
        },
      }),
    );

    const dag = f.datoer[0]!;
    expect(dag.erNy).toBe(false);
    expect(dag.blokkert).toBe(false);
    expect(dag.harEksisterendeRader).toBe(true);
    // Play-vinduet 07:00–15:00 overlapper den manuelle 08:00–10:00 ⇒ viker.
    expect(dag.vekForOverlapp).toHaveLength(1);
    expect(dag.vekForOverlapp[0]).toEqual({ fraTid: "07:00", tilTid: "15:00" });
    expect(dag.rader).toHaveLength(0); // ingen play-rad lagt til
  });

  it("5b. UF-1 blokkert: sendt sedel ⇒ blokkert, ingen rader, ingen overlapp-sjekk", () => {
    const f = beregnDagsforslag(
      lagInput({
        eksisterendeSedelPerDato: {
          "2026-10-01": {
            finnes: true,
            status: "sent",
            eksisterendeRader: [{ fraTid: "08:00", tilTid: "10:00" }],
          },
        },
      }),
    );
    const dag = f.datoer[0]!;
    expect(dag.blokkert).toBe(true);
    expect(dag.harEksisterendeRader).toBe(false); // ikke talt i blokkert-grenen
    expect(dag.rader).toHaveLength(0);
    expect(dag.vekForOverlapp).toHaveLength(0);
  });
});
