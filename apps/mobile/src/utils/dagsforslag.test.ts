import { describe, it, expect } from "vitest";
import {
  beregnDagsforslag,
  brukOppmoteResolver,
  leggTilOverforinger,
  byggOverforingOppslag,
  type DagsforslagOverforingOppslag,
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
  it("1. dag med reise (ut-etappe): egen reise-rad med V8-vindu + arbeids-rad forskjøvet", () => {
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
    // B2 V8: ut-reise får et utledet klokkevindu 07:00–07:45 (start-GPS +
    // kjøretid), tidKilde "utledet". Berører arbeidsstart 07:45 uten overlapp.
    expect(reise!.fraTid).toBe("07:00");
    expect(reise!.tilTid).toBe("07:45");
    expect(reise!.tidKilde).toBe("utledet");
    expect(reise!.reiseRetning).toBe("ut");
    expect(reise!.reiseKilde).toBe("matrise");
    expect(reise!.reiseKjoretidMin).toBe(45);
    expect(reise!.reiseAvstandM).toBe(30000);
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

  it("3. pause-fordeling: terskelgate (<5,5t ⇒ 0 pause) + pause der summert arbeid passerer grensen", () => {
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

    // 3c: midnatt-splitt [5t, 7t] ⇒ ORDRE 2026-11-13 «pausen trekkes etter 4
    // ARBEIDStimer»: 4 t arbeid er nådd 23:00 i seg0 ⇒ seg0 bærer hele pausen.
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
    // seg0 = 5t (19→24), seg1 = 7t (00→07): grensen passeres i seg0.
    expect(delt.datoer[0]!.pauseMin).toBe(30);
    expect(delt.datoer[1]!.pauseMin).toBe(0);
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
    // To reise-rader (ut + retur), 2 t hver. B2 V8: reisen har nå et UTLEDET
    // klokkevindu (ikke lenger null-tider) — ut 05:00–07:00, retur 17:30–19:30 —
    // som berører arbeidsvinduet i endepunktene (07:00 / 17:30) uten å overlappe.
    const reiser = f.datoer[0]!.rader.filter((r) => r.erReise);
    expect(reiser).toHaveLength(2);
    const ut = reiser.find((r) => r.reiseRetning === "ut")!;
    const retur = reiser.find((r) => r.reiseRetning === "retur")!;
    expect([ut.fraTid, ut.tilTid]).toEqual(["05:00", "07:00"]);
    expect([retur.fraTid, retur.tilTid]).toEqual(["17:30", "19:30"]);
    expect(reiser.every((r) => r.tidKilde === "utledet")).toBe(true);
    expect(reiser.every((r) => r.reiseKilde === "matrise")).toBe(true);
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

  it("Dag E (V1 / C5): reise teller ALDRI som overtid — reise-rader er utenfor OT-grunnlaget", () => {
    // L2-B/C5: `reisetidTellerOvertid` er fjernet (feltet leses ikke lenger).
    // V1 er nå strukturelt garantert — reise ligger på egen lønnsart (L_REISE),
    // aldri OT-arten (L_OT50), og normen senkes ikke av reisen.
    const a = dagMedReise();
    const reiseSomOt = a.datoer
      .flatMap((d) => d.rader)
      .some((r) => r.erReise && r.lonnsartId === L_OT50);
    expect(reiseSomOt).toBe(false);
    // Arbeidsvinduet gir fortsatt OT for det som overstiger normen (ikke reisen).
    expect(ot50Timer(a)).toBeCloseTo(2, 5);
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

  it("🔴 POST (13) B: reisetid-etappe uten reise-lønnsart → reiseAarsak = 'mangler_reise_lonnsart' (aldri stille null)", () => {
    const f = dagMedReise({}, { fallbackReiseLonnsartId: null, grensepunkter: [] });
    expect(f.reiseAarsak).toBe("mangler_reise_lonnsart");
    expect(f.datoer[0]!.rader.filter((r) => r.erReise)).toHaveLength(0);
  });

  it("POST (13) B: med reise-lønnsart → ingen årsak, reise-raden føres", () => {
    const f = dagMedReise();
    expect(f.reiseAarsak).toBeNull();
    expect(f.datoer[0]!.rader.filter((r) => r.erReise).length).toBeGreaterThan(0);
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

  it("🔴 B6.3 trinn 3 (norm ukjent): dagsnorm 0 → INGEN overtid-splitt, alt på standard-art", () => {
    const f = beregnDagsforslag(
      lagInput({
        sluttIso: "2026-10-01T18:00:00", // 11t spenn → 10,5t arbeid
        effektivPerDato: {
          "2026-10-01": {
            startTid: "07:00",
            sluttTid: "15:00",
            pauseMin: 30,
            dagsnorm: 0, // ukjent → ingen norm å dele mot
            normStatus: "ukjent",
          },
        },
      }),
    );
    // Alle arbeidstimer på standard-lønnsarten (ingen OT50), selv over 7,5t.
    expect(ot50Timer(f)).toBe(0);
    expect(
      f.datoer[0]!.rader.every(
        (r) => r.erReise || r.lonnsartId === L_NORMAL,
      ),
    ).toBe(true);
    expect(f.normStatus).toBe("ukjent");
  });

  it("B6.3 normStatus bæres fra start-dagens svar til forslaget (cachet)", () => {
    const f = beregnDagsforslag(
      lagInput({
        effektivPerDato: {
          "2026-10-01": { ...STD_EFFEKTIV, normStatus: "cachet" },
        },
      }),
    );
    expect(f.normStatus).toBe("cachet");
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
    ikkeAnsatt: false,
    manglerLonnsart: false,
    lagredeDatoer: [],
    blokkerteDatoer: [],
    forsteLagredeSheetId: null,
    ...over,
  };
}

describe("DEL 5 a — delvis lagret: økten lukkes, brukeren får vite hva som ble lagret", () => {
  it("🔴 9.11 sendt + 10.11 skrevet → delvisSendt, økten LUKKES, sedelen er den lagrede", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({
        startSheetId: "sedel-9-11",
        blokkertSendt: true,
        lagredeDatoer: ["2026-11-10"],
        blokkerteDatoer: ["2026-11-09"],
        forsteLagredeSheetId: "sedel-10-11",
      }),
    );
    expect(h).toEqual({
      type: "delvisSendt",
      sheetId: "sedel-10-11",
      lagret: ["2026-11-10"],
      blokkert: ["2026-11-09"],
    });
    expect(skalMarkereAvsluttet(h)).toBe(true);
  });

  it("🔴 ingenting skrevet (alle datoer sendt) → blokkertSendt, økten står ÅPEN", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({ blokkertSendt: true, blokkerteDatoer: ["2026-11-09"] }),
    );
    expect(h.type).toBe("blokkertSendt");
    expect(skalMarkereAvsluttet(h)).toBe(false);
  });
});

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

describe("Ikke ansatt / mangler lønnsart (ordre 2026-11-04 (8))", () => {
  it("🔴 (a) ikkeAnsatt: eget utfall, dagen står ÅPEN, slår blokkertSendt og ingenRader", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({
        startSheetId: null,
        ikkeAnsatt: true,
        blokkertSendt: true,
        ingenRader: true,
      }),
    );
    expect(h).toEqual({ type: "ikkeAnsatt" });
    expect(skalMarkereAvsluttet(h)).toBe(false);
  });

  it("🔴 (b) 0 rader fordi lønnsarten manglet → manglerLonnsart (ikke forKort), dagen lukkes", () => {
    const h = avgjorSluttDagHandling(
      lagResultat({ ingenRader: true, manglerLonnsart: true }),
    );
    expect(h).toEqual({ type: "manglerLonnsart", sheetId: "sedel-1" });
    expect(skalMarkereAvsluttet(h)).toBe(true);
  });

  it("manglerLonnsart med rader ført (bare overtid droppet) → suksess som før", () => {
    const h = avgjorSluttDagHandling(lagResultat({ manglerLonnsart: true }));
    expect(h.type).toBe("suksess");
  });

  it("🔴 (b) motoren teller rader droppet uten standard-lønnsart; drop-atferden er uendret", () => {
    const f = beregnDagsforslag(lagInput({ standardLonnsartId: null }));
    expect(arbeidsTimer(f)).toBe(0);
    expect(f.datoer[0].raderDroppetUtenLonnsart).toBeGreaterThan(0);
  });

  it("(c) regresjon: med standard-lønnsart droppes ingenting", () => {
    const f = beregnDagsforslag(lagInput());
    expect(f.datoer[0].raderDroppetUtenLonnsart).toBe(0);
  });
});

// POST 2026-11-15 (13) L2, beslutning 1: perioderesolveren styrer Bekreft dag.
describe("brukOppmoteResolver", () => {
  const dest = { type: "byggeplass" as const, byggeplassId: "bp" };
  const ukjent = { type: "ukjent" as const, aarsak: "posisjon_utilgjengelig" as const };
  const kontorGps = { type: "kontor" as const, oppmotestedId: "narvik", byggeplassId: null };

  it("byggeplass-periode → start og slutt på byggeplassen (ingen reise)", () => {
    const r = brukOppmoteResolver(kontorGps, kontorGps, dest, { kilde: "byggeplass", projectId: "p" });
    expect(r.start).toEqual({ type: "byggeplass", byggeplassId: "bp" });
    expect(r.slutt).toEqual({ type: "byggeplass", byggeplassId: "bp" });
  });

  it("ukjent GPS-start + midlertidig kontor → start på det kontoret", () => {
    const r = brukOppmoteResolver(ukjent, ukjent, dest, { kilde: "midlertidig", oppmotestedId: "tromso" });
    expect(r.start).toEqual({ type: "kontor", oppmotestedId: "tromso", byggeplassId: null });
    expect(r.slutt).toEqual(ukjent); // retur oppfinnes ikke
  });

  it("ukjent GPS-start + fast kontor → start på det faste", () => {
    const r = brukOppmoteResolver(ukjent, ukjent, dest, { kilde: "fast", oppmotestedId: "narvik" });
    expect(r.start).toMatchObject({ type: "kontor", oppmotestedId: "narvik" });
  });

  it("GPS-start på byggeplass beholdes (V11) og ikkeValgt endrer ingenting", () => {
    const paaPlass = { type: "byggeplass" as const, byggeplassId: "x" };
    expect(brukOppmoteResolver(paaPlass, ukjent, dest, { kilde: "fast", oppmotestedId: "n" }).start).toEqual(paaPlass);
    expect(brukOppmoteResolver(ukjent, ukjent, dest, { kilde: "ikkeValgt" }).start).toEqual(ukjent);
  });

  it("med beregnDagsforslag: ukjent start + fast kontor gir ut-etappe, byggeplass-periode gir ingen", () => {
    const basis = lagInput({
      dag: {
        startAt: "2026-07-01T05:00:00",
        startLat: 59.9,
        startLng: 10.7,
        oppmotestedId: null,
        byggeplassId: null,
      },
      sluttIso: "2026-07-01T19:30:00",
      endLat: 59.9,
      endLng: 10.7,
      destinasjonProsjektId: "p1",
      effektivPerDato: { "2026-07-01": SOMMER_EFFEKTIV },
      reiseOppslag: lagReise({
        start: ukjent,
        slutt: { type: "kontor", oppmotestedId: "kontor-1", byggeplassId: null },
        utCelle: { kjoretidMin: 120, avstandM: 50000 },
        returCelle: { kjoretidMin: 120, avstandM: 50000 },
      }),
    });
    const oppslag = basis.reiseOppslag!;
    const medFast = brukOppmoteResolver(ukjent, oppslag.slutt, oppslag.destinasjon, {
      kilde: "fast",
      oppmotestedId: "kontor-1",
    });
    const f1 = beregnDagsforslag({ ...basis, reiseOppslag: { ...oppslag, ...medFast } });
    expect(f1.reiseAarsak).toBeNull();
    expect(f1.datoer[0]!.rader.some((r) => r.erReise && r.reiseRetning === "ut")).toBe(true);

    const paaPlass = brukOppmoteResolver(oppslag.start, oppslag.slutt, oppslag.destinasjon, {
      kilde: "byggeplass",
      projectId: "p",
    });
    const f2 = beregnDagsforslag({ ...basis, reiseOppslag: { ...oppslag, ...paaPlass } });
    expect(f2.reiseAarsak).toBeNull();
    expect(f2.datoer[0]!.rader.some((r) => r.erReise)).toBe(false);
  });
});

describe("POST (13) L2 — overføring som forslagsrad (TILLEGG)", () => {
  const DATO = "2026-10-01";
  const PERIODE = {
    id: "per1", type: "kontor" as const, fast: false, oppmotestedId: "tromso",
    projectId: null, fraDato: DATO, tilDato: "2026-10-05",
  };
  const FAST = {
    id: "fast1", type: "kontor" as const, fast: true, oppmotestedId: "narvik",
    projectId: null, fraDato: "2026-01-01", tilDato: null,
  };
  /** Grunndag uten reise: arbeid 07:00–15:00. */
  function grunnDag() {
    return beregnDagsforslag(lagInput()).datoer;
  }
  function oppslag(over: Partial<DagsforslagOverforingOppslag> = {}): DagsforslagOverforingOppslag {
    return {
      dato: DATO,
      overforing: {
        retning: "ut",
        fra: { type: "kontor", oppmotestedId: "narvik" },
        til: { type: "kontor", oppmotestedId: "tromso" },
        periodeId: "per1",
      },
      oppmotestedId: "narvik",
      byggeplassId: null,
      fraNavn: "Narvik",
      tilNavn: "Tromsø",
      celle: { kjoretidMin: 180, avstandM: 250000 },
      ...over,
    };
  }
  const CTX = {
    regel: lagInput().regel,
    grensepunkter: [],
    fallbackReiseLonnsartId: L_REISE,
    standardLonnsartId: L_NORMAL,
    prosjektId: "p1",
    aktivitetId: "a1",
    eksisterendeSedelPerDato: {},
    perDato: undefined,
  };
  const overf = (d: ReturnType<typeof leggTilOverforinger>) =>
    d.datoer.flatMap((x) => x.rader).filter((r) => r.overforing);

  it("første dag: ut legges FØR dagens start med kjøretiden som lengde, over terskel = reise", () => {
    const r = overf(leggTilOverforinger(grunnDag(), [oppslag()], CTX));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      fraTid: "04:00", tilTid: "07:00", timer: 3, erReise: true, reiseRetning: "ut",
      lonnsartId: L_REISE, reiseKilde: "overforing", reiseOppmotestedId: "narvik",
      reiseKjoretidMin: 180, overforing: { retning: "ut", fraNavn: "Narvik", tilNavn: "Tromsø" },
    });
    expect(r[0].reiseRegel?.overforing).toEqual({
      fra: { type: "kontor", oppmotestedId: "narvik" },
      til: { type: "kontor", oppmotestedId: "tromso" },
      periodeId: "per1",
    });
  });

  it("siste dag: retur legges ETTER dagens slutt", () => {
    const o = oppslag({ overforing: { ...oppslag().overforing, retning: "retur" } });
    const r = overf(leggTilOverforinger(grunnDag(), [o], CTX));
    expect(r[0]).toMatchObject({ fraTid: "15:00", tilTid: "18:00", reiseRetning: "retur" });
  });

  it("under terskel: ordinær rad på standard-lønnsart, ikke reise, men sporet beholdes", () => {
    const o = oppslag({ celle: { kjoretidMin: 20, avstandM: 15000 } });
    const r = overf(leggTilOverforinger(grunnDag(), [o], CTX));
    expect(r[0]).toMatchObject({ erReise: false, lonnsartId: L_NORMAL, reiseKilde: null, reiseRetning: null });
    expect(r[0].reiseRegel?.overforing?.periodeId).toBe("per1");
  });

  it("mangler kjøretid → ingen rad, årsak mangler_matrise", () => {
    const res = leggTilOverforinger(grunnDag(), [oppslag({ celle: null })], CTX);
    expect(overf(res)).toHaveLength(0);
    expect(res.aarsak).toBe("mangler_matrise");
  });

  it("over terskel uten reise-lønnsart → årsak mangler_reise_lonnsart", () => {
    const res = leggTilOverforinger(grunnDag(), [oppslag()], { ...CTX, fallbackReiseLonnsartId: null });
    expect(overf(res)).toHaveLength(0);
    expect(res.aarsak).toBe("mangler_reise_lonnsart");
  });

  it("fjernet av arbeideren → ingen rad (forslaget kan fjernes)", () => {
    const res = leggTilOverforinger(grunnDag(), [oppslag()], {
      ...CTX, perDato: { [DATO]: { fjernOverforing: ["ut"] } },
    });
    expect(overf(res)).toHaveLength(0);
  });

  it("over midnatt eller overlapp med lagret rad → hoppes over, aldri oppfunnet", () => {
    const lang = oppslag({ celle: { kjoretidMin: 8 * 60, avstandM: 600000 } });
    expect(overf(leggTilOverforinger(grunnDag(), [lang], CTX))).toHaveLength(0);
    const overlapp = leggTilOverforinger(grunnDag(), [oppslag()], {
      ...CTX,
      eksisterendeSedelPerDato: {
        [DATO]: { eksisterendeRader: [{ fraTid: "05:00", tilTid: "06:00" }] },
      } as unknown as typeof CTX.eksisterendeSedelPerDato,
    });
    expect(overf(overlapp)).toHaveLength(0);
  });

  it("byggOverforingOppslag: første og siste dag av midlertidig kontor gir ut + retur med navn og kontor-celle", () => {
    const felles = {
      perioder: [FAST, PERIODE],
      destinasjonByggeplassId: null,
      kontekstByggeplassId: null,
      byggeplasserForProsjekt: () => [],
      kontorNavn: (id: string) => (id === "narvik" ? "Narvik" : "Tromsø"),
      prosjektNavn: () => "P",
      kontorAvstand: () => ({ kjoretidMin: 180, avstandM: 250000 }),
      matrise: () => null,
    };
    const forste = byggOverforingOppslag({ ...felles, datoer: [DATO] });
    expect(forste).toHaveLength(1);
    expect(forste[0]).toMatchObject({ fraNavn: "Narvik", tilNavn: "Tromsø", oppmotestedId: "narvik" });
    expect(forste[0].overforing.retning).toBe("ut");
    const siste = byggOverforingOppslag({ ...felles, datoer: ["2026-10-05"] });
    expect(siste[0]).toMatchObject({ fraNavn: "Tromsø", tilNavn: "Narvik" });
    expect(siste[0].overforing.retning).toBe("retur");
    expect(byggOverforingOppslag({ ...felles, datoer: ["2026-10-03"] })).toHaveLength(0);
  });

  it("byggOverforingOppslag: byggeplass-periode bruker kontekst-byggeplassen og matrisen; uten valg → celle null", () => {
    const bpPeriode = {
      id: "per2", type: "byggeplass" as const, fast: false, oppmotestedId: null,
      projectId: "p1", fraDato: DATO, tilDato: "2026-10-05",
    };
    const felles = {
      datoer: [DATO],
      perioder: [FAST, bpPeriode],
      destinasjonByggeplassId: null,
      byggeplasserForProsjekt: () => [{ id: "b1", navn: "Bru" }, { id: "b2", navn: "Tunnel" }],
      kontorNavn: () => "Narvik",
      prosjektNavn: () => "Prosjekt",
      kontorAvstand: () => null,
      matrise: (_o: string, b: string) => (b === "b2" ? { kjoretidMin: 60, avstandM: 70000 } : null),
    };
    const medKontekst = byggOverforingOppslag({ ...felles, kontekstByggeplassId: "b2" });
    expect(medKontekst[0]).toMatchObject({ byggeplassId: "b2", tilNavn: "Tunnel", celle: { kjoretidMin: 60 } });
    const uten = byggOverforingOppslag({ ...felles, kontekstByggeplassId: null });
    expect(uten[0]).toMatchObject({ byggeplassId: null, tilNavn: "Prosjekt", celle: null });
  });
});
