import { describe, it, expect } from "vitest";
import { byggArkivTegningsposisjon, byggLokasjonsblokk } from "./tegningsfelt";
import type { PdfConfig } from "../typer";

const OPPSLAG: PdfConfig["tegningsOppslag"] = {
  "d1": {
    dataUrl: "data:image/jpeg;base64,AAAA",
    imageWidth: 1600,
    imageHeight: 900,
    navn: "ARK-P-101 Plan 1",
  },
  "d2-udim": {
    // Kant: markering uten bilde-dimensjoner (imageWidth/Height null).
    dataUrl: "data:image/jpeg;base64,BBBB",
    imageWidth: null,
    imageHeight: null,
    navn: "Uten dimensjoner",
  },
};

describe("byggArkivTegningsposisjon — feltnivå drawing_position (D2)", () => {
  it("komplett markør → utsnitt m/ inlinet data-URI + tegningsnavn som tittel", () => {
    const html = byggArkivTegningsposisjon(
      { drawingId: "d1", positionX: 40, positionY: 60, drawingName: "ARK-P-101 Plan 1" },
      OPPSLAG,
    );
    expect(html).toContain("data:image/jpeg;base64,AAAA");
    expect(html).toContain("ARK-P-101 Plan 1");
    // Aldri en nettverks-URL i den ferdige HTML-en.
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("markering uten bilde-dimensjoner → rendres likevel (viewBox faller til kvadrat)", () => {
    const html = byggArkivTegningsposisjon(
      { drawingId: "d2-udim", positionX: 50, positionY: 50 },
      OPPSLAG,
    );
    expect(html).toContain("data:image/jpeg;base64,BBBB");
    expect(html).toContain("<svg");
  });

  it("tegning slettet etter markering (drawingId mangler i oppslag) → \"\" (ingen tom blokk)", () => {
    const html = byggArkivTegningsposisjon(
      { drawingId: "slettet", positionX: 10, positionY: 20 },
      OPPSLAG,
    );
    expect(html).toBe("");
  });

  it("ingen markør (tom/undefined verdi) → \"\"", () => {
    expect(byggArkivTegningsposisjon(undefined, OPPSLAG)).toBe("");
    expect(byggArkivTegningsposisjon(null, OPPSLAG)).toBe("");
    expect(byggArkivTegningsposisjon({}, OPPSLAG)).toBe("");
    // drawingId satt, men posisjon mangler → ikke en komplett markør.
    expect(byggArkivTegningsposisjon({ drawingId: "d1" }, OPPSLAG)).toBe("");
  });

  it("BEF-001-tilstand: drawingId satt, men position null → \"\" (tegning uten markør dokumenterer ingenting — Kenneth 2026-08-21)", () => {
    // Ukonvertert PDF-tegning: pin lar seg ikke sette → position_x/y NULL selv om
    // drawing_id er satt. Tegningen skrives IKKE ut. Presiserer ordrens «uten
    // markering utelates seksjonen».
    expect(
      byggArkivTegningsposisjon({ drawingId: "d1", positionX: null, positionY: null }, OPPSLAG),
    ).toBe("");
  });

  it("tomt oppslag → \"\" (bilde-henting feilet oppstrøms, ført i manglende)", () => {
    expect(
      byggArkivTegningsposisjon({ drawingId: "d1", positionX: 5, positionY: 5 }, {}),
    ).toBe("");
    expect(
      byggArkivTegningsposisjon({ drawingId: "d1", positionX: 5, positionY: 5 }, undefined),
    ).toBe("");
  });
});

describe("byggLokasjonsblokk — dokumentnivå lokasjon (D2)", () => {
  it("komplett markør → utsnitt + «Lokasjon»-tittel + tekstlinje byggeplass · tegningsnavn", () => {
    const html = byggLokasjonsblokk(
      {
        drawingId: "d1",
        positionX: 30,
        positionY: 70,
        byggeplassNavn: "Lakselv lufthavn",
        tegningNavn: "ARK-P-101 Plan 1",
      },
      OPPSLAG,
    );
    expect(html).toContain("Lokasjon");
    expect(html).toContain("data:image/jpeg;base64,AAAA");
    expect(html).toContain("Lakselv lufthavn · ARK-P-101 Plan 1");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("faller til oppslagets navn når tegningNavn ikke er gitt", () => {
    const html = byggLokasjonsblokk(
      { drawingId: "d1", positionX: 30, positionY: 70, byggeplassNavn: "Byggeplass A" },
      OPPSLAG,
    );
    expect(html).toContain("Byggeplass A · ARK-P-101 Plan 1");
  });

  it("bare tegningsnavn (ingen byggeplass) → tekstlinje uten skilletegn foran", () => {
    const html = byggLokasjonsblokk(
      { drawingId: "d1", positionX: 30, positionY: 70 },
      OPPSLAG,
    );
    expect(html).toContain("ARK-P-101 Plan 1");
    expect(html).not.toContain("· ARK-P-101");
  });

  it("ingen markør / ingen bilde → \"\" (seksjonen utelates, aldri tom kartboks)", () => {
    expect(byggLokasjonsblokk({}, OPPSLAG)).toBe("");
    expect(byggLokasjonsblokk({ drawingId: "d1", positionX: 30 }, OPPSLAG)).toBe("");
    expect(byggLokasjonsblokk({ drawingId: "slettet", positionX: 1, positionY: 1 }, OPPSLAG)).toBe("");
  });

  it("BEF-001-tilstand: drawingId satt, position null → \"\" (tegning uten markør skrives ikke ut — Kenneth 2026-08-21)", () => {
    expect(
      byggLokasjonsblokk(
        { drawingId: "d1", positionX: null, positionY: null, byggeplassNavn: "Lakselv lufthavn" },
        OPPSLAG,
      ),
    ).toBe("");
  });

  it("lokasjonOmfang=byggeplass → «Gjelder hele byggeplassen», ALDRI utelatt (2026-09-04)", () => {
    // Uten markør ville dagens regel gitt "". Byggeplass er et bevisst svar, ikke en manglende pin.
    const html = byggLokasjonsblokk({ lokasjonOmfang: "byggeplass" }, OPPSLAG);
    expect(html).toContain("Gjelder hele byggeplassen");
    expect(html).not.toBe("");
  });

  it("lokasjonOmfang=byggeplass vinner over manglende markør (ingen tegning kreves)", () => {
    const html = byggLokasjonsblokk(
      { lokasjonOmfang: "byggeplass", drawingId: null, positionX: null, positionY: null },
      OPPSLAG,
    );
    expect(html).toContain("Gjelder hele byggeplassen");
  });

  it("lokasjonOmfang=punkt uten markør → \"\" (som i dag)", () => {
    expect(byggLokasjonsblokk({ lokasjonOmfang: "punkt" }, OPPSLAG)).toBe("");
  });
});
