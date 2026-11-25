import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * FIRMAADMIN-TILGANG D (Kenneth 2026-11-25: «finn ut hva som skal til for at silje og medlemmer
 * kan registrere varer i kortet sitt»).
 *
 * Med `vareforbruk_tilgang_default = 'alle-ansatte'` bruker vare-katalogen og `opprett` samme
 * prosjektsett som timer for eierfirmaets ansatte: ingen medlemsrad kreves. Andre verdier av
 * innstillingen oppfører seg som før. En bruker i et annet firma får fortsatt FORBIDDEN.
 *
 * Tilgangsfunksjonene er mocket her; den ekte `aktivAnsattIEierfirma` (eierfirma, aldri
 * deltakerfirma) testes i src/trpc/firmaadmin-tilgang.test.ts.
 */

const { projectFindMany, settingFindUnique, activityCreate } = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  settingFindUnique: vi.fn(),
  activityCreate: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    project: {
      findMany: projectFindMany,
      findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: "11111111-1111-1111-1111-111111111111" }),
    },
    organizationSetting: { findUnique: settingFindUnique },
    activity: { create: activityCreate },
  },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  erAnsattIFirma: vi.fn(),
  aktivAnsattIEierfirma: vi.fn(),
  verifiserProsjektIkkeFrosset: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  aktivtMedlemWhere: { periodeSlutt: null },
  verifiserOrganisasjonTilgang: vi.fn(),
  erFirmaAdmin: vi.fn(),
  verifiserProsjekterTilhørerFirma: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  erVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { vareforbrukRouter } from "./vareforbruk";
import {
  verifiserProsjektmedlem,
  erAnsattIFirma,
  aktivAnsattIEierfirma,
  verifiserProsjektIkkeFrosset,
} from "../trpc/tilgangskontroll";
import { erVarelagerAktivert } from "../services/varelager/moduleGate";

const ORG = "11111111-1111-1111-1111-111111111111";
const ANSATT = "22222222-2222-2222-2222-222222222222";
const P999 = "33333333-3333-3333-3333-333333333333";
const VARE = "44444444-4444-4444-4444-444444444444";

const ikkeMedlem = () => new TRPCError({ code: "FORBIDDEN", message: "Du er ikke medlem av dette prosjektet" });

function lagCtx() {
  const lager = {
    vare: {
      findMany: vi.fn().mockResolvedValue([{ id: VARE, navn: "Grus", enhet: "m3", varenummer: "G1" }]),
      findUnique: vi.fn().mockResolvedValue({ organizationId: ORG, aktiv: true }),
    },
    vareforbruk: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "ny-linje" })),
    },
  };
  return {
    lager,
    ctx: {
      userId: ANSATT,
      tokenKilde: null,
      sessionToken: null,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      nyttSessionTokenForRespons: { value: null },
      prismaVarelager: lager,
      prismaTimer: { dailySheet: { findUnique: vi.fn() } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

const vareInput = { projectId: P999, dato: "2026-11-25", vareId: VARE, antall: 3 };

beforeEach(() => {
  projectFindMany.mockReset().mockResolvedValue([{ id: P999 }]);
  settingFindUnique.mockReset().mockResolvedValue(null); // default: alle-ansatte
  activityCreate.mockReset().mockResolvedValue({});
  vi.mocked(verifiserProsjektmedlem).mockReset().mockRejectedValue(ikkeMedlem());
  vi.mocked(erAnsattIFirma).mockReset().mockResolvedValue(true);
  vi.mocked(aktivAnsattIEierfirma).mockReset().mockResolvedValue(ORG);
  vi.mocked(verifiserProsjektIkkeFrosset).mockReset().mockResolvedValue(undefined);
  vi.mocked(erVarelagerAktivert).mockReset().mockResolvedValue(true);
});

describe("D: vareforbruk.katalogForFirma", () => {
  it("🔴 alle-ansatte: ansatt får alle prosjekter firmaet eier, uten medlemskrav (som timer)", async () => {
    const { ctx } = lagCtx();
    const res = await vareforbrukRouter.createCaller(ctx).katalogForFirma({ organizationId: ORG });
    expect(projectFindMany.mock.calls[0]![0].where).toEqual({ primaryOrganizationId: ORG });
    expect(res.prosjektIderMedVarelager).toEqual([P999]);
  });

  it("kun-prosjektmedlemmer: medlemskravet står som før", async () => {
    settingFindUnique.mockResolvedValue({ vareforbrukTilgangDefault: "kun-prosjektmedlemmer" });
    const { ctx } = lagCtx();
    await vareforbrukRouter.createCaller(ctx).katalogForFirma({ organizationId: ORG });
    expect(projectFindMany.mock.calls[0]![0].where).toEqual({
      primaryOrganizationId: ORG,
      members: { some: { userId: ANSATT, periodeSlutt: null } },
    });
  });

  it("ikke aktiv ansatt (f.eks. sitedoc_admin eller deaktivert): medlemskravet står", async () => {
    vi.mocked(erAnsattIFirma).mockResolvedValue(false);
    const { ctx } = lagCtx();
    await vareforbrukRouter.createCaller(ctx).katalogForFirma({ organizationId: ORG });
    expect(projectFindMany.mock.calls[0]![0].where).toHaveProperty("members");
  });
});

describe("D: vareforbruk.opprett", () => {
  it("🔴 ansatt i eierfirmaet uten medlemsrad lagrer en varelinje (alle-ansatte)", async () => {
    const { ctx, lager } = lagCtx();
    const res = await vareforbrukRouter.createCaller(ctx).opprett(vareInput);
    expect(res.id).toBe("ny-linje");
    expect(lager.vareforbruk.create).toHaveBeenCalledTimes(1);
    expect(verifiserProsjektmedlem).not.toHaveBeenCalled();
    expect(verifiserProsjektIkkeFrosset).toHaveBeenCalledWith(ANSATT, P999);
  });

  it("🔴 isolasjon: bruker i et annet firma (ikke ansatt i eierfirmaet) → FORBIDDEN, ingen skriving", async () => {
    vi.mocked(aktivAnsattIEierfirma).mockResolvedValue(null);
    const { ctx, lager } = lagCtx();
    await expect(vareforbrukRouter.createCaller(ctx).opprett(vareInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });

  it("kun-prosjektmedlemmer: ansatt uten medlemsrad avvises som før", async () => {
    settingFindUnique.mockResolvedValue({ vareforbrukTilgangDefault: "kun-prosjektmedlemmer" });
    const { ctx, lager } = lagCtx();
    await expect(vareforbrukRouter.createCaller(ctx).opprett(vareInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(lager.vareforbruk.create).not.toHaveBeenCalled();
  });
});
