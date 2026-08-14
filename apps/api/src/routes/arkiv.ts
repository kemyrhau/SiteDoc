import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserDokumentTilgang } from "../trpc/tilgangskontroll";
import { signerFilSti } from "../utils/hmac";
import { UPLOADS_DIR } from "../services/eksport/felles";
import { rendrerSjekklisteArkivPdf } from "../services/arkiv/render";

// Arkiv-PDF-ene legges under /uploads/privat/ → den eksisterende signatur-gaten
// i server.ts beskytter dem uten ny tilgangslogikk (samme mønster som eksport).
const ARKIV_DIR = join(UPLOADS_DIR, "privat", "arkiv");

// Kortlevd: brukeren henter en fersk signert URL ved hvert klikk. 15 min dekker
// selve nedlastingen med margin; en lekket lenke dør raskt.
const NEDLASTING_LEVETID_MS = 15 * 60 * 1000;

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

export const arkivRouter = router({
  // Rendr én sjekkliste til arkiv-PDF og returner en signert nedlastings-URL.
  //
  // Mutation (ikke query): skriver en fil til disk + en activity-rad per kall.
  // react-query kan refetche queries fritt — et sideeffekt-kall skal aldri caches.
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
          bestillerFaggruppeId: true,
          utforerFaggruppeId: true,
          template: {
            select: { projectId: true, domain: true, hmsSynlighet: true },
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

      // Enkeltdokument fra dag én: én fil per sjekkliste, overskrives ved re-render.
      await mkdir(ARKIV_DIR, { recursive: true });
      const filnavn = `sjekkliste-${input.id}.pdf`;
      await writeFile(join(ARKIV_DIR, filnavn), pdf);
      const urlSti = `/uploads/privat/arkiv/${filnavn}`;

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

      let url: string;
      try {
        url = signerFilSti(urlSti, NEDLASTING_LEVETID_MS);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Kunne ikke signere nedlastingslenken.",
        });
      }

      return { url, komplett, renderTimeout, manglendeVedlegg };
    }),
});
