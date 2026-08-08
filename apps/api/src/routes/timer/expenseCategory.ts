import { z } from "zod";
import { utledOrdning, erGyldigOrdning, type UtleggOrdning } from "@sitedoc/shared";
import { router, protectedProcedure } from "../../trpc/trpc";
import { resolverOrgFraInput } from "../../trpc/tilgangskontroll";

/**
 * ExpenseCategory-router (utleggs-ordningsmodell U3, 2026-08-08).
 *
 * Speiler `tilleggRouter.list` sitt milde tilgangsmønster (resolverOrgFraInput):
 * enhver arbeider som skal føre et utlegg må se firmaets utleggskatalog. CRUD
 * (opprett/oppdater/deaktiver) + overstyring-setting hører til firma-admin og
 * bygges i U5 — denne routeren eksponerer foreløpig KUN lesing + utledning.
 *
 * `list` returnerer hver kategori med DEN UTLEDEDE ordningen for et gitt
 * prosjekt (overstyring ?? firma-default, via delt `utledOrdning`) + kilden, så
 * web/mobil kan vise ordnings-pillen og kilde-linjen uten å reimplementere
 * utledningen. Feltarbeideren velger ALDRI ordning — den er utledet.
 *
 * NB (U1-default): alle eksisterende kategorier står på `ordning='utlegg'` til
 * firma-admin gjennomgår katalogen i U5. Uten prosjekt-overstyring gir `list`
 * derfor `ordning='utlegg'` for alt. `sats`/`fakturert` nås først via en
 * overstyring (U5) eller manuelt satt ordning i test-DB.
 */
export const expenseCategoryRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          inkluderInaktiv: z.boolean().default(false),
          organizationId: z.string().uuid().optional(),
          // Når satt: utled ordning per DETTE prosjektet (overstyring ?? default)
          // og merk kilden. Uten prosjekt returneres firma-default som ordning.
          projectId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);
      const inkluderInaktiv = input?.inkluderInaktiv ?? false;

      const kategorier = await ctx.prismaTimer.expenseCategory.findMany({
        where: {
          organizationId: orgId,
          ...(inkluderInaktiv ? {} : { aktiv: true }),
        },
        orderBy: { navn: "asc" },
      });

      // Prosjekt-overstyringer for dette prosjektet (om oppgitt) — én spørring,
      // slå opp per kategori. Ugyldige (drift-)verdier ignoreres av utledningen.
      const overstyringer = input?.projectId
        ? await ctx.prismaTimer.prosjektOrdningOverstyring.findMany({
            where: {
              prosjektId: input.projectId,
              expenseCategoryId: { in: kategorier.map((k) => k.id) },
            },
          })
        : [];
      const overstyringPerKategori = new Map<string, UtleggOrdning>();
      for (const o of overstyringer) {
        if (erGyldigOrdning(o.ordning)) {
          overstyringPerKategori.set(o.expenseCategoryId, o.ordning);
        }
      }

      return kategorier.map((k) => {
        // Firma-default fra katalogen (drift-sikring: ukjent verdi → 'utlegg').
        const firmaDefault: UtleggOrdning = erGyldigOrdning(k.ordning)
          ? k.ordning
          : "utlegg";
        const prosjektOverstyring =
          overstyringPerKategori.get(k.id) ?? null;
        const ordning = utledOrdning({ firmaDefault, prosjektOverstyring });
        return {
          id: k.id,
          navn: k.navn,
          aktiv: k.aktiv,
          firmaDefault,
          ordning,
          // Kilde-linjen på raden (8b): «firma-standard» / «overstyrt for prosjektet».
          kilde: prosjektOverstyring ? ("overstyrt" as const) : ("firma-standard" as const),
        };
      });
    }),
});
