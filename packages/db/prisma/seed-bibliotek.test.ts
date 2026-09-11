import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { opprettMalHvisMangler, type BibliotekMalSeed } from "./seed-bibliotek";

/**
 * Vakt mot at seeden igjen begynner å OVERSKRIVE en eksisterende bibliotekmal
 * (CLAUDE.md «Stille tomhet er forbudt», krav (c)). Testen bekrefter IKKE at seeden
 * kjørte — den FEILER hvis create-only-regelen fjernes:
 *  - finnes malen fra før → ingen create, ingen update, status «finnes».
 * Reintroduseres upsert (update på eksisterende rad), slår `update`-forventningen til.
 */

const malSeed: BibliotekMalSeed = {
  navn: "KA7 – Forberedende arbeider ved gjenbruk av materialer",
  referanse: "KA7",
  beskrivelse: "Rengjøring og sortering av gjenbruksmaterialer.",
  prioritet: 1,
  verifisert: false,
  malInnhold: [{ label: "Type materiale", type: "list_single", fase: "FØR", sortOrder: 1 }],
};

function lagFakeDb(finnesFraFor: boolean) {
  const findFirst = vi.fn().mockResolvedValue(finnesFraFor ? { id: "eksisterende-id" } : null);
  const create = vi.fn().mockResolvedValue({ id: "ny-id" });
  // `update` finnes på ekte PrismaClient — tas med her nettopp for å kunne bevise at
  // den ALDRI kalles på en eksisterende rad. Kaller en fremtidig regresjon update, feiler testen.
  const update = vi.fn().mockResolvedValue({ id: "eksisterende-id" });
  const db = { bibliotekMal: { findFirst, create, update } } as unknown as Pick<
    PrismaClient,
    "bibliotekMal"
  >;
  return { db, findFirst, create, update };
}

describe("opprettMalHvisMangler — kun opprett, aldri oppdater", () => {
  it("rører ALDRI en mal som finnes fra før (ingen create, ingen update)", async () => {
    const { db, findFirst, create, update } = lagFakeDb(true);

    const status = await opprettMalHvisMangler(db, "kap-id", malSeed);

    expect(status).toBe("finnes");
    expect(findFirst).toHaveBeenCalledWith({
      where: { kapittelId: "kap-id", referanse: "KA7" },
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("oppretter malen når den mangler", async () => {
    const { db, create, update } = lagFakeDb(false);

    const status = await opprettMalHvisMangler(db, "kap-id", malSeed);

    expect(status).toBe("opprettet");
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    const arg = create.mock.calls[0]![0] as { data: { referanse: string; kapittelId: string } };
    expect(arg.data.referanse).toBe("KA7");
    expect(arg.data.kapittelId).toBe("kap-id");
  });
});
