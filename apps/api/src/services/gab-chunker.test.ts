import { describe, it, expect } from "vitest";
import { byggGabChunker, rensGabSegment } from "./gab-chunker";

/**
 * F2 (relay 29.10, Røstbakken «2025.04.03 - Storgata nord.gab»): chunk-sløyfen i `prosesserGab`
 * lagret rå RTF-blokker, GUID-er og tusentegns kontrollord-rekker (målt: 1288 av 2228 chunker med
 * `\rtf`, 1160 med GUID, linjer på 5000 tegn uten mellomrom). Post-rensingen (ekstraTekst) hoppet
 * over nettopp dette. Chunkene skal bygges av samme rensing.
 * Rød før: `byggGabChunker` fantes ikke; sløyfen fjernet bare \x00–\x1f.
 */

const RTF_BLOKK =
  "{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}\\pard a)\\tab Omfang og prisgrunnlag\\par }";
const GUID = "$d4c03e4e-d23e-41b3-aae6-5d901cbc5d54Z01.03.6 - AM3.116A";
const KONTROLLORD_REKKE = "\\pard\\plain\\f1\\fs20" + "\\tx426".repeat(300); // > 1000 tegn uten mellomrom

function lagGabTekst(): string {
  return [
    "01.03.6 - AM3.116A DRIFT AV ADKOMST",
    GUID,
    RTF_BLOKK,
    KONTROLLORD_REKKE,
    "a) Omfang og prisgrunnlag\\par Utarbeidelse av midlertidig skiltplan inkluderes.",
    "\x02RS\x03",
    "— | |",
    "\x0603Q¬,",
  ].join("\x00");
}

describe("F2 — gab-chunker bygges av renset tekst", () => {
  it("chunkene inneholder lesbar posttekst, men ikke RTF, GUID eller kontrollord-rekker", () => {
    const chunker = byggGabChunker(lagGabTekst());
    const alt = chunker.join("\n");
    expect(alt).toContain("DRIFT AV ADKOMST");
    expect(alt).toContain("Omfang og prisgrunnlag");
    expect(alt).toContain("Utarbeidelse av midlertidig skiltplan inkluderes.");
    expect(alt).not.toMatch(/\{\\rtf/);
    expect(alt).not.toMatch(/\\par\b|\\tx\d+|\\pard/);
    expect(alt).not.toContain("d4c03e4e-d23e-41b3-aae6-5d901cbc5d54");
    expect(alt).not.toMatch(/\S{1000,}/);
    // Kortere binær-rester («— | |», «03Q¬,») gir ingen egen chunk-linje
    expect(alt).not.toContain("— | |");
    expect(alt).not.toContain("03Q¬");
  });

  it("\\par blir linjeskift og \\'xx blir tegn, som i post-rensingen", () => {
    expect(rensGabSegment("Omfang\\par Pris\\'e6r")).toBe("Omfang\nPrisær");
  });

  it("segmenter uten to bokstaver på rad forkastes", () => {
    expect(rensGabSegment("— | |")).toBeNull();
    expect(rensGabSegment("12 34")).toBeNull();
    expect(rensGabSegment(GUID)).toBeNull();
    expect(rensGabSegment(RTF_BLOKK)).toBeNull();
  });

  it("lange tekster deles i flere chunker, ingen over 5000 tegn", () => {
    const lang = Array.from({ length: 80 }, (_, i) => `Post ${i}: Levering og montering av rekkverk type A.`).join("\x00");
    const chunker = byggGabChunker(lang);
    expect(chunker.length).toBeGreaterThan(1);
    for (const c of chunker) expect(c.length).toBeLessThanOrEqual(5000);
    expect(chunker.join("")).toContain("Post 79:");
  });
});
