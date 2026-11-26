import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { finnSedlerÅSlette } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * O26 C (Kenneth 2026-11-26): «det er noen gamle sedler som er slettet -> men kommer tilbake».
 * MÅLING, ikke retting: kan en sedel eller rad slettet på web gjenoppstå via mobilens synk?
 *
 * Kjeden på telefonen (målt i kode):
 *  - push sender bare sedler med `syncStatus = "pending"` (`timerSync.ts` `pendingSedler`);
 *  - pull sletter lokalt det serveren ikke har lenger, men aldri pending/avvist og bare innenfor
 *    `slettevindu` (`finnSedlerÅSlette`, `@sitedoc/shared`);
 *  - serveren lager sedelen på nytt med samme id når den ikke finnes (`syncBatch`), og har intet
 *    slettespor for en sedel slettet på web.
 *
 * Mot ekte Postgres (lokal sandkasse). Faste id-er med prefiks 0260e5f0, ryddes i afterAll.
 */

const id = (n: string) => `0260e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const ADMIN = id("03");
const P1 = id("11");
const TL = id("41"); // Timelønn
const AKT = id("43");
const BRUKERE = [USER, ADMIN];

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

let datoTeller = 0;
function nyDato(): string {
  return new Date(Date.UTC(2026, 9, 1) + datoTeller++ * 86_400_000).toISOString().slice(0, 10);
}

const raderPaa = (sheetId: string) =>
  prismaTimer.sheetTimer.findMany({ where: { sheetId }, orderBy: { createdAt: "asc" } });

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: TL } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: USER, email: "o26-arbeider@sitedoc.test", name: "Arbeider O26", role: "user" },
      { id: ADMIN, email: "o26-admin@sitedoc.test", name: "Admin O26", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.create({ data: { id: ORG, name: "O26-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "O26-1", name: "O26 P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prismaTimer.lonnsart.create({
    data: { id: TL, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
  await prisma.organizationSetting.create({
    data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort" },
  });
}

function iDag(offsetDager = 0): string {
  return new Date(Date.now() - offsetDager * 86_400_000).toISOString().slice(0, 10);
}

function telefonSedel(clientUuid: string, dato: string, radId: string, ekstraRad: Record<string, unknown> = {}) {
  return {
    clientUuid, projectId: P1, aktivitetId: AKT, dato, status: "draft" as const, pauseMin: 0,
    timer: [{
      id: radId, projectId: P1, lonnsartId: TL, aktivitetId: AKT, timer: 4,
      fraTid: "07:00", tilTid: "11:00", pauseMin: 0, ...ekstraRad,
    }],
    tillegg: [], maskiner: [], utlegg: [],
  };
}
async function push(sedel: ReturnType<typeof telefonSedel>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svar = await dag().syncBatch({ sedler: [sedel as any] });
  return svar.resultater[0]!;
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("O26 C — gjenoppstår en sedel slettet på web via mobilens synk?", () => {
  it("JA: telefonen har sedelen med usendte endringer (pending) — pull lar den stå, push lager den på nytt med samme id", async () => {
    const sid = randomUUID();
    const dato = iDag(1);
    expect((await push(telefonSedel(sid, dato, randomUUID()))).resultat).toBe("ok");
    // Web: «Slett dagen».
    await dag().slett({ id: sid });
    expect(await prismaTimer.dailySheet.findUnique({ where: { id: sid } })).toBeNull();
    // Pull på telefonen: sedelen er borte fra serveren, men lokalt pending → slettes IKKE lokalt.
    const vindu = { fraDato: iDag(30), tilDato: null };
    expect(finnSedlerÅSlette([{ id: sid, dato, syncStatus: "pending" }], new Set(), vindu)).toEqual([]);
    // Neste push: samme sedel → serveren lager den på nytt.
    expect((await push(telefonSedel(sid, dato, randomUUID()))).resultat).toBe("ok");
    const gjenoppstaatt = await prismaTimer.dailySheet.findUnique({ where: { id: sid } });
    expect(gjenoppstaatt).not.toBeNull();
    expect(await raderPaa(sid)).toHaveLength(1);
  });

  it("NEI: synket sedel uten lokale endringer — pull sletter den lokalt, og push sender den aldri", () => {
    const vindu = { fraDato: iDag(30), tilDato: null };
    const dato = iDag(1);
    expect(finnSedlerÅSlette([{ id: "s-synket", dato, syncStatus: "synced" }], new Set(), vindu)).toEqual(["s-synket"]);
  });

  it("utenfor slettevinduet blir en sedel slettet på web liggende på telefonen (synlig der, men pushes ikke uten endring)", () => {
    const vindu = { fraDato: iDag(30), tilDato: null };
    expect(finnSedlerÅSlette([{ id: "s-gammel", dato: iDag(60), syncStatus: "synced" }], new Set(), vindu)).toEqual([]);
  });

  it("rad slettet på web, telefonen har ikke rørt raden (endretLokalt false): raden kommer ikke tilbake", async () => {
    const sid = randomUUID();
    const dato = iDag(2);
    const radA = randomUUID();
    await push(telefonSedel(sid, dato, radA));
    const lagret = await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: radA } });
    // Web sletter raden (fjernTimerRad) — sedelen står.
    await dag().fjernTimerRad({ id: radA });
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radA } })).toBeNull();
    await push(telefonSedel(sid, dato, radA, {
      serverVersjon: lagret.updatedAt.toISOString(),
      endretLokalt: false,
    }));
    expect(await prismaTimer.sheetTimer.findUnique({ where: { id: radA } })).toBeNull();
  });
});
