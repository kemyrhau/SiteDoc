import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Prosjektkort L3 (2026-11-06) — `vareforbruk.katalogForFirma` + idempotent
 * `vareforbruk.opprett` (valgfri klient-id).
 *
 * Katalogen er arbeiderens vare-velger: firmamedlem (ikke admin) får lese, et
 * annet firma og avslått Varelager avvises, og svaret har KUN fire felt pr. vare.
 * Opprett med samme id to ganger gir én rad (mobil-synk der svaret gikk tapt).
 */

const { projectFindMany, activityCreate } = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  activityCreate: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    project: { findMany: projectFindMany, findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: "11111111-1111-1111-1111-111111111111" }) },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    activity: { create: activityCreate },
  },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  aktivtMedlemWhere: { periodeSlutt: null },
  verifiserOrganisasjonTilgang: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  erVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { vareforbrukRouter } from "./vareforbruk";
import { verifiserOrganisasjonTilgang } from "../trpc/tilgangskontroll";
import { erVarelagerAktivert } from "../services/varelager/moduleGate";

const ORG = "11111111-1111-1111-1111-111111111111";
const BRUKER = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const VARE = "44444444-4444-4444-4444-444444444444";
const LINJE = "55555555-5555-5555-5555-555555555555";

function lagCtx(varelager: Record<string, unknown>) {
  return {
    userId: BRUKER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prismaVarelager: varelager,
    prismaTimer: { dailySheet: { findUnique: vi.fn() } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  projectFindMany.mockReset();
  activityCreate.mockReset().mockResolvedValue({});
  vi.mocked(verifiserOrganisasjonTilgang).mockReset().mockResolvedValue(undefined);
  vi.mocked(erVarelagerAktivert).mockReset().mockResolvedValue(true);
});

describe("vareforbruk.katalogForFirma", () => {
  it("arbeider i firmaet får aktive varer med kun fire felt + prosjekter med Varelager", async () => {
    const vareFindMany = vi.fn().mockResolvedValue([
      { id: VARE, navn: "Grus", enhet: "m3", varenummer: "G1", pris: 999, kategoriId: "k" },
    ]);
    projectFindMany.mockResolvedValue([{ id: PROSJEKT }, { id: "p-av" }]);
    vi.mocked(erVarelagerAktivert).mockImplementation(async (_org, pid) => pid !== "p-av");

    const res = await vareforbrukRouter
      .createCaller(lagCtx({ vare: { findMany: vareFindMany } }))
      .katalogForFirma({ organizationId: ORG });

    expect(verifiserOrganisasjonTilgang).toHaveBeenCalledWith(BRUKER, ORG);
    expect(vareFindMany.mock.calls[0]![0].where).toEqual({ organizationId: ORG, aktiv: true });
    expect(res.varer).toEqual([{ id: VARE, navn: "Grus", enhet: "m3", varenummer: "G1" }]);
    expect(Object.keys(res.varer[0]!).sort()).toEqual(["enhet", "id", "navn", "varenummer"]);
    expect(res.prosjektIderMedVarelager).toEqual([PROSJEKT]);
    // Kun brukerens egne, aktive medlemskap i firmaet.
    expect(projectFindMany.mock.calls[0]![0].where).toEqual({
      primaryOrganizationId: ORG,
      members: { some: { userId: BRUKER, periodeSlutt: null } },
    });
  });

  it("medlem av et annet firma avvises (FORBIDDEN) før noe leses", async () => {
    vi.mocked(verifiserOrganisasjonTilgang).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Ikke medlem" }),
    );
    const vareFindMany = vi.fn();
    await expect(
      vareforbrukRouter
        .createCaller(lagCtx({ vare: { findMany: vareFindMany } }))
        .katalogForFirma({ organizationId: ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(vareFindMany).not.toHaveBeenCalled();
  });

  it("Varelager av for firmaet avvises (FORBIDDEN)", async () => {
    vi.mocked(erVarelagerAktivert).mockResolvedValue(false);
    const vareFindMany = vi.fn();
    await expect(
      vareforbrukRouter
        .createCaller(lagCtx({ vare: { findMany: vareFindMany } }))
        .katalogForFirma({ organizationId: ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(vareFindMany).not.toHaveBeenCalled();
  });
});

describe("vareforbruk.opprett — idempotent klient-id", () => {
  function lagLager() {
    const rader = new Map<string, Record<string, unknown>>();
    const lager = {
      vare: { findUnique: vi.fn().mockResolvedValue({ organizationId: ORG, aktiv: true }) },
      vareforbruk: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rader.get(where.id) ?? null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = (data.id as string | undefined) ?? "server-generert";
          if (rader.has(id)) throw Object.assign(new Error("unik"), { code: "P2002" });
          const rad = { ...data, id };
          rader.set(id, rad);
          return rad;
        }),
      },
    };
    return { rader, lager };
  }

  const input = { id: LINJE, projectId: PROSJEKT, dato: "2026-11-06", vareId: VARE, antall: 2 };

  it("to sendinger med samme id gir én rad", async () => {
    const { rader, lager } = lagLager();
    const kaller = vareforbrukRouter.createCaller(lagCtx(lager));
    const a = await kaller.opprett(input);
    const b = await kaller.opprett(input);
    expect(rader.size).toBe(1);
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
    expect(a.id).toBe(LINJE);
    expect(b.id).toBe(LINJE);
  });

  it("samtidig dublett (P2002 på create) returnerer raden som ble skrevet", async () => {
    const { rader, lager } = lagLager();
    rader.set(LINJE, { id: LINJE, registrertAvUserId: BRUKER });
    // Første oppslag ser ingenting (racet), create treffer PK-en.
    lager.vareforbruk.findUnique.mockResolvedValueOnce(null);
    const res = await vareforbrukRouter.createCaller(lagCtx(lager)).opprett(input);
    expect(res.id).toBe(LINJE);
    expect(rader.size).toBe(1);
  });

  it("id som tilhører en annen bruker avvises", async () => {
    const { rader, lager } = lagLager();
    rader.set(LINJE, { id: LINJE, registrertAvUserId: "annen" });
    await expect(
      vareforbrukRouter.createCaller(lagCtx(lager)).opprett(input),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("uten id oppfører opprett seg som før (server genererer id)", async () => {
    const { lager } = lagLager();
    const { id: _id, ...utenId } = input;
    const res = await vareforbrukRouter.createCaller(lagCtx(lager)).opprett(utenId);
    expect(res.id).toBe("server-generert");
    expect(lager.vareforbruk.findUnique).not.toHaveBeenCalled();
  });
});
