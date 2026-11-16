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
  kolByggeplass: "Byggeplass",
  kolUnderprosjekt: "Underprosjekt",
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

/* ============================================================================
 *  ORDRE (36) 2026-11-16 — kolonnebredder i Detaljer (feltfunn Fakturagrunnlag):
 *  Dato/Type/tall ble brutt bokstav for bokstav fordi alle kolonner fikk prosent av
 *  min·(1+vekt) med table-layout:fixed. Nå: korte kolonner (vekt 0) har `kort` +
 *  nowrap og krymper til innholdet; tekstkolonner med innhold deler prosent etter
 *  vekt; tom tekstkolonne får ingen bredde. Verifisert i Chromium (liggende 1002 px,
 *  stående 673 px: korte kolonner på én linje, tabellen holder sidebredden).
 *  🔴 Rød før koden.
 * ============================================================================ */
describe("byggTimerRapportHtml — kolonnebredder (ORDRE 36)", () => {
  // Formen til @sitedoc/shared `TIMER_KOL_BREDDE` (api sender den ordrett).
  const BREDDE: Record<string, { min: number; vekt: number }> = {
    dato: { min: 90, vekt: 0 }, ansatt: { min: 120, vekt: 2 }, ansattnr: { min: 74, vekt: 0 },
    prosjekt: { min: 120, vekt: 2 }, type: { min: 78, vekt: 0 }, betegnelse: { min: 150, vekt: 4 },
    aktivitet: { min: 110, vekt: 2 }, fraTid: { min: 54, vekt: 0 }, tilTid: { min: 54, vekt: 0 },
    timer: { min: 72, vekt: 0 }, maskintimer: { min: 92, vekt: 0 }, antall: { min: 68, vekt: 0 },
    belop: { min: 88, vekt: 0 }, mengde: { min: 72, vekt: 0 }, enhet: { min: 56, vekt: 0 },
    beskrivelse: { min: 200, vekt: 6 }, status: { min: 100, vekt: 0 },
  };
  const KORTE = ["dato", "type", "timer", "maskintimer", "antall", "belop", "mengde", "enhet"];
  const KOLONNER = ["dato", "ansatt", "prosjekt", "type", "betegnelse", "aktivitet", "timer", "maskintimer", "antall", "belop", "mengde", "enhet", "beskrivelse"];
  /** Kolonnene PDF-en faktisk viser: Aktivitet er tom på alle rader og skjules. */
  const VISTE = KOLONNER.filter((id) => id !== "aktivitet");
  const html = (o: Partial<TimerRapportData> = {}) =>
    byggTimerRapportHtml(
      {
        ...data("ekstern"),
        // Alle valgte kolonner har verdi unntatt Aktivitet (tom → skjules, TILLEGG 36).
        grupper: [{ overskrift: null, rader: [{ ...timerRad, aktivitet: null, antall: 2, belop: 0, mengde: 3, enhet: "m3" }, { ...maskinUtenRad, aktivitet: null }], subtotal: { timer: 7.5, maskintimer: 4, antall: 2, belop: 0 } }],
        valgteKolonner: KOLONNER,
        kolBredder: BREDDE,
        ...o,
      },
      tekster,
    );
  /** Detaljer-tabellen: <col>-ene og overskriftscellene i kolonnerekkefølge. */
  const detaljer = (h: string) => {
    const tab = h.slice(h.lastIndexOf("<table"));
    const cols = (tab.match(/<colgroup>(.*?)<\/colgroup>/)?.[1] ?? "").match(/<col[^>]*>/g) ?? [];
    const ths = (tab.match(/<thead>(.*?)<\/thead>/s)?.[1] ?? "").match(/<th[^>]*>/g) ?? [];
    const forsteRad = (tab.match(/<tbody><tr[^>]*>(.*?)<\/tr>/s)?.[1] ?? "").match(/<td[^>]*>/g) ?? [];
    return { tab, cols, ths, forsteRad };
  };

  it("korte kolonner (dato, type, tall, enhet) har `kort`-klasse på overskrift og celle, og CSS-en gir nowrap", () => {
    const h = html();
    const { ths, forsteRad, cols } = detaljer(h);
    for (const id of KORTE) {
      const i = VISTE.indexOf(id);
      expect(ths[i], id).toMatch(/class="[^"]*\bkort\b/);
      expect(forsteRad[i], id).toMatch(/class="[^"]*\bkort\b/);
      expect(cols[i], id).toBe('<col style="width:1px">');
    }
    // SVAR (72) A1 (Kenneth: godta): overskriften over en tallkolonne er høyrejustert.
    for (const id of ["timer", "maskintimer", "antall", "belop", "mengde"]) {
      expect(ths[VISTE.indexOf(id)], id).toMatch(/^<th class="num\b/);
    }
    expect(ths[VISTE.indexOf("enhet")]).not.toMatch(/\bnum\b/);
    expect(h).toMatch(/table\.vekt \.kort \{ white-space: nowrap;/);
    expect(h).not.toContain("table-layout: fixed");
  });

  it("tekstkolonner med innhold deler bredden etter vekt", () => {
    const { cols, ths } = detaljer(html());
    // ansatt 2 · prosjekt 2 · betegnelse 4 · beskrivelse 6 = 14 (aktivitet er skjult)
    expect(cols).toHaveLength(VISTE.length);
    const pst = (id: string) => cols[VISTE.indexOf(id)];
    expect(pst("ansatt")).toBe('<col style="width:14.29%">');
    expect(pst("prosjekt")).toBe('<col style="width:14.29%">');
    expect(pst("betegnelse")).toBe('<col style="width:28.57%">');
    expect(pst("beskrivelse")).toBe('<col style="width:42.86%">');
    expect(ths[VISTE.indexOf("beskrivelse")]).toBe("<th>");
  });

  it("negativkontroll: uten kolBredder er tabellen som før (ingen colgroup, ingen kort-klasse)", () => {
    const { tab } = detaljer(html({ kolBredder: undefined }));
    expect(tab).not.toContain("<colgroup>");
    expect(tab).not.toContain("kort");
  });
});

/* ============================================================================
 * TILLEGG (36) 2026-11-16 — tomme valgte kolonner skjules i PDF-en (Kenneth: ja).
 * Skjerm og Excel er uendret (B1): shared `losTimerKolonner` gir fortsatt
 * brukervalget ordrett — vakt: timerDetaljRader.test.ts «config satt → ordrett
 * brukervalg … (ingen drop-tom)». «Tom» = samme regel som skjermen
 * (`kolonnerMedInnhold`): tekst null/"" · tall kun null (0 er en verdi).
 * ============================================================================ */
describe("byggTimerRapportHtml — tomme valgte kolonner skjules (TILLEGG 36)", () => {
  const overskrifter = (h: string): string[] => {
    const tab = h.slice(h.lastIndexOf("<table"));
    const thead = tab.match(/<thead>(.*?)<\/thead>/s)?.[1] ?? "";
    return [...thead.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1] ?? "");
  };
  const lag = (valgteKolonner: string[], rader = [timerRad, maskinUtenRad]) =>
    byggTimerRapportHtml(
      { ...data("intern"), grupper: [{ overskrift: null, rader, subtotal: { timer: 7.5, maskintimer: 4, antall: null, belop: null } }], valgteKolonner },
      tekster,
    );

  it("valgt kolonne som er tom på alle rader vises ikke (tall, tekst og ansattnr)", () => {
    const rader = [{ ...timerRad, ansattnr: null }, { ...maskinUtenRad, ansattnr: "" }];
    const h = overskrifter(lag(["dato", "ansattnr", "timer", "mengde", "enhet", "beskrivelse"], rader));
    expect(h).toEqual(["Dato", "Timer", "Beskrivelse"]);
  });

  it("negativkontroll: én verdi på én rad holder kolonnen — også 0 og én tekst", () => {
    const rader = [{ ...timerRad, mengde: 0, enhet: "m3" }, maskinUtenRad];
    const h = overskrifter(lag(["dato", "ansattnr", "mengde", "enhet", "aktivitet"], rader));
    expect(h).toEqual(["Dato", "ANSATTNR_HDR", "Mengde", "Enhet", "Aktivitet"]);
  });

  it("er alle valgte kolonner tomme, vises tabellen som før (alle valgte)", () => {
    const h = overskrifter(lag(["mengde", "enhet"]));
    expect(h).toEqual(["Mengde", "Enhet"]);
  });

  it("dynamisk sett (uten brukervalg) er uendret", () => {
    const h = overskrifter(lag([]));
    expect(h).not.toContain("Mengde");
    expect(h).toContain("ANSATTNR_HDR");
  });
});
