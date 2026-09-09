import { describe, it, expect } from "vitest";
import { renderFelt } from "./felt";
import { byggRepeaterTabell } from "./arkivmal/repeater";
import type { TreObjekt, FeltVerdi, PdfConfig, TilfoyelsePdf } from "./typer";

/**
 * Tilføyelser i arkiv-PDF (ordre `pdf-tilfoyelser`): tapte offline-kollisjonsverdier
 * (kollisjonsmerge) skal vises ved feltet — verdi + hvem + når — ETTER `verdi`, FØR
 * `kommentar`. Dekker topp-nivå-felt (renderFelt) og repeater-tabellcelle
 * (byggRepeaterTabell), samt at eldre/halve rader ikke krasjer.
 */

const config: PdfConfig = { bildeBaseUrl: "/api" };

const felt = (
  id: string,
  type: string,
  label: string,
): TreObjekt =>
  ({ id, type, label, required: false, config: {}, sortOrder: 0, parentId: null, children: [] }) as TreObjekt;

const til = (verdi: unknown, brukerNavn: string, tidspunkt: string): TilfoyelsePdf =>
  ({ verdi, brukerNavn, brukerId: "u-1", tidspunkt }) as TilfoyelsePdf;

describe("byggTilfoyelser via renderFelt (topp-nivå)", () => {
  const OBJ = felt("f", "text_field", "Beskrivelse");

  it("felt med ÉN tilføyelse: verdi + navn + tidspunkt, riktig rekkefølge", () => {
    const fv: FeltVerdi = {
      verdi: "Test",
      kommentar: "",
      vedlegg: [],
      tilfoyelser: [til("Tester en offline duplisering fra mobil", "Kenneth Myrhaug", "2026-09-08T23:24:00+02:00")],
    };
    const html = renderFelt(OBJ, fv, config);

    expect(html).toContain('class="tilfoyelse"');
    expect(html).toContain("Også registrert — feltet hadde allerede verdien over");
    expect(html).toContain("Tester en offline duplisering fra mobil");
    expect(html).toContain("Kenneth Myrhaug");
    expect(html).toContain("08.09.2026 23:24");
    // Rekkefølge: feltets verdi (over) FØR tilføyelsen (under).
    expect(html.indexOf('class="felt-verdi"')).toBeLessThan(html.indexOf('class="tilfoyelse"'));
  });

  it("felt med FLERE tilføyelser: alle rendres, kommentar kommer etter", () => {
    const fv: FeltVerdi = {
      verdi: "A",
      kommentar: "En kommentar",
      vedlegg: [],
      tilfoyelser: [
        til("B", "Per Berg", "2026-09-08T10:00:00+02:00"),
        til("C", "Anne Ås", "2026-09-08T11:00:00+02:00"),
      ],
    };
    const html = renderFelt(OBJ, fv, config);

    expect((html.match(/class="tilfoyelse-rad"/g) ?? []).length).toBe(2);
    expect(html).toContain("Per Berg");
    expect(html).toContain("Anne Ås");
    // Tilføyelser FØR kommentar.
    expect(html.indexOf('class="tilfoyelse"')).toBeLessThan(html.indexOf('class="kommentar"'));
  });

  it("felt UTEN tilføyelser: ingen tom boks", () => {
    const fv: FeltVerdi = { verdi: "A", kommentar: "", vedlegg: [] };
    const html = renderFelt(OBJ, fv, config);
    expect(html).not.toContain("tilfoyelse");
  });

  it("tomt tilfoyelser-array: ingen blokk", () => {
    const fv: FeltVerdi = { verdi: "A", kommentar: "", vedlegg: [], tilfoyelser: [] };
    const html = renderFelt(OBJ, fv, config);
    expect(html).not.toContain("tilfoyelse");
  });

  it("manglende brukerNavn (eldre rad): «Ukjent bruker», krasjer ikke", () => {
    const fv: FeltVerdi = {
      verdi: "A",
      kommentar: "",
      vedlegg: [],
      // Eldre/halv rad: navn og tidspunkt mangler.
      tilfoyelser: [{ verdi: "B" } as unknown as TilfoyelsePdf],
    };
    const html = renderFelt(OBJ, fv, config);
    expect(html).toContain("Ukjent bruker");
    expect(html).toContain("B");
    // Uten tidspunkt: ingen komma-hale etter navnet.
    expect(html).toContain('<div class="tilfoyelse-meta">Ukjent bruker</div>');
  });
});

describe("tilføyelse inne i repeater (arkiv-tabellcelle)", () => {
  const REP: TreObjekt = {
    id: "rep",
    type: "repeater",
    label: "Kontroll",
    required: false,
    config: {},
    sortOrder: 0,
    parentId: null,
    children: [felt("a", "text_field", "Punkt")],
  } as TreObjekt;

  it("barn-celle med tilføyelse rendres i tabellen, krasjer ikke", () => {
    const rader = [
      {
        _radId: "r1",
        felter: {
          a: {
            verdi: "OK",
            kommentar: "",
            vedlegg: [],
            tilfoyelser: [til("Ikke OK", "Per Berg", "2026-09-08T09:41:00+02:00")],
          } as FeltVerdi,
        },
      },
    ];
    const html = byggRepeaterTabell(REP, rader, "Kontroll");

    expect(html).toContain('class="tilfoyelse"');
    expect(html).toContain("Ikke OK");
    expect(html).toContain("Per Berg");
    expect(html).toContain("08.09.2026 09:41");
  });

  it("repeater uten tilføyelser: ingen tilfoyelse-blokk", () => {
    const rader = [{ _radId: "r1", felter: { a: { verdi: "OK", kommentar: "", vedlegg: [] } as FeltVerdi } }];
    const html = byggRepeaterTabell(REP, rader, "Kontroll");
    expect(html).not.toContain("tilfoyelse");
  });
});
