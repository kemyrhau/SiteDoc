import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { rapportRouter } from "./timer/rapport";
import { lonnsartRouter } from "./timer/lonnsart";
import { organisasjonRouter } from "./organisasjon";

/**
 * Kort-id-spec § 11 (fravær uten prosjekt), ordre b2 — TF1–TF7, TF11, TF26 og TF27 (server)
 * gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse `sitedoc_kortid_b`,
 * aldri test/prod). All data lages her med faste id-er (prefiks f0a7e500) og ryddes i afterAll.
 *
 * TF1  CHECK på sheet_timer: uten prosjekt krever flagg; flagg utelukker prosjekt/byggeplass/
 *      underprosjekt/reise.
 * TF2  Pr. skrivevei: flagg + ikke-fravær → avvist, ingenting skrevet; flagg + fravær → NULL.
 * TF3  Arbeidsrad uten prosjekt og uten flagg lagres ikke.
 * TF4  syncBatch, eldre klient (§ 11.3).
 * TF5  Attesteringsrett F1 + `fravaerKanAttesteres` = det serveren håndhever.
 * TF6  Rapport/eksport: «Fravær» uten prosjektfilter, utelatt med filter, aldri null-navn.
 * TF7  Firma-isolasjon; firmavalget leses fra SEDELENS firma.
 * TF11 lonnsart.oppdater: type bort fra fravær avvises mens arten står på rad uten prosjekt.
 * TF26 F1-kolonnen er false etter migrering; bare firma-admin skriver den.
 * TF27 Fravær på framtidig dato lagres (tilfoyTimerRad, syncBatch).
 */

const id = (n: string) => `f0a7e500-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG2 = id("02");
const USER = id("03"); // arbeider i ORG
const USER_B = id("04"); // arbeider i ORG2
const LEDER = id("05"); // prosjektadmin på P1, aktiv ansatt i ORG og ORG2
const LEDER_P2 = id("06"); // prosjektadmin bare på P2, aktiv ansatt i ORG
const FADMIN = id("07"); // firma-admin i ORG
const FADMIN2 = id("08"); // firma-admin i ORG2
const ADMIN = id("09"); // sitedoc_admin
const P1 = id("11");
const P2 = id("12");
const BYGGEPLASS_1 = id("21");
const ORD = id("41"); // ordinær lønnsart
const FRAV = id("42"); // fravær (egenmelding)
const FRAV_LEDIG = id("43"); // fravær som ingen rad uten prosjekt bruker (TF11)
const AKT = id("44");
const ORD2 = id("45"); // ORG2 sine arter
const FRAV2 = id("46");
const AKT2 = id("47");

const BRUKERE = [USER, USER_B, LEDER, LEDER_P2, FADMIN, FADMIN2, ADMIN];

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
const rapport = (userId: string) => rapportRouter.createCaller(ctx(userId));
const lonnsart = (userId: string) => lonnsartRouter.createCaller(ctx(userId));
const org = (userId: string) => organisasjonRouter.createCaller(ctx(userId));

let datoTeller = 0;
/** Unik dato pr. sedel, i november 2026 (TF6 spør på den perioden). */
function nyDato(): string {
  const d = new Date(Date.UTC(2026, 10, 1) + datoTeller++ * 86_400_000);
  return d.toISOString().slice(0, 10);
}

async function nySedel(
  opts: { userId?: string; org?: string; status?: string; dato?: string; akt?: string } = {},
) {
  const sid = randomUUID();
  const userId = opts.userId ?? USER;
  await prismaTimer.dailySheet.create({
    data: {
      id: sid,
      clientUuid: sid,
      organizationId: opts.org ?? ORG,
      userId,
      registrertAvUserId: userId,
      aktivitetId: opts.akt ?? AKT,
      dato: new Date(opts.dato ?? nyDato()),
      status: opts.status ?? "draft",
    },
  });
  return sid;
}

/** Rå arbeidsrad på et prosjekt. */
async function arbeid(sheetId: string, projectId = P1, f: { lonnsart?: string; akt?: string } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId,
      lonnsartId: f.lonnsart ?? ORD,
      aktivitetId: f.akt ?? AKT,
      fraTid: "07:00",
      tilTid: "09:00",
      timer: 2,
    },
  });
  return r.id;
}

/** Rå fraværsrad uten prosjekt. */
async function fravaer(sheetId: string, f: { lonnsart?: string; akt?: string; timer?: number } = {}) {
  const r = await prismaTimer.sheetTimer.create({
    data: {
      sheetId,
      projectId: null,
      utenProsjekt: true,
      lonnsartId: f.lonnsart ?? FRAV,
      aktivitetId: f.akt ?? AKT,
      timer: f.timer ?? 5.5,
    },
  });
  return r.id;
}

const rad = (rid: string) =>
  prismaTimer.sheetTimer.findUnique({
    where: { id: rid },
    select: { projectId: true, utenProsjekt: true, attestertStatus: true, lonnsartId: true, timer: true },
  });

async function settFirmavalg(organizationId: string, verdi: boolean) {
  await prisma.organizationSetting.update({
    where: { organizationId },
    data: { fravaerAttesteresAvProsjektleder: verdi },
  });
}

// ── syncBatch ────────────────────────────────────────────────────────────────
type SyncTimer = Record<string, unknown> & { id: string };
function syncSedel(clientUuid: string, dato: string, timer: SyncTimer[], projectId: string | null = null) {
  return {
    clientUuid,
    projectId,
    aktivitetId: AKT,
    dato,
    status: "draft" as const,
    pauseMin: 0,
    timer,
    tillegg: [],
    maskiner: [],
    utlegg: [],
  };
}
async function sync(sedel: ReturnType<typeof syncSedel>, userId = USER) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svar = await dag(userId).syncBatch({ sedler: [sedel as any] });
  return svar.resultater[0]! as {
    resultat: string;
    grunn?: string;
    feilmelding?: string;
    serverData?: { rader?: { id: string; updatedAt: string }[] };
  };
}
/** Radversjonen telefonen fikk ved forrige synk (V19.9) — eldre klient etter V19.9 sender den. */
const versjonFor = (svar: Awaited<ReturnType<typeof sync>>, rid: string) =>
  svar.serverData?.rader?.find((r) => r.id === rid)?.updatedAt ?? null;
const fravaerSync = (rid: string, ekstra: Record<string, unknown> = {}): SyncTimer => ({
  id: rid,
  lonnsartId: FRAV,
  aktivitetId: AKT,
  timer: 7.5,
  fraTid: null,
  tilTid: null,
  pauseMin: 0,
  beskrivelse: "Syk",
  ...ekstra,
});

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
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, FRAV, FRAV_LEDIG, ORD2, FRAV2] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT2] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.byggeplass.deleteMany({ where: { id: BYGGEPLASS_1 } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P2] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P2] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG2] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG2] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "fravaer-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: USER_B, email: "fravaer-arbeider-b@sitedoc.test", name: "Arbeider B", role: "user" },
      { id: LEDER, email: "fravaer-leder@sitedoc.test", name: "Leder P1", role: "user" },
      { id: LEDER_P2, email: "fravaer-leder-p2@sitedoc.test", name: "Leder P2", role: "user" },
      { id: FADMIN, email: "fravaer-fadmin@sitedoc.test", name: "Lønn", role: "user" },
      { id: FADMIN2, email: "fravaer-fadmin2@sitedoc.test", name: "Lønn 2", role: "user" },
      { id: ADMIN, email: "fravaer-admin@sitedoc.test", name: "Admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.createMany({
    data: [
      { id: ORG, name: "Fravær-firma" },
      { id: ORG2, name: "Fravær-firma 2" },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { userId: USER, organizationId: ORG, status: "aktiv" },
      { userId: LEDER, organizationId: ORG, status: "aktiv" },
      { userId: LEDER_P2, organizationId: ORG, status: "aktiv" },
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: USER_B, organizationId: ORG2, status: "aktiv" },
      { userId: LEDER, organizationId: ORG2, status: "aktiv" },
      { userId: FADMIN2, organizationId: ORG2, status: "aktiv", firmaRoller: ["firma_admin"] },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [ORG, ORG2].map((o) => ({ organizationId: o, moduleSlug: "timer", status: "aktiv" })),
  });
  // TF26: feltet utelatt → databasens standard skal gjelde.
  await prisma.organizationSetting.createMany({
    data: [{ organizationId: ORG }, { organizationId: ORG2 }],
  });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "FRAV-1", name: "Fravær P1", primaryOrganizationId: ORG },
      { id: P2, projectNumber: "FRAV-2", name: "Fravær P2", primaryOrganizationId: ORG },
    ],
  });
  await prisma.projectOrganization.createMany({
    data: [
      { projectId: P1, organizationId: ORG },
      { projectId: P2, organizationId: ORG },
      { projectId: P1, organizationId: ORG2, rolle: "underentreprenor" },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: USER, projectId: P1, role: "member" },
      { userId: USER, projectId: P2, role: "member" },
      { userId: USER_B, projectId: P1, role: "member" },
      { userId: LEDER, projectId: P1, role: "admin" },
      { userId: LEDER_P2, projectId: P2, role: "admin" },
    ],
  });
  await prisma.projectModule.createMany({
    data: [P1, P2].map((p) => ({ projectId: p, moduleSlug: "timer", organizationId: ORG, status: "aktiv" })),
  });
  await prisma.byggeplass.create({ data: { id: BYGGEPLASS_1, projectId: P1, name: "Fravær B1" } });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: FRAV, organizationId: ORG, type: "fravaer", navn: "Egenmelding", aktiv: true },
      { id: FRAV_LEDIG, organizationId: ORG, type: "fravaer", navn: "Velferdspermisjon", aktiv: true },
      { id: ORD2, organizationId: ORG2, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: FRAV2, organizationId: ORG2, type: "fravaer", navn: "Egenmelding", aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.createMany({
    data: [
      { id: AKT, organizationId: ORG, navn: "Grunnarbeid" },
      { id: AKT2, organizationId: ORG2, navn: "Grunnarbeid" },
    ],
  });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

// ════════════════════════════════════════════════════════════════════════════
describe("TF1 — CHECK på sheet_timer", () => {
  const lag = (sheetId: string, data: Record<string, unknown>) =>
    prismaTimer.sheetTimer.create({
      data: { sheetId, lonnsartId: FRAV, aktivitetId: AKT, timer: 1, ...data } as never,
    });

  it("avviser rad uten prosjekt og uten flagg", async () => {
    const sid = await nySedel();
    await expect(lag(sid, { projectId: null, utenProsjekt: false })).rejects.toThrow(/check|constraint/i);
  });

  it("avviser flagg sammen med prosjekt, byggeplass, underprosjekt eller reise", async () => {
    const sid = await nySedel();
    await expect(lag(sid, { projectId: P1, utenProsjekt: true })).rejects.toThrow(/check|constraint/i);
    await expect(
      lag(sid, { projectId: null, utenProsjekt: true, byggeplassId: BYGGEPLASS_1 }),
    ).rejects.toThrow(/check|constraint/i);
    await expect(
      lag(sid, { projectId: null, utenProsjekt: true, externalCostObjectId: randomUUID() }),
    ).rejects.toThrow(/check|constraint/i);
    await expect(lag(sid, { projectId: null, utenProsjekt: true, erReise: true })).rejects.toThrow(
      /check|constraint/i,
    );
  });

  it("godtar fravær uten prosjekt med flagg, og vanlig rad med prosjekt", async () => {
    const sid = await nySedel();
    await expect(lag(sid, { projectId: null, utenProsjekt: true })).resolves.toBeTruthy();
    await expect(lag(sid, { projectId: P1 })).resolves.toBeTruthy();
  });

  it("ingen eksisterende rad i databasen bryter regelen (migreringen gikk gjennom)", async () => {
    const [brudd] = await prismaTimer.$queryRawUnsafe<{ n: bigint }[]>(
      `select count(*) as n from timer.sheet_timer
        where (project_id is null and not uten_prosjekt)
           or (uten_prosjekt and (project_id is not null or byggeplass_id is not null
               or external_cost_object_id is not null or er_reise))`,
    );
    expect(Number(brudd!.n)).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF2/TF3 — skriveveiene", () => {
  it("tilfoyTimerRad: flagg + ordinær art → BAD_REQUEST, ingenting skrevet", async () => {
    const sid = await nySedel();
    await expect(
      dag().tilfoyTimerRad({
        sheetId: sid, utenProsjekt: true, lonnsartId: ORD, aktivitetId: AKT, timer: 7.5,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("tilfoyTimerRad: flagg + fravær → lagret med project_id NULL", async () => {
    const sid = await nySedel();
    const r = await dag().tilfoyTimerRad({
      sheetId: sid, utenProsjekt: true, lonnsartId: FRAV, aktivitetId: AKT, timer: 7.5, beskrivelse: "Syk",
    });
    expect(await rad(r.id)).toMatchObject({ projectId: null, utenProsjekt: true });
  });

  it("TF3 tilfoyTimerRad: uten prosjekt og uten flagg → avvist, ingen sedel-fallback", async () => {
    const sid = await nySedel();
    await expect(
      dag().tilfoyTimerRad({ sheetId: sid, lonnsartId: FRAV, aktivitetId: AKT, timer: 7.5 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(0);
  });

  it("syncBatch: flagg + ordinær art → avvist med grunn, ingenting skrevet", async () => {
    const cu = randomUUID();
    const svar = await sync(syncSedel(cu, nyDato(), [fravaerSync(randomUUID(), { utenProsjekt: true, lonnsartId: ORD })]));
    expect(svar).toMatchObject({ resultat: "avvist", grunn: "utenProsjektKreverFravaer" });
    expect(await prismaTimer.dailySheet.count({ where: { clientUuid: cu } })).toBe(0);
  });

  it("syncBatch: flagg + fravær → lagret med project_id NULL (også med sedel-prosjekt satt)", async () => {
    const cu = randomUUID();
    const rid = randomUUID();
    const svar = await sync(
      syncSedel(cu, nyDato(), [fravaerSync(rid, { utenProsjekt: true, projectId: P1, byggeplassId: BYGGEPLASS_1 })], P1),
    );
    expect(svar.resultat).toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true });
  });

  it("TF3 syncBatch: rad uten prosjekt, uten flagg, uten sedel-prosjekt → avvist", async () => {
    const cu = randomUUID();
    const svar = await sync(syncSedel(cu, nyDato(), [fravaerSync(randomUUID())]));
    expect(svar.resultat).toBe("avvist");
    expect(await prismaTimer.dailySheet.count({ where: { clientUuid: cu } })).toBe(0);
  });

  it("redigerSedelRader: fraværsraden bæres videre uten prosjekt", async () => {
    const sid = await nySedel({ status: "sent" });
    const a = await arbeid(sid);
    const f = await fravaer(sid);
    await dag(ADMIN).redigerSedelRader({
      sheetId: sid,
      nyeRader: {
        timer: [
          { originalId: a, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "09:00", timer: 2, pauseMin: 0 },
          { originalId: f, projectId: null, utenProsjekt: true, lonnsartId: FRAV, aktivitetId: AKT, timer: 5, pauseMin: 0 },
        ],
        tillegg: [],
        maskin: [],
      },
    });
    const aktive = await prismaTimer.sheetTimer.findMany({
      where: { sheetId: sid, attestertStatus: { not: "erstattet" } },
      select: { projectId: true, utenProsjekt: true, lonnsartId: true },
    });
    expect(aktive).toHaveLength(2);
    expect(aktive.find((r) => r.lonnsartId === FRAV)).toMatchObject({ projectId: null, utenProsjekt: true });
  });

  it("redigerSedelRader: flagg + ordinær art → BAD_REQUEST", async () => {
    const sid = await nySedel({ status: "sent" });
    const f = await fravaer(sid);
    await expect(
      dag(ADMIN).redigerSedelRader({
        sheetId: sid,
        nyeRader: {
          timer: [{ originalId: f, projectId: null, utenProsjekt: true, lonnsartId: ORD, aktivitetId: AKT, timer: 5, pauseMin: 0 }],
          tillegg: [],
          maskin: [],
        },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await rad(f)).toMatchObject({ lonnsartId: FRAV, attestertStatus: "pending" });
  });

  it("splittRadEier: fraværsrad splittes i to fraværsrader uten prosjekt", async () => {
    const sid = await nySedel();
    const f = await fravaer(sid, { timer: 6 });
    await dag().splittRadEier({
      radType: "timer",
      radId: f,
      nyeRader: [
        { projectId: null, lonnsartId: FRAV, aktivitetId: AKT, timer: 3 },
        { projectId: null, lonnsartId: FRAV, aktivitetId: AKT, timer: 3 },
      ],
    });
    const rader = await prismaTimer.sheetTimer.findMany({
      where: { sheetId: sid },
      select: { projectId: true, utenProsjekt: true },
    });
    expect(rader).toHaveLength(2);
    for (const r of rader) expect(r).toMatchObject({ projectId: null, utenProsjekt: true });
  });

  it("splittRadEier: fraværsrad kan ikke splittes til ordinær art uten prosjekt", async () => {
    const sid = await nySedel();
    const f = await fravaer(sid, { timer: 6 });
    await expect(
      dag().splittRadEier({
        radType: "timer",
        radId: f,
        nyeRader: [
          { projectId: null, lonnsartId: FRAV, aktivitetId: AKT, timer: 3 },
          { projectId: null, lonnsartId: ORD, aktivitetId: AKT, timer: 3 },
        ],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await prismaTimer.sheetTimer.count({ where: { sheetId: sid } })).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF4 — syncBatch, eldre klient", () => {
  it("bare-fravær-dag: ny klient lagrer, eldre klient (uten flagg/prosjekt) avvises ikke og beholder «uten prosjekt»; byttet art får klientens prosjekt", async () => {
    const cu = randomUUID();
    const dato = nyDato();
    const rid = randomUUID();
    const forst = await sync(syncSedel(cu, dato, [fravaerSync(rid, { utenProsjekt: true })]));
    expect(forst.resultat).toBe("ok");

    // Eldre klient endrer timene: verken flagg eller prosjekt (mobilen sender `"" || undefined`).
    const eldre = await sync(
      syncSedel(cu, dato, [fravaerSync(rid, { timer: 7, serverVersjon: versjonFor(forst, rid), endretLokalt: true })]),
    );
    expect(eldre.resultat).toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true });
    expect(Number((await rad(rid))!.timer)).toBe(7);

    // Eldre klient som har lagret raden på sedelens prosjekt, sender den med prosjekt: fortsatt fravær → uten prosjekt.
    const medProsjekt = await sync(
      syncSedel(cu, dato, [fravaerSync(rid, { timer: 6.5, projectId: P1, serverVersjon: versjonFor(eldre, rid), endretLokalt: true })], P1),
    );
    expect(medProsjekt.resultat).toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true });

    // Byttet til ordinær art → vanlig arbeidsrad på prosjektet klienten sendte.
    const byttet = await sync(
      syncSedel(cu, dato, [
        fravaerSync(rid, {
          lonnsartId: ORD, projectId: P1, fraTid: "07:00", tilTid: "14:00",
          serverVersjon: versjonFor(medProsjekt, rid), endretLokalt: true,
        }),
      ], P1),
    );
    expect(byttet.resultat).toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: P1, utenProsjekt: false, lonnsartId: ORD });
  });

  it("kjent fraværsrad byttet til ordinær art uten prosjekt → avvist (mangler prosjekt)", async () => {
    const cu = randomUUID();
    const dato = nyDato();
    const rid = randomUUID();
    const forst = await sync(syncSedel(cu, dato, [fravaerSync(rid, { utenProsjekt: true })]));
    const svar = await sync(
      syncSedel(cu, dato, [fravaerSync(rid, { lonnsartId: ORD, serverVersjon: versjonFor(forst, rid), endretLokalt: true })]),
    );
    expect(svar.resultat).toBe("avvist");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true, lonnsartId: FRAV });
  });

  it("annen brukers uten-prosjekt-rad gir ikke unntaket (id-gjetting)", async () => {
    const cu = randomUUID();
    const rid = randomUUID();
    await sync(syncSedel(cu, nyDato(), [fravaerSync(rid, { utenProsjekt: true })]));
    // USER_B sender samme rad-id uten flagg/prosjekt på egen sedel → ikke kjent for USER_B.
    const svar = await sync(
      { ...syncSedel(randomUUID(), nyDato(), [fravaerSync(rid, { lonnsartId: FRAV2 })]), aktivitetId: AKT2 },
      USER_B,
    );
    expect(svar.resultat).not.toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF5 — attesteringsrett F1", () => {
  it("firmavalget av: prosjektleder kan ikke attestere fravær uten prosjekt, firma-admin kan", async () => {
    await settFirmavalg(ORG, false);
    const sid = await nySedel({ status: "sent" });
    const a = await arbeid(sid);
    const f = await fravaer(sid);

    const detalj = await dag(LEDER).hentForAttestering({ id: sid });
    expect(detalj.fravaerKanAttesteres).toBe(false);
    await expect(
      dag(LEDER).attesterRader({ radIder: { timerIder: [f] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await rad(f))!.attestertStatus).toBe("pending");

    // Prosjektraden går fint for lederen (blandet sedel velter ikke).
    await dag(LEDER).attesterRader({ radIder: { timerIder: [a] } });
    expect((await rad(a))!.attestertStatus).toBe("attestert");

    expect((await dag(FADMIN).hentForAttestering({ id: sid })).fravaerKanAttesteres).toBe(true);
    await dag(FADMIN).attesterRader({ radIder: { timerIder: [f] } });
    expect((await rad(f))!.attestertStatus).toBe("attestert");
  });

  it("firmavalget på: leder med rett på et prosjekt sedelen har rad på, kan; leder uten slikt prosjekt kan ikke", async () => {
    await settFirmavalg(ORG, true);
    const sid = await nySedel({ status: "sent" });
    await arbeid(sid, P1);
    const f = await fravaer(sid);

    // Prosjektkøen viser sedelen med riktig flagg.
    const ko = await dag(LEDER).hentTilAttestering({ projectId: P1 });
    const iKo = ko.find((s) => s.id === sid) as { fravaerKanAttesteres?: boolean } | undefined;
    expect(iKo?.fravaerKanAttesteres).toBe(true);
    expect((await dag(LEDER).hentForAttestering({ id: sid })).fravaerKanAttesteres).toBe(true);

    await expect(
      dag(LEDER_P2).attesterRader({ radIder: { timerIder: [f] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await dag(LEDER).attesterRader({ radIder: { timerIder: [f] } });
    expect((await rad(f))!.attestertStatus).toBe("attestert");
    await settFirmavalg(ORG, false);
  });

  it("sedel med bare fravær: bare firma-admin, også med firmavalget på; står i firmakøen, kan åpnes, attesteres og returneres", async () => {
    await settFirmavalg(ORG, true);
    const sid = await nySedel({ status: "sent" });
    const f = await fravaer(sid, { timer: 7.5 });

    await expect(dag(LEDER).hentForAttestering({ id: sid })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      dag(LEDER).attesterRader({ radIder: { timerIder: [f] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const ko = await dag(FADMIN).hentTilAttesteringFirma({ organizationId: ORG });
    const iKo = ko.find((s) => s.id === sid) as { fravaerKanAttesteres?: boolean } | undefined;
    expect(iKo).toBeDefined();
    expect(iKo!.fravaerKanAttesteres).toBe(true);
    const detalj = await dag(FADMIN).hentForAttestering({ id: sid });
    expect(detalj.fravaerKanAttesteres).toBe(true);

    await dag(FADMIN).returner({ id: sid, kommentar: "Mangler beskrivelse" });
    expect((await prismaTimer.dailySheet.findUnique({ where: { id: sid } }))!.status).not.toBe("sent");

    const sid2 = await nySedel({ status: "sent" });
    await fravaer(sid2, { timer: 7.5 });
    await dag(FADMIN).attester({ id: sid2 });
    expect((await prismaTimer.dailySheet.findUnique({ where: { id: sid2 } }))!.status).toBe("accepted");
    await settFirmavalg(ORG, false);
  });

  it("hele-sedel-attestering av blandet sedel: leder uten fraværsrett avvises, firma-admin går gjennom", async () => {
    await settFirmavalg(ORG, false);
    const sid = await nySedel({ status: "sent" });
    await arbeid(sid);
    await fravaer(sid);
    await expect(dag(LEDER).attester({ id: sid })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await dag(FADMIN).attester({ id: sid });
    expect((await prismaTimer.dailySheet.findUnique({ where: { id: sid } }))!.status).toBe("accepted");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF6 — rapport og eksport", () => {
  it("uten prosjektfilter: fravær er med under «Fravær»; med filter utelatt; navnet aldri null", async () => {
    const dato = nyDato();
    const sid = await nySedel({ status: "accepted", dato });
    await arbeid(sid, P1);
    await fravaer(sid, { timer: 5.5 });
    // Sedel med BARE fravær — har ingen rad på et prosjekt og må likevel med.
    const datoBare = nyDato();
    const sidBare = await nySedel({ status: "accepted", dato: datoBare });
    await fravaer(sidBare, { timer: 7.5 });
    const periode = { organizationId: ORG, fra: dato, til: datoBare };

    const agg = await rapport(FADMIN).firmaPeriodeRapport(periode);
    const ansatt = agg.ansatte.find((a) => a.userId === USER)!;
    expect(ansatt.perProsjekt.find((p) => p.prosjektId === null)).toMatchObject({ prosjektNavn: "Fravær", timer: 13 });
    for (const p of ansatt.perProsjekt) expect(p.prosjektNavn).not.toBeNull();

    const engelsk = await rapport(FADMIN).firmaPeriodeRapport({ ...periode, fravaerEtikett: "Absence" });
    expect(
      engelsk.ansatte.find((a) => a.userId === USER)!.perProsjekt.find((p) => p.prosjektId === null)?.prosjektNavn,
    ).toBe("Absence");

    const filtrert = await rapport(FADMIN).firmaPeriodeRapport({ ...periode, prosjektId: P1 });
    expect(filtrert.ansatte.find((a) => a.userId === USER)!.perProsjekt.some((p) => p.prosjektId === null)).toBe(false);

    const detalj = await rapport(FADMIN).detaljEksport(periode);
    const mine = detalj.timerader.filter((r) => r.dato === dato);
    expect(mine).toHaveLength(2);
    expect(mine.map((r) => r.prosjekt).sort()).toEqual(["Fravær", "Fravær P1"]);
    expect(detalj.timerader.filter((r) => r.dato === datoBare).map((r) => r.prosjekt)).toEqual(["Fravær"]);
    const detaljFiltrert = await rapport(FADMIN).detaljEksport({ ...periode, prosjektId: P1 });
    expect(detaljFiltrert.timerader.filter((r) => r.dato === dato).map((r) => r.prosjekt)).toEqual(["Fravær P1"]);
    expect(detaljFiltrert.timerader.some((r) => r.dato === datoBare)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF7 — firma-isolasjon", () => {
  it("fravær fra et annet firmas sedel er ikke synlig eller attesterbar", async () => {
    const sid = await nySedel({ userId: USER_B, org: ORG2, status: "sent", akt: AKT2 });
    const f = await fravaer(sid, { lonnsart: FRAV2, akt: AKT2 });

    await expect(dag(FADMIN).hentForAttestering({ id: sid })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      dag(FADMIN).attesterRader({ radIder: { timerIder: [f] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const ko = await dag(FADMIN).hentTilAttesteringFirma({ organizationId: ORG });
    expect(ko.some((s) => s.id === sid)).toBe(false);
    expect((await rad(f))!.attestertStatus).toBe("pending");
    // Kontroll: riktig firma-admin ser og kan attestere den.
    await dag(FADMIN2).attesterRader({ radIder: { timerIder: [f] } });
    expect((await rad(f))!.attestertStatus).toBe("attestert");
  });

  it("firmavalget leses fra sedelens firma, ikke attestantens", async () => {
    await settFirmavalg(ORG, true);
    await settFirmavalg(ORG2, false);
    // LEDER er aktiv ansatt i begge firma og prosjektadmin på P1.
    const sidOrg2 = await nySedel({ userId: USER_B, org: ORG2, status: "sent", akt: AKT2 });
    await arbeid(sidOrg2, P1, { lonnsart: ORD2, akt: AKT2 });
    const fOrg2 = await fravaer(sidOrg2, { lonnsart: FRAV2, akt: AKT2 });
    await expect(
      dag(LEDER).attesterRader({ radIder: { timerIder: [fOrg2] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const sidOrg = await nySedel({ status: "sent" });
    await arbeid(sidOrg, P1);
    const fOrg = await fravaer(sidOrg);
    await dag(LEDER).attesterRader({ radIder: { timerIder: [fOrg] } });
    expect((await rad(fOrg))!.attestertStatus).toBe("attestert");
    await settFirmavalg(ORG, false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF11 — lonnsart.oppdater", () => {
  it("type bort fra fravær avvises når arten står på en rad uten prosjekt; ellers som i dag", async () => {
    const sid = await nySedel();
    await fravaer(sid);
    await expect(lonnsart(FADMIN).oppdater({ organizationId: ORG, id: FRAV, type: "ordinaer" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect((await prismaTimer.lonnsart.findUnique({ where: { id: FRAV } }))!.type).toBe("fravaer");

    await lonnsart(FADMIN).oppdater({ organizationId: ORG, id: FRAV_LEDIG, type: "ordinaer" });
    expect((await prismaTimer.lonnsart.findUnique({ where: { id: FRAV_LEDIG } }))!.type).toBe("ordinaer");
    await lonnsart(FADMIN).oppdater({ organizationId: ORG, id: FRAV, navn: "Egenmelding (endret navn)" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF26 — firmavalget fravaer_attesteres_av_prosjektleder", () => {
  it("er false for hvert firma etter migrering, også nye uten feltet", async () => {
    const [rader] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `select count(*) as n from public.organization_settings
        where fravaer_attesteres_av_prosjektleder is distinct from false
          and organization_id not in ('${ORG}', '${ORG2}')`,
    );
    expect(Number(rader!.n)).toBe(0);
    await settFirmavalg(ORG2, false);
    const ny = await prisma.organizationSetting.findUnique({ where: { organizationId: ORG2 } });
    expect(ny!.fravaerAttesteresAvProsjektleder).toBe(false);
  });

  it("oppdaterSetting: bare firma-admin kan slå valget av og på; hentSetting leser det", async () => {
    await expect(
      org(LEDER).oppdaterSetting({ organizationId: ORG, fravaerAttesteresAvProsjektleder: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await prisma.organizationSetting.findUnique({ where: { organizationId: ORG } }))!.fravaerAttesteresAvProsjektleder).toBe(false);

    await org(FADMIN).oppdaterSetting({ organizationId: ORG, fravaerAttesteresAvProsjektleder: true });
    const lest = (await org(FADMIN).hentSetting({ organizationId: ORG })) as { fravaerAttesteresAvProsjektleder?: boolean } | null;
    expect(lest?.fravaerAttesteresAvProsjektleder).toBe(true);
    await org(FADMIN).oppdaterSetting({ organizationId: ORG, fravaerAttesteresAvProsjektleder: false });
    expect((await prisma.organizationSetting.findUnique({ where: { organizationId: ORG } }))!.fravaerAttesteresAvProsjektleder).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("TF27 — fravær på framtidig dato (server)", () => {
  const framtid = () => {
    const d = new Date(Date.now() + (40 + datoTeller++) * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  it("tilfoyTimerRad lagrer fravær fram i tid", async () => {
    const sid = await nySedel({ dato: framtid() });
    const r = await dag().tilfoyTimerRad({
      sheetId: sid, utenProsjekt: true, lonnsartId: FRAV, aktivitetId: AKT, timer: 7.5, beskrivelse: "Ferie",
    });
    expect(await rad(r.id)).toMatchObject({ projectId: null, utenProsjekt: true });
  });

  it("syncBatch lagrer en bare-fravær-dag fram i tid", async () => {
    const rid = randomUUID();
    const svar = await sync(syncSedel(randomUUID(), framtid(), [fravaerSync(rid, { utenProsjekt: true })]));
    expect(svar.resultat).toBe("ok");
    expect(await rad(rid)).toMatchObject({ projectId: null, utenProsjekt: true });
  });
});
