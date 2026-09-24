import { describe, it, expect, afterAll } from "vitest";
import { open, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  lesLasPunktHeader,
  lesLasPunktHeaderFraFil,
  dekodPunkt,
  forHverLasPunkt,
  type LasSkala,
} from "./lasPunkter";

/**
 * Bygg en minimal, gyldig LAS 1.2-buffer (punktformat 0) med kjente
 * scale/offset og kjente rå int32-koordinater. Fordi vi eier tallene, vet vi
 * NØYAKTIG hva den metriske dekodingen skal gi — bedre bevis enn en ekte fil.
 *
 * ⚠️ Dette er en DEKODER-fixture for et veldefinert binærformat, ikke
 * generert georef-innhold. Verifisering mot en EKTE drone-LAS gjøres separat.
 */
function byggLasFixture(
  scale: LasSkala,
  offset: LasSkala,
  punkter: { raX: number; raY: number; raZ: number; klasse: number }[],
): Buffer {
  const HEADER = 227; // LAS 1.2 public header block
  const REC = 20; // punktformat 0
  const buf = Buffer.alloc(HEADER + punkter.length * REC);

  buf.write("LASF", 0, "ascii");
  buf.writeUInt8(1, 24); // versjon major
  buf.writeUInt8(2, 25); // versjon minor
  buf.writeUInt16LE(HEADER, 94); // header size
  buf.writeUInt32LE(HEADER, 96); // offset til punktdata
  buf.writeUInt8(0, 104); // punktformat 0
  buf.writeUInt16LE(REC, 105); // record length
  buf.writeUInt32LE(punkter.length, 107); // antall punkter (LAS 1.2)

  buf.writeDoubleLE(scale.x, 131);
  buf.writeDoubleLE(scale.y, 139);
  buf.writeDoubleLE(scale.z, 147);
  buf.writeDoubleLE(offset.x, 155);
  buf.writeDoubleLE(offset.y, 163);
  buf.writeDoubleLE(offset.z, 171);

  punkter.forEach((p, i) => {
    const o = HEADER + i * REC;
    buf.writeInt32LE(p.raX, o);
    buf.writeInt32LE(p.raY, o + 4);
    buf.writeInt32LE(p.raZ, o + 8);
    buf.writeUInt8(p.klasse, o + 15); // classification (format 0)
  });

  return buf;
}

const scale: LasSkala = { x: 0.01, y: 0.01, z: 0.001 };
const offset: LasSkala = { x: 600000, y: 6700000, z: 0 };

describe("lasPunkter — header", () => {
  it("leser scale og offset fra korrekte byte-offsets", () => {
    const buf = byggLasFixture(scale, offset, []);
    const h = lesLasPunktHeader(buf);
    expect(h.scale).toEqual(scale);
    expect(h.offset).toEqual(offset);
    expect(h.punktFormat).toBe(0);
    expect(h.punktStørrelse).toBe(20);
    expect(h.offsetTilPunkter).toBe(227);
    expect(h.versjon).toBe("1.2");
    expect(h.klassifiseringsOffset).toBe(15);
  });

  it("avviser buffer uten LASF-signatur", () => {
    const buf = Buffer.alloc(375);
    buf.write("XXXX", 0, "ascii");
    expect(() => lesLasPunktHeader(buf)).toThrow(/signatur/);
  });
});

describe("dekodPunkt — scale+offset gjør koordinatene metriske", () => {
  const buf = byggLasFixture(scale, offset, []);
  const h = lesLasPunktHeader(buf);
  // rå (5, 3, 1234) → metrisk (600000.05, 6700000.03, 1.234)
  const rec = Buffer.alloc(20);
  rec.writeInt32LE(5, 0);
  rec.writeInt32LE(3, 4);
  rec.writeInt32LE(1234, 8);
  rec.writeUInt8(2, 15);

  it("dekoder til metriske UTM-koordinater med scale og offset", () => {
    const p = dekodPunkt(rec, 0, h, true);
    expect(p.x).toBeCloseTo(600000.05, 6);
    expect(p.y).toBeCloseTo(6700000.03, 6);
    expect(p.z).toBeCloseTo(1.234, 6);
    expect(p.klasse).toBe(2);
  });

  it("NEGATIV KONTROLL: uten scale/offset blir tallene åpenbart gale", () => {
    const rå = dekodPunkt(rec, 0, h, false);
    // Rå heltall — ikke i nærheten av en UTM-posisjon
    expect(rå.x).toBe(5);
    expect(rå.y).toBe(3);
    expect(rå.z).toBe(1234);
    // Beviset: den metriske X ligger ~600 km unna den rå X
    const metrisk = dekodPunkt(rec, 0, h, true);
    expect(Math.abs(metrisk.x - rå.x)).toBeGreaterThan(500_000);
    // Og Z (høyde) er 1000× for stor rå (1234 m vs 1.234 m)
    expect(rå.z / metrisk.z).toBeCloseTo(1000, 0);
  });
});

describe("forHverLasPunkt — streaming fra fil", () => {
  const filsti = join(tmpdir(), `sitedoc-las-fixture-${process.pid}.las`);

  afterAll(async () => {
    await rm(filsti, { force: true });
  });

  it("streamer alle punkter metrisk dekodet", async () => {
    const punkter = [
      { raX: 0, raY: 0, raZ: 5000, klasse: 2 },
      { raX: 100, raY: 200, raZ: 5100, klasse: 2 },
      { raX: 300, raY: 400, raZ: 9000, klasse: 5 }, // vegetasjon
    ];
    const buf = byggLasFixture(scale, offset, punkter);
    await writeFile(filsti, buf);

    const h = await lesLasPunktHeaderFraFil(filsti);
    expect(h.punktAntall).toBe(3);

    const lest: { x: number; y: number; z: number; klasse: number }[] = [];
    await forHverLasPunkt(filsti, h, (p) => lest.push(p));

    expect(lest).toHaveLength(3);
    expect(lest[0]!.x).toBeCloseTo(600000, 6);
    expect(lest[0]!.z).toBeCloseTo(5, 6);
    expect(lest[1]!.x).toBeCloseTo(600001, 6);
    expect(lest[1]!.y).toBeCloseTo(6700002, 6);
    expect(lest[2]!.klasse).toBe(5);
    expect(lest[2]!.z).toBeCloseTo(9, 6);
  });
});
