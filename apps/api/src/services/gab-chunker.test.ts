import { describe, it, expect } from "vitest";
import { byggGabChunker, erMalSegment, rensGabPostLegacy, rensGabSegment } from "./gab-chunker";

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

  it("låsetest R1: post-beskrivelsen renses byte for byte som før (\\par og \\tab blir mellomrom)", () => {
    // Kontrollør-gate 2 (29.10): post-veien skal ikke endre atferd. Gammel kjede strippet \n og \t
    // fra \par/\tab og lot mellomrommet etter kontrollordet stå. Chunk-rensingen beholder linjeskiftet.
    const seg = "Graving av grøft\\par Dybde 1,2 m\\tab ca.";
    expect(rensGabPostLegacy(seg)).toBe("Graving av grøft Dybde 1,2 m ca.");
    expect(rensGabSegment(seg)).toBe("Graving av grøft\nDybde 1,2 m\tca.");
    // Samme forkastingsregler som før
    expect(rensGabPostLegacy(GUID)).toBeNull();
    expect(rensGabPostLegacy(RTF_BLOKK)).toBeNull();
    expect(rensGabPostLegacy("— | |")).toBeNull();
  });

  it("lange tekster deles i flere chunker, ingen over 5000 tegn", () => {
    const lang = Array.from({ length: 80 }, (_, i) => `Post ${i}: Levering og montering av rekkverk type A.`).join("\x00");
    const chunker = byggGabChunker(lang);
    expect(chunker.length).toBeGreaterThan(1);
    for (const c of chunker) expect(c.length).toBeLessThanOrEqual(5000);
    expect(chunker.join("")).toContain("Post 79:");
  });
});

/**
 * Rens 2 (relay 30.10, Kenneth «Ja, 1 og 2»). Målt i «Storgata nord.gab» på test (1037 chunker):
 * «03Q» 1134 ganger (330 linjer alene, ellers linjeslutt — også rett etter siffer: «Tilstandsklasse 203Q»),
 * «From CodeItem» 256 hele linjer, plassholdere «[[DATO]]»/«[[TOTAL_SUM]]», ensom «[», opptil 11 linjeskift
 * på rad, og forsiden «DEL III - Mengdebeskrivelse / Storgata nord / Tromsø kommune» limt inn i siste post
 * (chunk 1036). Rød før: alt dette stod i chunk-teksten.
 */
const MAL_SEGMENT =
  "[\\par\\par DEL III - Mengdebeskrivelse\\par Storgata nord\\par\\par\\par \\par\\par\\par Tromsø kommune\\par\\par\\par\\par [[DATO]]";

/** Halen av Storgata nord modellert som null-skilte segmenter (antatte segmentgrenser, se gab-chunker.ts). */
function lagHale(): string[] {
  return [
    'a)\\tab Omfang og prisgrunnlag\\par\\par Post omfatter gatevarmneanlegg (teknisk rom og utendørs anlegg)\\par\\par - Komplett FDV-dokumentasjon.\\par - Grunnlag for "som bygget"-tegninger. \x0603Q¬\x84',
    "Teknisk rom03Q",
    "From CodeItem",
    MAL_SEGMENT,
    "\x0603Q¬\x84",
  ];
}

describe("Rens 2 — 03Q, From CodeItem, plassholdere, klammer, linjeskift, mal-segment", () => {
  it("«03Q» strippes ved linjeslutt — også uten mellomrom og rett etter siffer (tallet står)", () => {
    expect(rensGabSegment('- Grunnlag for "som bygget"-tegninger. \x0603Q¬\x84')).toBe('- Grunnlag for "som bygget"-tegninger.');
    expect(rensGabSegment("Teknisk rom03Q")).toBe("Teknisk rom");
    expect(rensGabSegment("Tilstandsklasse 203Q")).toBe("Tilstandsklasse 2");
  });

  it("linjer som bare er «03Q» fjernes helt, segment som bare er «03Q» forkastes", () => {
    expect(rensGabSegment("Teknisk rom\\par 03Q\\par Utendørs anlegg")).toBe("Teknisk rom\nUtendørs anlegg");
    expect(rensGabSegment("\x0603Q¬\x84")).toBeNull();
  });

  it("«From CodeItem» droppes som egen linje og som eget segment", () => {
    expect(rensGabSegment("From CodeItem")).toBeNull();
    expect(rensGabSegment("From CodeItem\\par Graving av grøft")).toBe("Graving av grøft");
  });

  it("enkeltstående klammer og [[PLASSHOLDERE]] droppes, ≥3 linjeskift blir 2", () => {
    expect(rensGabSegment(MAL_SEGMENT)).toBe("DEL III - Mengdebeskrivelse\nStorgata nord\n\nTromsø kommune");
    expect(rensGabSegment("]")).toBeNull();
    const inline = rensGabSegment("Sum eks. mva [[TOTAL_SUM]] og avgift [[TOTAL_AVGIFT]] kr");
    expect(inline).not.toContain("[[");
    expect(inline).toContain("Sum eks. mva");
    expect(inline).toContain("og avgift");
  });

  it("negativkontroll: ekte tekst med «03», «03Q» midt i linje, små klammer og «Tromsø kommune» røres ikke", () => {
    const ekte = "kap. 03 Grøfter, Post 103 Graving og kode 03QA, se [1] og [[tabell]] for Tromsø kommune";
    expect(rensGabSegment(ekte)).toBe(ekte);
    expect(rensGabSegment("Kode 03Q4 gjelder")).toBe("Kode 03Q4 gjelder");
    expect(rensGabSegment("Leveres til Tromsø kommune\\par\\par Avtalt pris.")).toBe("Leveres til Tromsø kommune\n\nAvtalt pris.");
    // Binærsøppel med «[[» uten store bokstaver er ikke plassholder (og forkastes uansett — ingen ord)
    expect(rensGabSegment("[[\x01\x02]]")).toBeNull();
  });

  it("låsetest R1 står: post-rensingen (`rensGabPostLegacy`) får ingen av de nye reglene", () => {
    expect(rensGabPostLegacy("Teknisk rom03Q")).toBe("Teknisk rom03Q");
    expect(rensGabPostLegacy("From CodeItem")).toBe("From CodeItem");
    expect(rensGabPostLegacy("Tromsø kommune [[DATO]]")).toBe("Tromsø kommune [[DATO]]");
  });

  it("mal-/forsidesegment blir egen chunk — limes ikke inn i siste post, og neste post starter ny", () => {
    expect(erMalSegment(MAL_SEGMENT)).toBe(true);
    expect(erMalSegment("Post uten plassholder [[tabell]]")).toBe(false);
    const tekst = ["Post A: graving av grøft", "Post B: fylling av masser", MAL_SEGMENT, "Post C: asfaltering"].join("\x00");
    expect(byggGabChunker(tekst)).toEqual([
      "Post A: graving av grøft\nPost B: fylling av masser\n",
      "DEL III - Mengdebeskrivelse\nStorgata nord\n\nTromsø kommune\n",
      "Post C: asfaltering\n",
    ]);
  });

  it("halen av Storgata nord (chunk 1036) kommer ut uten støy", () => {
    const chunker = byggGabChunker(lagHale().join("\x00"));
    const alt = chunker.join("");
    expect(alt).not.toContain("03Q");
    expect(alt).not.toContain("From CodeItem");
    expect(alt).not.toContain("[[");
    expect(alt).not.toMatch(/^\[$/m);
    expect(alt).not.toMatch(/\n{3,}/);
    expect(alt).toContain('- Grunnlag for "som bygget"-tegninger.\n');
    expect(alt).toContain("Teknisk rom\n");
    expect(chunker).toEqual([
      'a)\tOmfang og prisgrunnlag\n\nPost omfatter gatevarmneanlegg (teknisk rom og utendørs anlegg)\n\n- Komplett FDV-dokumentasjon.\n- Grunnlag for "som bygget"-tegninger.\nTeknisk rom\n',
      "DEL III - Mengdebeskrivelse\nStorgata nord\n\nTromsø kommune\n",
    ]);
  });
});
