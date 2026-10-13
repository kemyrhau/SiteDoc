import { describe, it, expect } from "vitest";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import {
  ekstraherDocxChunks,
  erStøttetFiltype,
} from "./ftd-prosessering";

/**
 * Prod 2026-10-13 (UNN-prosjektet): DOCX-dokumenter ble markert `completed` med 0 chunks
 * fordi `.docx` manglet i filtype-dispatchen og falt til «ukjent filtype». Ingen søketreff.
 * Denne testen dekker:
 *  - DOCX gir søkbare chunks med riktig overskrift (sectionTitle/sectionLevel).
 *  - Gammelt/ukjent format regnes IKKE som støttet (skal gi synlig «ikke støttet»-status).
 */

async function lagDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Kontrollplan for grunnarbeid", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Komprimering av masser skal dokumenteres per lag." }),
          new Paragraph({ text: "Avvik registreres som RUH i SiteDoc." }),
          new Paragraph({ text: "Utførelse", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: "Komprimeringsgrad måles med platebelastning." }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("DOCX-ekstraksjon", () => {
  it("gir minst én chunk med riktig overskrift og nivå", async () => {
    const buffer = await lagDocx();
    const chunks = await ekstraherDocxChunks(buffer);

    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const h1 = chunks.find((c) => c.sectionTitle === "Kontrollplan for grunnarbeid");
    expect(h1).toBeDefined();
    expect(h1!.sectionLevel).toBe(1);
    expect(h1!.chunkText).toContain("Komprimering av masser");

    const h2 = chunks.find((c) => c.sectionTitle === "Utførelse");
    expect(h2).toBeDefined();
    expect(h2!.sectionLevel).toBe(2);
    expect(h2!.chunkText).toContain("platebelastning");
  });

  it("har sammenhengende chunkIndex fra 0", async () => {
    const buffer = await lagDocx();
    const chunks = await ekstraherDocxChunks(buffer);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });
});

describe("Filtype-støtte (synlig status for ikke-støttet)", () => {
  it("regner .docx som støttet", () => {
    expect(erStøttetFiltype(".docx")).toBe(true);
    expect(erStøttetFiltype(".DOCX")).toBe(true);
    expect(erStøttetFiltype(".pdf")).toBe(true);
  });

  it("regner gammelt .doc og ukjent format som IKKE støttet", () => {
    expect(erStøttetFiltype(".doc")).toBe(false);
    expect(erStøttetFiltype(".rtf")).toBe(false);
    expect(erStøttetFiltype(".pages")).toBe(false);
  });
});
