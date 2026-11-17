import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { grupperPaaKort } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";

/**
 * w2 web-timeføring — «+ Registrer timer» (plan `docs/claude/web-timeforing-plan.md` § 9 w2)
 * gjennom prosedyrene (`createCaller`) mot EKTE Postgres (lokal sandkasse, aldri test/prod).
 *
 * Kallene er de knappen og dagssiden gjør — `apps/api` er ikke endret i w2:
 *  1. Ny dag lages stille: `opprett` uten tider, med prosjekt + byggeplass fra toppen →
 *     sedel + første jobb (byggeplass på første rad, h).
 *  2. Finnes dagen: `opprett` gir samme sedel, `eksisterte: true`, ingen ny rad.
 *  3. Jobb 2 på samme prosjekt: `tilfoyTimerRad` med ny `kortId` → eget kort på serveren og i
 *     attesteringens gruppering (`grupperPaaKort`). PC-dagen samler fortsatt pr. prosjekt fram
 *     til w3 — det dekkes av `apps/web/.../prosjektkort-visning.test.tsx`.
 *  2b. Duplikat-dato når P2002 kommer fra en annen Prisma-runtime (web-ruta i Next bundler
 *     timer-klienten for seg): skal fortsatt gi `eksisterte: true`, ikke 409 — eneste
 *     endring i `apps/api` i w2.
 *  4. Sendt dag: `opprett` gir den sendte sedelen, `gjenaapneDagsseddel` åpner den, neste jobb
 *     kan føres.
 *
 * Data lages her med faste id-er (prefiks f2a2e5f0) og ryddes i afterAll.
 */

const id = (n: string) => `f2a2e5f0-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const USER = id("02");
const P1 = id("11");
const B1 = id("21"); // byggeplass i P1
const ORD = id("41");
const AKT = id("43");

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
const dag = () => dagsseddelRouter.createCaller(ctx(USER));

/** Det knappen sender (RegistrerTimerKnapp.registrer). */
const registrer = (dato: string) =>
  dag().opprett({
    clientUuid: randomUUID(),
    aktivitetId: AKT,
    projectId: P1,
    byggeplassId: B1,
    dato,
    organizationId: ORG,
  });

async function rader(sheetId: string) {
  return prismaTimer.sheetTimer.findMany({
    where: { sheetId },
    orderBy: { createdAt: "asc" },
  });
}

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: USER }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaTimer.lonnsart.deleteMany({ where: { id: ORD } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: AKT } });
  await prisma.activity.deleteMany({ where: { actorUserId: USER } });
  await prisma.byggeplass.deleteMany({ where: { id: B1 } });
  await prisma.projectModule.deleteMany({ where: { projectId: P1 } });
  await prisma.projectMember.deleteMany({ where: { projectId: P1 } });
  await prisma.project.deleteMany({ where: { id: P1 } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: ORG } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: ORG } });
  await prisma.organization.deleteMany({ where: { id: ORG } });
  await prisma.user.deleteMany({ where: { id: USER } });
}

async function seed() {
  await prisma.user.create({ data: { id: USER, email: "w2-registrer@sitedoc.test", name: "Arbeider W2", role: "user" } });
  await prisma.organization.create({ data: { id: ORG, name: "W2-firma" } });
  await prisma.organizationMember.create({ data: { userId: USER, organizationId: ORG, status: "aktiv" } });
  await prisma.organizationModule.create({ data: { organizationId: ORG, moduleSlug: "timer", status: "aktiv" } });
  await prisma.organizationSetting.create({ data: { organizationId: ORG, timerRegistreringsmodus: "prosjektkort" } });
  await prisma.project.create({ data: { id: P1, projectNumber: "W2-1", name: "W2 P1", primaryOrganizationId: ORG } });
  await prisma.projectMember.create({ data: { userId: USER, projectId: P1, role: "member" } });
  await prisma.projectModule.create({ data: { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" } });
  await prisma.byggeplass.create({ data: { id: B1, projectId: P1, name: "W2 B1" } });
  await prismaTimer.lonnsart.create({
    data: { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
  });
  await prismaTimer.aktivitet.create({ data: { id: AKT, organizationId: ORG, navn: "Anleggsarbeid" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("w2 «+ Registrer timer» — serverkallene", () => {
  it("ny dag lages stille med første jobb; byggeplassen står på første rad", async () => {
    const sheet = await registrer("2026-11-02");
    expect((sheet as { eksisterte?: boolean }).eksisterte).toBeFalsy();
    expect(sheet.status).toBe("draft");
    const r = await rader(sheet.id);
    expect(r).toHaveLength(1);
    expect(r[0]!.projectId).toBe(P1);
    expect(r[0]!.byggeplassId).toBe(B1);
    expect(r[0]!.kortId).not.toBeNull();
  });

  it("finnes dagen: samme sedel, eksisterte = true, ingen ny rad", async () => {
    const forste = await registrer("2026-11-03");
    const andre = await registrer("2026-11-03");
    expect(andre.id).toBe(forste.id);
    expect((andre as { eksisterte?: boolean }).eksisterte).toBe(true);
    expect(await rader(forste.id)).toHaveLength(1);
  });

  it("duplikat-dato med P2002 fra en annen feilklasse (Next-bundle) gir eksisterte, ikke 409", async () => {
    const forste = await registrer("2026-11-06");
    class AnnenRuntimeFeil extends Error {
      code = "P2002";
      constructor() {
        super("Unique constraint failed on the fields: (`user_id`,`dato`)");
        this.name = "PrismaClientKnownRequestError";
      }
    }
    const spion = vi.spyOn(prismaTimer.dailySheet, "upsert").mockRejectedValueOnce(new AnnenRuntimeFeil());
    try {
      const andre = await registrer("2026-11-06");
      expect(andre.id).toBe(forste.id);
      expect((andre as { eksisterte?: boolean }).eksisterte).toBe(true);
    } finally {
      spion.mockRestore();
    }
  });

  it("jobb 2 på samme prosjekt får egen kortId — eget kort på serveren og i attesteringen", async () => {
    const sheet = await registrer("2026-11-04");
    const [jobb1] = await rader(sheet.id);
    const nyKort = randomUUID();
    await dag().tilfoyTimerRad({
      sheetId: sheet.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      timer: 2, fraTid: "15:00", tilTid: "17:00", pauseMin: 0, kortId: nyKort,
    });
    const r = await rader(sheet.id);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.projectId)).toEqual([P1, P1]);
    expect(r[1]!.kortId).toBe(nyKort);
    expect(r[1]!.kortId).not.toBe(jobb1!.kortId);
    // Attesteringen grupperer på kortId (attestering-tabell.ts) → to kort.
    const g = grupperPaaKort({ timer: r.map((x) => ({ ...x, timer: Number(x.timer) })) });
    expect(g.kort).toHaveLength(2);
  });

  it("sendt dag: opprett gir den sendte dagen, gjenåpning åpner den, neste jobb kan føres", async () => {
    const sheet = await registrer("2026-11-05");
    await dag().send({ id: sheet.id });
    const igjen = await registrer("2026-11-05");
    expect(igjen.id).toBe(sheet.id);
    expect((igjen as { eksisterte?: boolean }).eksisterte).toBe(true);
    expect(igjen.status).toBe("sent");
    // Sendt dag tar ikke imot ny jobb før den er gjenåpnet.
    await expect(
      dag().tilfoyTimerRad({
        sheetId: sheet.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
        timer: 1, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, kortId: randomUUID(),
      }),
    ).rejects.toThrow();
    await dag().gjenaapneDagsseddel({ id: sheet.id });
    await dag().tilfoyTimerRad({
      sheetId: sheet.id, projectId: P1, lonnsartId: ORD, aktivitetId: AKT,
      timer: 1, fraTid: "16:00", tilTid: "17:00", pauseMin: 0, kortId: randomUUID(),
    });
    const s = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: sheet.id } });
    expect(s.status).toBe("draft");
    expect(await rader(sheet.id)).toHaveLength(2);
  });
});
