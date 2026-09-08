import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import { medNummerRetry } from "./nummerRetry";

/**
 * Retry ved unik-brudd på løpenummer (2026-09-08).
 *
 * `@@unique([templateId, number])` gjør at to samtidige opprettelser i samme mal
 * ikke lenger kan dele nummer — den ene feiler med P2002. medNummerRetry skal da
 * kjøre transaksjonen på nytt (som leser en fersk MAX) i stedet for å la brukeren
 * se en databasefeil. Kontrakten denne låser:
 *   - P2002 på nummer-constrainten → retry, nytt MAX, lykkes
 *   - P2002 på en ANNEN constraint → rethrow urørt (ikke maskert, ikke retryet)
 *   - uttømt retry → ren TRPCError CONFLICT, ikke rå Prisma-feil
 */

const CONSTRAINT = "checklists_template_id_number_key";

function nummerBrudd(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: CONSTRAINT },
  });
}

describe("medNummerRetry", () => {
  it("leser MAX på nytt og lykkes når nummeret racer én gang", async () => {
    // Modellerer Read Committed: attempt 1 leser MAX=0 (den samtidige committer
    // nr 1 i vinduet før vårt insert → P2002). Attempt 2 ser committet nr 1,
    // leser MAX=1, tar nr 2, lykkes.
    const committedRows: number[] = [];
    let samtidigCommittet = false;

    const fn = vi.fn(async () => {
      const maxRead = committedRows.length ? Math.max(...committedRows) : 0;
      const nummer = maxRead + 1;
      if (!samtidigCommittet) {
        samtidigCommittet = true;
        committedRows.push(1); // den andre opprettelsen landet
        throw nummerBrudd();
      }
      committedRows.push(nummer);
      return { number: nummer };
    });

    const resultat = await medNummerRetry(fn, CONSTRAINT);

    expect(resultat).toEqual({ number: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("rethrower P2002 på en annen constraint urørt", async () => {
    const annetBrudd = new Prisma.PrismaClientKnownRequestError("Unique", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: "checklists_some_other_key" },
    });
    const fn = vi.fn(async () => {
      throw annetBrudd;
    });

    await expect(medNummerRetry(fn, CONSTRAINT)).rejects.toBe(annetBrudd);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gir ren CONFLICT når retry er uttømt", async () => {
    const fn = vi.fn(async () => {
      throw nummerBrudd();
    });

    await expect(medNummerRetry(fn, CONSTRAINT, 3)).rejects.toBeInstanceOf(
      TRPCError,
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
