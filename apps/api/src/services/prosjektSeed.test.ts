import { describe, it, expect, vi } from "vitest";
import {
  STANDARD_PROJECT_GROUPS,
  STANDARD_FAGGRUPPER,
  PROSJEKT_MODULER,
} from "@sitedoc/shared";
import { seedStandardProsjektoppsett } from "./prosjektSeed";
import type { Prisma } from "@sitedoc/db";

/**
 * Kontrakten denne låser (2026-09-10):
 *   - et tomt prosjekt får ALLE fire seed-typene (grupper m/domener, moduler+maler,
 *     faggrupper, dokumentflyter) — samme oppsett uansett hvilken opprettelsesvei.
 *     F13c (2026-11-23): ingen faggruppeflyter. F13c-2: én HMS-flyt uten faggruppe-ledd
 *     (melder = kontaktlisten via null-ledd, behandler = HMS-gruppa), 4 eksempel-faggrupper.
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

  // Enkel where-matcher: bare skalare felt sammenlignes (nestede filtre håndteres eksplisitt).
  const treff = (rad: Rad, where?: Record<string, unknown>) =>
    !where ||
    Object.entries(where).every(([k, v]) =>
      v !== null && typeof v === "object" ? true : rad[k] === v,
    );

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
    findMany: vi.fn(async (arg?: { where?: Record<string, unknown> }) =>
      lager[navn].filter((r) => treff(r, arg?.where)).map((r) => ({ id: r.id, prefix: r.prefix })),
    ),
    findFirst: vi.fn(async (arg?: { where?: Record<string, unknown> }) => {
      const where = arg?.where;
      // dokumentflyt: «flyt med en mal i domain hms» (seedHmsModulOmradet sitt oppslag)
      if (navn === "dokumentflyt" && where && "maler" in where) {
        const hmsMaler = new Set(lager.reportTemplate.filter((m) => m.domain === "hms").map((m) => m.id));
        const flytId = lager.dokumentflytMal.find((k) => hmsMaler.has(String(k.templateId)))?.dokumentflytId;
        return flytId ? { id: flytId } : null;
      }
      return lager[navn].find((r) => treff(r, where)) ?? null;
    }),
    upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
      const rad: Rad = { id: `${navn}-${teller++}`, ...create };
      lager[navn].push(rad);
      return rad;
    }),
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
    expect(lager.dokumentflyt).toHaveLength(1); // bare HMS-flyten
    expect(lager.projectModule).toHaveLength(PROSJEKT_MODULER.length);

    // domener følger med gruppene (kjernen i saken)
    const hms = lager.projectGroup.find((g) => g.slug === "hms-ledere");
    expect(hms?.domains).toEqual(["hms"]);

    // maler seedes (minst én), og oppretteren kobles til Byggherre-faggruppa
    const antallMaler = PROSJEKT_MODULER.reduce((n, m) => n + m.maler.length, 0);
    expect(lager.reportTemplate).toHaveLength(antallMaler);
    expect(lager.faggruppeKobling).toHaveLength(1);
  });

  it("🔴 F13c-2: fire eksempel-faggrupper uten Bygg, og ingen faggruppeflyter", async () => {
    const { tx, lager } = lagTx();
    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);

    expect(lager.faggruppe.map((f) => f.name)).toEqual(["Byggherre", "Elektro", "VVS", "Ventilasjon"]);
    expect(lager.dokumentflyt.filter((f) => f.faggruppeId)).toHaveLength(0);
  });

  it("🔴 F13c-2 F1: HMS-flyten har ingen faggruppe-ledd — melder er kontaktlisten, behandler HMS-gruppa", async () => {
    const { tx, lager } = lagTx();
    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);

    expect(lager.dokumentflyt).toHaveLength(1);
    const flytId = lager.dokumentflyt[0]!.id;
    const ledd = lager.dokumentflytMedlem.filter((m) => m.dokumentflytId === flytId);
    // Ingen ledd peker på en faggruppe → B sperrer aldri sletting av faggrupper pga. HMS.
    expect(ledd.filter((m) => m.faggruppeId)).toHaveLength(0);

    const melder = ledd.find((m) => m.rolle === "bestiller");
    expect(melder).toBeDefined();
    expect(melder?.faggruppeId ?? null).toBeNull();
    expect(melder?.groupId ?? null).toBeNull();
    expect(melder?.projectMemberId ?? null).toBeNull();

    const hmsGruppe = lager.projectGroup.find((g) => g.systemNokkel === "hms");
    const behandler = ledd.find((m) => m.rolle === "utforer");
    expect(behandler?.groupId).toBe(hmsGruppe?.id);

    // Alle HMS-maler (domain hms) er koblet til flyten
    const hmsMalIder = lager.reportTemplate.filter((m) => m.domain === "hms").map((m) => m.id);
    expect(hmsMalIder.length).toBeGreaterThan(0);
    const koblet = lager.dokumentflytMal.filter((k) => k.dokumentflytId === flytId).map((k) => k.templateId);
    expect([...koblet].sort()).toEqual([...hmsMalIder].sort());
  });

  it("🔴 F13c 1A: oppretter som ikke er medlem (annet firma) kobles ikke til Byggherre", async () => {
    const { tx, lager } = lagTx();
    tx.projectMember.findFirst.mockResolvedValueOnce(null as unknown as { id: string });
    await seedStandardProsjektoppsett(tx as unknown as Prisma.TransactionClient, PROSJEKT, BRUKER);

    expect(lager.faggruppeKobling).toHaveLength(0);
    expect(lager.faggruppe).toHaveLength(STANDARD_FAGGRUPPER.length);
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
