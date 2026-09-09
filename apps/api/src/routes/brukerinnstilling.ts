import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

/**
 * Brukerminne på server (Kenneth-vedtak 2026-09-09). Innstillinger som skal overleve
 * mobil-reinstallering. Fase 1: sist brukt byggeplass + sist brukt tegning.
 *
 * Eierskap er ufravikelig: hver spørring er scopet til `ctx.userId`, så en bruker kan
 * ALDRI lese eller skrive en annens innstillinger. `projectId` NULL = global (per
 * bruker), satt = prosjektnær (per bruker×prosjekt) — og da kreves prosjektmedlemskap.
 *
 * Unikhet håndheves av to partielle indekser i DB (nullable projectId — se schema +
 * migrering 20260909180000). Prisma kjenner dem ikke (ingen @@unique), så `sett` bruker
 * updateMany-så-create i stedet for upsert, med P2002-fallback for samtidig skriv.
 * Sist-skrevne vinner ved konflikt mellom to enheter.
 *
 * `verdi` er en JSON-STRENG i BEGGE retninger (skriv: parses server-side og lagres som
 * Jsonb; les: Jsonb re-serialiseres til streng). Bevisst: både `z.unknown()` i input og
 * Prisma sin rekursive `JsonValue` i output blåser opp tRPCs klient-type til TS2589 på
 * den store AppRouter-en. En streng er concrete OG tåler vilkårlig JSON (filtervalg
 * senere) uten schema-endring. Klienten JSON.parser verdien.
 */
export interface BrukerInnstillingRad {
  nokkel: string;
  verdi: string; // JSON-streng
  projectId: string | null;
  oppdatert: Date;
}

export const brukerinnstillingRouter = router({
  // Hent brukerens egne innstillinger. Uten projectId: alle (global + alle prosjekter),
  // så klienten kan rebygge sine cache-maps i ett kall. Med projectId: kun det
  // prosjektet (krever medlemskap).
  hent: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }).optional())
    .query(async ({ ctx, input }): Promise<BrukerInnstillingRad[]> => {
      const where = input?.projectId
        ? { userId: ctx.userId, projectId: input.projectId }
        : { userId: ctx.userId };
      if (input?.projectId) {
        await verifiserProsjektmedlem(ctx.userId, input.projectId);
      }
      const rader = await ctx.prisma.brukerInnstilling.findMany({
        where,
        select: { nokkel: true, verdi: true, projectId: true, oppdatert: true },
      });
      // verdi returneres som JSON-STRENG (symmetrisk med `sett`). Prisma sin rekursive
      // `JsonValue` i klient-typen ville ellers utløst TS2589 på tRPC-hookene.
      return rader.map((r) => ({
        nokkel: r.nokkel,
        verdi: JSON.stringify(r.verdi),
        projectId: r.projectId,
        oppdatert: r.oppdatert,
      }));
    }),

  // Skriv én innstilling. `verdi` er sammensatt (Json) — filtervalg (senere) trenger det.
  sett: protectedProcedure
    .input(
      z.object({
        nokkel: z.string().min(1).max(100),
        verdi: z.string().max(100_000), // JSON-streng (se router-doc)
        projectId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.projectId) {
        await verifiserProsjektmedlem(ctx.userId, input.projectId);
      }
      const projectId = input.projectId ?? null;
      let parset: unknown;
      try {
        parset = JSON.parse(input.verdi);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "verdi må være gyldig JSON" });
      }
      const verdi = parset as Parameters<
        typeof ctx.prisma.brukerInnstilling.create
      >[0]["data"]["verdi"];

      // updateMany matcher `project_id IS NULL` korrekt for global. Traff ingen rad →
      // opprett. Samtidig create fra en annen enhet → P2002 fra den partielle unike
      // indeksen → fall tilbake til update (sist-skrevne vinner).
      const oppdatert = await ctx.prisma.brukerInnstilling.updateMany({
        where: { userId: ctx.userId, projectId, nokkel: input.nokkel },
        data: { verdi },
      });
      if (oppdatert.count === 0) {
        try {
          await ctx.prisma.brukerInnstilling.create({
            data: { userId: ctx.userId, projectId, nokkel: input.nokkel, verdi },
          });
        } catch (feil) {
          if ((feil as { code?: string })?.code === "P2002") {
            await ctx.prisma.brukerInnstilling.updateMany({
              where: { userId: ctx.userId, projectId, nokkel: input.nokkel },
              data: { verdi },
            });
          } else {
            throw feil;
          }
        }
      }
      return { ok: true };
    }),
});
