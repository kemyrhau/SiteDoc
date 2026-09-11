import { describe, it, expect, vi } from "vitest";
import { bibliotekRouter } from "./bibliotek";

/**
 * Retteveien inn i sentralarkivet (`/admin/bibliotek`). En ny skrivevei til et delt
 * arkiv uten test er en ny måte å ødelegge tolv kunders maler på — denne dekker
 * de tre tingene som MÅ holde:
 *   (1) tilgang: kun sitedoc_admin får skrive (firma-/prosjektadmin avvises),
 *   (2) `verifisert` røres ALDRI av en redigering (prod-gaten hviler på flagget),
 *   (3) malInnhold roundtrippes og sortOrder normaliseres til array-rekkefølgen.
 *
 * Kjører den EKTE prosedyren; ctx.prisma er en spion (verifiserSiteDocAdmin bruker
 * ctx.prisma.user.findUnique, ikke @sitedoc/db-singletonen).
 */

const MAL = "mal-1";

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
  return bibliotekRouter.createCaller(ctx);
}

function prismaMed(role: string, update = vi.fn().mockResolvedValue({ id: MAL })) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ role }) },
    bibliotekMal: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: MAL }),
      update,
    },
  };
}

const INPUT = {
  bibliotekMalId: MAL,
  navn: "KA7 – Gjenbruk",
  referanse: "KA7",
  beskrivelse: "Rettet hjelpetekst",
  malInnhold: [
    { label: "Type materiale", type: "list_single", zone: "datafelter", fase: "FØR", config: { options: ["A", "B"] } },
    { label: "Bæreevne", type: "traffic_light", fase: "ETTER", config: { helpText: "x" } },
  ],
};

describe("bibliotek.oppdaterMal", () => {
  it("(1) ikke-admin (role=user) → FORBIDDEN, ingen skriving", async () => {
    const update = vi.fn();
    await expect(lagCaller(prismaMed("user", update)).oppdaterMal(INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });

  it("(1) company_admin → FORBIDDEN (arkivet er SiteDocs eget)", async () => {
    const update = vi.fn();
    await expect(lagCaller(prismaMed("company_admin", update)).oppdaterMal(INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });

  it("(2)+(3) sitedoc_admin → skriver uten verifisert; sortOrder normalisert", async () => {
    const update = vi.fn().mockResolvedValue({ id: MAL });
    await lagCaller(prismaMed("sitedoc_admin", update)).oppdaterMal(INPUT);

    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0]![0] as { where: unknown; data: Record<string, unknown> & { malInnhold: { label: string; sortOrder: number }[] } };
    expect(arg.where).toEqual({ id: MAL });
    // (2) verifisert/aktiv/versjon er utenfor scope — skal ALDRI settes her.
    expect(arg.data).not.toHaveProperty("verifisert");
    expect(arg.data).not.toHaveProperty("aktiv");
    expect(arg.data).not.toHaveProperty("versjon");
    // metadata skrives
    expect(arg.data.navn).toBe("KA7 – Gjenbruk");
    expect(arg.data.beskrivelse).toBe("Rettet hjelpetekst");
    // (3) malInnhold roundtrippes, sortOrder = array-indeks
    expect(arg.data.malInnhold).toHaveLength(2);
    expect(arg.data.malInnhold[0]).toMatchObject({ label: "Type materiale", sortOrder: 0 });
    expect(arg.data.malInnhold[1]).toMatchObject({ label: "Bæreevne", sortOrder: 1 });
  });

  it("(2) tom beskrivelse lagres som null", async () => {
    const update = vi.fn().mockResolvedValue({ id: MAL });
    await lagCaller(prismaMed("sitedoc_admin", update)).oppdaterMal({ ...INPUT, beskrivelse: "" });
    const arg = update.mock.calls[0]![0] as { data: { beskrivelse: unknown } };
    expect(arg.data.beskrivelse).toBeNull();
  });
});
