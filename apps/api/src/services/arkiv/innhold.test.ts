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

describe("repeater-bilder — full bredde rett under sin egen rad (vedtak 2026-08-15)", () => {
  const DATA_URI = "data:image/jpeg;base64,AAAA";
  const bilde = (filnavn: string, url = DATA_URI, opprettet?: string) => ({ id: filnavn, type: "bilde", url, filnavn, opprettet });

  const repeaterMedBilder = obj({
    id: "r1",
    type: "repeater",
    label: "Kontrollpunkter",
    children: [
      obj({ id: "kom", type: "text_field", label: "Kommentar" }),
      obj({ id: "foto", type: "attachments", label: "Foto" }),
    ],
  });

  it("bilde rendres i egen bilderad med løpenr + filnavn, ikke «punkt N»", () => {
    const rader = [{ kom: { verdi: "Sprekk" }, foto: { verdi: [bilde("IMG_4821.jpg")] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("ark-bilde-rad");
    expect(html).toContain("ark-bilde-grid");
    expect(html).toContain("Bilde 01 — IMG_4821.jpg");
    expect(html).not.toContain("punkt 1"); // kryssreferansen utgår
    expect(html).toContain(`<img class="ark-bilde-img" src="${DATA_URI}"`);
  });

  it("tidsstempel vises når `opprettet` finnes, utelates ellers", () => {
    const medTid = [{ kom: { verdi: "A" }, foto: { verdi: [bilde("A.jpg", DATA_URI, "2026-08-07T09:41:00Z")] } }];
    const htmlTid = byggInnhold([repeaterMedBilder], { r1: { verdi: medTid, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(htmlTid).toMatch(/Bilde 01 — A\.jpg · 07\.08\.2026/);

    const utenTid = [{ kom: { verdi: "A" }, foto: { verdi: [bilde("A.jpg")] } }];
    const htmlUten = byggInnhold([repeaterMedBilder], { r1: { verdi: utenTid, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(htmlUten).toContain("Bilde 01 — A.jpg");
    expect(htmlUten).not.toContain("·");
  });

  it("cellen dumper ALDRI data-URI, og gjentar IKKE filnavn (kryssreferanse fjernet)", () => {
    const rader = [{ kom: { verdi: "Sprekk" }, foto: { verdi: [bilde("IMG_4821.jpg")] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    // <td> for foto-cellen viser antall vedlegg, aldri data-URI eller filnavn
    const cellerHtml = html.slice(html.indexOf("<tbody>"), html.indexOf("ark-bilde-rad"));
    expect(cellerHtml).not.toContain("data:image");
    expect(cellerHtml).not.toContain("IMG_4821.jpg");
    expect(cellerHtml).toContain("1 vedlegg");
  });

  it("løpenr fortsetter gjennom dokumentet — 01 før 02", () => {
    const rader = [
      { kom: { verdi: "A" }, foto: { verdi: [bilde("A.jpg")] } },
      { kom: { verdi: "B" }, foto: { verdi: [bilde("B.jpg", "data:image/jpeg;base64,BBBB")] } },
    ];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html.indexOf("Bilde 01 — A.jpg")).toBeLessThan(html.indexOf("Bilde 02 — B.jpg"));
  });

  it("bilde i celle-`vedlegg` (ikke bare `verdi`) samles også", () => {
    const rader = [{ kom: { verdi: "Sprekk", vedlegg: [bilde("V.jpg")] }, foto: { verdi: [] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).toContain("Bilde 01 — V.jpg");
  });

  it("repeater uten bilder → ingen bilderad", () => {
    const rader = [{ kom: { verdi: "Ingen foto" }, foto: { verdi: [] } }];
    const html = byggInnhold([repeaterMedBilder], { r1: { verdi: rader, kommentar: "", vedlegg: [] } }, cfg(true));
    expect(html).not.toContain("ark-bilde-rad");
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
