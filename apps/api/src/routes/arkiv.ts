import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserDokumentTilgang } from "../trpc/tilgangskontroll";
import { rendrerSjekklisteArkivPdf } from "../services/arkiv/render";

/** «14.08.2026 14:32» — generert-stempel, kort norsk format. */
function genererStempel(dato: Date): string {
  return dato.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** «BEF-001» → filnavn. Faller tilbake til id når nummer/prefix mangler. */
function byggFilnavn(prefix: string | null, nummer: number | null, id: string): string {
  if (prefix && nummer != null) return `${prefix}-${String(nummer).padStart(3, "0")}.pdf`;
  return `sjekkliste-${id}.pdf`;
}

export const arkivRouter = router({
  // Rendr én sjekkliste til arkiv-PDF og returner PDF-en (base64) i responsen.
  //
  // Vei 3b: ingen disk-skriving, ingen signert URL. tRPC kjører in-process i
  // web-containeren (Next route handler), som IKKE deler api-containerens
  // uploads-volum for skriving. Å returnere PDF-en i responsen gjør det
  // irrelevant hvilken container mutasjonen kjører i — renderen tar ~1 s når
  // bildene er inlinet, og dokumentet hentes én gang (ikke verdt disk+cache).
  // Web leser vedlegg fra et read-only uploads-mount (docker-compose*.yml).
  //
  // Mutation (ikke query): et sideeffekt-kall (activity-rad) skal aldri caches.
  rendrSjekkliste: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        taMedEndringslogg: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgang: samme dokumenttilgang som lesing (verifiserDokumentTilgang).
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          number: true,
          bestillerFaggruppeId: true,
          utforerFaggruppeId: true,
          template: {
            select: { projectId: true, domain: true, hmsSynlighet: true, prefix: true },
          },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
        sjekkliste.template.hmsSynlighet,
      );

      const { pdf, komplett, renderTimeout, manglendeVedlegg } =
        await rendrerSjekklisteArkivPdf(ctx.prisma, input.id, {
          generertTekst: genererStempel(new Date()),
          taMedEndringslogg: input.taMedEndringslogg,
        });

      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: sjekkliste.template.projectId },
        select: { primaryOrganizationId: true },
      });

      // Spor: arkiv-PDF er en sammenstilling av dokumentet + logg + bilder.
      // Logg hvem som genererte den (revisjonsspor).
      await ctx.prisma.activity.create({
        data: {
          actorUserId: ctx.userId,
          organizationId: prosjekt?.primaryOrganizationId ?? null,
          projectId: sjekkliste.template.projectId,
          targetType: "arkiv",
          targetId: input.id,
          action: "rendret",
          payload: {
            dokumentType: "checklist",
            komplett,
            renderTimeout,
            manglendeVedlegg,
          },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return {
        pdfBase64: pdf.toString("base64"),
        filnavn: byggFilnavn(sjekkliste.template.prefix, sjekkliste.number, input.id),
        komplett,
        renderTimeout,
        manglendeVedlegg,
      };
    }),
});
