import { describe, it, expect } from "vitest";
import {
  byggTimerRapportHtml,
  type TimerRapportData,
  type TimerRapportTekster,
  type TimerRapportMottaker,
  type TimerRapportDetaljRad,
} from "./timer-rapport";

/**
 * Fase 4 + oppfølger: `mottaker=ekstern` (ut av huset) skal STRUKTURELT utelate
 * intern informasjon — status, ansattnr (pseudonymiseringsnøkkel) og maskin-
 * anomali-merker. Ansattnavn + maskinnavn BLIR (dokumentasjon av arbeidet).
 * Distinktive markør-strenger så assertene ikke kolliderer med annen tekst.
 */

const tekster: TimerRapportTekster = {
  dokumentTittel: "DOK",
  periode: "Periode",
  prosjekt: "Prosjekt",
  ansatt: "Ansatt",
  alle: "Alle",
  ingenData: "Ingen data",
  sum: "Sum",
  sammendrag: "Sammendrag",
  kolAnsattnr: "ANSATTNR_HDR",
  kolTotalTimer: "Totale timer",
  kolSedler: "Sedler",
  kolSistRegistrert: "Sist",
  kolKladd: "KLADD_HDR",
  kolSent: "SENDT_HDR",
  kolAttestert: "ATTESTERT_HDR",
  detaljer: "Detaljer",
  subtotal: "Subtotal",
  kolDato: "Dato",
  kolType: "Type",
  kolBetegnelse: "Betegnelse",
  kolAktivitet: "Aktivitet",
  kolFra: "Fra",
  kolTil: "Til",
  kolTimer: "Timer",
  kolMaskintimer: "Maskintimer",
  kolAntall: "Antall",
  kolBelop: "Beløp",
  kolMengde: "Mengde",
  kolEnhet: "Enhet",
  kolBeskrivelse: "Beskrivelse",
  kolStatus: "Status",
  typeTimer: "Timer",
  typeMaskin: "Maskin",
  typeTillegg: "Tillegg",
  typeUtlegg: "Utlegg",
  maskinUtenTimerad: "MERKE_UTEN_TIMERAD",
  maskinIkkeEksporterbar: "MERKE_IKKE_EKSP",
  statusEtiketter: { pending: "STATUS_PENDING" },
};

const timerRad: TimerRapportDetaljRad = {
  type: "timer",
  nivaa: 0,
  dato: "2026-08-10",
  ansatt: "Ola Nordmann",
  ansattnr: "EMP-999",
  prosjekt: "Kai 12",
  betegnelse: "Normaltid",
  aktivitet: "Graving",
  fraTid: "07:00",
  tilTid: "15:00",
  timer: 7.5,
  maskintimer: null,
  antall: null,
  belop: null,
  mengde: null,
  enhet: null,
  beskrivelse: "gravde grøft",
  status: "pending",
  maskinMerke: null,
  maskinnavn: null,
};

const maskinUtenRad: TimerRapportDetaljRad = {
  ...timerRad,
  type: "maskin",
  betegnelse: "GRAVEMASKIN_NAVN",
  aktivitet: null,
  fraTid: null,
  tilTid: null,
  timer: null,
  maskintimer: 4,
  beskrivelse: null,
  status: "sent",
  maskinMerke: "utenTimerad",
};

function data(mottaker: TimerRapportMottaker): TimerRapportData {
  return {
    firmanavn: "Demo Bygg AS",
    fra: "2026-08-01",
    til: "2026-08-31",
    prosjektFilter: null,
    ansattFilter: null,
    mottaker,
    topptekstLinjer: [],
    ansatte: [
      { navn: "Ola Nordmann", ansattnr: "EMP-999", totalTimer: 7.5, antallSedler: 1, sistRegistrert: "2026-08-10", kladd: 1, sent: 0, attestert: 0 },
    ],
    grupper: [
      { overskrift: null, rader: [timerRad, maskinUtenRad], subtotal: { timer: 7.5, maskintimer: 4, antall: null, belop: null } },
    ],
  };
}

describe("byggTimerRapportHtml — mottaker-gating", () => {
  it("intern: viser ansattnr, status, maskin-merke (interne signaler beholdes)", () => {
    const html = byggTimerRapportHtml(data("intern"), tekster);
    expect(html).toContain("ANSATTNR_HDR");
    expect(html).toContain("EMP-999");
    expect(html).toContain("STATUS_PENDING");
    expect(html).toContain("MERKE_UTEN_TIMERAD");
    expect(html).toContain("KLADD_HDR"); // sammendrag status-kolonner
  });

  it("ekstern: ansattnr, status og maskin-merke er STRUKTURELT borte", () => {
    const html = byggTimerRapportHtml(data("ekstern"), tekster);
    // Lekkasjene som oppfølgeren lukket:
    expect(html).not.toContain("ANSATTNR_HDR");
    expect(html).not.toContain("EMP-999");
    expect(html).not.toContain("MERKE_UTEN_TIMERAD");
    // Fase 4-reglene (status ute av begge tabeller):
    expect(html).not.toContain("STATUS_PENDING");
    expect(html).not.toContain("KLADD_HDR");
    expect(html).not.toContain("SENDT_HDR");
    expect(html).not.toContain("ATTESTERT_HDR");
    // Men dokumentasjonen av arbeidet BLIR:
    expect(html).toContain("Ola Nordmann"); // ansattnavn
    expect(html).toContain("GRAVEMASKIN_NAVN"); // maskinnavn (uten merkelapp)
  });
});
