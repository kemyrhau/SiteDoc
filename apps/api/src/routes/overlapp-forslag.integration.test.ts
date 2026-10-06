import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaTimer } from "@sitedoc/db-timer";
import { byggForsonInputFraValg, type ForsonRad } from "@sitedoc/shared";
import { klassifiserSyncRader } from "./timer/sync-versjon";

/**
 * V19 (ordre V19-A) — migreringen + forslagstabellens garantier mot EKTE Postgres
 * (localhost-sandkasse, verifisert IKKE test/prod). Gate-kriterie 2: «migreringen,
 * tx-grensen, grep-vakten for lesere» kan ikke kvitteres med mock.
 *
 * Her: (migrering) kolonnene finnes med rett type · (FK cascade = garanti b) slettet
 * sedel river forslaget · (PK = idempotent erstatning, test 1e) deleteMany+createMany
 * dobler ikke · (invariant A-3) konflikt_ventende_siden + forslag henger sammen ·
 * (lekkasje, test 1d) et forslag ligger i egen tabell og dukker ALDRI opp i et
 * sheet_timer-oppslag.
 *
 * SheetTimerForslag har kun FK til DailySheet; org/user på sedelen er rene String-
 * felt (svak FK, ingen kryss-schema-relasjon) → ingen kjerne-seeding nødvendig.
 */

const ORG = "f19a0000-0000-0000-0000-0000000000a1";
const USER = "f19a0000-0000-0000-0000-0000000000b2";
const SHEET = "f19a0000-0000-0000-0000-0000000000c3";
const CLIENT_UUID = "f19a0000-0000-0000-0000-0000000000d4";
const RAD_1 = "f19a0000-0000-0000-0000-0000000000e5";
const RAD_2 = "f19a0000-0000-0000-0000-0000000000e6";
const LONNSART = "f19a0000-0000-0000-0000-000000000108";
const AKTIVITET = "f19a0000-0000-0000-0000-000000000109";
const PROSJEKT = "f19a0000-0000-0000-0000-0000000000f7";
const DATO = new Date("2026-09-20T00:00:00.000Z");

async function ryddOpp() {
  await prismaTimer.sheetTimerForslag.deleteMany({ where: { sheetId: SHEET } });
  await prismaTimer.sheetTimer.deleteMany({ where: { sheetId: SHEET } });
  await prismaTimer.dailySheet.deleteMany({ where: { id: SHEET } });
}

async function seedKatalog() {
  await prismaTimer.lonnsart.upsert({
    where: { id: LONNSART },
    create: { id: LONNSART, organizationId: ORG, type: "ordinaer", navn: "Timelønn" },
    update: {},
  });
  await prismaTimer.aktivitet.upsert({
    where: { id: AKTIVITET },
    create: { id: AKTIVITET, organizationId: ORG, navn: "Grunnarbeid" },
    update: {},
  });
}

async function lagSedel() {
  await prismaTimer.dailySheet.create({
    data: {
      id: SHEET,
      clientUuid: CLIENT_UUID,
      organizationId: ORG,
      userId: USER,
      registrertAvUserId: USER,
      dato: DATO,
      status: "draft",
    },
  });
}

const forslagRad = (id: string, fraTid: string, tilTid: string, timer: number) => ({
  id,
  sheetId: SHEET,
  projectId: PROSJEKT,
  lonnsartId: LONNSART,
  aktivitetId: AKTIVITET,
  fraTid,
  tilTid,
  timer,
  kilde: "mobil",
});

beforeAll(ryddOpp);
afterAll(async () => {
  await ryddOpp();
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKTIVITET } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: LONNSART } });
});

describe("V19 migrering — kolonner + typer", () => {
  it("daily_sheets.konflikt_ventende_siden finnes som timestamptz", async () => {
    const rows = await prismaTimer.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'timer' AND table_name = 'daily_sheets'
        AND column_name = 'konflikt_ventende_siden'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data_type).toBe("timestamp with time zone");
  });

  it("sheet_timer_forslag finnes med forventede kolonner + index på sheet_id", async () => {
    const kolonner = await prismaTimer.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'timer' AND table_name = 'sheet_timer_forslag'`;
    const navn = new Set(kolonner.map((k) => k.column_name));
    for (const k of [
      "id", "sheet_id", "project_id", "lonnsart_id", "aktivitet_id",
      "fra_tid", "til_tid", "timer", "er_reise", "reise_regel", "kilde", "mottatt_at",
    ]) {
      expect(navn.has(k)).toBe(true);
    }
    // Ingen attestert*-felt (et forslag kan ikke attesteres).
    expect([...navn].some((k) => k.startsWith("attestert"))).toBe(false);
  });
});

describe("V19 garantier — FK cascade, PK-idempotens, invariant, lekkasje", () => {
  it("🔴 FK ON DELETE CASCADE: slettet sedel river forslaget (garanti b)", async () => {
    await lagSedel();
    await prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_1, "07:00", "15:30", 8) });
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(1);
    await prismaTimer.dailySheet.delete({ where: { id: SHEET } });
    // Cascade: ingen foreldreløs forslagsrad.
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(0);
  });

  it("🔴 (1e) idempotent erstatning: deleteMany+createMany dobler ikke forslaget", async () => {
    await lagSedel();
    // Første push: to forslagsrader.
    await prismaTimer.sheetTimerForslag.createMany({
      data: [forslagRad(RAD_1, "07:00", "11:00", 4), forslagRad(RAD_2, "12:00", "16:00", 4)],
    });
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(2);
    // Ny push av SAMME forslag (samme sedel): skrive-veiens deleteMany+createMany.
    await prismaTimer.$transaction(async (tx) => {
      await tx.sheetTimerForslag.deleteMany({ where: { sheetId: SHEET } });
      await tx.sheetTimerForslag.createMany({
        data: [forslagRad(RAD_1, "07:00", "11:00", 4), forslagRad(RAD_2, "12:00", "16:00", 4)],
      });
    });
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(2);
    await ryddOpp();
  });

  it("🔴 PK hindrer duplikat på samme rad-id (idempotent nøkkel = mobilens rad-id)", async () => {
    await lagSedel();
    await prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_1, "07:00", "15:00", 7.5) });
    await expect(
      prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_1, "08:00", "16:00", 8) }),
    ).rejects.toMatchObject({ code: "P2002" });
    await ryddOpp();
  });

  it("🔴 (1d) forslaget ligger i egen tabell — dukker ALDRI opp i et sheet_timer-oppslag", async () => {
    await lagSedel();
    await prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_1, "07:00", "15:30", 8) });
    // Lønnslesernes grunn-spørring er sheet_timer; forslaget er ikke der.
    const lonnsRader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } });
    expect(lonnsRader).toHaveLength(0);
    // Pull-hodet teller forslag UTEN å bære radene (A-7).
    const antall = await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } });
    expect(antall).toBe(1);
    await ryddOpp();
  });

  it("invariant A-3: konflikt_ventende_siden kan settes og nulles på sedelen", async () => {
    await lagSedel();
    await prismaTimer.dailySheet.update({
      where: { id: SHEET },
      data: { konfliktVentendeSiden: new Date() },
    });
    const satt = await prismaTimer.dailySheet.findUnique({ where: { id: SHEET } });
    expect(satt!.konfliktVentendeSiden).not.toBeNull();
    await prismaTimer.dailySheet.update({
      where: { id: SHEET },
      data: { konfliktVentendeSiden: null },
    });
    const nullet = await prismaTimer.dailySheet.findUnique({ where: { id: SHEET } });
    expect(nullet!.konfliktVentendeSiden).toBeNull();
    await ryddOpp();
  });
});

describe("V19.9 migrering + tx + forsoning (ordre V19.9-A, gate 2)", () => {
  it("migrering: sheet_timer_forslag.grunn finnes, default 'overlapp', CHECK avviser ukjent verdi", async () => {
    const kol = await prismaTimer.$queryRaw<{ column_default: string | null }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'timer' AND table_name = 'sheet_timer_forslag'
        AND column_name = 'grunn'`;
    expect(kol).toHaveLength(1);
    expect(kol[0]!.column_default).toContain("overlapp");

    await lagSedel();
    // Default fylles når grunn ikke sendes (V19-A-forslag).
    await prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_1, "07:00", "15:30", 8) });
    const r = await prismaTimer.sheetTimerForslag.findUnique({ where: { id: RAD_1 } });
    expect(r!.grunn).toBe("overlapp");
    // CHECK avviser en ukjent grunn.
    await expect(
      prismaTimer.sheetTimerForslag.create({
        data: { ...forslagRad(RAD_2, "07:00", "11:00", 4), grunn: "noe_ugyldig" },
      }),
    ).rejects.toBeTruthy();
    await ryddOpp();
  });

  it("test 2 (R4) i EKTE tx: PC-raden står, avvik-forslaget får grunn endret_begge", async () => {
    await seedKatalog();
    await lagSedel();
    // Serverraden slik PC lagret den (updatedAt = V2).
    const serverRow = await prismaTimer.sheetTimer.create({
      data: {
        id: RAD_1, sheetId: SHEET, projectId: PROSJEKT, lonnsartId: LONNSART,
        aktivitetId: AKTIVITET, timer: 8, fraTid: "07:00", tilTid: "15:30",
      },
    });
    // Telefonen pusher RAD_1 m/ gammel versjon + endretLokalt + ulikt innhold (R4).
    const klass = klassifiserSyncRader(
      [{ id: serverRow.id, updatedAt: serverRow.updatedAt, projectId: PROSJEKT, lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 8, fraTid: "07:00", tilTid: "15:30", pauseMin: 0 }],
      [{ id: RAD_1, serverVersjon: "2020-01-01T00:00:00.000Z", endretLokalt: true, projectId: PROSJEKT, lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 8, fraTid: "07:00", tilTid: "15:15", pauseMin: 0 }],
      [],
    );
    expect(klass.avvik).toEqual([{ id: RAD_1, grunn: "endret_begge", kilde: "payload" }]);
    expect(klass.skriv).toEqual([]);
    // Skriv-stegets tx: avvik → forslag m/ grunn, serverraden urørt.
    await prismaTimer.$transaction(async (tx) => {
      await tx.sheetTimerForslag.deleteMany({ where: { sheetId: SHEET } });
      await tx.sheetTimerForslag.createMany({
        data: [{ ...forslagRad(RAD_1, "07:00", "15:15", 8), grunn: "endret_begge" }],
      });
      await tx.dailySheet.update({ where: { id: SHEET }, data: { konfliktVentendeSiden: new Date() } });
    });
    const rader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } });
    expect(rader).toHaveLength(1);
    expect(rader[0]!.tilTid).toBe("15:30"); // PC-raden står
    const forslag = await prismaTimer.sheetTimerForslag.findMany({ where: { sheetId: SHEET } });
    expect(forslag[0]!.grunn).toBe("endret_begge");
    await ryddOpp();
  });

  it("test 6 i EKTE tx: uomstridt NY rad skrives i SAMME tx som avvik-forslaget", async () => {
    await seedKatalog();
    await lagSedel();
    // Kun avvik + én ny rad — skriv NY, lagre forslag, ALT i én tx.
    await prismaTimer.$transaction(async (tx) => {
      await tx.sheetTimer.createMany({
        data: [{ id: RAD_2, sheetId: SHEET, projectId: PROSJEKT, lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 4, fraTid: "12:00", tilTid: "16:00" }],
      });
      await tx.sheetTimerForslag.createMany({
        data: [{ ...forslagRad(RAD_1, "07:00", "11:00", 4), grunn: "endret_begge" }],
      });
      await tx.dailySheet.update({ where: { id: SHEET }, data: { konfliktVentendeSiden: new Date() } });
    });
    // Den uomstridte raden ER skrevet selv om sedelen har forslag.
    const rader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } });
    expect(rader.map((r) => r.id)).toEqual([RAD_2]);
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(1);
    await ryddOpp();
  });

  it("test 4 (S2'): slettet_telefon → valg «forslag» → slettinger sletter serverraden i tx", async () => {
    await seedKatalog();
    await lagSedel();
    await prismaTimer.sheetTimer.create({
      data: { id: RAD_1, sheetId: SHEET, projectId: PROSJEKT, lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 8, fraTid: "07:00", tilTid: "15:30" },
    });
    // Forslaget = KOPI av serverraden (samme id), grunn slettet_telefon.
    await prismaTimer.sheetTimerForslag.create({
      data: { ...forslagRad(RAD_1, "07:00", "15:30", 8), grunn: "slettet_telefon" },
    });
    await prismaTimer.dailySheet.update({ where: { id: SHEET }, data: { konfliktVentendeSiden: new Date() } });

    const sedelRader: ForsonRad[] = (await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } })).map((r) => ({
      id: r.id, projectId: r.projectId, lonnsartId: r.lonnsartId, aktivitetId: r.aktivitetId,
      timer: Number(r.timer), fraTid: r.fraTid, tilTid: r.tilTid,
    }));
    const forslag: ForsonRad[] = (await prismaTimer.sheetTimerForslag.findMany({ where: { sheetId: SHEET } })).map((f) => ({
      id: f.id, projectId: f.projectId, lonnsartId: f.lonnsartId, aktivitetId: f.aktivitetId,
      timer: Number(f.timer), fraTid: f.fraTid, tilTid: f.tilTid, grunn: f.grunn as ForsonRad["grunn"],
    }));
    const input = byggForsonInputFraValg(sedelRader, forslag, { [RAD_1]: "forslag" });
    expect(input.slettinger).toEqual([RAD_1]);

    // forsonDagskorts slettinger-steg (A'-7) i EKTE tx.
    await prismaTimer.$transaction(async (tx) => {
      await tx.sheetTimer.deleteMany({ where: { sheetId: SHEET, id: { in: input.slettinger } } });
      await tx.sheetTimerForslag.deleteMany({ where: { sheetId: SHEET } });
      await tx.dailySheet.update({ where: { id: SHEET }, data: { konfliktVentendeSiden: null } });
    });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: SHEET } })).toBe(0);
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(0);
    expect((await prismaTimer.dailySheet.findUnique({ where: { id: SHEET } }))!.konfliktVentendeSiden).toBeNull();
    await ryddOpp();
  });
});

describe("V19 FASIT (gate 3) — web 07:00–15:00 + mobil 07:00–15:30 → 8 t etter valg, ikke 15,5", () => {
  it("🔴 velg «appen»: byggForsonInputFraValg → in-place-erstatning → sheet_timer = 8 t (ÉN rad)", async () => {
    await seedKatalog();
    await lagSedel();
    // 1. PC-raden slik web lagret den (7,5 t).
    await prismaTimer.sheetTimer.create({
      data: {
        id: RAD_1,
        sheetId: SHEET,
        projectId: PROSJEKT,
        lonnsartId: LONNSART,
        aktivitetId: AKTIVITET,
        timer: 7.5,
        fraTid: "07:00",
        tilTid: "15:00",
      },
    });
    // 2. Mobilens overlappende rad lagret som FORSLAG (8 t) + konfliktVentendeSiden satt
    //    (det lagreOverlappForslag gjør). sheet_timer er urørt → 7,5 t så lenge valget venter.
    await prismaTimer.sheetTimerForslag.create({ data: forslagRad(RAD_2, "07:00", "15:30", 8) });
    await prismaTimer.dailySheet.update({
      where: { id: SHEET },
      data: { konfliktVentendeSiden: new Date() },
    });
    expect(
      (await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } }))
        .reduce((s, r) => s + Number(r.timer), 0),
    ).toBe(7.5);

    // 3. Arbeideren velger «appen» for hele dagen. DELTE byggForsonInputFraValg bygger
    //    forsonDagskort-inputet fra FORSLAGET på serveren.
    const sedelRader = await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } });
    const forslag = await prismaTimer.sheetTimerForslag.findMany({ where: { sheetId: SHEET } });
    const input = byggForsonInputFraValg(
      sedelRader.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        lonnsartId: r.lonnsartId,
        aktivitetId: r.aktivitetId,
        timer: Number(r.timer),
        fraTid: r.fraTid,
        tilTid: r.tilTid,
      })),
      forslag.map((f) => ({
        id: f.id,
        projectId: f.projectId,
        lonnsartId: f.lonnsartId,
        aktivitetId: f.aktivitetId,
        timer: Number(f.timer),
        fraTid: f.fraTid,
        tilTid: f.tilTid,
      })),
      { [RAD_2]: "forslag" },
    );
    // Erstatter web-raden IN-PLACE (på RAD_1-id), ingen ny rad.
    expect(input.oppdateringer).toHaveLength(1);
    expect(input.oppdateringer[0]!.id).toBe(RAD_1);
    expect(input.nyeRader).toHaveLength(0);

    // 4. forsonDagskorts DB-steg (A-5): in-place update + slett forslag + null felt, i tx.
    await prismaTimer.$transaction(async (tx) => {
      for (const o of input.oppdateringer) {
        await tx.sheetTimer.update({
          where: { id: o.id },
          data: { timer: o.timer, fraTid: o.fraTid, tilTid: o.tilTid },
        });
      }
      await tx.sheetTimerForslag.deleteMany({ where: { sheetId: SHEET } });
      await tx.dailySheet.update({ where: { id: SHEET }, data: { konfliktVentendeSiden: null } });
    });

    // 5. Fasit: serveren har 8 t (ÉN rad), ikke 15,5; forslaget borte; feltet nullet.
    const etter = await prismaTimer.sheetTimer.findMany({ where: { sheetId: SHEET } });
    expect(etter).toHaveLength(1);
    expect(Number(etter[0]!.timer)).toBe(8);
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: SHEET } })).toBe(0);
    expect(
      (await prismaTimer.dailySheet.findUnique({ where: { id: SHEET } }))!.konfliktVentendeSiden,
    ).toBeNull();
    await ryddOpp();
  });
});
