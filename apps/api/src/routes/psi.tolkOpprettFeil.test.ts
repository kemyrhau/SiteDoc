import { describe, it, expect } from "vitest";
import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import { tolkPsiOpprettFeil } from "./psi-feil";

/**
 * Oversettelse av unik-brudd (P2002) fra `psi.create` (psi.ts:opprett) til en TRPCError
 * CONFLICT med stabil kode. To ulike unike indekser kan kaste P2002 her, og meldingen
 * må si HVILKEN:
 *   · psi_project_id_building_id_key → byggeplassen har alt en PSI
 *   · psi_prosjektniva_unik          → prosjektet har alt en PSI på prosjektnivå
 * Kontrakten denne låser (krav (c), tre tester med hver sin grunn):
 *   1. byggeplass-brudd → CONFLICT (ikke rå P2002)
 *   2. prosjektnivå-brudd → CONFLICT
 *   3. P2002 fra en FREMMED indeks bobler opp URØRT (ingen for bred catch)
 *
 * Ingen DB i api-testmiljøet: vi konstruerer PrismaClientKnownRequestError med code P2002
 * og riktig meta.target — det er nettopp oversettelsen denne runden bygger.
 */

function p2002(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("tolkPsiOpprettFeil", () => {
  it("kaster CONFLICT (ikke rå P2002) når byggeplassen alt har en PSI", () => {
    try {
      tolkPsiOpprettFeil(p2002("psi_project_id_building_id_key"));
      expect.unreachable("skulle ha kastet");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("CONFLICT");
      expect((e as TRPCError).message).toBe("PSI_KONFLIKT_BYGGEPLASS");
    }
  });

  it("kaster CONFLICT når prosjektet alt har en prosjektnivå-PSI", () => {
    try {
      tolkPsiOpprettFeil(p2002("psi_prosjektniva_unik"));
      expect.unreachable("skulle ha kastet");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("CONFLICT");
      expect((e as TRPCError).message).toBe("PSI_KONFLIKT_PROSJEKTNIVA");
    }
  });

  it("boble en P2002 fra en fremmed indeks opp URØRT (falsk-positiv-vakt)", () => {
    // Ikke fra PSI — en for bred catch ville skjult neste feil. Skal komme uendret ut.
    const fremmed = p2002("checklists_template_id_number_key");
    expect(() => tolkPsiOpprettFeil(fremmed)).toThrow();
    try {
      tolkPsiOpprettFeil(fremmed);
    } catch (e) {
      expect(e).toBe(fremmed);
      expect(e).not.toBeInstanceOf(TRPCError);
    }
  });

  it("gir ÉN melding sann for begge når det ER en PSI-indeks men målet ikke kan skilles", () => {
    // f.eks. bare "psi" i target — vi gjetter ikke hvilken av de to.
    try {
      tolkPsiOpprettFeil(p2002("psi"));
      expect.unreachable("skulle ha kastet");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("CONFLICT");
      expect((e as TRPCError).message).toBe("PSI_KONFLIKT");
    }
  });

  it("boble en ikke-P2002-feil opp URØRT", () => {
    const annet = new Error("noe helt annet");
    try {
      tolkPsiOpprettFeil(annet);
    } catch (e) {
      expect(e).toBe(annet);
    }
  });
});
