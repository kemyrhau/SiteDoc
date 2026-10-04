import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@sitedoc/db";
import {
  sikreByggeplassOrigo,
  utledGeometriFraTegning,
  oppdaterByggeplassGeofence,
} from "../services/byggeplassGeofence";

/**
 * V17-B integrasjonsbevis (spec § 8) mot ekte Postgres. To deler:
 *
 *  A. CHECK-en i 20261004120000_omrade_geo_polygon: (geo_polygon IS NULL) = (geo_kilde IS NULL)
 *     + geo_kilde IN ('kart','tegning'). Throwaway-tabell som speiler migreringens SQL (samme
 *     mønster som omrade/overflate-check-constraint) — RØD-FØRST innebygd via en tabell UTEN CHECK.
 *     Krever INGEN app-migrering.
 *
 *  B. Tjeneste-invariantene (§ 8.1/8.5/8.9/8.10) mot de ekte tabellene. 🔴 Disse KREVER at
 *     migreringen er kjørt på DB-en (geo_polygon/geo_kilde finnes) — kjøres i integrasjonssuiten
 *     ETTER at Kenneth har migrert (test), jf. cowork-gatet konvensjon. Localhost/CI-sandkasse.
 */

const T = "omrade_geo_polygon_testtabell";

describe("A. CHECK omrade.geo_polygon (DB-garanti)", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE ${T} (
         id text PRIMARY KEY,
         geo_polygon jsonb,
         geo_kilde text,
         CONSTRAINT ${T}_sammenheng CHECK ((geo_polygon IS NULL) = (geo_kilde IS NULL)),
         CONSTRAINT ${T}_kilde CHECK (geo_kilde IS NULL OR geo_kilde IN ('kart','tegning'))
       )`,
    );
  });
  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${T}`);
  });

  it("AVVISER polygon UTEN kilde", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('a', '[]'::jsonb, NULL)`),
    ).rejects.toThrow();
  });
  it("AVVISER kilde UTEN polygon", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('b', NULL, 'kart')`),
    ).rejects.toThrow();
  });
  it("AVVISER ukjent kilde", async () => {
    await expect(
      prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('c', '[]'::jsonb, 'tull')`),
    ).rejects.toThrow();
  });
  it("TILLATER polygon MED gyldig kilde", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('d', '[{"lat":1,"lng":2}]'::jsonb, 'kart')`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='d'`);
    expect(Number(r[0]!.n)).toBe(1);
  });
  it("TILLATER begge NULL (sone uten geometri)", async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO ${T} VALUES ('e', NULL, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM ${T} WHERE id='e'`);
    expect(Number(r[0]!.n)).toBe(1);
  });
  it("RØD-FØRST-KONTROLL: tabell UTEN CHECK slipper polygon-uten-kilde inn", async () => {
    const U = `${T}_uten`;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
    await prisma.$executeRawUnsafe(`CREATE TABLE ${U} (id text PRIMARY KEY, geo_polygon jsonb, geo_kilde text)`);
    await prisma.$executeRawUnsafe(`INSERT INTO ${U} VALUES ('x', '[]'::jsonb, NULL)`);
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM ${U} WHERE geo_polygon IS NOT NULL AND geo_kilde IS NULL`,
    );
    expect(Number(r[0]!.n)).toBe(1);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${U}`);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * B. Tjeneste-invariantene mot ekte tabeller. Krever migrert geo_polygon/geo_kilde.
 * ────────────────────────────────────────────────────────────────────────── */

const NS = `v17b-${randomUUID().slice(0, 8)}`;
const ids = { projectId: "", bpUtenPunkt: "", bpManuell: "", bpAuto: "", tegning: "" };

// Enkel, ikke-degenerert georeferanse (2 punkter → lineær transform).
const GEOREF = {
  point1: { pixel: { x: 0, y: 0 }, gps: { lat: 59.9, lng: 10.7 } },
  point2: { pixel: { x: 100, y: 100 }, gps: { lat: 59.91, lng: 10.71 } },
};
const PROSENT_POLYGON = [
  { x: 10, y: 10 },
  { x: 25, y: 10 },
  { x: 17, y: 25 },
];
const LATLNG_TREKANT = [
  { lat: 59.901, lng: 10.701 },
  { lat: 59.901, lng: 10.704 },
  { lat: 59.903, lng: 10.7025 },
];

describe("B. V17-B tjeneste-invarianter (ekte tabeller, krever migrering)", () => {
  beforeAll(async () => {
    const p = await prisma.project.create({
      data: { id: randomUUID(), projectNumber: NS, name: `${NS} prosjekt`, primaryOrganizationId: null },
    });
    ids.projectId = p.id;
    ids.bpUtenPunkt = (
      await prisma.byggeplass.create({
        data: { id: randomUUID(), projectId: p.id, name: `${NS} u-punkt`, number: 1 },
      })
    ).id;
    ids.bpManuell = (
      await prisma.byggeplass.create({
        data: {
          id: randomUUID(),
          projectId: p.id,
          name: `${NS} manuell`,
          number: 2,
          latitude: 59.95,
          longitude: 10.8,
          radiusM: 150,
          geofenceKilde: "manuell",
        },
      })
    ).id;
    ids.bpAuto = (
      await prisma.byggeplass.create({
        data: { id: randomUUID(), projectId: p.id, name: `${NS} auto`, number: 3 },
      })
    ).id;
    ids.tegning = (
      await prisma.drawing.create({
        data: {
          id: randomUUID(),
          projectId: p.id,
          byggeplassId: ids.bpAuto,
          name: `${NS} tegning`,
          fileUrl: "test://ingen",
          fileType: "PDF",
          geoReference: GEOREF,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.omrade.deleteMany({ where: { projectId: ids.projectId } });
    await prisma.drawing.deleteMany({ where: { projectId: ids.projectId } });
    await prisma.byggeplass.deleteMany({ where: { projectId: ids.projectId } });
    await prisma.project.deleteMany({ where: { id: ids.projectId } });
  });

  it("§8.1 origo-invariant: sone med geometri på punktløs byggeplass UTLEDER origo", async () => {
    const o = await prisma.omrade.create({
      data: {
        id: randomUUID(),
        projectId: ids.projectId,
        byggeplassId: ids.bpUtenPunkt,
        navn: "sone-1",
        geoPolygon: LATLNG_TREKANT,
        geoKilde: "kart",
      },
    });
    // 🔴 Rød først: uten sikreByggeplassOrigo forblir latitude null — invarianten brytes.
    const foer = await prisma.byggeplass.findUnique({ where: { id: ids.bpUtenPunkt }, select: { latitude: true } });
    expect(foer?.latitude).toBeNull();

    const origo = await sikreByggeplassOrigo(ids.bpUtenPunkt);
    expect(origo).not.toBeNull();
    const etter = await prisma.byggeplass.findUnique({
      where: { id: ids.bpUtenPunkt },
      select: { latitude: true, longitude: true, geofenceKilde: true },
    });
    expect(etter?.latitude).not.toBeNull();
    expect(etter?.geofenceKilde).toBe("soner");
    // Sentroide av trekanten.
    expect(etter!.latitude!).toBeCloseTo((59.901 + 59.901 + 59.903) / 3, 4);
    await prisma.omrade.delete({ where: { id: o.id } });
  });

  it("§8.5 kart-sone fredes: utledGeometriFraTegning overskriver IKKE geoKilde='kart'", async () => {
    const o = await prisma.omrade.create({
      data: {
        id: randomUUID(),
        projectId: ids.projectId,
        byggeplassId: ids.bpAuto,
        navn: "kart-sone",
        tegningId: ids.tegning,
        polygon: PROSENT_POLYGON,
        geoPolygon: LATLNG_TREKANT,
        geoKilde: "kart",
      },
    });
    const res = await utledGeometriFraTegning(o.id);
    expect(res).toBeNull(); // fredet
    const etter = await prisma.omrade.findUnique({ where: { id: o.id }, select: { geoKilde: true } });
    expect(etter?.geoKilde).toBe("kart"); // uendret
    await prisma.omrade.delete({ where: { id: o.id } });
  });

  it("§8.9 manuelt punkt får LIKEVEL soner fra «Hent fra tegning» (B8 pr. objekt)", async () => {
    const o = await prisma.omrade.create({
      data: {
        id: randomUUID(),
        projectId: ids.projectId,
        byggeplassId: ids.bpManuell,
        navn: "trase-fra-tegning",
        tegningId: ids.tegning,
        polygon: PROSENT_POLYGON,
      },
    });
    const res = await utledGeometriFraTegning(o.id);
    expect(res).not.toBeNull();
    const etterSone = await prisma.omrade.findUnique({ where: { id: o.id }, select: { geoKilde: true, geoPolygon: true } });
    expect(etterSone?.geoKilde).toBe("tegning");
    expect(Array.isArray(etterSone?.geoPolygon)).toBe(true);
    // Punktet står urørt (manuell fredes), men sonen fikk geometri.
    const bp = await prisma.byggeplass.findUnique({ where: { id: ids.bpManuell }, select: { geofenceKilde: true, latitude: true } });
    expect(bp?.geofenceKilde).toBe("manuell");
    expect(bp?.latitude).toBeCloseTo(59.95, 4);
    await prisma.omrade.delete({ where: { id: o.id } });
  });

  it("§8.10 auto-triggeren gir KUN punkt+sirkel, ALDRI soner", async () => {
    const o = await prisma.omrade.create({
      data: {
        id: randomUUID(),
        projectId: ids.projectId,
        byggeplassId: ids.bpAuto,
        navn: "urørt-av-auto",
        tegningId: ids.tegning,
        polygon: PROSENT_POLYGON,
      },
    });
    await oppdaterByggeplassGeofence(ids.bpAuto, true); // auto-trigger (kunHvisTom)
    const bp = await prisma.byggeplass.findUnique({ where: { id: ids.bpAuto }, select: { latitude: true, radiusM: true } });
    expect(bp?.latitude).not.toBeNull(); // punkt satt (sirkel)
    expect(bp?.radiusM).not.toBeNull();
    const sone = await prisma.omrade.findUnique({ where: { id: o.id }, select: { geoKilde: true } });
    expect(sone?.geoKilde).toBeNull(); // 🔴 auto lagde INGEN sone
    await prisma.omrade.delete({ where: { id: o.id } });
  });
});
