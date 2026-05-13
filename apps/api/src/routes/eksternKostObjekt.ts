import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { krevBrukersOrg } from "../trpc/tilgangskontroll";

/**
 * ExternalCostObject = "Underprosjekt" i UI (tilleggsarbeid, endring,
 * regningsarbeid m.fl.). Kostnadsobjekt brukt på timer-rader for å
 * skille hovedjobb fra tillegg/endringer.
 *
 * Per A.1: ExternalCostObject lever i kjernen-DB (packages/db), refereres
 * fra db-timer-skjema som svak String-FK (`SheetTimer.externalCostObjectId`).
 *
 * Denne router-en eksponerer kun lese-operasjoner mot mobil/web-velgere.
 * Opprettelse skjer via Proadm-import eller dedikert admin-flyt (ikke her).
 */

export const eksternKostObjektRouter = router({
  /**
   * Hent aktive ECO-er for innlogget bruker. Filtrer valgfritt på prosjekt.
   *
   * Mobilen bruker dette som katalog-cache (delta-pull ved login).
   * Returnerer kun ikke-slettet, status="aktiv" og timerregistreringApen=true
   * — dvs. det som faktisk er valgbart for timer-rader.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          inkluderLukket: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await krevBrukersOrg(ctx.userId);

      return ctx.prisma.externalCostObject.findMany({
        where: {
          organizationId: orgId,
          slettetVed: null,
          ...(input?.projectId ? { projectId: input.projectId } : {}),
          ...(input?.inkluderLukket
            ? {}
            : { status: "aktiv", timerregistreringApen: true }),
        },
        select: {
          id: true,
          organizationId: true,
          projectId: true,
          proAdmId: true,
          proAdmType: true,
          kortNavn: true,
          kilde: true,
          status: true,
          timerregistreringApen: true,
          updatedAt: true,
        },
        orderBy: [{ proAdmId: "asc" }],
      });
    }),
});
