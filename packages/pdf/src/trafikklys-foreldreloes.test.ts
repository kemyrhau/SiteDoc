import { describe, it, expect } from "vitest";
import { renderFelt } from "./felt";
import type { TreObjekt, FeltVerdi, PdfConfig } from "./typer";

/**
 * 🔴 Foreldreløs trafikklys-verdi i arkiv-PDF — den DYRESTE flaten (et signert dokument som
 * mister et svar). `felt.ts` slo opp `TRAFIKKLYS[verdi]`; en ukjent verdi ga `<span class="tom">
 * Ikke utfylt</span>` — svaret forsvant stille. Fallbacken viser den rå verdien.
 *
 * En test som bare sjekker at det ikke kastes er en tillatelse — derfor kreves den RÅ verdien i
 * HTML-en, OG at «Ikke utfylt» IKKE står der.
 */

const config: PdfConfig = { bildeBaseUrl: "/api" };
const felt = (): TreObjekt =>
  ({ id: "f", type: "traffic_light", label: "Status", required: false, config: {}, sortOrder: 0, parentId: null, children: [] }) as TreObjekt;

describe("renderFelt traffic_light — foreldreløs verdi", () => {
  it("ukjent verdi → RÅ verdi i HTML, IKKE «Ikke utfylt»", () => {
    const fv = { verdi: "foreldreloes-42", kommentar: "", vedlegg: [] } as FeltVerdi;
    const html = renderFelt(felt(), fv, config);
    expect(html).toContain("foreldreloes-42");
    expect(html).not.toContain("Ikke utfylt");
  });

  it("gyldig verdi (green) → norsk label, uendret", () => {
    const fv = { verdi: "green", kommentar: "", vedlegg: [] } as FeltVerdi;
    const html = renderFelt(felt(), fv, config);
    expect(html).toContain("Godkjent");
  });

  it("tom verdi → «Ikke utfylt» (ubesvart forblir ubesvart)", () => {
    const fv = { verdi: "", kommentar: "", vedlegg: [] } as FeltVerdi;
    const html = renderFelt(felt(), fv, config);
    expect(html).toContain("Ikke utfylt");
  });
});
