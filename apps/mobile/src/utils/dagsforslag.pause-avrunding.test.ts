import { describe, it, expect } from "vitest";
import { effektiveTimerFraSpenn } from "@sitedoc/shared";
import {
  beregnDagsforslag,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
  type DagsforslagEksisterendeSedel,
} from "./dagsforslag";

/**
 * ORDRE 2026-11-13 — Bekreft dag: dobbel pause + avrunding av Fra/Til.
 * Kenneth: «rett dobbelpause, benytt fra til -> rund av til nærmeste 15
 * minutter -> la den ansatte korrigere».
 *
 * A: pausen avgjøres for hele dagen (rader på sedelen + økta), samme regel som
 *    manuell føring — trekkes én gang pr. dag.
 * B: arbeidsstart og arbeidsslutt rundes hver for seg; timer = rundet spenn −
 *    pause, så `rad.timer = effektiveTimerFraSpenn(...)` holder for hver rad.
 *
 * Lokal-ISO (uten Z) — carve og midnatt-splitt regner i lokal tid.
 */

const L_NORMAL = "L-normal";
const L_OT50 = "L-ot50";

const EFFEKTIV: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:00",
  pauseMin: 30,
  dagsnorm: 7.5,
};

function lagInput(over: Partial<BeregnDagsforslagInput> = {}): BeregnDagsforslagInput {
  return {
    dag: {
      startAt: "2026-10-01T16:39:00",
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: null,
      byggeplassId: null,
    },
    sluttIso: "2026-10-01T22:49:00",
    endLat: 59.9,
    endLng: 10.7,
    kontekstByggeplassId: null,
    aktivtProsjektId: "p1",
    destinasjonProsjektId: null,
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
      tidsrundingMinutter: 15,
      standardPauseEtterTimer: 4.0,
    },
    reiseOppslag: null,
    effektivPerDato: { "2026-10-01": EFFEKTIV, "2026-10-02": EFFEKTIV },
    eksisterendeSedelPerDato: {},
    ...over,
  };
}

function sedelMed(
  rader: DagsforslagEksisterendeSedel["eksisterendeRader"],
): DagsforslagEksisterendeSedel {
  return { finnes: true, status: "draft", eksisterendeRader: rader };
}

const arbeid = (f: ReturnType<typeof beregnDagsforslag>) =>
  f.datoer.flatMap((d) => d.rader).filter((r) => !r.erReise);
const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

/** Invarianten for hver genererte arbeidsrad. Bæreren har pausen inne i
 *  spennet (klokke-gap = pauseMin), så pauseFra = fra gir full overlapp.
 *  Et segment som ender ved midnatt skrives «23:59» (eksisterende konvensjon i
 *  `tilFraAntall`) — det betyr 24:00 i regnestykket. */
function sjekkInvariant(f: ReturnType<typeof beregnDagsforslag>) {
  for (const d of f.datoer) {
    const tilMidnatt = d.deltVedMidnatt && d.sluttTidKilde === "midnatt";
    for (const r of d.rader.filter((x) => !x.erReise)) {
      const til =
        r.tilTid === "00:00" || (tilMidnatt && r.tilTid === "23:59") ? "24:00" : r.tilTid!;
    expect(
        Math.abs(r.timer - effektiveTimerFraSpenn(r.fraTid!, til, r.fraTid!, r.pauseMin)),
      ).toBeLessThanOrEqual(0.01);
    }
  }
}

describe("Bekreft dag — dobbel pause (A)", () => {
  it("🔴 Kenneths fasit: morgenkort med pause + kveld 16:39–22:49 → 16:45–22:45 = 6,00 t, pause 0", () => {
    const f = beregnDagsforslag(
      lagInput({
        eksisterendeSedelPerDato: {
          "2026-10-01": sedelMed([{ fraTid: "07:00", tilTid: "15:00", pauseMin: 30 }]),
        },
      }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:45");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.timer))).toBe(6);
    expect(sum(rader.map((r) => r.pauseMin))).toBe(0);
    expect(f.datoer[0]!.pauseMin).toBe(0);
    sjekkInvariant(f);
  });

  it("morgen 3 t UTEN pause + kveld 6:10 → dagen > 5,5 t, pausen trekkes én gang (på kvelden)", () => {
    const f = beregnDagsforslag(
      lagInput({
        eksisterendeSedelPerDato: {
          "2026-10-01": sedelMed([{ fraTid: "07:00", tilTid: "10:00", pauseMin: 0 }]),
        },
      }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:45");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.pauseMin))).toBe(30);
    expect(sum(rader.map((r) => r.timer))).toBe(5.5);
    sjekkInvariant(f);
  });

  it("🔴 terskelen ser hele dagen: morgen 3 t uten pause + kveld 3 t → 6 t > 5,5 → pause 30", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T16:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-01T19:00:00",
        eksisterendeSedelPerDato: {
          "2026-10-01": sedelMed([{ fraTid: "07:00", tilTid: "10:00", pauseMin: 0 }]),
        },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(30);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(2.5);
    sjekkInvariant(f);
  });

  it("enkelt økt 6:10 (16:39–22:49) uten andre rader → pause 30 + avrundet spenn = 5,50 t", () => {
    const f = beregnDagsforslag(lagInput());
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:45");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.pauseMin))).toBe(30);
    expect(sum(rader.map((r) => r.timer))).toBe(5.5);
    sjekkInvariant(f);
  });

  it("midnatt-delt økt (20:00–03:10) → én pause for økta, over begge sedlene", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T20:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-02T03:10:00",
      }),
    );
    expect(f.datoer).toHaveLength(2);
    expect(sum(f.datoer.map((d) => d.pauseMin))).toBe(30);
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(30);
    // 20:00–24:00 + 00:00–03:15 = 7,25 t brutto − 0,5 pause.
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(6.75);
    sjekkInvariant(f);
  });
});

describe("Bekreft dag — avrunding av klokkeslett (B)", () => {
  it("🔴 Fra og Til rundes hver for seg, ikke varigheten (16:53–22:52 → 17:00–22:45)", () => {
    // Varighet 5:59 → gammel varighets-avrunding ga 6:00 − pause = 5,50 t.
    // Klokke-avrunding: 17:00–22:45 = 5:45 − pause = 5,25 t.
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T16:53:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: null,
          byggeplassId: null,
        },
        sluttIso: "2026-10-01T22:52:00",
      }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("17:00");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.timer))).toBe(5.25);
    sjekkInvariant(f);
  });

  it("Til kan runde frem i tid (22:53 → 23:00) — godtatt, den ansatte retter", () => {
    const f = beregnDagsforslag(lagInput({ sluttIso: "2026-10-01T22:53:00" }));
    const rader = arbeid(f);
    expect(rader[rader.length - 1]!.tilTid).toBe("23:00");
    expect(sum(rader.map((r) => r.timer))).toBe(5.75);
    sjekkInvariant(f);
  });

  it("uten tidsrunding (null) → minutt-nøyaktig spenn, invarianten holder", () => {
    const base = lagInput();
    const f = beregnDagsforslag({
      ...base,
      regel: { ...base.regel!, tidsrundingMinutter: null },
    });
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:39");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:49");
    sjekkInvariant(f);
  });
});
