import type { Prisma, PrismaClient } from "@sitedoc/db";

/** Systemnøkkelen som identifiserer prosjektets HMS-behandlergruppe (`STANDARD_PROJECT_GROUPS` → «HMS»). */
export const HMS_SYSTEMNOKKEL = "hms";

/**
 * Prosjektets HMS-behandlergruppe, entydig via `systemNokkel = "hms"` (partiell unik-indeks
 * på (project_id, system_nokkel)).
 *
 * Slå ALDRI opp HMS-gruppa på `domains array_contains ["hms"]`: domenet «hms» er bredde-tilgang
 * som også «Prosjektadministratorer» bærer, og den gruppa opprettes først. Oppslaget på domenet
 * sendte derfor nye HMS-meldinger og RUH til prosjektadministratorene i stedet for HMS-behandleren
 * (H1, 2026-11-23). Brukes av `sikreHmsGruppe` (services/hmsFlyt.ts: modul.aktiver og prosjektSeed) og opprettelsen av HMS-dokumenter.
 */
export function finnHmsGruppe(
  db: Prisma.TransactionClient | PrismaClient,
  projectId: string,
): Promise<{ id: string } | null> {
  return db.projectGroup.findFirst({
    where: { projectId, systemNokkel: HMS_SYSTEMNOKKEL },
    select: { id: true },
  });
}
