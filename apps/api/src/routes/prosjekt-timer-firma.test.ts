import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `prosjekt.hentForTimer` — prosjektvelgeren for timer SKAL vise nøyaktig de prosjektene
 * skrive-vakta (`verifiserProsjekterTilhørerFirma`) godtar. Begge leser samme regel
 * (`prosjektTilhørerFirmaWhere`): eid ∪ ProjectOrganization-koblet.
 *
 * 🔴 Rotfeil (feltfunn 2026-10-09): lista var medlemskaps-skopet, skrivingen firma-skopet.
 * En bruker som er MEDLEM av et prosjekt i et ANNET firma fikk prosjektet i velgeren, men
 * skrivingen avviste det med «Prosjekt(er) tilhører ikke firmaet: <uuid>».
 *
 * Testen bruker den EKTE where-byggeren (kun `hentBrukersOrg` mockes) og lar den mockede
 * `findMany` filtrere en fixtur-liste ved å evaluere where-et. Negativkontroll er bakt inn:
 * reverteres lista til medlemskap, dukker `members` opp i where-et (assert feiler) og
 * P_MEDLEM_ANNET slipper gjennom (assert feiler).
 */

const resolverOrgMock = vi.fn();

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../services/firmamodul", () => ({ hentAktiveFirmamoduler: vi.fn() }));
vi.mock("../services/autoProsjektAdmin", () => ({ autoLeggFirmaAdmins: vi.fn() }));
vi.mock("../services/prosjektTilgangEvaluator", () => ({ provisjonerProsjektmedlemskap: vi.fn() }));
vi.mock("../services/prosjektSeed", () => ({ seedStandardProsjektoppsett: vi.fn() }));
// Behold den EKTE `prosjektTilhørerFirmaWhere` (regelen under test). Kun firma-resolveren
// mockes — dens tilgangsregel (sitedoc_admin ∪ eget medlemskap) er låst av egen test under.
vi.mock("../trpc/tilgangskontroll", async (importActual) => {
  const actual = await importActual<typeof import("../trpc/tilgangskontroll")>();
  return { ...actual, resolverOrgFraInput: (...a: unknown[]) => resolverOrgMock(...a) };
});

import { prosjektRouter } from "./prosjekt";

const MITT_FIRMA = "11111111-1111-1111-1111-111111111111";
const ANNET_FIRMA = "22222222-2222-2222-2222-222222222222";
const BRUKER = "user-1";

type Fixtur = {
  id: string;
  name: string;
  type: string;
  primaryOrganizationId: string | null;
  projectOrganizations: { organizationId: string }[];
  // Medlemskap er bevisst IRRELEVANT for firma-regelen — feltet finnes kun for å bevise
  // at en bruker IKKE lenger får listet et annet firmas prosjekt bare fordi han er medlem.
  members: { userId: string }[];
};

const P_EID: Fixtur = {
  id: "p-eid",
  name: "Eid av mitt firma",
  type: "kunde",
  primaryOrganizationId: MITT_FIRMA,
  projectOrganizations: [],
  members: [{ userId: BRUKER }],
};
const P_INTERNT: Fixtur = {
  id: "p-internt",
  name: "Internt prosjekt",
  type: "internt",
  primaryOrganizationId: MITT_FIRMA,
  projectOrganizations: [],
  members: [],
};
const P_KOBLET: Fixtur = {
  id: "p-koblet",
  name: "UE på annet firmas prosjekt",
  type: "kunde",
  primaryOrganizationId: ANNET_FIRMA,
  projectOrganizations: [{ organizationId: MITT_FIRMA }],
  members: [],
};
const P_MEDLEM_ANNET: Fixtur = {
  id: "p-medlem-annet",
  name: "UNN - prosjekter",
  type: "kunde",
  primaryOrganizationId: ANNET_FIRMA,
  projectOrganizations: [],
  members: [{ userId: BRUKER }],
};
const P_ANNET: Fixtur = {
  id: "p-annet",
  name: "Fremmed prosjekt",
  type: "kunde",
  primaryOrganizationId: ANNET_FIRMA,
  projectOrganizations: [],
  members: [],
};

const ALLE = [P_EID, P_INTERNT, P_KOBLET, P_MEDLEM_ANNET, P_ANNET];

// Evaluer where-et `prosjektTilhørerFirmaWhere` produserer mot én fixtur.
// Shape: { OR: [ {primaryOrganizationId}, {projectOrganizations:{some:{organizationId}}} ] }
function matcher(where: Record<string, unknown>, p: Fixtur): boolean {
  const or = (where.OR ?? []) as Array<Record<string, unknown>>;
  const eidOrg = or.find((c) => "primaryOrganizationId" in c)?.primaryOrganizationId;
  const koblet = or.find((c) => "projectOrganizations" in c)?.projectOrganizations as
    | { some?: { organizationId?: string } }
    | undefined;
  const kobletOrg = koblet?.some?.organizationId;
  const erEid = eidOrg != null && p.primaryOrganizationId === eidOrg;
  const erKoblet =
    kobletOrg != null && p.projectOrganizations.some((po) => po.organizationId === kobletOrg);
  return erEid || erKoblet;
}

let sisteWhere: Record<string, unknown> | null = null;
const findMany = vi.fn((args: { where: Record<string, unknown> }) => {
  sisteWhere = args.where;
  return Promise.resolve(ALLE.filter((p) => matcher(args.where, p)));
});

function lagCaller() {
  const ctx = {
    userId: BRUKER,
    prisma: { project: { findMany: (...a: unknown[]) => findMany(a[0] as { where: Record<string, unknown> }) } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return prosjektRouter.createCaller(ctx);
}

describe("prosjekt.hentForTimer — firma-skopet, ikke medlemskap", () => {
  beforeEach(() => {
    resolverOrgMock.mockReset();
    findMany.mockClear();
    sisteWhere = null;
  });

  it("viser eide (inkl. interne) og ProjectOrganization-koblede prosjekter i det valgte firmaet", async () => {
    resolverOrgMock.mockResolvedValue(MITT_FIRMA);
    const resultat = (await lagCaller().hentForTimer({ organizationId: MITT_FIRMA })) as unknown as Fixtur[];
    const ider = resultat.map((p) => p.id).sort();
    expect(ider).toEqual([P_EID.id, P_INTERNT.id, P_KOBLET.id].sort());
  });

  it("sender det valgte firmaet til tilgangs-resolveren (én firmakilde)", async () => {
    resolverOrgMock.mockResolvedValue(MITT_FIRMA);
    await lagCaller().hentForTimer({ organizationId: MITT_FIRMA });
    expect(resolverOrgMock).toHaveBeenCalledWith(BRUKER, MITT_FIRMA);
  });

  it("viser IKKE et annet firmas prosjekt selv om brukeren er medlem (UNN-feilen)", async () => {
    resolverOrgMock.mockResolvedValue(MITT_FIRMA);
    const resultat = (await lagCaller().hentForTimer({ organizationId: MITT_FIRMA })) as unknown as Fixtur[];
    expect(resultat.map((p) => p.id)).not.toContain(P_MEDLEM_ANNET.id);
    // Negativkontroll: where-et er firma-skopet — medlemskap skal ikke engang nevnes.
    expect(JSON.stringify(sisteWhere)).not.toContain("members");
  });

  it("propagerer FORBIDDEN fra resolveren (vanlig bruker ber om et firma uten tilgang)", async () => {
    resolverOrgMock.mockRejectedValue(new Error("Ikke ditt firma"));
    await expect(
      lagCaller().hentForTimer({ organizationId: ANNET_FIRMA }),
    ).rejects.toThrow(/Ikke ditt firma/);
    expect(findMany).not.toHaveBeenCalled();
  });
});
