import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 *
 * `byggeplassId` på SheetTimer/SheetMachine er en svak referanse, så serveren må
 * avvise en byggeplass fra et annet prosjekt enn radens. Rød først: før ordren
 * lagret tilfoyTimerRad/maskin.tilfoy verdien ukontrollert, og oppdaterTimerRad/
 * maskin.oppdater tok den ikke imot i det hele tatt.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som timer-km-tak.test.ts.
 */

const findFirstByggeplass = vi.fn();
const findManyByggeplass = vi.fn();

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  resolverOrgForEgenTimeføring: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  verifiserAnsattIFirma: vi.fn().mockResolvedValue(undefined),
  resolverOrgFraInput: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30, dagsnorm: 7.5, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    byggeplass: {
      findFirst: (...a: unknown[]) => findFirstByggeplass(...a),
      findMany: (...a: unknown[]) => findManyByggeplass(...a),
    },
  },
}));
vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn().mockResolvedValue({ id: "utstyr" }) } },
}));

import { dagsseddelRouter } from "./dagsseddel";
import {
  krevByggeplassIProsjekt,
  krevByggeplasserIProsjekt,
  lagByggeplassVasker,
  maskinByggeplassVedSync,
} from "./byggeplass-rad";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT_A = "33333333-3333-3333-3333-333333333333";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const RAD = "66666666-6666-6666-6666-666666666666";
const UTSTYR = "77777777-7777-7777-7777-777777777777";
const BYGGEPLASS_B = "88888888-8888-8888-8888-888888888888"; // hører til prosjekt B
const PROSJEKT_B = "99999999-9999-9999-9999-999999999999";
const RAD2 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  // Byggeplassen finnes ikke under radens prosjekt (A).
  findFirstByggeplass.mockResolvedValue(null);
  findManyByggeplass.mockResolvedValue([{ id: BYGGEPLASS_B, projectId: PROSJEKT_B }]);
});

function lagCtx() {
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: "draft",
    pauseMin: 0,
    dato: new Date("2026-11-05T00:00:00Z"),
  };
  const timerCreate = vi.fn();
  const timerUpdate = vi.fn();
  const maskinCreate = vi.fn();
  const maskinUpdate = vi.fn();
  // Interaktiv transaksjon: rad-skriving + hode-synk (PK6) går via tx.
  const transaction = vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      sheetTimer: {
        update: timerUpdate,
        aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
      },
      dailySheet: { update: vi.fn().mockResolvedValue({}) },
    }),
  );
  const upsert = vi.fn();
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      organizationSetting: {
        findUnique: vi.fn().mockResolvedValue({ tillattRedigerVedAttestering: true }),
      },
    },
    prismaTimer: {
      $transaction: transaction,
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet), upsert },
      lonnsart: {
        findFirst: vi.fn().mockResolvedValue({ id: LONNSART, satsEnhet: "per_time" }),
      },
      aktivitet: { findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }) },
      sheetTimer: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, lonnsartId: LONNSART, timer: 4,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: timerCreate,
        update: timerUpdate,
      },
      sheetMachine: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, vehicleId: UTSTYR, timer: 4,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: maskinCreate,
        update: maskinUpdate,
      },
    },
  };
  return { ctx, sheet, timerCreate, timerUpdate, maskinCreate, maskinUpdate, transaction, upsert };
}

// createCaller-typen er for dyp til å uttrykke mock-ctx; samme grep som de andre testene.
const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);

const AVVIST = /hører ikke til radens prosjekt/;

describe("byggeplass per rad — avvisning av byggeplass fra annet prosjekt (ordre 10)", () => {
  it("🔴 tilfoyTimerRad: BAD_REQUEST, ingen rad opprettes", async () => {
    const { ctx, timerCreate } = lagCtx();
    await expect(
      caller(ctx).tilfoyTimerRad({
        sheetId: SHEET, projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
        lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 4,
        fraTid: "07:00", tilTid: "11:00",
      }),
    ).rejects.toThrow(AVVIST);
    expect(findFirstByggeplass).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BYGGEPLASS_B, projectId: PROSJEKT_A } }),
    );
    expect(timerCreate).not.toHaveBeenCalled();
  });

  it("🔴 oppdaterTimerRad: valideres mot RADENS prosjekt, ingen oppdatering", async () => {
    const { ctx, timerUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdaterTimerRad({
        id: RAD, byggeplassId: BYGGEPLASS_B, fraTid: "07:00", tilTid: "11:00",
      }),
    ).rejects.toThrow(AVVIST);
    expect(findFirstByggeplass).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BYGGEPLASS_B, projectId: PROSJEKT_A } }),
    );
    expect(timerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 maskin.tilfoy: BAD_REQUEST, ingen rad opprettes", async () => {
    const { ctx, maskinCreate } = lagCtx();
    await expect(
      caller(ctx).maskin.tilfoy({
        sheetId: SHEET, projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
        vehicleId: UTSTYR, timer: 2,
      }),
    ).rejects.toThrow(AVVIST);
    expect(maskinCreate).not.toHaveBeenCalled();
  });

  it("🔴 maskin.oppdater: valideres mot radens prosjekt, ingen oppdatering", async () => {
    const { ctx, maskinUpdate } = lagCtx();
    await expect(
      caller(ctx).maskin.oppdater({ id: RAD, byggeplassId: BYGGEPLASS_B }),
    ).rejects.toThrow(AVVIST);
    expect(maskinUpdate).not.toHaveBeenCalled();
  });
});

describe("krevByggeplassIProsjekt", () => {
  it("null/utelatt er gyldig og slår ikke opp (A.30: byggeplass-NULL er lovlig)", async () => {
    await expect(krevByggeplassIProsjekt(null, PROSJEKT_A)).resolves.toBeUndefined();
    await expect(krevByggeplassIProsjekt(undefined, PROSJEKT_A)).resolves.toBeUndefined();
    expect(findFirstByggeplass).not.toHaveBeenCalled();
  });

  it("byggeplass under radens prosjekt passerer", async () => {
    findFirstByggeplass.mockResolvedValue({ id: BYGGEPLASS_B });
    await expect(krevByggeplassIProsjekt(BYGGEPLASS_B, PROSJEKT_A)).resolves.toBeUndefined();
  });
});

describe("byggeplass-grense i de øvrige skriveveiene (ordre 12)", () => {
  const timerRad = {
    projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
    lonnsartId: LONNSART, aktivitetId: AKTIVITET,
    fraTid: "07:00", tilTid: "11:00", timer: 4,
  };

  it("🔴 forsonDagskort: ny rad med byggeplass fra annet prosjekt avvises, ingen transaksjon", async () => {
    const { ctx, transaction } = lagCtx();
    await expect(
      caller(ctx).forsonDagskort({ sheetId: SHEET, oppdateringer: [], nyeRader: [timerRad] }),
    ).rejects.toThrow(AVVIST);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("🔴 forsonDagskort: oppdatering med byggeplass fra annet prosjekt avvises", async () => {
    const { ctx, transaction } = lagCtx();
    await expect(
      caller(ctx).forsonDagskort({
        sheetId: SHEET, oppdateringer: [{ id: RAD, ...timerRad }], nyeRader: [],
      }),
    ).rejects.toThrow(AVVIST);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("🔴 redigerSedelRader: timer- og maskinrad med fremmed byggeplass avvises, ingen transaksjon", async () => {
    for (const nyeRader of [
      { timer: [{ originalId: null, ...timerRad }], tillegg: [], maskin: [] },
      {
        timer: [], tillegg: [],
        maskin: [{ originalId: null, projectId: PROSJEKT_A, vehicleId: UTSTYR, byggeplassId: BYGGEPLASS_B, timer: 2 }],
      },
    ]) {
      const { ctx, sheet, transaction } = lagCtx();
      sheet.status = "sent";
      await expect(
        caller(ctx).redigerSedelRader({ sheetId: SHEET, nyeRader }),
      ).rejects.toThrow(AVVIST);
      expect(transaction).not.toHaveBeenCalled();
    }
  });

  it("🔴 splittRadEier: ny splitt-rad med fremmed byggeplass avvises, ingen transaksjon", async () => {
    const { ctx, transaction } = lagCtx();
    await expect(
      caller(ctx).splittRadEier({
        radType: "timer", radId: RAD,
        nyeRader: [
          { ...timerRad, byggeplassId: null, timer: 2, tilTid: "09:00" },
          { ...timerRad, timer: 2, fraTid: "09:00" },
        ],
      }),
    ).rejects.toThrow(AVVIST);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("🔴 opprett: sedel med prosjekt og byggeplass fra annet prosjekt avvises før lagring", async () => {
    const { ctx, upsert } = lagCtx();
    await expect(
      caller(ctx).opprett({
        clientUuid: RAD2, aktivitetId: AKTIVITET, dato: "2026-11-05",
        projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
        startAt: "2026-11-05T07:00:00Z", endAt: "2026-11-05T15:00:00Z",
      }),
    ).rejects.toThrow(AVVIST);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("krevByggeplasserIProsjekt / lagByggeplassVasker", () => {
  it("én spørring for alle rader; null/utelatt passerer uten oppslag", async () => {
    await expect(
      krevByggeplasserIProsjekt([{ projectId: PROSJEKT_A }, { projectId: PROSJEKT_A, byggeplassId: null }]),
    ).resolves.toBeUndefined();
    expect(findManyByggeplass).not.toHaveBeenCalled();
  });

  it("byggeplass under radens prosjekt passerer", async () => {
    await expect(
      krevByggeplasserIProsjekt([{ projectId: PROSJEKT_B, byggeplassId: BYGGEPLASS_B }]),
    ).resolves.toBeUndefined();
  });

  it("vaskeren gir byggeplassen kun for riktig prosjekt, ellers null (også ukjent id)", async () => {
    const vask = await lagByggeplassVasker([BYGGEPLASS_B, null, BYGGEPLASS_B]);
    expect(findManyByggeplass).toHaveBeenCalledTimes(1);
    expect(vask(BYGGEPLASS_B, PROSJEKT_B)).toBe(BYGGEPLASS_B);
    expect(vask(BYGGEPLASS_B, PROSJEKT_A)).toBeNull();
    expect(vask(BYGGEPLASS_B, null)).toBeNull();
    expect(vask(RAD2, PROSJEKT_B)).toBeNull();
    expect(vask(null, PROSJEKT_B)).toBeNull();
  });
});

/**
 * Ordre (12), B — «utelatt = urørt»: en oppdatering som ikke sender byggeplassId skal la
 * radens eksisterende byggeplass stå. Klienten (web) sender feltet bare når brukeren
 * har endret det; serveren må på sin side ikke tolke utelatt som null.
 */
describe("oppdaterTimerRad — utelatt byggeplassId er urørt (ordre 12 B)", () => {
  it("🔴 uten byggeplassId: update-dataen har ikke feltet, og ingen oppslag gjøres", async () => {
    const { ctx, timerUpdate } = lagCtx();
    timerUpdate.mockResolvedValue({ id: RAD });
    await caller(ctx).oppdaterTimerRad({
      id: RAD, beskrivelse: "Ny tekst", fraTid: "07:00", tilTid: "11:00",
    });
    expect(timerUpdate).toHaveBeenCalledTimes(1);
    const data = (timerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.beskrivelse).toBe("Ny tekst");
    expect(data).not.toHaveProperty("byggeplassId");
    expect(findFirstByggeplass).not.toHaveBeenCalled();
  });

  it("eksplisitt null fjerner byggeplassen (gyldig tilstand, A.30)", async () => {
    const { ctx, timerUpdate } = lagCtx();
    timerUpdate.mockResolvedValue({ id: RAD });
    await caller(ctx).oppdaterTimerRad({
      id: RAD, byggeplassId: null, fraTid: "07:00", tilTid: "11:00",
    });
    const data = (timerUpdate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.byggeplassId).toBeNull();
  });
});

describe("maskinByggeplassVedSync (ORDRE 36b)", () => {
  const vask = (b: string | null | undefined) => (b === BYGGEPLASS_B ? b : null);

  it("egen byggeplass vinner over sedelens", () => {
    expect(maskinByggeplassVedSync({ byggeplassId: BYGGEPLASS_B }, RAD2, vask)).toBe(BYGGEPLASS_B);
  });
  it("egen byggeplass som vaskes bort → null, faller IKKE tilbake til sedelens", () => {
    expect(maskinByggeplassVedSync({ byggeplassId: RAD2 }, BYGGEPLASS_B, vask)).toBeNull();
  });
  it("eksplisitt null → null uten sedel-arv", () => {
    expect(maskinByggeplassVedSync({ byggeplassId: null }, BYGGEPLASS_B, vask)).toBeNull();
  });
  it("utelatt felt → sedelens byggeplass (vasket)", () => {
    expect(maskinByggeplassVedSync({}, BYGGEPLASS_B, vask)).toBe(BYGGEPLASS_B);
    expect(maskinByggeplassVedSync({}, RAD2, vask)).toBeNull();
  });
});
