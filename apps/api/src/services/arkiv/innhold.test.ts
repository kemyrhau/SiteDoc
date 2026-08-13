import { describe, it, expect } from "vitest";
import { byggInnhold } from "@sitedoc/pdf";
import type { TreObjekt, PdfConfig } from "@sitedoc/pdf";

/**
 * Stage 2 — innholds-renderer + felt.ts opt-in for de to hullene. Rent lag.
 */

const cfg = (visTommeStrukturer: boolean): PdfConfig => ({ bildeBaseUrl: "", visTommeStrukturer });

const obj = (o: Partial<TreObjekt> & { id: string; type: string; label: string }): TreObjekt => ({
  required: false,
  config: {},
  sortOrder: 0,
  parentId: null,
  children: [],
  ...o,
});

describe("repeater som tabell (arkiv-override)", () => {
  const repeater = obj({
    id: "r1",
    type: "repeater",
    label: "Kontrollpunkter",
    children: [
      obj({ id: "res", type: "list_single", label: "Resultat", config: { options: [{ value: "ok", label: "OK" }] } }),
      obj({ id: "kom", type: "text_field", label: "Kommentar" }),
    ],
  });

  it("tom repeater → «Ingen rader registrert» (arkiv viser alltid, aldri stille skjul)", () => {
    const html = byggInnhold([repeater], { r1: { verdi: [], kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Ingen rader registrert");
    expect(html).toContain("Kontrollpunkter");
  });

  it("rader → tabell med kolonner fra barn-definisjonen + radverdier", () => {
    const rader = [
      { res: { verdi: "ok" }, kom: { verdi: "Alt OK" } },
      { res: { verdi: "" }, kom: { verdi: "" } },
    ];
    const html = byggInnhold([repeater], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("ark-repeater");
    expect(html).toContain("<th>Resultat</th>");
    expect(html).toContain("<th>Kommentar</th>");
    expect(html).toContain("OK"); // list_single label
    expect(html).toContain("Alt OK");
    expect(html).toContain("Ikke utfylt"); // tom celle vises, ikke skjult
  });
});

describe("felt.ts opt-in — tomt attachments", () => {
  const vedlegg = obj({ id: "a1", type: "attachments", label: "Dokumentasjon" });

  it("true → «Ingen vedlegg»", () => {
    const html = byggInnhold([vedlegg], { a1: { verdi: [], kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Ingen vedlegg");
  });

  it("false → tom", () => {
    expect(byggInnhold([vedlegg], { a1: { verdi: [], kommentar: "", vedlegg: [] } }, cfg(false))).toBe("");
  });
});

describe("byggInnhold — seksjoner + nesting", () => {
  it("heading rendres alltid, også uten barn-verdier", () => {
    const html = byggInnhold([obj({ id: "h", type: "heading", label: "Kontroll av armering" })], {}, cfg(true));
    expect(html).toContain("Kontroll av armering");
  });

  it("rekurserer inn i nestede barn (felt under en overskrift faller ikke ut)", () => {
    const tre: TreObjekt[] = [
      obj({
        id: "seksjon",
        type: "heading",
        label: "Seksjon A",
        children: [obj({ id: "f1", type: "text_field", label: "Målt verdi" })],
      }),
    ];
    const html = byggInnhold(tre, { f1: { verdi: "", kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Seksjon A");
    expect(html).toContain("Målt verdi");
    // tomt text_field → «Ikke utfylt» (ikke skjult)
    expect(html).toContain("Ikke utfylt");
  });

  it("utfylt felt viser verdien", () => {
    const html = byggInnhold([obj({ id: "f", type: "text_field", label: "Notat" })], { f: { verdi: "Alt OK", kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Alt OK");
  });
});
