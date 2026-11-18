import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaTimer } from "@sitedoc/db-timer";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { prismaVarelager } from "@sitedoc/db-varelager";
import { dagsseddelRouter } from "./timer/dagsseddel";
import { organisasjonRouter } from "./organisasjon";

/**
 * Web-timeføring w7 (B15, web-timeforing-plan.md § 8.3/§ 8.5) — mot EKTE Postgres (lokal sandkasse,
 * aldri test/prod), gjennom prosedyrene (`createCaller`).
 *
 * Regelen: ingen attestant attesterer, returnerer, gjenåpner, retter eller deler EGNE sedler når
 * firmaet har «Attestant kan attestere egne timer» = Nei (standard). Gjelder også firmaadministrator.
 * For hver av de elleve prosedyrene:
 *  1. firmaadministratoren avvises på egen sedel, og ingenting er skrevet;
 *  2. en annen attestant gjør det samme på sedelen (B16 A);
 *  3. negativkontroll: med valget på Ja gjør firmaadministratoren det selv (dagens atferd).
 * I tillegg: flagget `egneTimer` i de tre listene, lesing er lov (B18 A), standarden er Nei for ny
 * rad og for manglende rad, og innstillingen kan skrives av firma-admin.
 *
 * All data lages her med faste id-er (prefiks c0d1e5f7) og ryddes i afterAll.
 */

const id = (n: string) => `c0d1e5f7-0000-4000-8000-0000000000${n}`;
const ORG = id("01");
const ORG_UTEN = id("02"); // firma uten innstillingsrad
const FADMIN = id("03"); // firmaadministrator som også fører egne timer
const ANNEN = id("04"); // attestant (kanAttestere på P1), ikke firma-admin
const ARB = id("05"); // vanlig ansatt
const SADMIN = id("06"); // sitedoc_admin som fører timer i ORG_UTEN
const P1 = id("11");
const P_UTEN = id("12");
const ECO_1 = id("31");
const ORD = id("41");
const AKT = id("43");
const ORD_U = id("44");
const AKT_U = id("45");
const MASKIN = id("51");

const BRUKERE = [FADMIN, ANNEN, ARB, SADMIN];

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
const dag = (userId: string) => dagsseddelRouter.createCaller(ctx(userId));
const org = (userId: string) => organisasjonRouter.createCaller(ctx(userId));

let datoTeller = 0;
const nyDato = () => new Date(Date.UTC(2026, 8, 1) + datoTeller++ * 86_400_000);

type Fase = "innsendt" | "attestert";

/** Sedel med én jobb (kort): 07–11 og 11–15, maskin 07–09 på første rad. */
async function nySedel(eier: string, fase: Fase = "innsendt") {
  const sheetId = randomUUID();
  const kortId = randomUUID();
  const attestert = fase === "attestert";
  await prismaTimer.dailySheet.create({
    data: {
      id: sheetId, clientUuid: sheetId, organizationId: ORG, userId: eier, registrertAvUserId: eier,
      aktivitetId: AKT, dato: nyDato(), status: attestert ? "accepted" : "sent",
    },
  });
  const radStatus = attestert ? "attestert" : "pending";
  const rad = (fraTid: string, tilTid: string) =>
    prismaTimer.sheetTimer.create({
      data: { sheetId, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid, tilTid, timer: 4, kortId, attestertStatus: radStatus },
    });
  const r1 = await rad("07:00", "11:00");
  const r2 = await rad("11:00", "15:00");
  const m = await prismaTimer.sheetMachine.create({
    data: {
      sheetId, sheetTimerId: r1.id, vehicleId: MASKIN, projectId: P1, fraTid: "07:00", tilTid: "09:00", timer: 2, kortId,
      attestertStatus: radStatus,
    },
  });
  return { sheetId, kortId, r1: r1.id, r2: r2.id, maskin: m.id };
}
type Sedel = Awaited<ReturnType<typeof nySedel>>;

/** Alt prosedyrene kan skrive. Lik før og etter = ingenting skrevet. */
async function tilstand(s: Sedel) {
  const sedel = await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: s.sheetId } });
  const timer = await prismaTimer.sheetTimer.findMany({ where: { sheetId: s.sheetId }, orderBy: { id: "asc" } });
  const maskin = await prismaTimer.sheetMachine.findMany({ where: { sheetId: s.sheetId }, orderBy: { id: "asc" } });
  return {
    status: sedel.status,
    timer: timer.map((r) => [r.id, r.fraTid, r.tilTid, Number(r.timer), r.kortId, r.externalCostObjectId, r.attestertStatus]),
    maskin: maskin.map((r) => [r.id, r.kortId, r.externalCostObjectId, r.attestertStatus]),
    historikk: await prismaTimer.sheetRadHistorikk.count({ where: { sheetId: s.sheetId } }),
  };
}

async function settSelvAttestering(ja: boolean) {
  await prisma.organizationSetting.update({ where: { organizationId: ORG }, data: { tillattSelvAttestering: ja } });
}

type Kaller = ReturnType<typeof dag>;
/** De elleve prosedyrene (Fabel talte elleve; målt i LØSNING FØR KODE — ORDRE w7). */
const PROSEDYRER: { navn: string; fase: Fase; kall: (k: Kaller, s: Sedel) => Promise<unknown> }[] = [
  {
    navn: "attesterRader",
    fase: "innsendt",
    kall: (k, s) => k.attesterRader({ radIder: { timerIder: [s.r1, s.r2], tilleggIder: [], maskinIder: [s.maskin] } }),
  },
  {
    navn: "returnerRader",
    fase: "innsendt",
    kall: (k, s) => k.returnerRader({ radIder: { timerIder: [s.r1], tilleggIder: [], maskinIder: [] }, kommentar: "Feil tid" }),
  },
  { navn: "gjenaapneAttestering", fase: "attestert", kall: (k, s) => k.gjenaapneAttestering({ sheetId: s.sheetId }) },
  {
    navn: "gjenaapneRader",
    fase: "attestert",
    kall: (k, s) => k.gjenaapneRader({ radIder: { timerIder: [s.r1], tilleggIder: [], maskinIder: [] } }),
  },
  {
    navn: "rettRadFelt",
    fase: "innsendt",
    kall: (k, s) => k.rettRadFelt({ radType: "timer", radId: s.r2, felter: { tilTid: "14:30", timer: 3.5 } }),
  },
  {
    navn: "redigerSedelRader",
    fase: "innsendt",
    kall: (k, s) =>
      k.redigerSedelRader({
        sheetId: s.sheetId,
        nyeRader: {
          timer: [
            { originalId: s.r1, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "07:00", tilTid: "11:00", timer: 4 },
            { originalId: s.r2, projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "11:00", tilTid: "14:30", timer: 3.5 },
          ],
          tillegg: [],
          maskin: [{ originalId: s.maskin, projectId: P1, vehicleId: MASKIN, fraTid: "07:00", tilTid: "09:00", timer: 2 }],
        },
      }),
  },
  {
    navn: "splittRad",
    fase: "innsendt",
    kall: (k, s) =>
      k.splittRad({
        radType: "timer",
        radId: s.r2,
        nyeRader: [
          { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "11:00", tilTid: "13:00", timer: 2 },
          { projectId: P1, lonnsartId: ORD, aktivitetId: AKT, fraTid: "13:00", tilTid: "15:00", timer: 2 },
        ],
      }),
  },
  {
    navn: "delJobb",
    fase: "innsendt",
    kall: (k, s) => k.delJobb({ sheetId: s.sheetId, kortId: s.kortId, kl: "10:00", externalCostObjectIdB: ECO_1 }),
  },
  {
    navn: "flyttTimerRadEco",
    fase: "innsendt",
    kall: (k, s) => k.flyttTimerRadEco({ timerRadId: s.r1, radType: "timer", externalCostObjectId: ECO_1, helJobb: true }),
  },
  { navn: "attester (gammel)", fase: "innsendt", kall: (k, s) => k.attester({ id: s.sheetId }) },
  { navn: "returner (gammel)", fase: "innsendt", kall: (k, s) => k.returner({ id: s.sheetId, kommentar: "Feil tid" }) },
];

async function ryddOpp() {
  const sedler = await prismaTimer.dailySheet.findMany({ where: { userId: { in: BRUKERE } }, select: { id: true } });
  const sids = sedler.map((s) => s.id);
  if (sids.length > 0) {
    for (const t of ["sheet_timer_forslag", "sheet_rad_historikk", "sheet_machines", "sheet_tillegg", "sheet_utlegg", "sheet_timer"]) {
      await prismaTimer.$executeRawUnsafe(`DELETE FROM "timer"."${t}" WHERE sheet_id = ANY($1::text[])`, sids);
    }
    await prismaTimer.dailySheet.deleteMany({ where: { id: { in: sids } } });
  }
  await prismaMaskin.equipment.deleteMany({ where: { id: MASKIN } });
  await prismaTimer.lonnsart.deleteMany({ where: { id: { in: [ORD, ORD_U] } } });
  await prismaTimer.aktivitet.deleteMany({ where: { id: { in: [AKT, AKT_U] } } });
  await prisma.activity.deleteMany({ where: { actorUserId: { in: BRUKERE } } });
  await prisma.externalCostObject.deleteMany({ where: { id: ECO_1 } });
  await prisma.projectOrganization.deleteMany({ where: { projectId: { in: [P1, P_UTEN] } } });
  await prisma.projectModule.deleteMany({ where: { projectId: { in: [P1, P_UTEN] } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: [P1, P_UTEN] } } });
  await prisma.project.deleteMany({ where: { id: { in: [P1, P_UTEN] } } });
  await prisma.organizationSetting.deleteMany({ where: { organizationId: { in: [ORG, ORG_UTEN] } } });
  await prisma.organizationModule.deleteMany({ where: { organizationId: { in: [ORG, ORG_UTEN] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ORG, ORG_UTEN] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ORG, ORG_UTEN] } } });
  await prisma.user.deleteMany({ where: { id: { in: BRUKERE } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      { id: FADMIN, email: "w7-fadmin@sitedoc.test", name: "Firmaadmin", role: "user" },
      { id: ANNEN, email: "w7-attestant@sitedoc.test", name: "Annen attestant", role: "user" },
      { id: ARB, email: "w7-arbeider@sitedoc.test", name: "Arbeider", role: "user" },
      { id: SADMIN, email: "w7-sadmin@sitedoc.test", name: "Sitedoc-admin", role: "sitedoc_admin" },
    ],
  });
  await prisma.organization.createMany({ data: [{ id: ORG, name: "w7-firma" }, { id: ORG_UTEN, name: "w7-firma-uten-innstilling" }] });
  await prisma.organizationMember.createMany({
    data: [
      { userId: FADMIN, organizationId: ORG, status: "aktiv", firmaRoller: ["firma_admin"] },
      { userId: ANNEN, organizationId: ORG, status: "aktiv" },
      { userId: ARB, organizationId: ORG, status: "aktiv" },
      { userId: SADMIN, organizationId: ORG_UTEN, status: "aktiv" },
    ],
  });
  await prisma.organizationModule.createMany({
    data: [ORG, ORG_UTEN].flatMap((o) => [
      { organizationId: o, moduleSlug: "timer", status: "aktiv" },
      { organizationId: o, moduleSlug: "maskin", status: "aktiv" },
    ]),
  });
  // Ingen verdi for tillattSelvAttestering: standarden (Nei) gjelder.
  await prisma.organizationSetting.create({ data: { organizationId: ORG, tillattRedigerVedAttestering: true } });
  await prisma.project.createMany({
    data: [
      { id: P1, projectNumber: "W7-1", name: "w7 P1", primaryOrganizationId: ORG },
      { id: P_UTEN, projectNumber: "W7-2", name: "w7 uten innstilling", primaryOrganizationId: ORG_UTEN },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { userId: FADMIN, projectId: P1, role: "admin", kanAttestere: true },
      { userId: ANNEN, projectId: P1, role: "member", kanAttestere: true },
      { userId: ARB, projectId: P1, role: "member" },
      { userId: SADMIN, projectId: P_UTEN, role: "member" },
    ],
  });
  await prisma.projectOrganization.create({ data: { projectId: P1, organizationId: ORG } });
  await prisma.projectModule.createMany({
    data: [
      { projectId: P1, moduleSlug: "timer", organizationId: ORG, status: "aktiv" },
      { projectId: P_UTEN, moduleSlug: "timer", organizationId: ORG_UTEN, status: "aktiv" },
    ],
  });
  await prisma.externalCostObject.create({
    data: { id: ECO_1, organizationId: ORG, projectId: P1, proAdmId: "W7-E1", kortNavn: "Grøft", kilde: "manuell", opprettetAvUserId: FADMIN },
  });
  await prismaTimer.lonnsart.createMany({
    data: [
      { id: ORD, organizationId: ORG, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
      { id: ORD_U, organizationId: ORG_UTEN, type: "ordinaer", navn: "Timelønn", erStandardvalg: true, aktiv: true },
    ],
  });
  await prismaTimer.aktivitet.createMany({
    data: [
      { id: AKT, organizationId: ORG, navn: "Grunnarbeid" },
      { id: AKT_U, organizationId: ORG_UTEN, navn: "Grunnarbeid" },
    ],
  });
  await prismaMaskin.equipment.create({ data: { id: MASKIN, organizationId: ORG, kategori: "anleggsmaskin", type: "gravemaskin" } });
}

beforeAll(async () => {
  await ryddOpp();
  await seed();
});
afterAll(ryddOpp);

describe("w7 — standarden er Nei", () => {
  it("en innstillingsrad laget uten verdi får Nei (false)", async () => {
    // Kjøres før noe skriver feltet: raden fra seed() har bare standardverdien.
    expect((await prisma.organizationSetting.findUniqueOrThrow({ where: { organizationId: ORG } })).tillattSelvAttestering).toBe(false);
    const fersk = await prisma.organizationSetting.create({ data: { organizationId: ORG_UTEN } });
    try {
      expect(fersk.tillattSelvAttestering).toBe(false);
    } finally {
      await prisma.organizationSetting.delete({ where: { organizationId: ORG_UTEN } });
    }
  });

  it("firma UTEN innstillingsrad leses som Nei: sitedoc_admin avvises på egen sedel", async () => {
    expect(await prisma.organizationSetting.findUnique({ where: { organizationId: ORG_UTEN } })).toBeNull();
    const sheetId = randomUUID();
    await prismaTimer.dailySheet.create({
      data: {
        id: sheetId, clientUuid: sheetId, organizationId: ORG_UTEN, userId: SADMIN, registrertAvUserId: SADMIN,
        aktivitetId: AKT_U, dato: nyDato(), status: "sent",
      },
    });
    const r = await prismaTimer.sheetTimer.create({
      data: { sheetId, projectId: P_UTEN, lonnsartId: ORD_U, aktivitetId: AKT_U, fraTid: "07:00", tilTid: "15:00", timer: 8 },
    });
    await expect(
      dag(SADMIN).attesterRader({ radIder: { timerIder: [r.id], tilleggIder: [], maskinIder: [] } }),
    ).rejects.toThrow(/Egne timer attesteres av en annen/);
    expect((await prismaTimer.sheetTimer.findUniqueOrThrow({ where: { id: r.id } })).attestertStatus).toBe("pending");
  });
});

describe("w7 — sperren i de elleve prosedyrene", () => {
  beforeEach(() => settSelvAttestering(false));

  it("målingen: elleve prosedyrer", () => {
    expect(PROSEDYRER).toHaveLength(11);
  });

  for (const p of PROSEDYRER) {
    describe(p.navn, () => {
      it("Nei: firmaadministratoren avvises på egen sedel, og ingenting skrives", async () => {
        const s = await nySedel(FADMIN, p.fase);
        const for_ = await tilstand(s);
        await expect(p.kall(dag(FADMIN), s)).rejects.toThrow(/Egne timer attesteres av en annen/);
        expect(await tilstand(s)).toEqual(for_);
      });

      it("Nei: en annen attestant gjør det på sedelen (B16 A)", async () => {
        const s = await nySedel(FADMIN, p.fase);
        const for_ = await tilstand(s);
        await p.kall(dag(ANNEN), s);
        expect(await tilstand(s)).not.toEqual(for_);
      });

      it("negativkontroll Ja: firmaadministratoren gjør det selv (dagens atferd)", async () => {
        await settSelvAttestering(true);
        const s = await nySedel(FADMIN, p.fase);
        const for_ = await tilstand(s);
        await p.kall(dag(FADMIN), s);
        expect(await tilstand(s)).not.toEqual(for_);
      });
    });
  }

  it("attestant uten firma-admin avvises også på egen sedel", async () => {
    const s = await nySedel(ANNEN);
    await expect(
      dag(ANNEN).attesterRader({ radIder: { timerIder: [s.r1, s.r2], tilleggIder: [], maskinIder: [] } }),
    ).rejects.toThrow(/Egne timer attesteres av en annen/);
  });

  it("utvalg med én egen sedel blant andres avvises samlet — ingenting attesteres", async () => {
    const egen = await nySedel(FADMIN);
    const andres = await nySedel(ARB);
    await expect(
      dag(FADMIN).attesterRader({ radIder: { timerIder: [egen.r1, andres.r1], tilleggIder: [], maskinIder: [] } }),
    ).rejects.toThrow(/Egne timer/);
    const statuser = await prismaTimer.sheetTimer.findMany({ where: { id: { in: [egen.r1, andres.r1] } }, select: { attestertStatus: true } });
    expect(statuser.every((r) => r.attestertStatus === "pending")).toBe(true);
  });

  it("eieren gjenåpner fortsatt i Mine timer før attestering (gjenaapneDagsseddel er ikke sperret)", async () => {
    const s = await nySedel(FADMIN);
    await dag(FADMIN).gjenaapneDagsseddel({ id: s.sheetId });
    expect((await prismaTimer.dailySheet.findUniqueOrThrow({ where: { id: s.sheetId } })).status).not.toBe("sent");
  });
});

describe("w7 — flagget egneTimer i listene", () => {
  beforeEach(() => settSelvAttestering(false));

  it("hentTilAttesteringFirma: egen sedel true, andres false; Ja gir false", async () => {
    const egen = await nySedel(FADMIN);
    const andres = await nySedel(ARB);
    const flagg = async () => {
      const liste = (await dag(FADMIN).hentTilAttesteringFirma({ organizationId: ORG })) as { id: string; egneTimer: boolean }[];
      return Object.fromEntries(liste.filter((s) => ([egen.sheetId, andres.sheetId] as string[]).includes(s.id)).map((s) => [s.id, s.egneTimer]));
    };
    expect(await flagg()).toEqual({ [egen.sheetId]: true, [andres.sheetId]: false });
    await settSelvAttestering(true);
    expect(await flagg()).toEqual({ [egen.sheetId]: false, [andres.sheetId]: false });
  });

  it("hentTilAttestering (prosjekt): egen sedel true, andres false", async () => {
    const egen = await nySedel(FADMIN);
    const andres = await nySedel(ARB);
    const liste = (await dag(FADMIN).hentTilAttestering({ projectId: P1 })) as { id: string; egneTimer: boolean }[];
    expect(liste.find((s) => s.id === egen.sheetId)?.egneTimer).toBe(true);
    expect(liste.find((s) => s.id === andres.sheetId)?.egneTimer).toBe(false);
  });

  it("hentForAttestering: egen sedel kan leses (B18 A) og er merket; den andre attestanten ser false", async () => {
    const egen = await nySedel(FADMIN);
    expect((await dag(FADMIN).hentForAttestering({ id: egen.sheetId })).egneTimer).toBe(true);
    expect((await dag(ANNEN).hentForAttestering({ id: egen.sheetId })).egneTimer).toBe(false);
  });
});

describe("w7 — innstillingen", () => {
  beforeEach(() => settSelvAttestering(false));

  it("firma-admin leser og skriver «Attestant kan attestere egne timer»", async () => {
    const les = async () => ((await org(FADMIN).hentSetting({ organizationId: ORG })) as { tillattSelvAttestering: boolean }).tillattSelvAttestering;
    expect(await les()).toBe(false);
    await org(FADMIN).oppdaterSetting({ organizationId: ORG, tillattSelvAttestering: true });
    expect(await les()).toBe(true);
    await org(FADMIN).oppdaterSetting({ organizationId: ORG, tillattSelvAttestering: false });
    expect(await les()).toBe(false);
  });

  it("en attestant uten firma-admin kan ikke slå den på", async () => {
    await expect(org(ANNEN).oppdaterSetting({ organizationId: ORG, tillattSelvAttestering: true })).rejects.toThrow();
    expect((await prisma.organizationSetting.findUniqueOrThrow({ where: { organizationId: ORG } })).tillattSelvAttestering).toBe(false);
  });
});
