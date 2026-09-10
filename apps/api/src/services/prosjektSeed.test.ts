import { describe, it, expect, vi } from "vitest";
import {
  STANDARD_PROJECT_GROUPS,
  STANDARD_FAGGRUPPER,
  STANDARD_DOKUMENTFLYTER,
  PROSJEKT_MODULER,
} from "@sitedoc/shared";
import { seedStandardProsjektoppsett } from "./prosjektSeed";
import type { Prisma } from "@sitedoc/db";

/**
 * Kontrakten denne låser (2026-09-10):
 *   - et tomt prosjekt får ALLE fire seed-typene (grupper m/domener, moduler+maler,
 *     faggrupper, dokumentflyter) — samme oppsett uansett hvilken opprettelsesvei
 *   - dobbeltkjøring er idempotent (grupper finnes alt → no-op, ingen duplikater)
 *   - feiler en create midt i seedingen, propageres feilen → den omsluttende
 *     $transaction i mutasjonen ruller tilbake hele opprettelsen
 *
 * Drives via en in-memory fake-tx (samme mønster som bilde-idempotens.test.ts).
 */

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const BRUKER = "user-1";

interface Rad {
  id: string;
  [k: string]: unknown;
}

function lagTx() {
  const lager = {
    projectGroup: [] as Rad[],
    projectModule: [] as Rad[],
    reportTemplate: [] as Rad[],
    reportObject: [] as Rad[],
    faggruppe: [] as Rad[],
    faggruppeKobling: [] as Rad[],
    dokumentflyt: [] as Rad[],
    dokumentflytMedlem: [] as Rad[],
    dokumentflytMal: [] as Rad[],
  };
  let teller = 0;

  const model = (navn: keyof typeof lager) => ({
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const rad: Rad = { id: `${navn}-${teller++}`, ...data };
      lager[navn].push(rad);
      return rad;
    }),
    createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
      for (const d of data) lager[navn].push({ id: `${navn}-${teller++}`, ...d });
      return { count: data.length };
    }),
    count: vi.fn(async () => lager[navn].length),
    findMany: vi.fn(async () =>
      lager[navn].map((r) => ({ id: r.id, prefix: r.prefix })),
    ),
  });

  const tx = {
    projectGroup: model("projectGroup"),
    projectModule: model("projectModule"),
    reportTemplate: model("reportTemplate"),
    reportObject: model("reportObject"),
    faggruppe: model("faggruppe"),
    faggruppeKobling: model("faggruppeKobling"),
    dokumentflyt: model("dokumentflyt"),
    dokumentflytMedlem: model("dokumentflytMedlem"),
    dokumentflytMal: model("dokumentflytMal"),
    projectMember: {
      findFirst: vi.fn(async () => ({ id: "pm-1" })),
    },
  };

  return { tx, lager };
}

describe("seedStandardProsjektoppsett", () => {
  it("tomt prosjekt får alle fire seed-typene", async () => {
    const { tx, lager } = lagTx();
    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);

    expect(lager.projectGroup).toHaveLength(STANDARD_PROJECT_GROUPS.length);
    expect(lager.faggruppe).toHaveLength(STANDARD_FAGGRUPPER.length);
    expect(lager.dokumentflyt).toHaveLength(STANDARD_DOKUMENTFLYTER.length);
    expect(lager.projectModule).toHaveLength(PROSJEKT_MODULER.length);

    // domener følger med gruppene (kjernen i saken)
    const hms = lager.projectGroup.find((g) => g.slug === "hms-ledere");
    expect(hms?.domains).toEqual(["hms"]);

    // maler seedes (minst én), og oppretteren kobles til Byggherre-faggruppa
    const antallMaler = PROSJEKT_MODULER.reduce((n, m) => n + m.maler.length, 0);
    expect(lager.reportTemplate).toHaveLength(antallMaler);
    expect(lager.faggruppeKobling).toHaveLength(1);
  });

  it("dobbeltkjøring er idempotent — ingen duplikater", async () => {
    const { tx, lager } = lagTx();
    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);
    const etterFørste = lager.projectGroup.length;

    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);
    expect(lager.projectGroup).toHaveLength(etterFørste);
    expect(lager.faggruppe).toHaveLength(STANDARD_FAGGRUPPER.length);
  });

  it("feil i seeding propageres → transaksjonen ruller tilbake", async () => {
    const { tx } = lagTx();
    tx.faggruppe.create.mockRejectedValueOnce(new Error("DB nede"));

    await expect(
      seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER),
    ).rejects.toThrow("DB nede");
  });
});
