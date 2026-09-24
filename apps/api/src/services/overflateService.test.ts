import { describe, it, expect, afterAll } from "vitest";
import { writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { byggOverflateFraLas } from "./overflateService";
import { RAMME_LAS_PROVISORISK } from "./overflateRamme";

/** Minimal LAS 1.2-fixture (format 0) — samme bygger som lasPunkter.test.ts. */
function byggLas(
  scale: { x: number; y: number; z: number },
  offset: { x: number; y: number; z: number },
  punkter: { raX: number; raY: number; raZ: number; klasse: number }[],
): Buffer {
  const HEADER = 227;
  const REC = 20;
  const buf = Buffer.alloc(HEADER + punkter.length * REC);
  buf.write("LASF", 0, "ascii");
  buf.writeUInt8(1, 24);
  buf.writeUInt8(2, 25);
  buf.writeUInt16LE(HEADER, 94);
  buf.writeUInt32LE(HEADER, 96);
  buf.writeUInt8(0, 104);
  buf.writeUInt16LE(REC, 105);
  buf.writeUInt32LE(punkter.length, 107);
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
    buf.writeUInt8(p.klasse, o + 15);
  });
  return buf;
}

const scale = { x: 0.01, y: 0.01, z: 0.001 };
const offset = { x: 600000, y: 6700000, z: 0 };

describe("byggOverflateFraLas — A+B+C ende-til-ende", () => {
  const filsti = join(tmpdir(), `sitedoc-overflate-${process.pid}.las`);
  afterAll(async () => rm(filsti, { force: true }));

  it("uklassifisert sky → metrisk TIN, bakkeMetode='minZ', provisorisk ramme", async () => {
    // 4 punkter i vidt adskilte ruter (metrisk ~30 m fra hverandre) + ett høyt støypunkt
    const punkter = [
      { raX: 0, raY: 0, raZ: 5000, klasse: 1 },
      { raX: 3000, raY: 0, raZ: 5100, klasse: 1 },
      { raX: 3000, raY: 3000, raZ: 5200, klasse: 1 },
      { raX: 0, raY: 3000, raZ: 5300, klasse: 1 },
      { raX: 1, raY: 1, raZ: 90000, klasse: 1 }, // gravemaskin i rute (0,0) — skal falle bort (min-Z)
    ];
    await writeFile(filsti, byggLas(scale, offset, punkter));

    const res = await byggOverflateFraLas(filsti, { harKlassifisering: false, coordinateSystem: null });

    expect(res.bakkeMetode).toBe("minZ");
    expect(res.ramme).toBe(RAMME_LAS_PROVISORISK);
    expect(res.malavstandM).toBe(0.15);
    // 4 hjørne-ruter (støypunktet deler rute med hjørnet 0,0 → min-Z beholder z=5)
    expect(res.punktAntall).toBe(4);
    // Metriske koordinater, ikke rå heltall
    expect(res.tin.bbox.minX).toBeCloseTo(600000, 3);
    expect(res.tin.bbox.maxX).toBeCloseTo(600030, 3);
    // 🔴 Gravemaskinen (z=90) forkastet — laveste Z i hjørnerute (0,0) er 5 m
    expect(res.tin.bbox.minZ).toBeCloseTo(5, 3);
    expect(res.tin.triangles.length).toBeGreaterThanOrEqual(6); // minst 2 trekanter
  });

  it("klassifisert sky → bakkeMetode='klasse2', kun bakkepunkter", async () => {
    const punkter = [
      { raX: 0, raY: 0, raZ: 5000, klasse: 2 },
      { raX: 3000, raY: 0, raZ: 5100, klasse: 2 },
      { raX: 3000, raY: 3000, raZ: 5200, klasse: 2 },
      { raX: 0, raY: 3000, raZ: 4000, klasse: 5 }, // vegetasjon — ignoreres, gir < 3 bakkeruter? nei, 3 klasse-2
    ];
    await writeFile(filsti, byggLas(scale, offset, punkter));
    const res = await byggOverflateFraLas(filsti, { harKlassifisering: true, coordinateSystem: "utm33" });

    expect(res.bakkeMetode).toBe("klasse2");
    expect(res.ramme).toBe("utm33"); // detektert sone → ikke provisorisk
    expect(res.punktAntall).toBe(3); // kun klasse-2-punktene
  });
});
