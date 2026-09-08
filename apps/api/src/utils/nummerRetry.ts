import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";

/**
 * Kjør en dokument-opprettelse på nytt ved unik-brudd på løpenummeret.
 *
 * Løpenummeret utledes fra `MAX(number) + 1` uten lås (Read Committed) — se
 * `sjekkliste.opprett` / `oppgave.opprett`. To samtidige opprettelser i samme
 * mal kan lese samme MAX og få samme nummer. Det fanges nå av
 * `@@unique([templateId, number])` på `Checklist`/`Task`, som feiler den ene
 * med P2002 i stedet for å lage en duplikat.
 *
 * P2002 skal ikke nå brukeren som databasefeil: et nytt forsøk leser en MAX som
 * ser den andre transaksjonens committede rad, så nummeret øker og forsøket
 * lykkes umiddelbart. Opprettelsen er idempotent i brukerens øyne. Kun P2002 på
 * NUMMER-constrainten retryes — andre unik-brudd rethrowes urørt.
 *
 * `fn` MÅ inneholde hele transaksjonen (MAX-lesning + create), slik at retry
 * leser nummeret på nytt.
 */
export async function medNummerRetry<T>(
  fn: () => Promise<T>,
  constraint: string,
  maksForsok = 5,
): Promise<T> {
  for (let forsok = 1; ; forsok++) {
    try {
      return await fn();
    } catch (e) {
      if (!erNummerKollisjon(e, constraint)) throw e;
      if (forsok < maksForsok) continue;
      // Ekstremt usannsynlig: maksForsok samtidige opprettelser tapte kappløpet
      // etter hverandre. Gi en forklarende melding i stedet for rå DB-feil.
      throw new TRPCError({
        code: "CONFLICT",
        message: "Kunne ikke tildele dokumentnummer på grunn av samtidige opprettelser. Prøv igjen.",
      });
    }
  }
}

/** Er feilen et unik-brudd på nettopp nummer-constrainten (ikke et annet)? */
function erNummerKollisjon(e: unknown, constraint: string): boolean {
  if (
    !(e instanceof Prisma.PrismaClientKnownRequestError) ||
    e.code !== "P2002"
  ) {
    return false;
  }
  const target = (e.meta as { target?: unknown } | undefined)?.target;
  if (typeof target === "string") return target.includes(constraint);
  if (Array.isArray(target)) return target.some((t) => String(t).includes(constraint));
  return false;
}
