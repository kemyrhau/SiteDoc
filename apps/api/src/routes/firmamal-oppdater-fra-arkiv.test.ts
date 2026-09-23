import { describe, it, expect, vi } from "vitest";

/**
 * `firmamal.oppdaterFraSentralarkiv` — det manglende leddet i propageringskjeden
 * (arkiv → firmamal → prosjekt). En skrivevei som ERSTATTER en firmamals innhold uten
 * test er en ny måte å ødelegge kundens maler på. Denne dekker de tre tingene som MÅ
 * holde:
 *   (1) avstamning mangler (`laantFraBibliotekMalId = null`) → forklarende BAD_REQUEST,
 *       ingen skriving,
 *   (2) objekt-treet faktisk erstattet: gammelt tre slettes, nytt KOPIERES fra
 *       bibliotekmalens objekt-RADER (vei C), og navn/beskrivelse/versjon oppdateres,
 *   (3) prosjektmaler er UROERT: verken `reportTemplate` eller `reportObject` skrives —
 *       oppdatering av firmamalen dytter aldri noe ut i prosjektene (krav 4).
 *
 * Auth mockes: `autoriserAdminForFirma` resolver (firma-admin passerer). Vi verifiserer
 * likevel at den kalles med firmaets org-id — vakten skal være firma-eid, ikke
 * SiteDoc-eid.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  erFirmaAdminForProsjekt: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { firmamalRouter } from "./firmamal";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";

const MAL = "11111111-1111-1111-1111-111111111111";
const ORG = "22222222-2222-2222-2222-222222222222";
const BIB = "bib-mal-1";

const BIB_MAL = {
  id: BIB,
  navn: "KA7 – Komprimering (revidert)",
  referanse: "KA7",
  beskrivelse: "Ny hjelpetekst",
  kategori: "sjekkliste",
  domene: "kvalitet",
  version: 3, // sentralmalen er revidert 3 ganger — re-synk fryser dette som nytt snapshot
  kapittel: { standard: { kode: "NS 3420" } },
};

// Vei C: treet kopieres fra RADENE. 3 felt + 2 fase-headinger = 5 rader.
const BIB_RADER = [
  { id: "r1", parentId: null, type: "heading", label: "Kontroll FØR utførelse", config: {}, translations: {}, sortOrder: 1, required: false },
  { id: "r2", parentId: null, type: "list_single", label: "Type materiale", config: { zone: "datafelter" }, translations: {}, sortOrder: 2, required: false },
  { id: "r3", parentId: null, type: "heading", label: "Kontroll ETTER utførelse", config: {}, translations: {}, sortOrder: 3, required: false },
  { id: "r4", parentId: null, type: "traffic_light", label: "Bæreevne", config: { zone: "datafelter" }, translations: {}, sortOrder: 4, required: false },
  { id: "r5", parentId: null, type: "text", label: "Kommentar", config: { zone: "datafelter" }, translations: {}, sortOrder: 5, required: false },
];

function lagPrisma(laantFraBibliotekMalId: string | null = BIB) {
  const tx = {
    organizationTemplateObject: {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
      create: vi.fn().mockResolvedValue({ id: "obj-ny" }),
      update: vi.fn().mockResolvedValue({ id: "obj-ny" }),
    },
    organizationTemplate: { update: vi.fn().mockResolvedValue({ id: MAL }) },
    // Fanges hvis prosjekt-tabeller berøres (krav 4) — skal ALDRI kalles.
    reportTemplate: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    reportObject: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  };
  return {
    organizationTemplate: {
      // Soft-delete-guard (krav 3): oppdaterFraSentralarkiv bruker nå findFirst(deletedAt:null).
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: MAL, organizationId: ORG, laantFraBibliotekMalId }),
    },
    bibliotekMal: { findUniqueOrThrow: vi.fn().mockResolvedValue(BIB_MAL) },
    bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue(BIB_RADER) },
    reportTemplate: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    reportObject: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    _tx: tx,
  };
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return firmamalRouter.createCaller(ctx);
}

describe("firmamal.oppdaterFraSentralarkiv", () => {
  it("(1) avstamning mangler → BAD_REQUEST, ingen skriving", async () => {
    const prisma = lagPrisma(null);
    await expect(lagCaller(prisma).oppdaterFraSentralarkiv({ id: MAL })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    // Firma-admin-vakten er sjekket (firma-eid, ikke SiteDoc-eid), men ingen skriving skjer.
    expect(autoriserAdminForFirma).toHaveBeenCalledWith("user-1", ORG);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.bibliotekMal.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("(2) objekt-treet erstattet + navn/beskrivelse/versjon oppdatert", async () => {
    const prisma = lagPrisma();
    const res = await lagCaller(prisma).oppdaterFraSentralarkiv({ id: MAL });
    const tx = prisma._tx;

    // Gammelt tre slettes én gang for denne malen.
    expect(tx.organizationTemplateObject.deleteMany).toHaveBeenCalledWith({
      where: { templateId: MAL },
    });
    // Nytt tre: 3 felt + 2 fase-headinger (FØR, ETTER) = 5 create-kall.
    expect(tx.organizationTemplateObject.create).toHaveBeenCalledTimes(5);
    for (const call of tx.organizationTemplateObject.create.mock.calls) {
      expect(call[0].data.templateId).toBe(MAL);
    }
    // Metadata: navn + beskrivelse fra bibliotekmalen, versjon inkrementeres.
    const oppd = tx.organizationTemplate.update.mock.calls[0]![0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(oppd.where).toEqual({ id: MAL });
    expect(oppd.data.name).toBe("KA7 – Komprimering (revidert)");
    expect(oppd.data.description).toBe("NS 3420 KA7 — Ny hjelpetekst");
    expect(oppd.data.version).toEqual({ increment: 1 });
    // Snapshot (krav 2): re-synk fryser sentralmalens GJELDENDE versjon → firmanivå-badgen nullstilles.
    expect(oppd.data.versjonAvHovedmal).toBe(3);
    expect(res).toEqual({ id: MAL, malNavn: "KA7 – Komprimering (revidert)" });
  });

  it("(3) prosjektmaler urørt: reportTemplate/reportObject aldri skrevet", async () => {
    const prisma = lagPrisma();
    await lagCaller(prisma).oppdaterFraSentralarkiv({ id: MAL });
    const tx = prisma._tx;
    for (const tbl of [prisma.reportTemplate, prisma.reportObject, tx.reportTemplate, tx.reportObject]) {
      expect(tbl.create).not.toHaveBeenCalled();
      expect(tbl.update).not.toHaveBeenCalled();
      expect(tbl.deleteMany).not.toHaveBeenCalled();
    }
  });
});
