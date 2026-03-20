/**
 * LAS Header Parser
 *
 * Leser LAS-filhode for å detektere:
 * - Antall punkter
 * - Bounding box
 * - Punkt-format (har RGB? har klassifisering?)
 * - LAS-versjon
 *
 * Ref: ASPRS LAS 1.2–1.4 Specification
 */

import { open } from "fs/promises";

/** ASPRS standard klassifiseringskoder */
export const KLASSIFISERINGSNAVN: Record<number, string> = {
  0: "Aldri klassifisert",
  1: "Uklassifisert",
  2: "Bakke",
  3: "Lav vegetasjon",
  4: "Middels vegetasjon",
  5: "Høy vegetasjon",
  6: "Bygning",
  7: "Støy (lav)",
  8: "Modell-nøkkelpunkt",
  9: "Vann",
  10: "Jernbane",
  11: "Veioverflate",
  12: "Overlappende punkter",
  13: "Ledning (vern)",
  14: "Ledning (leder)",
  15: "Sendemast",
  16: "Ledningskobling",
  17: "Bro",
  18: "Støy (høy)",
};

export interface LasInfo {
  versjon: string;          // "1.2", "1.4" etc.
  punktFormat: number;       // Point Data Record Format
  punktAntall: number;
  harRgb: boolean;
  harKlassifisering: boolean;
  klassifiseringer: { kode: number; navn: string; antall: number }[];
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

/**
 * Punkt-formater som har RGB-data
 * Format 2, 3, 5, 7, 8, 10 har RGB
 */
const FORMAT_MED_RGB = new Set([2, 3, 5, 7, 8, 10]);

/**
 * Punkt-record størrelse per format (bytes)
 * Brukes for å vite offset til klassifisering og andre felter
 */
const PUNKT_STØRRELSE: Record<number, number> = {
  0: 20, 1: 28, 2: 26, 3: 34, 4: 57, 5: 63,
  6: 30, 7: 36, 8: 38, 9: 59, 10: 67,
};

/** Offset til klassifiseringsbyte innenfor punkt-record */
function klassifiseringsOffset(format: number): number {
  // Format 0-5: byte 15 (classification)
  // Format 6-10: byte 16 (classification)
  return format >= 6 ? 16 : 15;
}

/**
 * Les LAS-header og sample punkter for klassifiseringsstatistikk.
 * Leser kun header + et utvalg av punkter for ytelse.
 */
export async function lesLasInfo(filsti: string): Promise<LasInfo> {
  const fh = await open(filsti, "r");

  try {
    // Les header (375 bytes er nok for LAS 1.4)
    const headerBuf = Buffer.alloc(375);
    await fh.read(headerBuf, 0, 375, 0);

    // Signatur
    const signatur = headerBuf.toString("ascii", 0, 4);
    if (signatur !== "LASF") {
      throw new Error(`Ugyldig LAS-fil: signatur "${signatur}" (forventet "LASF")`);
    }

    const versjonMajor = headerBuf.readUInt8(24);
    const versjonMinor = headerBuf.readUInt8(25);
    const versjon = `${versjonMajor}.${versjonMinor}`;

    const offsetTilPunkter = headerBuf.readUInt32LE(96);
    const punktFormat = headerBuf.readUInt8(104) & 0x3f; // Bit 0-5

    const punktStørrelse = headerBuf.readUInt16LE(105);

    // Antall punkter: LAS 1.4 bruker 64-bit felt
    let punktAntall: number;
    if (versjonMinor >= 4) {
      // Offset 247: Number of point records (64-bit)
      punktAntall = Number(headerBuf.readBigUInt64LE(247));
    } else {
      punktAntall = headerBuf.readUInt32LE(107);
    }

    // Bounding box
    const boundingBox = {
      max: {
        x: headerBuf.readDoubleLE(187),
        y: headerBuf.readDoubleLE(195),
        z: headerBuf.readDoubleLE(203),
      },
      min: {
        x: headerBuf.readDoubleLE(171),
        y: headerBuf.readDoubleLE(179),
        z: headerBuf.readDoubleLE(211),
      },
    };

    // Korriger rekkefølge: LAS spec er maxX, minX, maxY, minY, maxZ, minZ
    // Offset 187: maxX, 195: minX, 203: maxY, 211: minY, 219: maxZ, 227: minZ
    // La meg re-lese korrekt
    const bbox = {
      min: {
        x: headerBuf.readDoubleLE(195),
        y: headerBuf.readDoubleLE(211),
        z: headerBuf.readDoubleLE(227),
      },
      max: {
        x: headerBuf.readDoubleLE(187),
        y: headerBuf.readDoubleLE(203),
        z: headerBuf.readDoubleLE(219),
      },
    };

    const harRgb = FORMAT_MED_RGB.has(punktFormat);

    // Sample punkter for klassifiseringsstatistikk
    const maksAntallSamples = Math.min(punktAntall, 100_000);
    const stegStørrelse = Math.max(1, Math.floor(punktAntall / maksAntallSamples));
    const faktiskPunktStørrelse = punktStørrelse || PUNKT_STØRRELSE[punktFormat] || 20;
    const klassOffset = klassifiseringsOffset(punktFormat);

    // Les punktdata i blokker
    const klasseTelling = new Map<number, number>();
    const blokkStørrelse = Math.min(maksAntallSamples, 10000) * faktiskPunktStørrelse;
    const blokkBuf = Buffer.alloc(blokkStørrelse);

    let sampletPunkter = 0;
    let punktIdx = 0;

    while (sampletPunkter < maksAntallSamples && punktIdx < punktAntall) {
      const posisjon = offsetTilPunkter + punktIdx * faktiskPunktStørrelse;
      const antallIBlokk = Math.min(
        Math.floor(blokkStørrelse / faktiskPunktStørrelse),
        Math.ceil((punktAntall - punktIdx) / stegStørrelse),
      );
      const bytesÅLese = antallIBlokk * faktiskPunktStørrelse;

      const { bytesRead } = await fh.read(blokkBuf, 0, bytesÅLese, posisjon);
      if (bytesRead === 0) break;

      const antallLest = Math.floor(bytesRead / faktiskPunktStørrelse);
      for (let i = 0; i < antallLest && sampletPunkter < maksAntallSamples; i++) {
        const klasse = blokkBuf.readUInt8(i * faktiskPunktStørrelse + klassOffset);
        klasseTelling.set(klasse, (klasseTelling.get(klasse) ?? 0) + 1);
        sampletPunkter++;
      }

      punktIdx += antallIBlokk * stegStørrelse;
    }

    // Skaler opp tellingen til estimert totalt antall
    const skalafaktor = punktAntall / (sampletPunkter || 1);
    const klassifiseringer = Array.from(klasseTelling.entries())
      .map(([kode, antall]) => ({
        kode,
        navn: KLASSIFISERINGSNAVN[kode] ?? `Klasse ${kode}`,
        antall: Math.round(antall * skalafaktor),
      }))
      .sort((a, b) => a.kode - b.kode);

    // Sjekk om filen har meningsfull klassifisering
    // (ikke bare kode 0 og/eller 1, som betyr "uklassifisert")
    const uklassifiserteKoder = new Set([0, 1]);
    const harKlassifisering = klassifiseringer.some(
      (k) => !uklassifiserteKoder.has(k.kode) && k.antall > 0,
    );

    return {
      versjon,
      punktFormat,
      punktAntall,
      harRgb,
      harKlassifisering,
      klassifiseringer,
      boundingBox: bbox,
    };
  } finally {
    await fh.close();
  }
}
