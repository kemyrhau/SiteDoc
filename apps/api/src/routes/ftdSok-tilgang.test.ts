import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * SØK-1 S6a / T9 (dokumentsok-visning-spec § 6, F1/F2; sikkerhet.md § 8d).
 *
 * `ftdSok.hentDokumentChunks` returnerte hele dokumentteksten for en hvilken som helst
 * documentId uten medlemskapssjekk, og `ftdSok.nsChunks` returnerte chunks for en nsCode på
 * tvers av alle prosjekter. Begge krever nå `projectId` + medlemskap, og dokumentet må
 * tilhøre det prosjektet.
 *
 * Rød før fiksen: kallet uten medlemskap returnerer chunks i stedet for FORBIDDEN.
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
}));

// Ekte Prisma.sql/join (SQL-en i nsStandardSok settes sammen og fanges), men ingen klient.
vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem,
  verifiserAdmin: vi.fn(),
  erSiteDocAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));
vi.mock("../services/embedding-service", () => ({
  fetchMedTimeout: vi.fn(),
  startEmbeddingGenerering: vi.fn(),
  stoppEmbeddingGenerering: vi.fn(),
  hentEmbeddingStatus: vi.fn(),
}));

import { Prisma } from "@sitedoc/db";
import { ftdSokRouter } from "./ftdSok";
import { aiSokRouter } from "./aiSok";

const PROSJEKT_A = "11111111-1111-4111-8111-111111111111";
const PROSJEKT_B = "22222222-2222-4222-8222-222222222222";
const DOK_A = "dok-a";
const CHUNKS = [{ id: "c1", documentId: DOK_A, chunkIndex: 0, chunkText: "Ved forsinkelse påløper dagmulkt." }];

interface FakeDok {
  id: string;
  projectId: string;
  folderId: string | null;
}

function lagCaller(dokumenter: FakeDok[] = [{ id: DOK_A, projectId: PROSJEKT_A, folderId: null }]) {
  const chunkFindMany = vi.fn().mockResolvedValue(CHUNKS);
  const prisma = {
    ftdDocument: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; projectId: string } }) => {
        const d = dokumenter.find((x) => x.id === where.id && x.projectId === where.projectId);
        return d ? { id: d.id, folderId: d.folderId } : null;
      }),
    },
    ftdDocumentChunk: { findMany: chunkFindMany },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = ftdSokRouter.createCaller({ userId: "bruker-1", prisma } as any);
  return { caller, chunkFindMany };
}

const forbidden = () => new TRPCError({ code: "FORBIDDEN", message: "Du er ikke medlem av dette prosjektet" });

beforeEach(() => {
  verifiserProsjektmedlem.mockReset();
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
});

describe("ftdSok.hentDokumentChunks — S6a prosjektisolering", () => {
  it("F1: bruker uten medlemskap → FORBIDDEN, ingen chunks lest", async () => {
    verifiserProsjektmedlem.mockRejectedValue(forbidden());
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("F2: medlem → chunks som før", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller } = lagCaller();
    const res = await caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A });
    expect(res).toEqual(CHUNKS);
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith("bruker-1", PROSJEKT_A);
  });

  it("medlem i B kan ikke lese et dokument fra A ved å sende B som projectId → NOT_FOUND", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      caller.hentDokumentChunks({ projectId: PROSJEKT_B, documentId: DOK_A }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("dokument i mappe brukeren ikke har tilgang til → FORBIDDEN (samme regel som sokDokumenter)", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    hentTilgjengeligeMappeIder.mockResolvedValue(["annen-mappe"]);
    const { caller, chunkFindMany } = lagCaller([{ id: DOK_A, projectId: PROSJEKT_A, folderId: "lukket-mappe" }]);
    await expect(
      caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });
});

describe("ftdSok.nsChunks — S6a prosjektisolering", () => {
  it("bruker uten medlemskap → FORBIDDEN", async () => {
    verifiserProsjektmedlem.mockRejectedValue(forbidden());
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("medlem → spørringen er avgrenset til prosjektet", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller, chunkFindMany } = lagCaller();
    await caller.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" });
    expect(chunkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nsCode: "AB1.1", document: { projectId: PROSJEKT_A, isActive: true } },
      }),
    );
  });
});

// ── RETUR gate 2c8dd50e (Kontrollør): mappetilgangen skal være LIK søket i alle lese-prosedyrer ──
// Et medlem med begrenset mappetilgang skal ikke lese tekst eller filnavn fra en lukket mappe ved
// å kalle tRPC direkte. Fake-Prisma evaluerer `where` på et lite datasett, så «ikke i svaret» måles
// på data, ikke på at et felt finnes. Rød på 2c8dd50e (lukket mappe og inaktivt dokument kom med).

type Rad = Record<string, unknown>;
/** Minimal Prisma-where-evaluator: likhet, null, { in }, { contains }, { startsWith }, OR, AND, relasjon. */
function treffer(rad: Rad, where: Rad | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Rad[]).some((w) => treffer(rad, w));
    if (k === "AND") return (v as Rad[]).every((w) => treffer(rad, w));
    const verdi = rad[k];
    if (v === null || typeof v !== "object") return verdi === v;
    const op = v as Rad;
    if ("in" in op) return (op.in as unknown[]).includes(verdi);
    if ("contains" in op) return typeof verdi === "string" && verdi.includes(op.contains as string);
    if ("startsWith" in op) return typeof verdi === "string" && verdi.startsWith(op.startsWith as string);
    return typeof verdi === "object" && verdi !== null && treffer(verdi as Rad, op);
  });
}

const DOKS = [
  { id: "d-rot", projectId: PROSJEKT_A, isActive: true, folderId: null, filename: "ns-3420-a rot.pdf" },
  { id: "d-apen", projectId: PROSJEKT_A, isActive: true, folderId: "apen-mappe", filename: "ns-3420-b apen.pdf" },
  { id: "d-lukket", projectId: PROSJEKT_A, isActive: true, folderId: "lukket-mappe", filename: "ns-3420-c lukket.pdf" },
  { id: "d-inaktiv", projectId: PROSJEKT_A, isActive: false, folderId: null, filename: "ns-3420-d inaktiv.pdf" },
];
const NS_CHUNKS = DOKS.map((d, i) => ({ id: `c-${d.id}`, documentId: d.id, nsCode: "AB1.1", chunkIndex: i, document: d }));

function lagMappeCaller() {
  const fanget: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    ftdDocument: {
      findFirst: vi.fn(async ({ where }: { where: Rad }) => DOKS.find((d) => treffer(d, where)) ?? null),
      findMany: vi.fn(async ({ where }: { where: Rad }) =>
        DOKS.filter((d) => treffer(d, where)).map((d) => ({ ...d, folder: d.folderId ? { id: d.folderId, name: d.folderId } : null })),
      ),
    },
    ftdDocumentChunk: {
      findMany: vi.fn(async ({ where }: { where: Rad }) => NS_CHUNKS.filter((c) => treffer(c, where))),
    },
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = Prisma.sql(strings, ...values);
      fanget.push({ sql: q.sql, values: q.values });
      return [];
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = { userId: "bruker-1", prisma } as any;
  return { ftd: ftdSokRouter.createCaller(ctx), ai: aiSokRouter.createCaller(ctx), fanget };
}

describe("S6a mappetilgang lik søket — dokument i mappe uten tilgang er ikke i svaret", () => {
  beforeEach(() => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    hentTilgjengeligeMappeIder.mockResolvedValue(["apen-mappe"]);
  });

  it("nsChunks: bare rot + åpen mappe; lukket mappe og inaktivt dokument er ute", async () => {
    const { ftd } = lagMappeCaller();
    const svar = await ftd.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" });
    expect(svar.map((c) => c.documentId).sort()).toEqual(["d-apen", "d-rot"]);
  });

  it("nsChunks: full tilgang (null) → alle aktive", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(null);
    const { ftd } = lagMappeCaller();
    const svar = await ftd.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" });
    expect(svar.map((c) => c.documentId).sort()).toEqual(["d-apen", "d-lukket", "d-rot"]);
  });

  it("nsStandardSok: SQL-en har samme mappeKlausul som sokDokumenter, med brukerens mapper", async () => {
    const { ftd, fanget } = lagMappeCaller();
    await ftd.nsStandardSok({ projectId: PROSJEKT_A, nsKode: "AB1.1" });
    expect(fanget[0]!.sql).toMatch(/AND \(d\.folder_id IS NULL OR d\.folder_id IN \(\?\)\)/);
    expect(fanget[0]!.values).toContain("apen-mappe");
    expect(fanget[0]!.values).not.toContain("lukket-mappe");
  });

  it("hentReferanseDokumenter: filnavn i lukket mappe listes ikke", async () => {
    const { ai } = lagMappeCaller();
    const svar = await ai.hentReferanseDokumenter({ projectId: PROSJEKT_A });
    expect(svar.dokumenter.map((d) => d.id).sort()).toEqual(["d-apen", "d-rot"]);
    expect(svar.mapper.map((m) => m.id)).not.toContain("lukket-mappe");
  });

  it("hentDokumentChunks: inaktivt dokument → NOT_FOUND (søket viser bare aktive)", async () => {
    const { ftd } = lagMappeCaller();
    await expect(
      ftd.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: "d-inaktiv" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
