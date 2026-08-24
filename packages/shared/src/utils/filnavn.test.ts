import { describe, it, expect } from "vitest";
import { sikreEndelse, saniter, ENDELSE_FRA_MIME } from "./filnavn";

// Beviser utledningsgrenen som mobilens uploadAsync-sti IKKE kan fremtvinge fra UI-et
// (DocumentPicker bevarer endelsen; fil uten UTI nedtones). Ren logikk → testes her.

describe("sikreEndelse", () => {
  it("navn MED endelse beholdes uendret", () => {
    expect(sikreEndelse("bilde.jpg", "image/jpeg")).toBe("bilde.jpg");
    expect(sikreEndelse("rapport.pdf", "application/pdf")).toBe("rapport.pdf");
    expect(sikreEndelse("klipp.HEIC", "image/heic")).toBe("klipp.HEIC"); // endelse (m/ bokstav) beholdes
  });

  it("navn UTEN endelse får den fra MIME", () => {
    expect(sikreEndelse("dokument", "application/pdf")).toBe("dokument.pdf");
    expect(sikreEndelse("kvittering", "image/jpeg")).toBe("kvittering.jpg");
    expect(sikreEndelse("skjerm", "image/png")).toBe("skjerm.png");
  });

  it("ukjent MIME uten endelse → uendret navn (ingen endelse påført)", () => {
    expect(sikreEndelse("dokument", "application/octet-stream")).toBe("dokument");
    expect(sikreEndelse("fil", "noe/rart")).toBe("fil");
  });

  it("rent numerisk suffiks regnes IKKE som endelse → MIME vinner", () => {
    expect(sikreEndelse("Faktura 2026.08", "application/pdf")).toBe("Faktura 2026.08.pdf");
    expect(sikreEndelse("v1.2", "application/pdf")).toBe("v1.2.pdf");
  });

  it("sti-separatorer saniteres bort før endelse-vurdering", () => {
    expect(sikreEndelse("mappe/under/bilde.jpg", "image/jpeg")).toBe("mappe_under_bilde.jpg");
    expect(sikreEndelse("a\\b\\dok", "application/pdf")).toBe("a_b_dok.pdf");
  });

  it("tomt/kun-whitespace navn → «fil» (+ MIME-endelse)", () => {
    expect(sikreEndelse("", "application/pdf")).toBe("fil.pdf");
    expect(sikreEndelse("   ", "image/png")).toBe("fil.png");
    expect(sikreEndelse("", "application/octet-stream")).toBe("fil");
  });

  it("MIME er case-insensitiv", () => {
    expect(sikreEndelse("dok", "APPLICATION/PDF")).toBe("dok.pdf");
  });

  it("kjent restgrense (dokumentert): alfabetisk men ikke-reelt suffiks «.v2» leses som endelse", () => {
    // Ikke ønsket, men bevisst tap — pinnes så en framtidig endring er et VALG, ikke en overraskelse.
    expect(sikreEndelse("rapport.v2", "application/pdf")).toBe("rapport.v2");
  });
});

describe("saniter", () => {
  it("erstatter sti-separatorer og kontrolltegn med _", () => {
    expect(saniter("a/b\\c")).toBe("a_b_c");
    expect(saniter("navn" + String.fromCharCode(9) + "med" + String.fromCharCode(10) + "kontroll")).toBe("navn_med_kontroll");
  });
  it("tomt/whitespace → «fil»", () => {
    expect(saniter("")).toBe("fil");
    expect(saniter("   ")).toBe("fil");
  });
  it("vanlig navn med mellomrom beholdes (trimmet)", () => {
    expect(saniter("  Min fil.pdf  ")).toBe("Min fil.pdf");
  });
});

describe("ENDELSE_FRA_MIME", () => {
  it("dekker de vanlige bilde-/dokument-typene", () => {
    expect(ENDELSE_FRA_MIME["image/jpeg"]).toBe(".jpg");
    expect(ENDELSE_FRA_MIME["image/heif"]).toBe(".heic");
    expect(ENDELSE_FRA_MIME["application/pdf"]).toBe(".pdf");
  });
});
