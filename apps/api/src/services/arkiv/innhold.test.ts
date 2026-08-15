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

describe("repeater-vedlegg — bilder samlet under tabellen (steg 2)", () => {
  const DATA_URI = "data:image/jpeg;base64,AAAA";
  const bilde = (filnavn: string, url = DATA_URI) => ({ id: filnavn, type: "bilde", url, filnavn });

  const repeaterMedBilder = obj({
    id: "r1",
    type: "repeater",
    label: "Kontrollpunkter",
    children: [
      obj({ id: "kom", type: "text_field", label: "Kommentar" }),
      obj({ id: "foto", type: "attachments", label: "Foto" }),
    ],
  });

  it("bilde i repeater-rad rendres som merket kort under tabellen", () => {
    const rader = [{ kom: { verdi: "Sprekk" }, foto: { verdi: [bilde("IMG_4821.jpg")] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("ark-bilde-samling");
    expect(html).toContain("Bilde — punkt 1 (IMG_4821.jpg)");
    expect(html).toContain(`<img class="bilde-img" src="${DATA_URI}"`);
  });

  it("cellen dumper ALDRI data-URI-base64 (kun filnavn-referanse)", () => {
    const rader = [{ kom: { verdi: "Sprekk" }, foto: { verdi: [bilde("IMG_4821.jpg")] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    // <td> for foto-cellen viser filnavnet, ikke data-URI
    const cellerHtml = html.slice(html.indexOf("<tbody>"), html.indexOf("ark-bilde-samling"));
    expect(cellerHtml).not.toContain("data:image");
    expect(cellerHtml).toContain("IMG_4821.jpg");
  });

  it("radrekkefølge er forutsigbar — punkt 1 før punkt 2", () => {
    const rader = [
      { kom: { verdi: "A" }, foto: { verdi: [bilde("A.jpg")] } },
      { kom: { verdi: "B" }, foto: { verdi: [bilde("B.jpg", "data:image/jpeg;base64,BBBB")] } },
    ];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html.indexOf("Bilde — punkt 1 (A.jpg)")).toBeLessThan(html.indexOf("Bilde — punkt 2 (B.jpg)"));
  });

  it("bilde i celle-`vedlegg` (ikke bare `verdi`) samles også", () => {
    const rader = [{ kom: { verdi: "Sprekk", vedlegg: [bilde("V.jpg")] }, foto: { verdi: [] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Bilde — punkt 1 (V.jpg)");
  });

  it("repeater uten bilder → ingen bilde-samling", () => {
    const rader = [{ kom: { verdi: "Ingen foto" }, foto: { verdi: [] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).not.toContain("ark-bilde-samling");
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
