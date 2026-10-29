import { describe, it, expect } from "vitest";
import { byggUtsnitt, posisjonsEtikett, ELLIPSE, HL_START, HL_STOP, type UtsnittDel } from "../utsnitt";

/**
 * SØK-1 S2/S5 (dokumentsok-visning-spec § 6): T3 (B1/B2 vindu + ellipse, samme funksjon begge moduser),
 * T4 (B3 side XOR avsnitt, overskrift ikke gjentatt; B4 kort chunk uten ellipse), T8 (E1/E2).
 * Rød før: utsnittet var `(utdrag ?? chunkText).slice(0, 240)` i treff-liste.tsx og fantes ikke som funksjon.
 */

const tekst = (d: UtsnittDel[]) => d.map((x) => x.tekst).join("");
const av = (d: UtsnittDel[], type: UtsnittDel["type"]) => d.filter((x) => x.type === type).map((x) => x.tekst);

// ~70 ord, «dagmulkt» langt ute (etter 240 tegn) — som side 2 i tilbud-kontrakt-b12.pdf.
const LANG =
  "Kontrakten gjelder grunnarbeider, betong og tømrerarbeid for bygg 12. Det tas forbehold om fjell i byggegropa, " +
  "forurensede masser og kabler som ikke er påvist. Arbeidet skal utføres i henhold til tegninger og beskrivelse, " +
  "og entreprenøren skal holde byggeplassen ryddig. Ferdigstillelse skal skje innen avtalt dato. " +
  "Ved forsinkelse påløper dagmulkt på 1 promille av kontraktssummen pr. kalenderdag. " +
  "Sluttoppgjør skjer etter NS 8405 med de endringer som følger av denne kontrakten og vedleggene til den, " +
  "inkludert tilbudsbrev, prisskjema, fremdriftsplan og SHA-plan for prosjektet.";

describe("T3 — vindu rundt treffet med ellipse, samme funksjon i begge moduser", () => {
  it("B1 AI-søk (ingen server-headline): «dagmulkt» står i utsnittet, markert, «…» i begge ender", () => {
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "dagmulkt", metode: "tekst" });
    expect(av(d, "treff")).toEqual(["dagmulkt"]);
    expect(tekst(d).startsWith(ELLIPSE)).toBe(true);
    expect(tekst(d).endsWith(ELLIPSE)).toBe(true);
    // Ikke de første 240 tegnene (S-M4)
    expect(tekst(d)).not.toContain(LANG.slice(0, 60));
  });

  it("B2 Tekstsøk (server-headline) går gjennom samme funksjon og får ellipse der den er kuttet", () => {
    const headline = `Ved forsinkelse påløper ${HL_START}dagmulkt${HL_STOP} på 1 promille av kontraktssummen pr. kalenderdag.`;
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "dagmulkt", utdrag: headline, metode: "tekst" });
    expect(av(d, "treff")).toEqual(["dagmulkt"]);
    expect(tekst(d).startsWith(ELLIPSE)).toBe(true);
    expect(tekst(d).endsWith(ELLIPSE)).toBe(true);
  });

  it("B4 kort chunk → ingen «…»", () => {
    const d = byggUtsnitt({ chunkText: "Dagmulkt er avtalt.", søkeord: "dagmulkt", metode: "tekst" });
    expect(tekst(d)).toBe("Dagmulkt er avtalt.");
    expect(av(d, "treff")).toEqual(["Dagmulkt"]);
  });

  it("ingen treff i teksten → starten (≤ 240 tegn) + «…»", () => {
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "vernerunde", metode: "begge" });
    expect(tekst(d).endsWith(ELLIPSE)).toBe(true);
    expect(tekst(d).length).toBeLessThanOrEqual(240 + 2);
  });
});

describe("T4 — etikett side XOR avsnitt, overskrift ikke gjentatt", () => {
  it("PDF: «side 2», aldri avsnitt", () => {
    expect(posisjonsEtikett(2, 5)).toEqual({ type: "side", nr: 2 });
  });

  it("DOCX (ingen sidetall): «avsnitt 4» (1-indeksert)", () => {
    expect(posisjonsEtikett(null, 3)).toEqual({ type: "avsnitt", nr: 4 });
    expect(posisjonsEtikett(0, 3)).toEqual({ type: "avsnitt", nr: 4 });
  });

  it("B3: «3. Frostsikring» er etikett og fjernes fra starten av utsnittet — ordet markeres ikke to ganger på rad", () => {
    const d = byggUtsnitt({
      chunkText: "3. Frostsikring\nFrostsikring av grunnmur utføres med XPS-plater.",
      søkeord: "frostsikring",
      sectionTitle: "3. Frostsikring",
      metode: "tekst",
    });
    expect(tekst(d)).toBe("Frostsikring av grunnmur utføres med XPS-plater.");
    expect(av(d, "treff")).toEqual(["Frostsikring"]);
  });

  it("B3 også når overskriften står først i server-headline", () => {
    const d = byggUtsnitt({
      chunkText: "3. Frostsikring\nFrostsikring av grunnmur utføres med XPS-plater.",
      søkeord: "frostsikring",
      utdrag: `3. ${HL_START}Frostsikring${HL_STOP}\n${HL_START}Frostsikring${HL_STOP} av grunnmur utføres med XPS-plater.`,
      sectionTitle: "3. Frostsikring",
      metode: "tekst",
    });
    expect(av(d, "treff")).toEqual(["Frostsikring"]);
    expect(tekst(d).startsWith("Frostsikring av")).toBe(true);
  });
});

describe("T8 — semantisk treff markerer setningen, «begge» får gult", () => {
  const SETNING = "Ved forsinkelse påløper dagmulkt på 1 promille av kontraktssummen pr. kalenderdag.";

  it("E1: «bot ved forsinkelse» → setningen markert semantisk, ingen gul markering", () => {
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "bot ved forsinkelse", semantiskSetning: SETNING, metode: "semantisk" });
    expect(av(d, "semantisk")).toEqual([SETNING]);
    expect(av(d, "treff")).toEqual([]);
  });

  it("semantisk uten setning → starten av chunken, ingen markering", () => {
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "bot ved forsinkelse", semantiskSetning: null, metode: "semantisk" });
    expect(av(d, "semantisk")).toEqual([]);
    expect(av(d, "treff")).toEqual([]);
    expect(tekst(d).startsWith("Kontrakten gjelder")).toBe(true);
  });

  it("E2: «begge» → gult, aldri semantisk stil (selv om en setning skulle følge med)", () => {
    const d = byggUtsnitt({ chunkText: LANG, søkeord: "dagmulkt", semantiskSetning: SETNING, metode: "begge" });
    expect(av(d, "treff")).toEqual(["dagmulkt"]);
    expect(av(d, "semantisk")).toEqual([]);
  });
});
