import { describe, it, expect } from "vitest";
import { effektiveTimerFraSpenn, hhmmTilMin, pauseVinduForDag } from "@sitedoc/shared";
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
 * ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer» — Kenneth: «Morgen
 *    07:00–10:00 og kveld 16:00–19:00 gir 0 pause og 3,0 t. -> dette kan ikke
 *    være rett -> dette er totalt 6 timer arbeid -> her er det krav om 0,5
 *    timer pause» · «Ja, etter 4 arbeidstimer». Dagen får pause når arbeidet
 *    > 5,5 t; bæreren er raden der summert arbeid passerer firmaets
 *    `standardPauseEtterTimer`; et gap mellom rader er ingen pause; lagrede
 *    rader endres aldri.
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
/**
 * Serverens kontroll (`vurderRadTimer`, `apps/api/src/routes/timer/dagsseddel.ts`):
 * en rad gir verken `avvik` (sync) eller `kast` (interaktiv) når den stemmer
 * med den GAMLE vindu-formelen (`pauseVinduForDag` over alle radene) ELLER med
 * den nye regelen (pausen inne i raden: `timer = (spenn − pauseMin)/60`).
 * Gjelder dager som ikke er delt ved midnatt (23:59-konvensjonen, se gate nr. 4).
 */
function sjekkServer(
  f: ReturnType<typeof beregnDagsforslag>,
  eksisterende: Array<{ fraTid: string; tilTid: string; pauseMin: number }>,
  pauseEtterTimer = 4,
) {
  for (const d of f.datoer) {
    const alle = [...eksisterende, ...d.rader];
    const vindu = pauseVinduForDag(alle, {
      startTid: "07:00",
      pauseEtterTimer,
      pauseReferanse: "ankomst",
    });
    for (const r of d.rader) {
      const gammel =
        Math.abs(r.timer - effektiveTimerFraSpenn(r.fraTid!, r.tilTid!, vindu, r.pauseMin)) <=
        0.01;
      const spenn = hhmmTilMin(r.tilTid!) - hhmmTilMin(r.fraTid!);
      const ny =
        r.pauseMin > 0 &&
        spenn > r.pauseMin &&
        Math.abs(r.timer - (spenn - r.pauseMin) / 60) <= 0.01;
      expect(gammel || ny).toBe(true);
    }
  }
}

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
    sjekkServer(f, [{ fraTid: "07:00", tilTid: "15:00", pauseMin: 30 }]);
  });

  it("🔴 morgen 3 t UTEN pause + kveld 6:10 → 4-timersgrensen passeres i kveldsøkta → pause 30, 5,50 t", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "10:00", pauseMin: 0 }];
    const f = beregnDagsforslag(
      lagInput({ eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) } }),
    );
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:45");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.pauseMin))).toBe(30);
    expect(sum(rader.map((r) => r.timer))).toBe(5.5);
    sjekkInvariant(f);
    sjekkServer(f, morgen);
  });

  const kveld16til19 = {
    dag: {
      startAt: "2026-10-01T16:00:00",
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: null,
      byggeplassId: null,
    },
    sluttIso: "2026-10-01T19:00:00",
  };

  // Dagsnorm 1 t splitter kveldsøkta i normaltid + overtid, så pausepunktet
  // synes: pause kl. 17:00 → 16:00–17:00 uten pause, 17:00–19:00 med pause.
  const EFFEKTIV_NORM1: DagsforslagEffektiv = { ...EFFEKTIV, dagsnorm: 1 };

  it("🔴 Kenneths fasit: morgen 07:00–10:00 uten pause + kveld 16:00–19:00 → kveld pause 30 fra 17:00, 2,5 t (dag 5,5 t)", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "10:00", pauseMin: 0 }];
    const f = beregnDagsforslag(
      lagInput({
        ...kveld16til19,
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(30);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(2.5);
    expect(3 + sum(arbeid(f).map((r) => r.timer))).toBe(5.5);
    sjekkInvariant(f);
    sjekkServer(f, morgen);

    const delt = beregnDagsforslag(
      lagInput({
        ...kveld16til19,
        effektivPerDato: { "2026-10-01": EFFEKTIV_NORM1 },
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    const r = arbeid(delt).map((x) => [x.fraTid, x.tilTid, x.pauseMin]);
    expect(r).toEqual([
      ["16:00", "17:00", 0],
      ["17:00", "19:00", 30],
    ]);
    sjekkInvariant(delt);
    sjekkServer(delt, morgen);
  });

  it("🔴 3 t + 2 t → dagen ≤ 5,5 t → ingen pause", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "10:00", pauseMin: 0 }];
    const f = beregnDagsforslag(
      lagInput({
        ...kveld16til19,
        sluttIso: "2026-10-01T18:00:00",
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(0);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(2);
    sjekkInvariant(f);
    sjekkServer(f, morgen);
  });

  it("🔴 lagret morgen 5 t uten pause + ny kveld 2 t → pausen på kvelden (lagret rad endres aldri)", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "12:00", pauseMin: 0 }];
    const f = beregnDagsforslag(
      lagInput({
        ...kveld16til19,
        sluttIso: "2026-10-01T18:00:00",
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(30);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(1.5);
    sjekkInvariant(f);
    sjekkServer(f, morgen);
  });

  // VILKÅR 1 (gate 2026-11-14): en økt kortere enn pausen blir aldri bærer.
  const utenRunding = (over: Partial<BeregnDagsforslagInput>) => {
    const base = lagInput(over);
    return { ...base, regel: { ...base.regel!, tidsrundingMinutter: null } };
  };

  it("🔴 VILKÅR 1: lagret 07:00–12:15 p0 + ny økt 13:00–13:20 → p0 og 0,33 t", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "12:15", pauseMin: 0 }];
    const f = beregnDagsforslag(
      utenRunding({
        dag: { ...lagInput().dag, startAt: "2026-10-01T13:00:00" },
        sluttIso: "2026-10-01T13:20:00",
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(0);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(0.33);
    sjekkInvariant(f);
    sjekkServer(f, morgen);
  });

  it("🔴 VILKÅR 1: midnattsdelt økt der bæreren (00:00–00:20) er kortere enn pausen → p0, fullt spenn", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "12:15", pauseMin: 0 }];
    const f = beregnDagsforslag(
      utenRunding({
        dag: { ...lagInput().dag, startAt: "2026-10-01T23:00:00" },
        sluttIso: "2026-10-02T00:20:00",
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(0);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(1.33);
    sjekkInvariant(f);
  });

  const morgen0700til1310 = {
    dag: {
      startAt: "2026-10-01T07:00:00",
      startLat: 59.9,
      startLng: 10.7,
      oppmotestedId: null,
      byggeplassId: null,
    },
    sluttIso: "2026-10-01T13:10:00",
  };
  // Dagsnorm 3 t: normaltid 07:00–10:00(+pause) synliggjør pausepunktet.
  const EFFEKTIV_NORM3: DagsforslagEffektiv = { ...EFFEKTIV, dagsnorm: 3 };

  it("🔴 07:00–13:10 → pause 30 kl. 11:00 (etter 4 arbeidstimer)", () => {
    const f = beregnDagsforslag(
      lagInput({ ...morgen0700til1310, effektivPerDato: { "2026-10-01": EFFEKTIV_NORM3 } }),
    );
    expect(arbeid(f).map((x) => [x.fraTid, x.tilTid, x.pauseMin])).toEqual([
      ["07:00", "10:00", 0],
      ["10:00", "13:15", 30],
    ]);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(5.75);
    sjekkInvariant(f);
    sjekkServer(f, []);
  });

  it("🔴 firmaets pausegrense 2 t → pausen havner i morgenraden (kl. 09:00), ikke fast 4", () => {
    const base = lagInput({
      ...morgen0700til1310,
      effektivPerDato: { "2026-10-01": EFFEKTIV_NORM3 },
    });
    const f = beregnDagsforslag({
      ...base,
      regel: { ...base.regel!, standardPauseEtterTimer: 2 },
    });
    expect(arbeid(f).map((x) => [x.fraTid, x.tilTid, x.pauseMin])).toEqual([
      ["07:00", "10:30", 30],
      ["10:30", "13:15", 0],
    ]);
    sjekkInvariant(f);
    sjekkServer(f, [], 2);
  });

  it("firmaets pausegrense fra svar-cachen (effektiv.pauseEtterTimer) vinner over org-setting-cachen", () => {
    const f = beregnDagsforslag(
      lagInput({
        ...morgen0700til1310,
        effektivPerDato: { "2026-10-01": { ...EFFEKTIV_NORM3, pauseEtterTimer: 2 } },
      }),
    );
    expect(arbeid(f).map((x) => [x.fraTid, x.tilTid, x.pauseMin])).toEqual([
      ["07:00", "10:30", 30],
      ["10:30", "13:15", 0],
    ]);
    sjekkServer(f, [], 2);
  });

  it("🔴 kun én pause pr. dag: morgenraden bærer alt pausen → kveld 0", () => {
    const morgen = [{ fraTid: "07:00", tilTid: "10:00", pauseMin: 30 }];
    const f = beregnDagsforslag(
      lagInput({
        ...kveld16til19,
        eksisterendeSedelPerDato: { "2026-10-01": sedelMed(morgen) },
      }),
    );
    expect(sum(arbeid(f).map((r) => r.pauseMin))).toBe(0);
    expect(sum(arbeid(f).map((r) => r.timer))).toBe(3);
    sjekkInvariant(f);
    sjekkServer(f, morgen);
  });

  it("enkelt økt 6:10 (16:39–22:49) uten andre rader → pause 30 + avrundet spenn = 5,50 t", () => {
    const f = beregnDagsforslag(lagInput());
    const rader = arbeid(f);
    expect(rader[0]!.fraTid).toBe("16:45");
    expect(rader[rader.length - 1]!.tilTid).toBe("22:45");
    expect(sum(rader.map((r) => r.pauseMin))).toBe(30);
    expect(sum(rader.map((r) => r.timer))).toBe(5.5);
    sjekkInvariant(f);
    sjekkServer(f, []);
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
