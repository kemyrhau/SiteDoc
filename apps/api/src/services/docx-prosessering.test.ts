import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import {
  ekstraherDocxChunks,
  erStøttetFiltype,
  sjekkDocxTrygg,
  DOCX_UGYLDIG_MELDING,
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

/**
 * Bygg en minimal, strukturelt gyldig ZIP med ÉN entry. `komprimert` er de faktiske
 * lagrede bytene; `utpakketDeklarert` skrives i katalogen (en zip-bombe deklarerer en
 * langt større utpakket størrelse enn de komprimerte bytene). CRC settes 0 — vernet leser
 * kun størrelsene fra central directory og avviser FØR noen dekomprimering.
 */
function lagZip(navn: string, komprimert: Buffer, utpakketDeklarert: number): Buffer {
  const name = Buffer.from(navn, "utf-8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(komprimert.length, 18);
  local.writeUInt32LE(utpakketDeklarert, 22);
  local.writeUInt16LE(name.length, 26);
  const localDel = Buffer.concat([local, name, komprimert]);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(8, 10); // deflate
  cd.writeUInt32LE(komprimert.length, 20);
  cd.writeUInt32LE(utpakketDeklarert, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42); // local header offset
  const cdDel = Buffer.concat([cd, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); // entries på disken
  eocd.writeUInt16LE(1, 10); // entries totalt
  eocd.writeUInt32LE(cdDel.length, 12);
  eocd.writeUInt32LE(localDel.length, 16); // central-dir-offset
  return Buffer.concat([localDel, cdDel, eocd]);
}

describe("DOCX zip-bomb-vern (RETUR 1 R2)", () => {
  it("godtar en ekte, liten DOCX", async () => {
    const buffer = await lagDocx();
    expect(() => sjekkDocxTrygg(buffer)).not.toThrow();
  });

  it("avviser for stor UTPAKKET total (> 50 MB)", () => {
    // ~1 MB komprimert, deklarert 60 MB utpakket → forhold ~60:1 (< 100), men over 50 MB.
    const bombe = lagZip("word/document.xml", deflateRawSync(randomBytes(1024 * 1024)), 60 * 1024 * 1024);
    expect(() => sjekkDocxTrygg(bombe)).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("avviser for høyt kompresjonsforhold (> 100:1)", () => {
    // Noen få komprimerte byte, deklarert 10 MB utpakket → forhold enormt, men under 50 MB.
    const bombe = lagZip("word/document.xml", deflateRawSync(Buffer.from("x")), 10 * 1024 * 1024);
    expect(() => sjekkDocxTrygg(bombe)).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("avviser en fil som ikke er en lesbar ZIP", () => {
    expect(() => sjekkDocxTrygg(randomBytes(500))).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("ekstraksjon kaster på en zip-bombe (FØR mammoth)", async () => {
    const bombe = lagZip("word/document.xml", deflateRawSync(Buffer.from("x")), 10 * 1024 * 1024);
    await expect(ekstraherDocxChunks(bombe)).rejects.toThrow(DOCX_UGYLDIG_MELDING);
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
