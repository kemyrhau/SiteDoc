import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  krevBrukersOrg,
  resolverOrgFraInput,
  verifiserProsjektmedlem,
} from "../trpc/tilgangskontroll";

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

/*
 * Hvilket firma underprosjekt-katalogen hentes fra (post 2026-11-14 (7) punkt 2).
 *
 *  1. `organizationId` oppgitt (sedelens firma) → `resolverOrgFraInput`:
 *     sitedoc_admin får det oppgitte firmaet, andre KUN sitt eget (ellers
 *     FORBIDDEN «Ikke ditt firma»).
 *  2. Kun `projectId` → prosjekttilgang kreves (`verifiserProsjektmedlem`), og
 *     firmaet utledes fra prosjektets `primaryOrganizationId`. Prosjekt uten
 *     firma faller tilbake til brukerens firma (oppførselen før endringen).
 *  3. Ingen input (mobilens katalog-cache, `timerKatalog.ts`) → brukerens firma,
 *     uendret — bakoverkompatibelt.
 *
 * Firmafilteret ligger alltid i WHERE, så en bruker får aldri underprosjekter
 * fra et firma han eller hun ikke har tilgang til.
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
          // Post 2026-11-14 (7) punkt 2: firmaet katalogen gjelder (sedelens
          // firma). Utelatt → utledes fra prosjektet, ellers brukerens firma.
          organizationId: z.string().uuid().optional(),
          inkluderLukket: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      let orgId: string | null = null;
      if (input?.organizationId) {
        orgId = await resolverOrgFraInput(ctx.userId, input.organizationId);
      } else if (input?.projectId) {
        await verifiserProsjektmedlem(ctx.userId, input.projectId);
        const prosjekt = await ctx.prisma.project.findUnique({
          where: { id: input.projectId },
          select: { primaryOrganizationId: true },
        });
        orgId = prosjekt?.primaryOrganizationId ?? null;
      }
      if (!orgId) orgId = await krevBrukersOrg(ctx.userId);

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
