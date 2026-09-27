import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";

// Oversetter et unik-brudd (P2002) fra `psi.create` til en TRPCError CONFLICT med en
// stabil kode klienten kan oversette via t(). To ulike unike indekser kan kaste P2002 her:
//   · psi_project_id_building_id_key → byggeplassen har alt en PSI
//   · psi_prosjektniva_unik          → prosjektet har alt en PSI på prosjektnivå
// Vi skiller dem på `e.meta.target` (indeksnavnet, jf. mønsteret i nummerRetry.ts). Er det
// et P2002 fra en PSI-indeks vi ikke klarer å skille, gir vi ÉN melding sann for begge —
// aldri en som gjetter. Er det et P2002 som IKKE tilhører PSI (fremmed tabell/indeks),
// bobler feilen opp URØRT: en for bred catch ville skjult neste feil.
export function tolkPsiOpprettFeil(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = Array.isArray(e.meta?.target)
      ? (e.meta.target as string[]).join(",")
      : String(e.meta?.target ?? "");
    // Begge PSI-indeksene bærer "psi" i navnet; fremmede indekser (checklists_*, tasks_*) gjør ikke.
    if (target.includes("psi")) {
      if (target.includes("prosjektniva")) {
        throw new TRPCError({ code: "CONFLICT", message: "PSI_KONFLIKT_PROSJEKTNIVA" });
      }
      if (target.includes("building_id")) {
        throw new TRPCError({ code: "CONFLICT", message: "PSI_KONFLIKT_BYGGEPLASS" });
      }
      // PSI-unikbrudd, men målet lar seg ikke skille pålitelig → én melding sann for begge.
      throw new TRPCError({ code: "CONFLICT", message: "PSI_KONFLIKT" });
    }
  }
  throw e;
}
