import { describe, it, expect } from "vitest";
import {
  tolkInnstillinger,
  byggTopptekst,
  byggProsjektblokk,
  byggStatusblokk,
  byggFortsettelsesHeader,
  byggBunntekst,
  statusTekst,
  statusSemantiskFarge,
  ARKIV_FARGER,
  type ArkivFirma,
  type ArkivDokumentMeta,
} from "@sitedoc/pdf";

/**
 * Ramme-byggeklosser (Stage 1) — rent lag, ingen DB. Verifiserer at
 * innstillinger + sporbarhetsminimum + komprimering oppfører seg mot fasiten.
 */

const firma: ArkivFirma = { navn: "SiteDoc AS", orgnr: "923 456 789", logoDataUrl: "data:image/png;base64,AAAA" };
const meta: ArkivDokumentMeta = {
  kategori: "sjekkliste",
  dokumenttype: "Sjekkliste",
  dokumentnavn: "Betongarbeider — dekke 3. etasje",
  dokumentnummer: "SJ-2026-0142",
  dokumentId: "sj_9f2c41d8",
  status: "approved",
};

describe("byggTopptekst", () => {
  it("viser logo når innst.logo=på og logoDataUrl finnes", () => {
    const html = byggTopptekst(firma, meta, tolkInnstillinger(null));
    expect(html).toContain('class="ark-logo"');
    expect(html).toContain("data:image/png;base64,AAAA");
  });

  it("skjuler logo når innst.logo=av, men beholder firmanavn + org.nr (sporbarhetsminimum)", () => {
    const html = byggTopptekst(firma, meta, tolkInnstillinger({ logo: false }));
    expect(html).not.toContain("ark-logo");
    expect(html).toContain("SiteDoc AS");
    expect(html).toContain("Org.nr 923 456 789");
  });

  it("inneholder dokumenttype, navn og nr", () => {
    const html = byggTopptekst(firma, meta, tolkInnstillinger(null));
    expect(html).toContain("Sjekkliste");
    expect(html).toContain("Betongarbeider");
    expect(html).toContain("Dokumentnr. SJ-2026-0142");
  });
});

describe("byggProsjektblokk — komprimering", () => {
  const blokk = { prosjekt: "998 Instinniforbotn", byggeplass: "Blokk B", byggherre: "Fjordbygg Eiendom AS" };

  it("full blokk → tre celler", () => {
    const html = byggProsjektblokk(blokk, tolkInnstillinger(null));
    expect(html).toContain("Prosjekt");
    expect(html).toContain("Byggeplass");
    expect(html).toContain("Byggherre");
  });

  it("prosjektnavn av → Prosjekt-cellen faller bort (komprimeres)", () => {
    const html = byggProsjektblokk(blokk, tolkInnstillinger({ prosjektnavn: false }));
    expect(html).not.toContain(">Prosjekt<");
    expect(html).toContain("Byggeplass");
  });

  it("lokasjon av → Byggeplass faller bort", () => {
    const html = byggProsjektblokk(blokk, tolkInnstillinger({ lokasjon: false }));
    expect(html).not.toContain(">Byggeplass<");
  });

  it("ingen verdier → tom streng (ingen tom ramme)", () => {
    expect(byggProsjektblokk({}, tolkInnstillinger(null))).toBe("");
  });
});

describe("byggStatusblokk", () => {
  const celler = [
    { etikett: "Status", verdi: "Godkjent", farge: ARKIV_FARGER.gronn },
    { etikett: "Utført av", verdi: "Mathias Berg", underVerdi: "(bas)" },
  ];

  it("rendrer cellene med semantisk farge", () => {
    const html = byggStatusblokk(celler);
    expect(html).toContain("Godkjent");
    expect(html).toContain(`color:${ARKIV_FARGER.gronn}`);
    expect(html).toContain("(bas)");
  });

  it("legger til «Sist endret» som ekstra celle når logg finnes", () => {
    const html = byggStatusblokk(celler, { navn: "Silje Havstad", dato: "2026-08-08" }, (d) => d.slice(0, 10));
    expect(html).toContain("Sist endret");
    expect(html).toContain("Silje Havstad");
  });

  it("uten sistEndret → ingen «Sist endret»-celle", () => {
    expect(byggStatusblokk(celler)).not.toContain("Sist endret");
  });
});

describe("statusTekst / statusSemantiskFarge", () => {
  it("godkjent/lukket → grønn, avvist → rød, nøytral → null", () => {
    expect(statusSemantiskFarge("approved")).toBe(ARKIV_FARGER.gronn);
    expect(statusSemantiskFarge("closed")).toBe(ARKIV_FARGER.gronn);
    expect(statusSemantiskFarge("rejected")).toBe(ARKIV_FARGER.rod);
    expect(statusSemantiskFarge("received")).toBeNull();
  });
  it("statusTekst gjenbruker STATUS_TEKST", () => {
    expect(statusTekst("approved")).toBe("Godkjent");
    expect(statusTekst("ukjent_nokkel")).toBe("ukjent_nokkel");
  });
});

describe("byggBunntekst — sporbarhetsminimum", () => {
  it("generert-stempel med; dokument-id utgått (funn 3)", () => {
    const html = byggBunntekst(meta, "11.08.2026 14:32");
    expect(html).toContain("Generert fra SiteDoc 11.08.2026 14:32");
    expect(html).not.toContain("dokument-id");
  });
  it("sidetall valgfritt (settes normalt av container)", () => {
    expect(byggBunntekst(meta, "x", "Side 1 av 2")).toContain("Side 1 av 2");
  });
});

describe("byggFortsettelsesHeader", () => {
  it("slank header med firma + dok-referanse + prosjekt", () => {
    const html = byggFortsettelsesHeader(firma, meta, "998 Instinniforbotn", tolkInnstillinger(null));
    expect(html).toContain("ark-fortsettelse");
    expect(html).toContain("SJ-2026-0142");
    expect(html).toContain("998 Instinniforbotn");
  });
});
