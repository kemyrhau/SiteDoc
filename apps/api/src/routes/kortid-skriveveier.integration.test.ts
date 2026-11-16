import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { byggForsonInputFraValg, type ForsonRad } from "@sitedoc/shared";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { vareforbrukRouter } from "./vareforbruk";

/**
 * Kort-id, ordre b — T5–T9 (prosjektkort-kortid-spec.md § 9) gjennom prosedyrene
 * (`createCaller`) mot EKTE Postgres (lokal sandkasse `sitedoc_kortid_b`, aldri test/prod).
 *
 * T5: pr. server-skrivevei — etter kallet har alle arbeidsrader (timer/tillegg/maskin/utlegg,
 *     vare med sedel) `kortId` ≠ null; reise-rad har null. Radene som finnes fra før, legges
 *     inn rått med `kort_id NULL` (som før migreringen), så testen måler skriveveien.
 * T6: syncBatch uten `kortId` (eldre klient) — regel 2 og 3, to kort på samme nøkkel holdes adskilt.
 * T7: syncBatch med `kortId` som bryter K2/K3 → `avvist` (`kortUlikeRader`), ingenting skrevet.
 * T8: V19 forslag → forsoning beholder kortets id; V19.9 hoppet rad beholder id.
 * T9: kort-id fra en annen brukers sedel kan ikke brukes (K1 → avvist).
 *
 * Kjerne-seeden er brukket, så all data lages her med faste id-er (prefiks c0d1e5f0) og
 * ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02"); // arbeideren
const USER2 = id("03"); // annen arbeider i samme firma (T9)
const ADMIN = id("04"); // sitedoc_admin (attesteringsveiene)
const P1 = id("11");
const P2 = id("12");
const BYGGEPLASS_1 = id("21"); // i P1
const ECO_1 = id("31"); // i P1
const ORD = id("41"); // ordinær lønnsart (standardvalg)
const REISE = id("42"); // reise-lønnsart (OrganizationSetting.reiseLonnsartId)
const AKT = id("43");
const TILLEGG = id("44");
const KATEGORI = id("45"); // utleggskategori, ordning «utlegg»
const MASKIN = id("51"); // Equipment
const VARE = id("61");

const BRUKERE = [USER, USER2, ADMIN];

function ctx(userId: string) {
  return {
    prisma,
    prismaMaskin,
    prismaTimer,
    prismaVarelager,
    userId,
    actualUserId: userId,
    imperseringAktiv: false,
    sessionToken: null,
    tokenKilde: null,
    ipAddress: null,
    userAgent: null,
    req: { log: { info: () => {}, warn: () => {}, error: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const dag = (userId = USER) => dagsseddelRouter.createCaller(ctx(userId));
const vare = (userId = USER) => vareforbrukRouter.createCaller(ctx(userId));

// Én sedel pr. test → egen dato (unik pr. bruker).
let datoTeller = 0;
function nyDato(): string {
  const d = new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function nySedel(opts: { userId?: string; status?: string; byggeplassId?: string | null } = {}) {
  const sid = randomUUID();
  const userId = opts.userId ?? USER;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: ORG,
      userId,
      registrertAvUserId: userId,
      aktivitetId: AKT,
      byggeplassId: opts.byggeplassId ?? null,
      dato: new Date(nyDato()),
      status: opts.status ?? "draft",
    },
  });
  return sid;
}

/** Rå timerrad med `kort_id NULL` (som en rad fra før migreringen). */
async function raTimer(
  sheetId: string,
  f: { fra?: string; til?: string; timer?: number; projectId?: string; kortId?: string | null } = {},
) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: f.projectId ?? P1,
      lonnsartId: ORD,
      aktivitetId: AKT,
      fraTid: f.fra ?? "07:00",
      tilTid: f.til ?? "11:00",
      timer: f.timer ?? 4,
      kortId: f.kortId ?? null,
    },
  });
  return r.id;
}

type KortRad = { id: string; kortId: string | null };
async function kortPaaSedel(sheetId: string) {
  const [timer, tillegg, maskin, utlegg] = await Promise.all([
    prismaTimer.sheetTimer.findMany({
      where: { sheetId },
      select: { id: true, kortId: true, erReise: true, projectId: true, externalCostObjectId: true, updatedAt: true, beskrivelse: true },
      orderBy: { createdAt: "asc" },
    }),
    prismaTimer.sheetTillegg.findMany({ where: { sheetId }, select: { id: true, kortId: true } }),
    prismaTimer.sheetMachine.findMany({ where: { sheetId }, select: { id: true, kortId: true, sheetTimerId: true } }),
    prismaTimer.sheetUtlegg.findMany({ where: { sheetId }, select: { id: true, kortId: true } }),
  ]);
  return { timer, tillegg, maskin, utlegg };
}

/** Alle ikke-reise arbeidsrader på sedelen har kort-id; reise har null. */
function forventAlleMedKort(rader: KortRad[]) {
  expect(rader.length).toBeGreaterThan(0);
  for (const r of rader) expect(r.kortId, `rad ${r.id} mangler kort_id`).not.toBeNull();
}

// ── syncBatch-hjelpere ──────────────────────────────────────────────────────
type SyncTimer = {
  id: string;
  projectId?: string;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string;
  tilTid: string;
  pauseMin?: number;
  externalCostObjectId?: string | null;
  beskrivelse?: string | null;
  kortId?: string | null;
  serverVersjon?: string | null;
  endretLokalt?: boolean;
};
const syncTimer = (rid: string, fra: string, til: string, timer: number, ekstra: Partial<SyncTimer> = {}): SyncTimer => ({
  id: rid,
  projectId: P1,
  lonnsartId: ORD,
  aktivitetId: AKT,
  timer,
  fraTid: fra,
  tilTid: til,
  pauseMin: 0,
  ...ekstra,
});
function syncSedel(clientUuid: string, dato: string, timer: SyncTimer[], ekstra: Record<string, unknown> = {}) {
  return {
    clientUuid,
    projectId: P1,
    aktivitetId: AKT,
    dato,
    status: "draft" as const,
    pauseMin: 0,
    timer,
    tillegg: [],
    maskiner: [],
    utlegg: [],
    ...ekstra,
  };
}
async function sync(sedel: ReturnType<typeof syncSedel>, userId = USER) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svar = await dag(userId).syncBatch({ sedler: [sedel as any] });
  return svar.resultater[0]!;
}
const kortFor = async (radId: string) =>
  (await prismaTimer.sheetTimer.findUnique({ where: { id: radId }, select: { kortId: true } }))?.kortId ?? null;

// ── Oppsett / rydding ───────────────────────────────────────────────────────
async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({
    where: { userId: { in: BRUKERE } },
    select: { id: true },
  });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of [
      "sheet_timer_forslag",
      "sheet_rad_historikk",
      "sheet_machines",
      "sheet_tillegg",
      "sheet_utlegg",
      "sheet_timer",
    ]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaVarelager.vareforbruk.deleteMany({ where: { registrertAvUserId: { in: BRUKERE } } });
  await prismaVarelager.vare.deleteMany({ where: { id: VARE } });
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, REISE] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prismaTimer.tillegg.deleteMany({ where: { id: TILLEGG } });
  await prismaTimer.expenseCategory.deleteMany({ where: { id: KATEGORI } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_1 } });
  await prisma.byggeplass.deleteMany({ where: { id: BYGGEPLASS_1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "kortid-skrivevei-1@sitedoc.test", name: "Arbeider Én", role: "user" },
      { id: USER2, email: "kortid-skrivevei-2@sitedoc.test", name: "Arbeider To", role: "user" },
      { id: ADMIN, email: "kortid-skrivevei-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "Kort-id-firma" } });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: USER2, organizationId: ORG, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [
      { organizationId: ORG, moduleSlug: "timer", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "varelager", status: "aktiv" },
      { organizationId: ORG, moduleSlug: "maskin", status: "aktiv" },
    ],
  });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, reiseLonnsartId: REISE, tillattRedigerVedAttestering: true },
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "KIDS-1", name: "Kort-id P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "KIDS-2", name: "Kort-id P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectMember.createMany({
    data: [USER, USER2].flatMap((u) => [
      { userId: u, projectId: P1, role: "member" },
      { userId: u, projectId: P2, role: "member" },
    ]),
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].flatMap((p) => [
      { projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: p, moduleSlug: "varelager", organizationId: ORG, status: "aktiv" },
    ]),
  });
  await prisma.byggeplass.create({ data: { id: BYGGEPLASS_1, projectId: P1, name: "Kort-id B1" } });
  await prisma.externalCostObject.create({
    data: {
      id: ECO_1,
      organizationId: ORG,
      projectId: P1,
      proAdmId: "KID-E1",
      kortNavn: "Grøft",
      kilde: "manuell",
      opprettetAvUserId: ADMIN,
    },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: REISE, organizationId: ORG, type: "ordinaer", navn: "Reisetid", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Grunnarbeid" } });
  await prismaTimer.tillegg.create({ data: { id: TILLEGG, organizationId: ORG, navn: "Smuss", type: "avhuking" } });
  await prismaTimer.expenseCategory.create({
    data: { id: KATEGORI, organizationId: ORG, navn: "Parkering", ordning: "utlegg" },
  });
  await prismaMaskin.equipment.create({
    data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" },
  });
  await prismaVarelager.vare.create({ data: { id: VARE, organizationId: ORG, navn: "Pukk 6-32", enhet: "tonn" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
//  T5 — hver server-skrivevei etterlater arbeidsrader med kort-id
// ════════════════════════════════════════════════════════════════════════════
describe("T5 — server-skriveveier fyller kort_id (reise = null)", () => {
  it("opprett → opprettForsteTimerRadForslag: auto-første-rad har kort-id", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    await dag().opprett({
      clientUuid,
      aktivitetId: AKT,
      projectId: P1,
      dato,
      // 07:00–11:00 Oslo (CEST) — under pause-terskelen.
      startAt: `${dato}T05:00:00.000Z`,
      endAt: `${dato}T09:00:00.000Z`,
    });
    const { timer } = await kortPaaSedel(clientUuid);
    expect(timer).toHaveLength(1);
    forventAlleMedKort(timer);
  });

  it("tilfoyTimerRad: arbeidsrad uten oppgitt id får kort-id (regel 3)", async () => {
    const sid = await nySedel();
    const rad = await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      timer: 4, fraTid: "07:00", tilTid: "11:00", pauseMin: 0,
    });
    expect(rad.kortId).not.toBeNull();
    forventAlleMedKort((await kortPaaSedel(sid)).timer);
  });

  it("tilfoyTimerRad: reise-rad får kort_id NULL, også med oppgitt id", async () => {
    const sid = await nySedel();
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: REISE, aktivitetId: AKT,
      timer: 1, fraTid: "06:00", tilTid: "07:00", pauseMin: 0, kortId: randomUUID(),
    });
    await dag().tilfoyTimerRad({
      sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      timer: 4, fraTid: "07:00", tilTid: "11:00", pauseMin: 0,
    });
    const { timer } = await kortPaaSedel(sid);
    const reise = timer.filter((t) => t.erReise);
    const arbeid = timer.filter((t) => !t.erReise);
    expect(reise).toHaveLength(1);
    expect(reise[0]!.kortId).toBeNull();
    forventAlleMedKort(arbeid);
  });

  it("oppdaterTimerRad: rad uten kort-id får kort-id", async () => {
    const sid = await nySedel();
    const rid = await raTimer(sid);
    await dag().oppdaterTimerRad({ id: rid, fraTid: "07:00", tilTid: "11:00", beskrivelse: "Grøft" });
    forventAlleMedKort((await kortPaaSedel(sid)).timer);
  });

  it("forsonDagskort: ny rad og eksisterende rad har kort-id etter forsoning", async () => {
    const sid = await nySedel();
    await raTimer(sid);
    await dag().forsonDagskort({
      sheetId: sid,
      nyeRader: [
        { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, timer: 3, fraTid: "12:00", tilTid: "15:00", pauseMin: 0 },
      ],
    });
    const { timer } = await kortPaaSedel(sid);
    expect(timer).toHaveLength(2);
    forventAlleMedKort(timer);
  });

  it("tilfoyTilleggRad: tillegg får kort-id", async () => {
    const sid = await nySedel();
    const rad = await dag().tilfoyTilleggRad({ sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1 });
    expect(rad.kortId).not.toBeNull();
    forventAlleMedKort((await kortPaaSedel(sid)).tillegg);
  });

  it("oppdaterTilleggRad: tillegg uten kort-id får kort-id", async () => {
    const sid = await nySedel();
    const t = await prismaTimer.sheetTillegg.create({
      data: { sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1 },
    });
    await dag().oppdaterTilleggRad({ id: t.id, antall: 2 });
    forventAlleMedKort((await kortPaaSedel(sid)).tillegg);
  });

  it("tilfoyUtleggRad: utlegg får kort-id", async () => {
    const sid = await nySedel();
    const rad = await dag().tilfoyUtleggRad({ sheetId: sid, projectId: P1, expenseCategoryId: KATEGORI, belop: 120 });
    expect(rad.kortId).not.toBeNull();
    forventAlleMedKort((await kortPaaSedel(sid)).utlegg);
  });

  it("oppdaterUtleggRad: utlegg uten kort-id får kort-id", async () => {
    const sid = await nySedel();
    const u = await prismaTimer.sheetUtlegg.create({
      data: { sheetId: sid, projectId: P1, expenseCategoryId: KATEGORI, belop: 100, ordningVedFoering: "utlegg" },
    });
    await dag().oppdaterUtleggRad({ id: u.id, kommentar: "Parkering ved byggeplass" });
    forventAlleMedKort((await kortPaaSedel(sid)).utlegg);
  });

  it("maskin.tilfoy: maskin (og timerraden på sedelen) får kort-id", async () => {
    const sid = await nySedel();
    // Ordre d2c-1 (R24): maskin uten satt enhet føres på timeraden den gikk på.
    const tid = await raTimer(sid);
    const rad = await dag().maskin.tilfoy({ sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 2, sheetTimerId: tid });
    expect(rad.kortId).not.toBeNull();
    const { timer, maskin } = await kortPaaSedel(sid);
    forventAlleMedKort([...timer, ...maskin]);
  });

  it("maskin.oppdater: maskin uten kort-id får kort-id", async () => {
    const sid = await nySedel();
    // Ordre d2c-1 (R24): maskinen står på timeraden (endring krever gyldig kobling).
    const tid = await raTimer(sid);
    const m = await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 2, sheetTimerId: tid },
    });
    await dag().maskin.oppdater({ id: m.id, timer: 3 });
    forventAlleMedKort((await kortPaaSedel(sid)).maskin);
  });

  it("flyttTimerRadEco (attestering): flyttet rad får kort-id for ny nøkkel", async () => {
    const sid = await nySedel({ status: "sent" });
    const rid = await raTimer(sid);
    await dag(ADMIN).flyttTimerRadEco({ timerRadId: rid, externalCostObjectId: ECO_1 });
    forventAlleMedKort((await kortPaaSedel(sid)).timer);
  });

  it("redigerSedelRader (attestering): nye timer-, tillegg- og maskinrader har kort-id", async () => {
    const sid = await nySedel({ status: "sent" });
    const rid = await raTimer(sid);
    const tl = await prismaTimer.sheetTillegg.create({
      data: { sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1 },
    });
    const m = await prismaTimer.sheetMachine.create({
      data: { sheetId: sid, projectId: P1, vehicleId: MASKIN, timer: 2 },
    });
    await dag(ADMIN).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: rid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "11:00", timer: 4, pauseMin: 0 },
        ],
        tillegg: [{ originalId: tl.id, projectId: P1, tilleggId: TILLEGG, antall: 2 }],
        maskin: [{ originalId: m.id, projectId: P1, vehicleId: MASKIN, timer: 2 }],
      },
    });
    const { timer, tillegg, maskin } = await kortPaaSedel(sid);
    expect(timer).toHaveLength(1);
    expect(tillegg).toHaveLength(1);
    expect(maskin).toHaveLength(1);
    forventAlleMedKort([...timer, ...tillegg, ...maskin]);
  });

  it("splittRad (attestering): begge delene har kort-id", async () => {
    const sid = await nySedel({ status: "sent" });
    const rid = await raTimer(sid);
    await dag(ADMIN).splittRad({
      radType: "timer",
      radId: rid,
      nyeRader: [
        { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2 },
        { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "09:00", tilTid: "11:00", timer: 2 },
      ],
    });
    // Ordre d2a: første del beholder originalens id (koblingene står), den andre er ny.
    const aktive = (await kortPaaSedel(sid)).timer;
    expect(aktive).toHaveLength(2);
    expect(aktive.map((t) => t.id)).toContain(rid);
    forventAlleMedKort(aktive);
  });

  it("splittRadEier: begge delene har kort-id", async () => {
    const sid = await nySedel();
    const rid = await raTimer(sid);
    await dag().splittRadEier({
      radType: "timer",
      radId: rid,
      nyeRader: [
        { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2 },
        { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "09:00", tilTid: "11:00", timer: 2 },
      ],
    });
    const { timer } = await kortPaaSedel(sid);
    expect(timer).toHaveLength(2);
    forventAlleMedKort(timer);
  });

  it("syncBatch: timer, tillegg, maskin og utlegg uten kort-id får kort-id; reise null", async () => {
    const clientUuid = randomUUID();
    const reiseId = randomUUID();
    const svar = await sync(
      syncSedel(clientUuid, nyDato(), [
        syncTimer(reiseId, "06:00", "07:00", 1, { lonnsartId: REISE }),
        syncTimer(randomUUID(), "07:00", "11:00", 4),
      ], {
        tillegg: [{ id: randomUUID(), projectId: P1, tilleggId: TILLEGG, antall: 1 }],
        maskiner: [{ id: randomUUID(), projectId: P1, vehicleId: MASKIN, timer: 2 }],
        utlegg: [
          {
            id: randomUUID(), projectId: P1, expenseCategoryId: KATEGORI, belop: 80,
            ordningVedFoering: "utlegg", foertVed: new Date().toISOString(),
          },
        ],
      }),
    );
    expect(svar.resultat).toBe("ok");
    const { timer, tillegg, maskin, utlegg } = await kortPaaSedel(clientUuid);
    expect(timer.find((t) => t.id === reiseId)?.erReise).toBe(true);
    expect(await kortFor(reiseId)).toBeNull();
    forventAlleMedKort([...timer.filter((t) => t.id !== reiseId), ...tillegg, ...maskin, ...utlegg]);
  });

  it("vareforbruk.opprett med sedel: varen får kort-id", async () => {
    const sid = await nySedel();
    await raTimer(sid);
    const v = await vare().opprett({ projectId: P1, dato: "2026-10-01", vareId: VARE, antall: 3, dagsseddelId: sid });
    const lagret = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } });
    expect(lagret.kortId).not.toBeNull();
  });

  it("vareforbruk.oppdater med sedel: vare uten kort-id får kort-id", async () => {
    const sid = await nySedel();
    await raTimer(sid);
    const v = await prismaVarelager.vareforbruk.create({
      data: {
        dato: new Date("2026-10-01"), projectId: P1, vareId: VARE, antall: 1,
        registrertAvUserId: USER, dagsseddelId: sid,
      },
    });
    await vare().oppdater({ id: v.id, antall: 2 });
    const lagret = await prismaVarelager.vareforbruk.findUniqueOrThrow({ where: { id: v.id } });
    expect(lagret.kortId).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  T6 — syncBatch uten kortId (eldre klient)
// ════════════════════════════════════════════════════════════════════════════
describe("T6 — syncBatch fra eldre klient (uten kortId)", () => {
  it("kjent rad beholder id ved ny push (id fylt av serveren første gang)", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    const sedel = syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4)]);
    expect((await sync(sedel)).resultat).toBe("ok");
    const forst = await kortFor(a);
    expect(forst).not.toBeNull();
    expect((await sync(sedel)).resultat).toBe("ok");
    expect(await kortFor(a)).toBe(forst);
  });

  it("kjent rad beholder klientens id (regel 2), ikke utledet id", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    const x = randomUUID();
    expect((await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4, { kortId: x })]))).resultat).toBe("ok");
    // Eldre klient pusher samme rad uten kortId.
    expect((await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4)]))).resultat).toBe("ok");
    expect(await kortFor(a)).toBe(x);
  });

  describe("to kort med samme nøkkel", () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    const b = randomUUID();
    const c = randomUUID();
    const x = randomUUID(); // eldste kort
    const y = randomUUID(); // nytt kort, samme nøkkel (K7)

    it("ny rad uten kortId havner i ELDSTE kort med samme nøkkel", async () => {
      expect((await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "09:00", 2, { kortId: x })]))).resultat).toBe("ok");
      expect((await sync(syncSedel(clientUuid, dato, [syncTimer(b, "09:00", "11:00", 2, { kortId: y })]))).resultat).toBe("ok");
      expect((await sync(syncSedel(clientUuid, dato, [syncTimer(c, "11:00", "13:00", 2)]))).resultat).toBe("ok");
      expect(await kortFor(c)).toBe(x);
    });

    it("to kort forblir to når eldre klient pusher alle radene uten kortId", async () => {
      const svar = await sync(
        syncSedel(clientUuid, dato, [
          syncTimer(a, "07:00", "09:00", 2),
          syncTimer(b, "09:00", "11:00", 2),
          syncTimer(c, "11:00", "13:00", 2),
        ]),
      );
      expect(svar.resultat).toBe("ok");
      expect(await kortFor(a)).toBe(x);
      expect(await kortFor(b)).toBe(y);
      expect(await kortFor(c)).toBe(x);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  T7 — K2/K3-brudd i syncBatch avvises, ingenting skrives
// ════════════════════════════════════════════════════════════════════════════
describe("T7 — syncBatch med kortId som bryter K2/K3", () => {
  const clientUuid = randomUUID();
  const dato = nyDato();
  const a = randomUUID();
  const x = randomUUID();
  let foer: Awaited<ReturnType<typeof kortPaaSedel>>;

  beforeAll(async () => {
    const svar = await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4, { kortId: x })]));
    expect(svar.resultat).toBe("ok");
    foer = await kortPaaSedel(clientUuid);
  });

  async function forventUendret() {
    const etter = await kortPaaSedel(clientUuid);
    expect(etter).toEqual(foer);
  }

  it("K2: samme kortId, ulikt prosjekt → avvist kortUlikeRader, sedelen uendret", async () => {
    const svar = await sync(
      syncSedel(clientUuid, dato, [
        syncTimer(a, "07:00", "11:00", 4, { kortId: x }),
        syncTimer(randomUUID(), "12:00", "14:00", 2, { projectId: P2, kortId: x }),
      ]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toBe("kortUlikeRader");
    await forventUendret();
  });

  it("K3: samme kortId, ulikt underprosjekt → avvist kortUlikeRader, sedelen uendret", async () => {
    const svar = await sync(
      syncSedel(clientUuid, dato, [
        syncTimer(a, "07:00", "11:00", 4, { kortId: x }),
        syncTimer(randomUUID(), "12:00", "14:00", 2, { externalCostObjectId: ECO_1, kortId: x }),
      ]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toBe("kortUlikeRader");
    await forventUendret();
  });

  it("K2 på ny sedel → avvist, sedelen opprettes ikke", async () => {
    const ny = randomUUID();
    const k = randomUUID();
    const svar = await sync(
      syncSedel(ny, nyDato(), [
        syncTimer(randomUUID(), "07:00", "11:00", 4, { kortId: k }),
        syncTimer(randomUUID(), "12:00", "14:00", 2, { projectId: P2, kortId: k }),
      ]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toBe("kortUlikeRader");
    expect(await prismaTimer.dailySheet.findUnique({ where: { clientUuid: ny } })).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  T8 — V19 forslag/forsoning og V19.9 hoppet rad
// ════════════════════════════════════════════════════════════════════════════
describe("T8 — V19 og V19.9 bevarer kort-id", () => {
  it("V19: rad lagt som overlapp-forslag og forsonet tilbake har samme kortId", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    const m = randomUUID();
    const kortA = randomUUID();
    const kortM = randomUUID();
    expect((await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4, { kortId: kortA })]))).resultat).toBe("ok");

    // Telefonen pusher en overlappende rad med eget kort → forslag.
    const svar = await sync(syncSedel(clientUuid, dato, [syncTimer(m, "07:00", "11:30", 4.5, { kortId: kortM })]));
    expect(svar.resultat).toBe("conflict");
    expect(svar.aarsak).toBe("overlapp");
    const forslag = await prismaTimer.sheetTimerForslag.findMany({ where: { sheetId: clientUuid } });
    expect(forslag.map((f) => [f.id, f.kortId])).toEqual([[m, kortM]]);

    // Arbeideren velger forslaget (samme input som klienten bygger).
    const sedelRader: ForsonRad[] = (await prismaTimer.sheetTimer.findMany({ where: { sheetId: clientUuid } })).map((r) => ({
      id: r.id, projectId: r.projectId, byggeplassId: r.byggeplassId, lonnsartId: r.lonnsartId,
      aktivitetId: r.aktivitetId, timer: Number(r.timer), fraTid: r.fraTid, tilTid: r.tilTid,
      externalCostObjectId: r.externalCostObjectId,
    }));
    const forslagRader: ForsonRad[] = forslag.map((f) => ({
      id: f.id, projectId: f.projectId, byggeplassId: f.byggeplassId, lonnsartId: f.lonnsartId,
      aktivitetId: f.aktivitetId, timer: Number(f.timer), fraTid: f.fraTid, tilTid: f.tilTid,
      externalCostObjectId: f.externalCostObjectId, grunn: f.grunn as ForsonRad["grunn"],
    }));
    const input = byggForsonInputFraValg(sedelRader, forslagRader, { [m]: "forslag" });
    await dag().forsonDagskort({ sheetId: clientUuid, ...input });

    const { timer } = await kortPaaSedel(clientUuid);
    expect(timer).toHaveLength(1);
    expect(timer[0]!.kortId).toBe(kortM);
    expect(await prismaTimer.sheetTimerForslag.count({ where: { sheetId: clientUuid } })).toBe(0);
  });

  it("V19.9: rad som hoppes over (versjonssjekk) beholder id, og ny rad med samme nøkkel får den", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    const n = randomUUID();
    const x = randomUUID();
    const forst = await sync(
      syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4, { kortId: x, beskrivelse: "Grøft" })]),
    );
    expect(forst.resultat).toBe("ok");
    const versjon = forst.serverData!.rader!.find((r) => r.id === a)!.updatedAt;

    // PC endrer raden (ny versjon).
    await dag().oppdaterTimerRad({ id: a, fraTid: "07:00", tilTid: "11:00", beskrivelse: "Grøft, PC" });
    expect(await kortFor(a)).toBe(x);

    // Telefonen (uendret, gammel versjon) + en ny rad uten kortId.
    const svar = await sync(
      syncSedel(clientUuid, dato, [
        syncTimer(a, "07:00", "11:00", 4, { beskrivelse: "Grøft", serverVersjon: versjon, endretLokalt: false }),
        syncTimer(n, "12:00", "14:00", 2),
      ]),
    );
    expect(svar.resultat).toBe("ok");
    expect(svar.serverData!.hoppetOver).toEqual([a]);
    const rad = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: a } });
    expect(rad.beskrivelse).toBe("Grøft, PC");
    expect(rad.kortId).toBe(x);
    expect(await kortFor(n)).toBe(x);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  T9 — kort-id fra en annen brukers sedel avvises (K1)
// ════════════════════════════════════════════════════════════════════════════
describe("T9 — kort-id fra annen brukers sedel", () => {
  const fremmedKort = randomUUID();

  beforeAll(async () => {
    const sid2 = await nySedel({ userId: USER2 });
    await raTimer(sid2, { kortId: fremmedKort });
  });

  it("syncBatch: ny sedel med annen brukers kortId → avvist kortUlikeRader, ingenting skrevet", async () => {
    const clientUuid = randomUUID();
    const svar = await sync(
      syncSedel(clientUuid, nyDato(), [syncTimer(randomUUID(), "07:00", "11:00", 4, { kortId: fremmedKort })]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toBe("kortUlikeRader");
    expect(await prismaTimer.dailySheet.findUnique({ where: { clientUuid } })).toBeNull();
  });

  it("syncBatch: eksisterende sedel med annen brukers kortId → avvist, sedelen uendret", async () => {
    const clientUuid = randomUUID();
    const dato = nyDato();
    const a = randomUUID();
    expect((await sync(syncSedel(clientUuid, dato, [syncTimer(a, "07:00", "11:00", 4)]))).resultat).toBe("ok");
    const foer = await kortPaaSedel(clientUuid);
    const svar = await sync(
      syncSedel(clientUuid, dato, [
        syncTimer(a, "07:00", "11:00", 4),
        syncTimer(randomUUID(), "12:00", "14:00", 2, { kortId: fremmedKort }),
      ]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(svar.feilmelding).toBe("kortUlikeRader");
    expect(await kortPaaSedel(clientUuid)).toEqual(foer);
  });

  it("tilfoyTimerRad med annen brukers kortId → kortUlikeRader, ingen rad", async () => {
    const sid = await nySedel();
    await expect(
      dag().tilfoyTimerRad({
        sheetId: sid, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
        timer: 4, fraTid: "07:00", tilTid: "11:00", pauseMin: 0, kortId: fremmedKort,
      }),
    ).rejects.toThrow("kortUlikeRader");
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("tilfoyTilleggRad med annen brukers kortId → kortUlikeRader, ingen rad", async () => {
    const sid = await nySedel();
    await expect(
      dag().tilfoyTilleggRad({ sheetId: sid, projectId: P1, tilleggId: TILLEGG, antall: 1, kortId: fremmedKort }),
    ).rejects.toThrow("kortUlikeRader");
    expect(await prismaTimer.sheetTillegg.count({ where: { sheetId: sid } })).toBe(0);
  });
});
