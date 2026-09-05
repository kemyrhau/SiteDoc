import { describe, it, expect } from "vitest";
import { harFeltVerdi, beregnLaasteFelter, erUtfyllbartFelt, harMinstEttUtfyltFelt } from "./feltLaasing";

describe("harFeltVerdi", () => {
  it("returnerer false for tomme verdier", () => {
    expect(harFeltVerdi(null)).toBe(false);
    expect(harFeltVerdi(undefined)).toBe(false);
    expect(harFeltVerdi("")).toBe(false);
    expect(harFeltVerdi([])).toBe(false);
    expect(harFeltVerdi({})).toBe(false); // tomt objekt → ingen verdi
  });

  it("returnerer true for reelle verdier", () => {
    expect(harFeltVerdi("OK")).toBe(true);
    expect(harFeltVerdi(0)).toBe(true); // tallet 0 er en reell verdi
    expect(harFeltVerdi(false)).toBe(true); // boolean false er en reell verdi
    expect(harFeltVerdi(["a"])).toBe(true);
    expect(harFeltVerdi({ nested: 1 })).toBe(true);
  });
});

describe("erUtfyllbartFelt", () => {
  it("rene visnings-/instruksjonstyper er IKKE svar-felt (konsolidert 2026-09-06)", () => {
    for (const t of ["heading", "subtitle", "location", "drawing_position", "calculation", "info_text", "info_image", "video"]) {
      expect(erUtfyllbartFelt(t)).toBe(false);
    }
  });

  it("faktiske svar-felt er utfyllbare — inkl. quiz (bærer svar)", () => {
    for (const t of ["text_field", "list_single", "traffic_light", "integer", "signature", "quiz"]) {
      expect(erUtfyllbartFelt(t)).toBe(true);
    }
  });
});

describe("harMinstEttUtfyltFelt (P2-guard)", () => {
  it("mal med KUN infofelt har ingen svar-felt → regnes som utfylt (kan sendes)", () => {
    // Konsolideringen: info_text/info_image/video er ikke svar-felt, så et rent
    // informasjonsdokument blokkeres ikke lenger av tom-besvarelse-guarden.
    const felter = [{ id: "h", type: "heading" }, { id: "i", type: "info_text" }, { id: "v", type: "video" }];
    expect(harMinstEttUtfyltFelt(felter, {})).toBe(true);
  });

  it("mal med et svar-felt krever fortsatt minst ett besvart", () => {
    const felter = [{ id: "i", type: "info_text" }, { id: "t", type: "text_field" }];
    expect(harMinstEttUtfyltFelt(felter, {})).toBe(false);
    expect(harMinstEttUtfyltFelt(felter, { t: { verdi: "svar" } })).toBe(true);
  });
});

describe("beregnLaasteFelter", () => {
  it("låser kun felt med reell server-verdi", () => {
    const data: Record<string, { verdi?: unknown; kommentar?: string }> = {
      a: { verdi: "OK" },
      b: { verdi: "" }, // tom → ikke låst
      c: { verdi: null }, // null → ikke låst
      d: { verdi: [] }, // tom array → ikke låst
      e: { verdi: ["valgt"] },
      f: { kommentar: "kun kommentar" }, // ingen verdi → ikke låst
    };
    const laaste = beregnLaasteFelter(data);
    expect([...laaste].sort()).toEqual(["a", "e"]);
  });

  it("returnerer tomt sett for tom/manglende data", () => {
    expect(beregnLaasteFelter(null).size).toBe(0);
    expect(beregnLaasteFelter(undefined).size).toBe(0);
    expect(beregnLaasteFelter({}).size).toBe(0);
  });
});
