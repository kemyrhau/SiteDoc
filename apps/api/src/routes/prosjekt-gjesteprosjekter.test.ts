import { describe, it, expect, vi } from "vitest";

/**
 * POST 2026-11-15 (15) — prosjektvalg på tvers av firma.
 *
 *  (b) prosjekt.hentGjesteprosjekter: gjesten ser prosjektet i det andre firmaet; eget firmas
 *      prosjekt, standalone, deaktivert eier-ansettelse, avsluttet medlemskap og ikke-medlem
 *      er ikke med. firmaKoblet = eget firma koblet via ProjectOrganization.
 *  (f) Timer-negativkontroll (Kenneth-vedtak 1): hentForTimer for gjestens EGET firma
 *      inneholder ikke gjesteprosjektet, og skriving dit gir FORBIDDEN
 *      (verifiserProsjekterTilhørerFirma). Koblet prosjekt (ProjectOrganization) er med.
 *
 * Prisma er en minne-modell som evaluerer `where` — testen måler regelen, ikke formen på
 * spørringen. 🔴 Feiler når gjestefilteret eller firmaregelen endres.
 */

const U = "u-gjest";
const F = "f0000000-0000-0000-0000-00000000000f"; // gjestens eget firma (aktiv)
const D = "d0000000-0000-0000-0000-00000000000d"; // firma der ansettelsen er deaktivert
const X = "a0000000-0000-0000-0000-00000000000a"; // annet firma (eier av gjesteprosjektet)
const Y = "b0000000-0000-0000-0000-00000000000b"; // annet firma, men F er koblet

const P_GJEST = "p-gjest";
const P_EGEN = "p-egen";
const P_DEAKT = "p-deakt";
const P_STANDALONE = "p-standalone";
const P_KOBLET = "p-koblet";
const P_IKKE_MEDLEM = "p-ikke-medlem";
const P_AVSLUTTET = "p-avsluttet";
const P_ARKIVERT = "p-arkivert";

type Prosjekt = {
  id: string;
  name: string;
  status: string;
  primaryOrganizationId: string | null;
  members: Array<{ userId: string; periodeSlutt: Date | null }>;
  projectOrganizations: Array<{ organizationId: string }>;
};
const medlem = [{ userId: U, periodeSlutt: null }];
const PROSJEKTER: Prosjekt[] = [
  // Eier-firmaet er selv koblet (auto-kobling) — skal IKKE gi firmaKoblet.
  { id: P_GJEST, name: "Gjest", status: "active", primaryOrganizationId: X, members: medlem, projectOrganizations: [{ organizationId: X }] },
  { id: P_EGEN, name: "Egen", status: "active", primaryOrganizationId: F, members: medlem, projectOrganizations: [{ organizationId: F }] },
  { id: P_DEAKT, name: "Deakt", status: "active", primaryOrganizationId: D, members: medlem, projectOrganizations: [] },
  { id: P_STANDALONE, name: "Standalone", status: "active", primaryOrganizationId: null, members: medlem, projectOrganizations: [] },
  { id: P_KOBLET, name: "Koblet", status: "active", primaryOrganizationId: Y, members: medlem, projectOrganizations: [{ organizationId: F }] },
  { id: P_IKKE_MEDLEM, name: "Ikke medlem", status: "active", primaryOrganizationId: X, members: [], projectOrganizations: [] },
  { id: P_AVSLUTTET, name: "Avsluttet", status: "active", primaryOrganizationId: X, members: [{ userId: U, periodeSlutt: new Date() }], projectOrganizations: [] },
  { id: P_ARKIVERT, name: "Arkivert", status: "archived", primaryOrganizationId: X, members: medlem, projectOrganizations: [] },
];
const ANSETTELSER = [
  { userId: U, organizationId: F, status: "aktiv" },
  { userId: U, organizationId: D, status: "deaktivert" },
];
const FIRMANAVN: Record<string, string> = { [F]: "Eget AS", [D]: "Deakt AS", [X]: "Annet AS", [Y]: "Koblet AS" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = Record<string, any>;
function feltTreff(verdi: unknown, krav: unknown): boolean {
  if (krav === null || typeof krav !== "object") return verdi === krav;
  const k = krav as W;
  if ("in" in k) return (k.in as unknown[]).includes(verdi);
  if ("not" in k) return verdi !== k.not;
  throw new Error(`ukjent feltkrav ${JSON.stringify(krav)}`);
}
function radTreff(rad: W, w: W): boolean {
  return Object.entries(w).every(([k, v]) => feltTreff(rad[k], v));
}
function treff(p: Prosjekt, w: W): boolean {
  return Object.entries(w).every(([k, v]) => {
    if (k === "AND") return (v as W[]).every((d) => treff(p, d));
    if (k === "OR") return (v as W[]).some((d) => treff(p, d));
    if (k === "NOT") return !treff(p, v as W);
    if (k === "members") return p.members.some((m) => radTreff(m, (v as W).some));
    if (k === "projectOrganizations") return p.projectOrganizations.some((o) => radTreff(o, (v as W).some));
    return feltTreff((p as unknown as W)[k], v);
  });
}

const prismaMock = {
  user: { findUnique: vi.fn().mockResolvedValue({ role: "user" }) },
  organizationMember: {
    findMany: vi.fn(async ({ where }: { where: W }) => ANSETTELSER.filter((a) => radTreff(a, where))),
  },
  project: {
    findMany: vi.fn(async ({ where, select }: { where: W; select?: W }) =>
      PROSJEKTER.filter((p) => treff(p, where)).map((p) => ({
        ...p,
        primaryOrganization: p.primaryOrganizationId
          ? { id: p.primaryOrganizationId, name: FIRMANAVN[p.primaryOrganizationId] }
          : null,
        projectOrganizations: select?.projectOrganizations
          ? p.projectOrganizations.filter((o) => radTreff(o, select.projectOrganizations.where))
          : p.projectOrganizations,
      })),
    ),
  },
};

vi.mock("@sitedoc/db", () => ({ prisma: prismaMock }));
vi.mock("../trpc/tilgangskontroll", async (orig) => ({
  ...(await orig<typeof import("../trpc/tilgangskontroll")>()),
  // Gjestens eget firma — firma-oppslaget er ikke det (f) måler.
  resolverOrgFraInput: vi.fn().mockResolvedValue("f0000000-0000-0000-0000-00000000000f"),
}));

const { prosjektRouter } = await import("./prosjekt");
const { verifiserProsjekterTilhørerFirma } = await import("../trpc/tilgangskontroll");

function caller() {
  const ctx = {
    userId: U,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: prismaMock,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return prosjektRouter.createCaller(ctx);
}

describe("(b) prosjekt.hentGjesteprosjekter", () => {
  it("🔴 gjesten ser prosjektet i annet firma, med eier-firmaets navn", async () => {
    const res = await caller().hentGjesteprosjekter();
    const gjest = res.find((p) => p.id === P_GJEST);
    expect(gjest).toBeDefined();
    expect(gjest!.primaryOrganization).toEqual({ id: X, name: "Annet AS" });
    expect(gjest!.firmaKoblet).toBe(false);
  });

  it("🔴 kun gjesteprosjekter: eget firma, standalone, deaktivert eier, ikke-medlem, avsluttet og arkivert er ikke med", async () => {
    const ider = (await caller().hentGjesteprosjekter()).map((p) => p.id).sort();
    expect(ider).toEqual([P_GJEST, P_KOBLET].sort());
  });

  it("firmaKoblet = eget firma koblet via ProjectOrganization", async () => {
    const res = await caller().hentGjesteprosjekter();
    expect(res.find((p) => p.id === P_KOBLET)!.firmaKoblet).toBe(true);
    // Kobling-rådata lekker ikke ut i svaret.
    expect(res.every((p) => !("projectOrganizations" in p))).toBe(true);
  });
});

describe("(f) Timer-negativkontroll — gjesteprosjekt er ikke eget firmas", () => {
  it("🔴 hentForTimer for gjestens eget firma inneholder ikke gjesteprosjektet", async () => {
    const ider = (await caller().hentForTimer()).map((p: { id: string }) => p.id);
    expect(ider).not.toContain(P_GJEST);
    // Eid og koblet er med (vedtak 1: koblingen står urørt).
    expect(ider).toContain(P_EGEN);
    expect(ider).toContain(P_KOBLET);
  });

  it("🔴 skriving av timer mot gjesteprosjektet i eget firma → FORBIDDEN", async () => {
    await expect(verifiserProsjekterTilhørerFirma([P_GJEST], F)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("negativkontroll: eid og koblet prosjekt → skriving tillatt", async () => {
    await expect(verifiserProsjekterTilhørerFirma([P_EGEN, P_KOBLET], F)).resolves.toBeUndefined();
  });
});
