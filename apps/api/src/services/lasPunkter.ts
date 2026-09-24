/**
 * LAS punkt-lesing — X/Y/Z med scale OG offset
 *
 * Søsterfil til lasHeader.ts (bevisst adskilt): lasHeader.ts leser hodet +
 * klassifiseringsstatistikk for HELE fila og importeres bredt. Her leser vi
 * de faktiske punktkoordinatene for overflate-pipelinen — en tyngre, mer
 * spesialisert operasjon som bare bakkeoverflate-tjenesten trenger.
 *
 * 🔴 KJERNEPOENGET: LAS lagrer X/Y/Z som int32 som MÅ multipliseres med scale
 * og adderes med offset for å bli metriske koordinater:
 *     metrisk = rå_int32 * scale + offset
 * Hopper man over det, blir koordinatene rå heltall og volumet meningsløst.
 *
 * Header-byte (ASPRS LAS 1.2–1.4):
 *   131/139/147 = X/Y/Z scale factor (double)
 *   155/163/171 = X/Y/Z offset (double)
 *
 * Bare LAS i steg 1. LAZ er komprimert og krever en dekoder — ikke her.
 *
 * Ref: ASPRS LAS 1.2–1.4 Specification, Public Header Block.
 */

import { open } from "fs/promises";

/** Punkt-record størrelse per format (bytes) — speiler lasHeader.ts */
const PUNKT_STØRRELSE: Record<number, number> = {
  0: 20, 1: 28, 2: 26, 3: 34, 4: 57, 5: 63,
  6: 30, 7: 36, 8: 38, 9: 59, 10: 67,
};

/** Offset til klassifiseringsbyte innenfor punkt-record (format 0-5: 15, 6-10: 16) */
function klassifiseringsOffset(format: number): number {
  return format >= 6 ? 16 : 15;
}

export interface LasSkala {
  x: number;
  y: number;
  z: number;
}

export interface LasPunktHeader {
  versjon: string;
  punktFormat: number;
  punktAntall: number;
  offsetTilPunkter: number;
  punktStørrelse: number;
  /** X/Y/Z scale factor (byte 131/139/147) */
  scale: LasSkala;
  /** X/Y/Z offset (byte 155/163/171) */
  offset: LasSkala;
  klassifiseringsOffset: number;
}

export interface DekodetPunkt {
  x: number;
  y: number;
  z: number;
  klasse: number;
}

/**
 * Les LAS-punkthode fra en råbuffer (minst 375 bytes).
 * Ren funksjon — enhetstestbar uten fil.
 */
export function lesLasPunktHeader(headerBuf: Buffer): LasPunktHeader {
  const signatur = headerBuf.toString("ascii", 0, 4);
  if (signatur !== "LASF") {
    throw new Error(`Ugyldig LAS-fil: signatur "${signatur}" (forventet "LASF")`);
  }

  const versjonMajor = headerBuf.readUInt8(24);
  const versjonMinor = headerBuf.readUInt8(25);
  const versjon = `${versjonMajor}.${versjonMinor}`;

  const offsetTilPunkter = headerBuf.readUInt32LE(96);
  const punktFormat = headerBuf.readUInt8(104) & 0x3f;
  const punktStørrelseRaw = headerBuf.readUInt16LE(105);
  const punktStørrelse = punktStørrelseRaw || PUNKT_STØRRELSE[punktFormat] || 20;

  let punktAntall: number;
  if (versjonMinor >= 4) {
    // LAS 1.4: 64-bit felt på offset 247
    punktAntall = Number(headerBuf.readBigUInt64LE(247));
  } else {
    punktAntall = headerBuf.readUInt32LE(107);
  }

  const scale: LasSkala = {
    x: headerBuf.readDoubleLE(131),
    y: headerBuf.readDoubleLE(139),
    z: headerBuf.readDoubleLE(147),
  };
  const offset: LasSkala = {
    x: headerBuf.readDoubleLE(155),
    y: headerBuf.readDoubleLE(163),
    z: headerBuf.readDoubleLE(171),
  };

  return {
    versjon,
    punktFormat,
    punktAntall,
    offsetTilPunkter,
    punktStørrelse,
    scale,
    offset,
    klassifiseringsOffset: klassifiseringsOffset(punktFormat),
  };
}

/**
 * Dekod ETT punkt fra en record-buffer ved gitt offset.
 * Ren funksjon — kjernen i scale/offset-matematikken, enhetstestbar.
 *
 * @param brukSkala  true = metrisk (rå*scale+offset). false = rå int32 (kun for
 *                   negativ kontroll: viser at koordinatene blir åpenbart gale
 *                   når scale/offset hoppes over).
 */
export function dekodPunkt(
  rec: Buffer,
  recOffset: number,
  header: Pick<LasPunktHeader, "scale" | "offset" | "klassifiseringsOffset">,
  brukSkala = true,
): DekodetPunkt {
  const raX = rec.readInt32LE(recOffset);
  const raY = rec.readInt32LE(recOffset + 4);
  const raZ = rec.readInt32LE(recOffset + 8);
  const klasse = rec.readUInt8(recOffset + header.klassifiseringsOffset);

  if (!brukSkala) {
    return { x: raX, y: raY, z: raZ, klasse };
  }

  return {
    x: raX * header.scale.x + header.offset.x,
    y: raY * header.scale.y + header.offset.y,
    z: raZ * header.scale.z + header.offset.z,
    klasse,
  };
}

/**
 * Les LAS-punkthode fra fil.
 */
export async function lesLasPunktHeaderFraFil(filsti: string): Promise<LasPunktHeader> {
  const fh = await open(filsti, "r");
  try {
    const headerBuf = Buffer.alloc(375);
    await fh.read(headerBuf, 0, 375, 0);
    return lesLasPunktHeader(headerBuf);
  } finally {
    await fh.close();
  }
}

/** Antall punkt-records lest per blokk (I/O-effektivitet uten å materialisere hele skya) */
const PUNKTER_PR_BLOKK = 65_536;

/**
 * Stream alle punkter i en LAS-fil, dekodet til metriske koordinater.
 * Leser i blokker for å holde minnebruk konstant — en drone-sky kan ha
 * titalls millioner punkter. `onPunkt` kalles for hvert dekodet punkt.
 */
export async function forHverLasPunkt(
  filsti: string,
  header: LasPunktHeader,
  onPunkt: (p: DekodetPunkt) => void,
): Promise<void> {
  const fh = await open(filsti, "r");
  try {
    const { punktAntall, punktStørrelse, offsetTilPunkter } = header;
    const blokkBuf = Buffer.alloc(PUNKTER_PR_BLOKK * punktStørrelse);

    let lest = 0;
    while (lest < punktAntall) {
      const igjen = punktAntall - lest;
      const antallIBlokk = Math.min(PUNKTER_PR_BLOKK, igjen);
      const bytesÅLese = antallIBlokk * punktStørrelse;
      const posisjon = offsetTilPunkter + lest * punktStørrelse;

      const { bytesRead } = await fh.read(blokkBuf, 0, bytesÅLese, posisjon);
      if (bytesRead === 0) break;

      const antallFaktisk = Math.floor(bytesRead / punktStørrelse);
      for (let i = 0; i < antallFaktisk; i++) {
        onPunkt(dekodPunkt(blokkBuf, i * punktStørrelse, header, true));
      }
      lest += antallFaktisk;
      if (antallFaktisk < antallIBlokk) break;
    }
  } finally {
    await fh.close();
  }
}
