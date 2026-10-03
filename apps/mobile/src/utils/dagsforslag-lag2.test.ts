import { describe, it, expect } from "vitest";
import { finnTidsromKonflikt } from "@sitedoc/shared";
import {
  beregnDagsforslag,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
} from "./dagsforslag";
import { erReiseRadVisning } from "./reiseRad";

/**
 * LAG 2 (L2-B) rød-først-tester — hver skal FEILE uten koden i denne leveransen
 * (vist rød i en engangskopi, kvittert med `comm -13` mot origin):
 *  (a) utledet reise-vindu uten `tidKilde` (B2 V8)
 *  (b) `erReise`-rad uten `reiseKilde` (B1)
 *  (d) visningen gjenkjenner reise på lønnsart i stedet for `erReise` (B6)
 * + B3: Dag A med fire tidsatte rader passerer serverens `finnTidsromKonflikt`.
 *
 * Ren utils (ingen DB/RN). Lokal-ISO (uten Z) — samme konvensjon som
 * `dagsforslag.test.ts`.
 */

const L_NORMAL = "L-normal";
const L_OT50 = "L-ot50";
const L_REISE = "L-reise";

const SOMMER: DagsforslagEffektiv = {
  startTid: "07:00",
  sluttTid: "15:30",
  pauseMin: 30,
  dagsnorm: 8,
  normStatus: "server",
};

/** Dag A: start/slutt kontor «o1», destinasjon «b1», ut+retur 120 min (reisetid). */
function dagA(): ReturnType<typeof beregnDagsforslag> {
  const input: BeregnDagsforslagInput = {
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
  };
  return beregnDagsforslag(input);
}

describe("L2-B — reise-sporet på raden (B1/B2)", () => {
  it("🔴 (a) reise-rader har et UTLEDET klokkevindu MED tidKilde='utledet' (B2 V8)", () => {
    const rader = dagA().datoer[0]!.rader.filter((r) => r.erReise);
    expect(rader).toHaveLength(2);
    // Rød uten B2: reise-raden bar null-tider og null tidKilde.
    for (const r of rader) {
      expect(r.fraTid).not.toBeNull();
      expect(r.tilTid).not.toBeNull();
      expect(r.tidKilde).toBe("utledet");
    }
  });

  it("🔴 (b) hver erReise-rad bærer reiseKilde + full etappe-spor (B1)", () => {
    const rader = dagA().datoer[0]!.rader.filter((r) => r.erReise);
    expect(rader.length).toBeGreaterThan(0);
    for (const r of rader) {
      // Rød uten B1: reiseKilde/retning/oppmøtested/regel var null.
      expect(r.reiseKilde).toBe("matrise");
      expect(r.reiseRetning === "ut" || r.reiseRetning === "retur").toBe(true);
      expect(r.reiseOppmotestedId).toBe("o1");
      expect(r.byggeplassId).toBe("b1");
      expect(r.reiseKjoretidMin).toBe(120);
      expect(r.reiseAvstandM).toBe(50000);
      expect(r.reiseRegel).not.toBeNull();
      expect(r.reiseRegel!.kategori).toBe("reisetid");
    }
  });

  it("sedelen bærer normStatus + normSnapshot fra svar-cachen (B5)", () => {
    const dag = dagA().datoer[0]!;
    expect(dag.normStatus).toBe("server");
    expect(dag.normSnapshot).toBeNull(); // SOMMER har ingen normSnapshot i fixturen
  });

  it("🔴 B3: Dag As fire tidsatte rader passerer serverens finnTidsromKonflikt", () => {
    // ut 05:00–07:00, normaltid+OT50 07:00–17:30 (carvet), retur 17:30–19:30.
    // Reise-vinduene berører arbeidsvinduet i endepunktene (tidsromOverlapper er
    // streng → berøring teller ikke). Importerer serverens EGEN vakt (delt kilde
    // i @sitedoc/shared → samme funksjon prod kjører, L2-A urørt).
    const rader = dagA().datoer[0]!.rader.map((r) => ({
      fraTid: r.fraTid,
      tilTid: r.tilTid,
    }));
    // Minst fire rader med begge tider satt (ut + arbeid(er) + retur).
    expect(rader.filter((r) => r.fraTid && r.tilTid).length).toBeGreaterThanOrEqual(4);
    expect(finnTidsromKonflikt(rader)).toBeNull();
  });
});

describe("L2-B — reise-gjenkjenning ved visning (B6)", () => {
  it("🔴 (d) leser det EKSPLISITTE erReise-flagget, ikke lønnsart-id", () => {
    // erReise=true selv om lønnsarten IKKE er firmaets reise-art → reise.
    // Rød uten B6: gammel kode var `lonnsartId === reiseLonnsartId` → false.
    expect(erReiseRadVisning(true, "annen-art", "reise-art")).toBe(true);
    // erReise=false overstyrer en lønnsart som ser ut som reise.
    expect(erReiseRadVisning(false, "reise-art", "reise-art")).toBe(false);
    // Fallback KUN for rader uten flagg (legacy/pull): lønnsart-match.
    expect(erReiseRadVisning(null, "reise-art", "reise-art")).toBe(true);
    expect(erReiseRadVisning(null, "annen-art", "reise-art")).toBe(false);
  });
});
