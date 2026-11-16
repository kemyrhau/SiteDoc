import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TILLEGG 2026-11-15 (13) L2 del C: oppmøtested-adressesøket bruker samme
 * `sokAdresser` (Geonorge, treffliste + normaliserte varianter) som byggeplass —
 * ikke Nominatim-`geokodAdresse`. Firma-admin-sjekken går før søket. Kjører UTEN DB.
 */

const m = vi.hoisted(() => ({
  sokAdresser: vi.fn(),
  geokodAdresse: vi.fn(),
  autoriser: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: (...a: unknown[]) => m.autoriser(...a),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/rute-service", () => ({
  sokAdresser: (...a: unknown[]) => m.sokAdresser(...a),
  geokodAdresse: (...a: unknown[]) => m.geokodAdresse(...a),
}));
vi.mock("../services/reisetidMatrise", () => ({
  MANUELL_KILDE: "manuell",
  recomputeMatrise: vi.fn(),
  recomputeMatriseIBakgrunn: vi.fn(),
}));

import { oppmotestedRouter } from "./oppmotested";

const ORG = "11111111-1111-1111-1111-111111111111";

function caller() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return oppmotestedRouter.createCaller({ userId: "u1", prisma: {} } as any);
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.autoriser.mockResolvedValue(undefined);
});

describe("oppmotested.geokod — samme adressesøk som byggeplass", () => {
  it("kaller sokAdresser og returnerer trefflista (ikke geokodAdresse)", async () => {
    const treff = [
      { lat: 69.65, lng: 18.95, label: "Sommerfeldts gate 65, 9013 TROMSØ" },
      { lat: 69.66, lng: 18.96, label: "Sommerfeldts gate 63, 9013 TROMSØ" },
    ];
    m.sokAdresser.mockResolvedValue(treff);
    const svar = await caller().geokod({ organizationId: ORG, adresse: "sommerfeldtsgate 65 tromsø" });
    expect(m.sokAdresser).toHaveBeenCalledWith("sommerfeldtsgate 65 tromsø");
    expect(m.geokodAdresse).not.toHaveBeenCalled();
    expect(svar).toEqual(treff);
  });

  it("0 treff → tom liste (ingen feil — lagring med kartpunkt er fortsatt mulig)", async () => {
    m.sokAdresser.mockResolvedValue([]);
    await expect(caller().geokod({ organizationId: ORG, adresse: "ukjent sted" })).resolves.toEqual([]);
  });

  it("ikke firma-admin → feiler før søket (negativkontroll)", async () => {
    m.autoriser.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(caller().geokod({ organizationId: ORG, adresse: "x" })).rejects.toThrow();
    expect(m.sokAdresser).not.toHaveBeenCalled();
  });
});
