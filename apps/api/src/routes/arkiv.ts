import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserDokumentTilgang } from "../trpc/tilgangskontroll";
import { rendrArkivPdf, type ArkivDokumentRef } from "../services/arkiv/render";

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
  // Rendr ett eller flere dokumenter til ÉN arkiv-PDF og returner den (base64) i
  // responsen.
  //
  // N1 (fabel-vedtak 2026-08-15): payloaden er ALLTID en liste. Enkeltutskrift =
  // liste med ett element (identisk med tidligere oppførsel). Samleutskrift av
  // flere rapporter = «send flere i samme payload» — samme mal, samme pipeline,
  // én sammenhengende PDF ut, men mangel-kontrakten holdes PER dokument.
  //
  // N2: `mal` er et navngitt felt fra dag én. Full arkivform, én-linje-liste og
  // arbeidsliste er tre maler over samme data — rutes på malnavn, ikke tre
  // prosedyrer. Bare «arkiv» finnes nå.
  //
  // Vei 3b: ingen disk-skriving, ingen signert URL — PDF-en returneres i
  // responsen (irrelevant hvilken container tRPC kjører i). Web leser vedlegg fra
  // et read-only uploads-mount.
  //
  // Mutation (ikke query): sideeffekt-kall (activity-rad per dokument) caches aldri.
  rendr: protectedProcedure
    .input(
      z.object({
        mal: z.enum(["arkiv"]).default("arkiv"),
        dokumenter: z
          .array(
            z.object({
              id: z.string().uuid(),
              type: z.enum(["sjekkliste", "oppgave"]).default("sjekkliste"),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Oppgave-rendring er ikke bygget ennå (task-innholdsleser mangler). Kontrakten
      // godtar typen for N1, men avvis rendring med tydelig melding til den kommer.
      const oppgave = input.dokumenter.find((d) => d.type === "oppgave");
      if (oppgave) {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Arkiv-PDF for oppgaver er ikke bygget ennå — kun sjekklister støttes.",
        });
      }

      // Tilgang PER dokument: samme dokumenttilgang som lesing. Samle prosjekt-
      // organisasjon for activity-loggen i samme sving.
      const prosjektForDok = new Map<string, string | null>();
      for (const dok of input.dokumenter) {
        const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
          where: { id: dok.id },
          select: {
            id: true,
            bestillerFaggruppeId: true,
            utforerFaggruppeId: true,
            template: { select: { projectId: true, domain: true, hmsSynlighet: true } },
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
        prosjektForDok.set(dok.id, sjekkliste.template.projectId);
      }

      // Ruting på mal (N2). Bare «arkiv» finnes nå; nye former blir egne grener.
      const dokRefs: ArkivDokumentRef[] = input.dokumenter.map((d) => ({
        id: d.id,
        type: d.type,
      }));
      const naa = new Date();
      const resultat = await rendrArkivPdf(ctx.prisma, dokRefs, {
        generertTekst: genererStempel(naa),
        datoForFilnavn: naa.toISOString().slice(0, 10),
      });

      // Revisjonsspor: én activity-rad per dokument (hvem genererte hva).
      for (const dokStatus of resultat.dokumenter) {
        const projectId = prosjektForDok.get(dokStatus.id) ?? null;
        const prosjekt = projectId
          ? await ctx.prisma.project.findUnique({
              where: { id: projectId },
              select: { primaryOrganizationId: true },
            })
          : null;
        await ctx.prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId: prosjekt?.primaryOrganizationId ?? null,
            projectId,
            targetType: "arkiv",
            targetId: dokStatus.id,
            action: "rendret",
            payload: {
              mal: input.mal,
              dokumentType: "checklist",
              komplett: resultat.komplett,
              renderTimeout: resultat.renderTimeout,
              manglendeVedlegg: dokStatus.manglendeVedlegg,
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        });
      }

      return {
        pdfBase64: resultat.pdf.toString("base64"),
        filnavn: resultat.filnavn,
        komplett: resultat.komplett,
        // Eksponert ved siden av `komplett` (cowork 2026-08-15): timeout ≠ mangel.
        // Timeout → dokumentet kan være helt, «prøv igjen» hjelper. Manglende
        // vedlegg → dokumentet ER ufullstendig, retry hjelper ikke. Knappen skiller.
        renderTimeout: resultat.renderTimeout,
        // Per-dokument-status: hvilket dokument mangler hva (mangel-kontrakten er
        // verdiløs i en samleutskrift hvis brukeren ikke ser hvilken rapport).
        dokumenter: resultat.dokumenter,
      };
    }),
});
