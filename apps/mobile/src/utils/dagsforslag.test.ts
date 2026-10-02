import { describe, it, expect } from "vitest";
import {
  beregnDagsforslag,
  avgjorSluttDagHandling,
  skalMarkereAvsluttet,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
  type AnvendDagsforslagResultat,
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
// Sommer-norm (sesongjustert) — brukt som cachet svar i fasit-dagene A/B/E.
const SOMMER_EFFEKTIV: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:30",
  pauseMin: 30,
  dagsnorm: 8,
};

/** Reise-oppslag der start/slutt er kontor og destinasjonen en byggeplass. */
function lagReise(
  over: Partial<BeregnDagsforslagInput["reiseOppslag"] & object> = {},
): NonNullable<BeregnDagsforslagInput["reiseOppslag"]> {
  return {
    start: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
    slutt: { type: "utenfor" },
    destinasjon: { type: "byggeplass", byggeplassId: "b1" },
    utCelle: { kjoretidMin: 120, avstandM: 50000 },
    returCelle: null,
    grensepunkter: [],
    fallbackReiseLonnsartId: L_REISE,
    ...over,
  };
}

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
    // §2: prosjektvalg er destinasjon → aktivtProsjektId → prosjektUkjent.
    // Uten reise-destinasjon leverer arbeiderens aktive prosjekt «p1».
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
/** Sum av reise-rad-timer. */
function reiseTimer(f: ReturnType<typeof beregnDagsforslag>): number {
  return f.datoer
    .flatMap((d) => d.rader)
    .filter((r) => r.erReise)
    .reduce((s, r) => s + r.timer, 0);
}
/** Overtid (OT50) i timer. */
function ot50Timer(f: ReturnType<typeof beregnDagsforslag>): number {
  return f.datoer
    .flatMap((d) => d.rader)
    .filter((r) => !r.erReise && r.lonnsartId === L_OT50)
    .reduce((s, r) => s + r.timer, 0);
}

describe("beregnDagsforslag — karakterisering (1:1 med dagens genererForslag)", () => {
  it("1. dag med reise (ut-etappe): egen reise-rad med null-tider + arbeids-rad forskjøvet", () => {
    const f = beregnDagsforslag(
      lagInput({
        dag: {
          startAt: "2026-10-01T07:00:00",
          startLat: 59.9,
          startLng: 10.7,
          oppmotestedId: "o1",
          byggeplassId: null,
        },
        destinasjonProsjektId: "p1",
        // 45 min ut-reise (reisetid), ingen retur (slutt ikke kontor).
        reiseOppslag: lagReise({ utCelle: { kjoretidMin: 45, avstandM: 30000 } }),
      }),
    );

    expect(f.prosjektId).toBe("p1");
    expect(f.aktivitetId).toBe("a1");
    expect(f.datoer).toHaveLength(1);
    const rader = f.datoer[0]!.rader;

    const reise = rader.find((r) => r.erReise);
    expect(reise).toBeDefined();
    // B4: reise beholder null-tider (V8 er lag 2).
    expect(reise!.fraTid).toBeNull();
    expect(reise!.tilTid).toBeNull();
    expect(reise!.lonnsartId).toBe(L_REISE);
    expect(reise!.timer).toBeCloseTo(0.75, 5); // 45 min
    expect(rader.filter((r) => r.erReise)).toHaveLength(1); // kun ut, ingen retur

    const arbeid = rader.filter((r) => !r.erReise);
    expect(arbeid).toHaveLength(1);
    // Vindu 07:45–15:00 = 7,25t − 0,5t pause = 6,75t arbeid (reise trukket via vinduet).
    expect(arbeid[0]!.timer).toBeCloseTo(6.75, 5);
    expect(arbeid[0]!.fraTid).toBe("07:45"); // arbeidsstart = start-GPS + ut
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
    expect(f.datoer).toHaveLength(1); // kappet til 8t ⇒ ingen midnatt-splitt
    expect(f.datoer[0]!.dato).toBe("2026-10-01");
    // Kappet ⇒ siste (eneste) segments kilde tvinges "system" (gjettet tid).
    expect(f.datoer[0]!.sluttTidKilde).toBe("system");
    // M13→B2: kapplengde = ut(0) + dagsnorm(7,5) + pause(0,5) = 8,0t. Måler
    // varighet, ikke eksakt ISO (`.toISOString()` er runner-TZ-avhengig).
    const spennTimer =
      (new Date(f.datoer[0]!.segmentSluttIso).getTime() -
        new Date(f.datoer[0]!.segmentStartIso).getTime()) /
      3_600_000;
    expect(spennTimer).toBeCloseTo(8.0, 5);
    // 8,0t vindu − 0,5t pause = 7,5t arbeid (= dagsnorm; kappet dag yter normen).
    expect(arbeidsTimer(f)).toBeCloseTo(7.5, 5);
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

/**
 * L1-B fasit-dagene (helhetsplan § 4b). `beregnDagsforslag` er ren → normen er
 * et INPUT (cachet server-svar via `effektivPerDato`), ikke noe funksjonen
 * utleder. Forventet overtid regnes som `arbeid − norm` (ikke literal 8/7,5),
 * jf. `ukenorm.ts:4` og gate-krav 3. Sesong-oppslaget selv (Dag F/G) testes mot
 * server-servicen i api.
 *
 * Fixture: start/slutt kontor «o1», destinasjon byggeplass «b1», ut+retur 2 t
 * (reisetid, 120 min ≥ 30 min terskel).
 */
describe("beregnDagsforslag — L1-B fasit-dager (etapper + vindu)", () => {
  function dagMedReise(
    over: Partial<BeregnDagsforslagInput> = {},
    reiseOver: Partial<
      NonNullable<BeregnDagsforslagInput["reiseOppslag"]> & object
    > = {},
  ) {
    return beregnDagsforslag(
      lagInput({
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
        destinasjonProsjektId: "p1",
        effektivPerDato: { "2026-07-01": SOMMER_EFFEKTIV },
        reiseOppslag: lagReise({
          // slutt er kontor → retur-etappe.
          slutt: { type: "kontor", oppmotestedId: "o1", byggeplassId: null },
          utCelle: { kjoretidMin: 120, avstandM: 50000 },
          returCelle: { kjoretidMin: 120, avstandM: 50000 },
          ...reiseOver,
        }),
        ...over,
      }),
    );
  }

  it("Dag A (sommer, norm 8): ut 05:00–07:00, vindu 07:00–17:30, retur 17:30–19:30 → 8 ord + 2 OT50", () => {
    const f = dagMedReise();
    const norm = SOMMER_EFFEKTIV.dagsnorm; // 8 (cachet svar, ikke literal her)
    // 10 t arbeid (vindu 10,5 − 0,5 pause). Reisen trukket via vinduet.
    expect(arbeidsTimer(f)).toBeCloseTo(10, 5);
    // Overtid = arbeid − norm (ikke hardkodet).
    expect(ot50Timer(f)).toBeCloseTo(arbeidsTimer(f) - norm, 5); // 10 − 8 = 2
    // To reise-rader (ut + retur), 2 t hver, null-tider.
    const reiser = f.datoer[0]!.rader.filter((r) => r.erReise);
    expect(reiser).toHaveLength(2);
    expect(reiser.every((r) => r.fraTid === null && r.tilTid === null)).toBe(true);
    expect(reiseTimer(f)).toBeCloseTo(4, 5);
    // Normaltid-vinduet starter ved arbeidsstart 07:00.
    const normalt = f.datoer[0]!.rader.find(
      (r) => !r.erReise && r.lonnsartId === L_NORMAL,
    );
    expect(normalt!.fraTid).toBe("07:00");
  });

  it("🔴 Dobbelttrekk: Dag A gir nøyaktig 8 ord + 2 OT50 (ikke 6 + 2) — reisen trekkes ÉN gang", () => {
    const f = dagMedReise();
    const normalt = f.datoer[0]!.rader
      .filter((r) => !r.erReise && r.lonnsartId === L_NORMAL)
      .reduce((s, r) => s + r.timer, 0);
    expect(normalt).toBeCloseTo(8, 5); // 8, IKKE 6 (reisen ikke trukket to ganger)
    expect(ot50Timer(f)).toBeCloseTo(2, 5);
  });

  it("Invariant: Σ carvede arbeids-vinduer + pause = arbeidsslutt − arbeidsstart (Dag A)", () => {
    const f = dagMedReise();
    const dag = f.datoer[0]!;
    const arbeid = dag.rader
      .filter((r) => !r.erReise)
      .reduce((s, r) => s + r.timer, 0);
    const pauseTimer = dag.pauseMin / 60;
    // arbeidsstart 07:00, arbeidsslutt 17:30 → 10,5 t.
    expect(arbeid + pauseTimer).toBeCloseTo(10.5, 5);
  });

  it("🔴 Dag E: Dag A med reisetidTellerOvertid = true → NØYAKTIG samme svar (normen ikke senket)", () => {
    const a = dagMedReise();
    const e = dagMedReise({
      regel: {
        reiseTerskelEnhet: "minutter",
        reiseTerskelMin: 30,
        reiseTerskelM: null,
        reiseUnderTerskelType: "arbeidstid",
        reiseOverTerskelType: "reisetid",
        tidsrundingMinutter: null,
        reisetidTellerOvertid: true, // flagget PÅ — skal ikke endre noe (V1)
        standardPauseEtterTimer: 4.0,
      },
    });
    expect(ot50Timer(e)).toBeCloseTo(ot50Timer(a), 5); // 2, ikke senket med ut+retur
    expect(arbeidsTimer(e)).toBeCloseTo(arbeidsTimer(a), 5);
  });

  it("Dag B (start 07:00): ut 07:00–09:00, vindu 09:00–17:30, pause 13:00–13:30 (ankomst) → 8 ord, 0 OT", () => {
    const f = dagMedReise({
      dag: {
        startAt: "2026-07-01T07:00:00",
        startLat: 59.9,
        startLng: 10.7,
        oppmotestedId: "o1",
        byggeplassId: null,
      },
    });
    // Vindu 09:00–17:30 = 8,5 − 0,5 pause = 8 t = norm → alt normaltid.
    expect(arbeidsTimer(f)).toBeCloseTo(8, 5);
    expect(ot50Timer(f)).toBeCloseTo(0, 5);
    const normalt = f.datoer[0]!.rader.find(
      (r) => !r.erReise && r.lonnsartId === L_NORMAL,
    );
    expect(normalt!.fraTid).toBe("09:00"); // arbeidsstart etter ut-etappen
    // Pause (ankomst): arbeidsstart 09:00 + 4 t = 13:00. Bæreren har pauseMin 30
    // og et klokke-gap på 30 min ved 13:00–13:30.
    expect(normalt!.pauseMin).toBe(30);
  });

  it("Dag C: start i kontor OG byggeplass, destinasjon = samme byggeplass → ingen etappe", () => {
    const f = dagMedReise(
      {},
      {
        start: { type: "kontor", oppmotestedId: "o1", byggeplassId: "b1" },
        slutt: { type: "kontor", oppmotestedId: "o1", byggeplassId: "b1" },
        destinasjon: { type: "byggeplass", byggeplassId: "b1" },
      },
    );
    expect(f.datoer[0]!.rader.filter((r) => r.erReise)).toHaveLength(0);
    // Ingen vindu-trekk → vindu = fullt spenn 05:00–19:30 = 14,5 − 0,5 = 14 t.
    expect(arbeidsTimer(f)).toBeCloseTo(14, 5);
  });

  it("🔴 Dag D: byggeplass uten matrisecelle → ingen etappe, reiseAarsak = 'mangler_matrise'", () => {
    const f = dagMedReise({}, { utCelle: null, returCelle: null });
    expect(f.reiseAarsak).toBe("mangler_matrise");
    expect(f.datoer[0]!.rader.filter((r) => r.erReise)).toHaveLength(0);
    // Ingen ut-etappe → arbeidsstart = start-GPS 05:00.
    const normalt = f.datoer[0]!.rader.find(
      (r) => !r.erReise && r.lonnsartId === L_NORMAL,
    );
    expect(normalt!.fraTid).toBe("05:00");
  });

  it("§2 prosjektUkjent: ingen destinasjon OG ingen aktivtProsjektId → dagen åpen, prosjektId null", () => {
    const f = beregnDagsforslag(
      lagInput({ aktivtProsjektId: null, destinasjonProsjektId: null }),
    );
    expect(f.prosjektUkjent).toBe(true);
    expect(f.prosjektId).toBeNull();
    expect(f.datoer).toHaveLength(0);
  });

  it("§2 prosjektvalg: destinasjonProsjektId vinner over aktivtProsjektId", () => {
    const f = beregnDagsforslag(
      lagInput({ aktivtProsjektId: "p-aktiv", destinasjonProsjektId: "p-dest" }),
    );
    expect(f.prosjektId).toBe("p-dest");
  });
});

/**
 * H7 (LAG 0b commit 2) — rekkefølgen: «avsluttet» settes KUN når skrivingen
 * lyktes. `avgjorSluttDagHandling` + `skalMarkereAvsluttet` er den rene,
 * injiserbare rekkefølge-logikken (trukket ut av `useCallback`), så den kan
 * testes uten React Native.
 *
 * To utfall holder dagen ÅPEN så GPS-økta ikke går tapt — `blokkertSendt` og
 * `kildeManglet`. Mot DAGENS (gamle) rekkefølge markerte begge `avsluttet`
 * uansett → disse testene er rød-først.
 */
function lagResultat(
  over: Partial<AnvendDagsforslagResultat> = {},
): AnvendDagsforslagResultat {
  return {
    startSheetId: "sedel-1",
    blokkertSendt: false,
    ingenRader: false,
    harEksisterendeRader: false,
    vekForOverlapp: [],
    prosjektUkjent: false,
    ...over,
  };
}

describe("H7 — avgjorSluttDagHandling: dagen lukkes kun når skrivingen lyktes", () => {
  it("blokkertSendt: dagen står ÅPEN (rød-først — i dag markeres avsluttet)", () => {
    const h = avgjorSluttDagHandling(lagResultat({ blokkertSendt: true }));
    expect(h.type).toBe("blokkertSendt");
    expect(skalMarkereAvsluttet(h)).toBe(false);
  });

  it("kildeManglet (startSheetId null): dagen står ÅPEN + eget utfall (rød-først — i dag er den stum)", () => {
    const h = avgjorSluttDagHandling(lagResultat({ startSheetId: null, ingenRader: true }));
    expect(h.type).toBe("kildeManglet");
    expect(skalMarkereAvsluttet(h)).toBe(false);
  });

  it("§2 prosjektUkjent (startSheetId null + prosjektUkjent): dagen ÅPEN, eget utfall ≠ kildeManglet", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({ startSheetId: null, ingenRader: true, prosjektUkjent: true }),
    );
    expect(h.type).toBe("prosjektUkjent");
    expect(skalMarkereAvsluttet(h)).toBe(false);
  });

  it("regresjon: ingenRader (ekte, for kort økt) LUKKER fortsatt dagen", () => {
    const h = avgjorSluttDagHandling(lagResultat({ ingenRader: true }));
    expect(h.type).toBe("forKort");
    expect(skalMarkereAvsluttet(h)).toBe(true);
  });

  it("regresjon: suksess lukker dagen og navigerer til sedelen", () => {
    const h = avgjorSluttDagHandling(lagResultat({ startSheetId: "sedel-9" }));
    expect(h).toEqual({ type: "suksess", sheetId: "sedel-9" });
    expect(skalMarkereAvsluttet(h)).toBe(true);
  });

  it("playVek lukker dagen (manuell rad er fasit) og rapporterer tidsrommene", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({ vekForOverlapp: [{ fraTid: "07:00", tilTid: "09:00" }] }),
    );
    expect(h).toEqual({
      type: "playVek",
      sheetId: "sedel-1",
      intervaller: "07:00–09:00",
    });
    expect(skalMarkereAvsluttet(h)).toBe(true);
  });

  it("forKort med pre-fylt sedel markeres preFylt (differensiert copy)", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({ ingenRader: true, harEksisterendeRader: true }),
    );
    expect(h).toEqual({ type: "forKort", sheetId: "sedel-1", preFylt: true });
  });

  it("prioritet: blokkertSendt slår vekForOverlapp og ingenRader", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({
        blokkertSendt: true,
        ingenRader: true,
        vekForOverlapp: [{ fraTid: "07:00", tilTid: "09:00" }],
      }),
    );
    expect(h.type).toBe("blokkertSendt");
  });
});
