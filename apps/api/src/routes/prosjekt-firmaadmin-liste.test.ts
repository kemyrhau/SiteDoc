import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FIRMAADMIN-TILGANG A (Kenneth 2026-11-25): «Silje må som firma admin ha full tilgang på alle
 * firmaets prosjekter». `prosjekt.hentAlle` og `hentSistBrukte` tar med prosjekter firmaet EIER
 * når brukeren er aktiv firma_admin der. `hentMine` er uendret (B1-vedtaket: medlemskap).
 *
 * Prod-testcase: A.Markussen AS, Silje medlem bare av 998. DoD: «Alle» = 998, 999, 1000;
 * «Mine» = 998. Isolasjon: prosjekt et annet firma eier, også der A bare deltar, er utenfor.
 *
 * `project.findMany` er en liten where-tolker over feltene listene bruker — fjernes
 * firmaadmin-grenen, faller 999 og 1000 ut og testen blir rød.
 */

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", async (importActual) => ({
  ...(await importActual<typeof import("../trpc/tilgangskontroll")>()),
  hentDeaktiverteOrgIder: vi.fn().mockResolvedValue([]),
  hentFirmaAdminOrgIder: vi.fn(),
}));

import { prosjektRouter, medlemEllerFirmaAdminWhere } from "./prosjekt";
import { hentFirmaAdminOrgIder } from "../trpc/tilgangskontroll";

const SILJE = "u-silje";
const FIRMA_A = "org-a";
const FIRMA_B = "org-b";

interface P {
  id: string;
  primaryOrganizationId: string | null;
  type: string;
  status: string;
  medlemmer: string[];
  deltakere: string[];
}

const PROSJEKTER: P[] = [
  { id: "998", primaryOrganizationId: FIRMA_A, type: "kunde", status: "active", medlemmer: [SILJE], deltakere: [] },
  { id: "999", primaryOrganizationId: FIRMA_A, type: "kunde", status: "active", medlemmer: [], deltakere: [] },
  { id: "1000", primaryOrganizationId: FIRMA_A, type: "kunde", status: "active", medlemmer: [], deltakere: [] },
  { id: "b-eid", primaryOrganizationId: FIRMA_B, type: "kunde", status: "active", medlemmer: [], deltakere: [] },
  { id: "b-a-deltar", primaryOrganizationId: FIRMA_B, type: "kunde", status: "active", medlemmer: [], deltakere: [FIRMA_A] },
  { id: "a-internt", primaryOrganizationId: FIRMA_A, type: "internt", status: "active", medlemmer: [], deltakere: [] },
  { id: "a-arkivert", primaryOrganizationId: FIRMA_A, type: "kunde", status: "archived", medlemmer: [], deltakere: [] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Record<string, any>;
function matcher(p: P, w: W | undefined): boolean {
  if (!w) return true;
  return Object.entries(w).every(([k, v]) => {
    switch (k) {
      case "OR": return (v as W[]).some((x) => matcher(p, x));
      case "AND": return (v as W[]).every((x) => matcher(p, x));
      case "NOT": return !matcher(p, v as W);
      case "id": return typeof v === "string" ? p.id === v : (v.in as string[]).includes(p.id);
      case "type": return p.type === v;
      case "status": return p.status === v;
      case "primaryOrganizationId":
        return typeof v === "string" || v === null ? p.primaryOrganizationId === v : (v.in as string[]).includes(p.primaryOrganizationId ?? "");
      case "members": return p.medlemmer.includes(v.some.userId);
      case "projectOrganizations": return p.deltakere.includes(v.some.organizationId);
      default: throw new Error(`Ukjent where-felt i test: ${k}`);
    }
  });
}

function lagCtx() {
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ role: "user" }) },
    project: {
      findMany: vi.fn(async ({ where }: { where: W }) =>
        PROSJEKTER.filter((p) => matcher(p, where)).map((p) => ({ id: p.id })),
      ),
    },
    activity: {
      findMany: vi.fn().mockResolvedValue(PROSJEKTER.map((p) => ({ projectId: p.id }))),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { userId: SILJE, prisma } as any;
}

const ider = (rader: Array<{ id: string }>) => rader.map((r) => r.id).sort();

beforeEach(() => {
  vi.mocked(hentFirmaAdminOrgIder).mockReset().mockResolvedValue([FIRMA_A]);
});

describe("A: prosjektlistene for firmaadmin", () => {
  it("🔴 hentAlle: Silje ser 998, 999 og 1000 — ikke B-prosjekter, interne eller arkiverte", async () => {
    const res = await prosjektRouter.createCaller(lagCtx()).hentAlle();
    expect(ider(res)).toEqual(["1000", "998", "999"]);
  });

  it("🔴 hentMine: Silje ser bare 998 (medlemskap, uendret)", async () => {
    const res = await prosjektRouter.createCaller(lagCtx()).hentMine();
    expect(ider(res)).toEqual(["998"]);
  });

  it("🔴 hentSistBrukte: firmaadmin-prosjektene er med, B-prosjektene ikke", async () => {
    const res = await prosjektRouter.createCaller(lagCtx()).hentSistBrukte({ antall: 10 });
    expect([...res].sort()).toEqual(["1000", "998", "999"]);
  });

  it("vanlig bruker (ikke firmaadmin) ser bare egne medlemskap i hentAlle, som før", async () => {
    vi.mocked(hentFirmaAdminOrgIder).mockResolvedValue([]);
    const res = await prosjektRouter.createCaller(lagCtx()).hentAlle();
    expect(ider(res)).toEqual(["998"]);
  });

  it("inkluderFrosne gir også arkiverte eierprosjekter (timer-flater)", async () => {
    const res = await prosjektRouter.createCaller(lagCtx()).hentAlle({ inkluderFrosne: true });
    expect(ider(res)).toEqual(["1000", "998", "999", "a-arkivert"]);
  });

  it("🔴 isolasjon: firmaadmin i B ser ikke A-prosjekter, og A-firmaadmin ikke prosjektet der A bare deltar", async () => {
    vi.mocked(hentFirmaAdminOrgIder).mockResolvedValue([FIRMA_B]);
    const res = await prosjektRouter.createCaller(lagCtx()).hentAlle();
    expect(ider(res)).toEqual(["998", "b-a-deltar", "b-eid"]);
    expect(PROSJEKTER.filter((p) => matcher(p, medlemEllerFirmaAdminWhere(SILJE, [FIRMA_A]))).map((p) => p.id))
      .not.toContain("b-a-deltar");
  });
});
