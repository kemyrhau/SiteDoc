import { describe, it, expect } from "vitest";
import {
  byggServiceRapportHtml,
  type ServiceRapportData,
  type ServiceRapportTekster,
} from "./service-rapport";

const tekster: ServiceRapportTekster = {
  dokumentTittel: "SERVICERAPPORT",
  maskin: "Maskin",
  ident: "Ident",
  serviceIntervall: "Serviceintervall",
  nesteService: "Neste service",
  gjeldendeDriftstimer: "Driftstimer",
  timerEnhet: "t",
  servicelogg: "SERVICELOGG",
  kolDato: "Dato",
  kolType: "Type",
  kolDriftstimer: "Driftstimer",
  kolKm: "Km",
  kolBeskrivelse: "Beskrivelse",
  kolUtfortAv: "Utført av",
  kolKostnad: "Kostnad",
  ingenData: "INGEN_SERVICE",
  ikkeSatt: "Ikke satt",
  generert: "Generert",
};

const basisData: ServiceRapportData = {
  firmanavn: "Test Maskin AS",
  maskinNavn: "Stor-Volvo",
  maskinIdent: "MASK-042",
  serviceIntervallTimer: 250,
  nesteServiceTimer: 1250,
  driftstimer: 1000,
  rader: [
    {
      dato: "2026-09-18",
      type: "Service",
      driftstimer: 1000,
      km: null,
      beskrivelse: "Oljeskift og filter",
      utfortAv: "Verksted AS",
      kostnad: "4 500 kr",
    },
  ],
  generertDato: "2026-09-18",
};

describe("byggServiceRapportHtml", () => {
  it("tar med tittel, maskin, intervall og servicelogg-rad", () => {
    const html = byggServiceRapportHtml(basisData, tekster);
    expect(html).toContain("SERVICERAPPORT");
    expect(html).toContain("Stor-Volvo");
    expect(html).toContain("250 t");
    expect(html).toContain("1250 t");
    expect(html).toContain("Oljeskift og filter");
    expect(html).toContain("Verksted AS");
  });

  it("viser «ikke satt» når intervall/neste mangler", () => {
    const html = byggServiceRapportHtml(
      { ...basisData, serviceIntervallTimer: null, nesteServiceTimer: null },
      tekster,
    );
    expect(html).toContain("Ikke satt");
  });

  it("viser ingen-data-tekst når loggen er tom", () => {
    const html = byggServiceRapportHtml({ ...basisData, rader: [] }, tekster);
    expect(html).toContain("INGEN_SERVICE");
  });

  it("escaper brukerinnhold (ingen rå <script>)", () => {
    const html = byggServiceRapportHtml(
      {
        ...basisData,
        rader: [
          { ...basisData.rader[0], beskrivelse: "<script>alert(1)</script>" },
        ],
      },
      tekster,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
