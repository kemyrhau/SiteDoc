import { describe, it, expect } from "vitest";
import { deflateRawSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import {
  ekstraherDocxChunks,
  erStøttetFiltype,
  pakkUtDocxTrygg,
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
 * Bygg en ZIP med ÉN deflate-entry. `komprimert` er de faktiske lagrede bytene;
 * `utpakketDeklarert` skrives i katalogen. En ekte zip-bombe LYVER her: den deklarerer en
 * liten utpakket størrelse mens den komprimerte strømmen ekspanderer til gigabyte. Vernet
 * ignorerer det deklarerte feltet og pakker ut selv med byte-budsjett, så løgnen fanges.
 */
function lagZipDeflate(navn: string, komprimert: Buffer, utpakketDeklarert: number): Buffer {
  const name = Buffer.from(navn, "utf-8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(komprimert.length, 18); // faktisk komprimert størrelse (til slicing)
  local.writeUInt32LE(utpakketDeklarert, 22); // LØGN: liten deklarert utpakket
  local.writeUInt16LE(name.length, 26);
  const localDel = Buffer.concat([local, name, komprimert]);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(8, 10); // deflate
  cd.writeUInt32LE(komprimert.length, 20);
  cd.writeUInt32LE(utpakketDeklarert, 24); // LØGN her også
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42); // local header offset
  const cdDel = Buffer.concat([cd, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdDel.length, 12);
  eocd.writeUInt32LE(localDel.length, 16);
  return Buffer.concat([localDel, cdDel, eocd]);
}

describe("DOCX zip-bomb-vern (RETUR 2 — faktisk utpakking med byte-budsjett)", () => {
  it("godtar en ekte, liten DOCX og gir en gyldig ren ZIP", async () => {
    const buffer = await lagDocx();
    const rent = pakkUtDocxTrygg(buffer);
    expect(rent.readUInt32LE(0)).toBe(0x04034b50); // ZIP-signatur
    // Den rene ZIP-en skal fortsatt la seg ekstrahere (mammoth leser STORED-entries).
    const chunks = await ekstraherDocxChunks(buffer);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("avviser en bombe som LYVER om utpakket størrelse (deklarerer 1 KB, ekspanderer 60 MB)", () => {
    // Deflate av 60 MB nuller → ~60 KB komprimert, men katalogen deklarerer bare 1 KB utpakket.
    // Vernet stoler ikke på deklarasjonen: faktisk utpakking sprenger budsjettet → avvist.
    const bombe = lagZipDeflate("word/document.xml", deflateRawSync(Buffer.alloc(60 * 1024 * 1024)), 1024);
    expect(() => pakkUtDocxTrygg(bombe)).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("avviser når flere entries til sammen sprenger budsjettet (50 MB)", () => {
    // Tre entries à ~20 MB utpakket = 60 MB totalt → den som krysser 50 MB avvises.
    const biter = Buffer.alloc(20 * 1024 * 1024);
    const name = (n: number) => `word/bomb${n}.xml`;
    // Bygg et flerfils-ZIP manuelt med tre deflate-entries.
    const komp = deflateRawSync(biter);
    const lokale: Buffer[] = [];
    const sentrale: Buffer[] = [];
    let off = 0;
    for (let i = 0; i < 3; i++) {
      const nm = Buffer.from(name(i), "utf-8");
      const lfh = Buffer.alloc(30);
      lfh.writeUInt32LE(0x04034b50, 0); lfh.writeUInt16LE(8, 8);
      lfh.writeUInt32LE(komp.length, 18); lfh.writeUInt32LE(biter.length, 22);
      lfh.writeUInt16LE(nm.length, 26);
      const ld = Buffer.concat([lfh, nm, komp]);
      lokale.push(ld);
      const cdh = Buffer.alloc(46);
      cdh.writeUInt32LE(0x02014b50, 0); cdh.writeUInt16LE(8, 10);
      cdh.writeUInt32LE(komp.length, 20); cdh.writeUInt32LE(biter.length, 24);
      cdh.writeUInt16LE(nm.length, 28); cdh.writeUInt32LE(off, 42);
      sentrale.push(Buffer.concat([cdh, nm]));
      off += ld.length;
    }
    const lb = Buffer.concat(lokale), sb = Buffer.concat(sentrale);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(3, 8); eocd.writeUInt16LE(3, 10);
    eocd.writeUInt32LE(sb.length, 12); eocd.writeUInt32LE(lb.length, 16);
    const bombe = Buffer.concat([lb, sb, eocd]);
    expect(() => pakkUtDocxTrygg(bombe)).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("avviser en korrupt deflate-strøm", () => {
    const bombe = lagZipDeflate("word/document.xml", randomBytes(500), 10_000);
    expect(() => pakkUtDocxTrygg(bombe)).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("avviser en fil som ikke er en lesbar ZIP", () => {
    expect(() => pakkUtDocxTrygg(randomBytes(500))).toThrow(DOCX_UGYLDIG_MELDING);
  });

  it("ekstraksjon kaster på en lyvende bombe FØR mammoth", async () => {
    const bombe = lagZipDeflate("word/document.xml", deflateRawSync(Buffer.alloc(60 * 1024 * 1024)), 1024);
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
