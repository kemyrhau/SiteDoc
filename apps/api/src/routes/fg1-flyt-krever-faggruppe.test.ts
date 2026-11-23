import { describe, it, expect, vi } from "vitest";

/**
 * FG1 (Kenneth 2026-11-23): «det som ikke visuelt er med i UI → de skal ikke opprettes i en db».
 * En ikke-HMS-dokumentflyt uten eier-faggruppe vises ingen steder og skal ikke kunne oppstå.
 *
 *  - `dokumentflyt.opprett` uten faggruppeId → BAD_REQUEST, ingenting opprettes.
 *  - `dokumentflyt.opprett` med faggruppe fra et annet prosjekt → BAD_REQUEST.
 *  - `dokumentflyt.oppdater` kan ikke nulle eier-faggruppen (feltet finnes ikke i skjemaet).
 *  - `faggruppe.slett` nekter når faggruppen EIER en flyt, også uten medlemmer/ledd —
 *    ellers ville `onDelete: SetNull` på Dokumentflyt.faggruppe gjort flyten eierløs i stillhet.
 *  - HMS-flyten opprettes bare av seedHmsModulOmradet; seed-vakten står i prosjektSeed.test.ts.
 *
 * Tilgangsportene er stubbet (admin slipper) — de dekkes av dokumentflyt-slett-adminvakt.test.ts.
 *
 * Kjør: cd apps/api && npx vitest run src/routes/fg1-flyt-krever-faggruppe.test.ts
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn(async () => undefined),
  verifiserAdmin: vi.fn(async () => undefined),
}));

import { dokumentflytRouter } from "./dokumentflyt";
import { faggruppeRouter } from "./faggruppe";

const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const FAGGRUPPE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const FREMMED_FAGGRUPPE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const FLYT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function ctxMed(prisma: unknown) {
  return {
    userId: "admin",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function prismaForFlyt() {
  return {
    faggruppe: {
      // Bare FAGGRUPPE hører til PROSJEKT.
      findFirst: vi.fn(async (args: { where: { id: string; projectId: string } }) =>
        args.where.id === FAGGRUPPE && args.where.projectId === PROSJEKT ? { id: FAGGRUPPE } : null,
      ),
    },
    dokumentflyt: {
      create: vi.fn().mockResolvedValue({ id: FLYT }),
      update: vi.fn().mockResolvedValue({ id: FLYT }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: FLYT }),
    },
    dokumentflytMal: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("FG1 — dokumentflyt.opprett krever eier-faggruppe i prosjektet", () => {
  it("🔴 uten faggruppeId → BAD_REQUEST, ingen flyt opprettes", async () => {
    const prisma = prismaForFlyt();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dokumentflytRouter.createCaller(ctxMed(prisma)).opprett({ projectId: PROSJEKT, name: "Eierløs" } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflyt.create).not.toHaveBeenCalled();
  });

  it("🔴 faggruppeId: null → BAD_REQUEST, ingen flyt opprettes", async () => {
    const prisma = prismaForFlyt();
    await expect(
      dokumentflytRouter
        .createCaller(ctxMed(prisma))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .opprett({ projectId: PROSJEKT, faggruppeId: null, name: "Eierløs" } as any),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.dokumentflyt.create).not.toHaveBeenCalled();
  });

  it("🔴 faggruppe fra et annet prosjekt → BAD_REQUEST, ingen flyt opprettes", async () => {
    const prisma = prismaForFlyt();
    await expect(
      dokumentflytRouter
        .createCaller(ctxMed(prisma))
        .opprett({ projectId: PROSJEKT, faggruppeId: FREMMED_FAGGRUPPE, name: "Fremmed" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Dokumentflyten må høre til en faggruppe i prosjektet." });
    expect(prisma.dokumentflyt.create).not.toHaveBeenCalled();
  });

  it("faggruppe i prosjektet → flyten opprettes med eier-faggruppen (vakt mot overstramming)", async () => {
    const prisma = prismaForFlyt();
    await dokumentflytRouter
      .createCaller(ctxMed(prisma))
      .opprett({ projectId: PROSJEKT, faggruppeId: FAGGRUPPE, name: "Elektro rapporterer" });
    expect(prisma.dokumentflyt.create.mock.calls[0]![0].data).toMatchObject({
      projectId: PROSJEKT,
      faggruppeId: FAGGRUPPE,
      name: "Elektro rapporterer",
    });
  });

  it("🔴 oppdater kan ikke nulle eier-faggruppen — feltet når aldri update", async () => {
    const prisma = prismaForFlyt();
    await dokumentflytRouter
      .createCaller(ctxMed(prisma))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .oppdater({ id: FLYT, projectId: PROSJEKT, name: "Nytt navn", faggruppeId: null } as any);
    const data = prisma.dokumentflyt.update.mock.calls[0]![0].data;
    expect(data).toEqual({ name: "Nytt navn" });
    expect("faggruppeId" in data).toBe(false);
  });
});

describe("FG1 — faggruppe.slett gjør aldri en flyt eierløs", () => {
  it("🔴 faggruppe som EIER en flyt (ingen medlemmer, ingen ledd) → PRECONDITION_FAILED, ingen sletting", async () => {
    const prisma = {
      faggruppe: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT, name: "Elektro" }),
        delete: vi.fn().mockResolvedValue({ id: FAGGRUPPE }),
      },
      checklist: { count: vi.fn().mockResolvedValue(0) },
      task: { count: vi.fn().mockResolvedValue(0) },
      faggruppeKobling: { count: vi.fn().mockResolvedValue(0) },
      dokumentflyt: { findMany: vi.fn().mockResolvedValue([{ name: "Elektro rapporterer" }]) },
      dokumentflytMedlem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await expect(
      faggruppeRouter.createCaller(ctxMed(prisma)).slett({ id: FAGGRUPPE }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Kan ikke slette «Elektro» fordi den står i dokumentflyten «Elektro rapporterer». Fjern dem fra faggruppen og flytene først.",
    });
    expect(prisma.faggruppe.delete).not.toHaveBeenCalled();
    // Eide flyter slås opp på eier-faggruppen — det er SetNull-koblingen som ellers ville nullet.
    expect(prisma.dokumentflyt.findMany.mock.calls[0]![0].where).toEqual({ faggruppeId: FAGGRUPPE });
  });
});
