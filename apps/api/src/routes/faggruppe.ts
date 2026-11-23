import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { createFaggruppeSchema, copyFaggruppeSchema } from "@sitedoc/shared";
import { type Prisma } from "@sitedoc/db";
import { verifiserAdmin, verifiserProsjektmedlem, aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { IKKE_SLETTET } from "../utils/softDelete";

/*
 * F13c E (Kenneth 6A, 2026-11-23): bare prosjektadmin (verifiserAdmin — sitedoc_admin og
 * firma-admin slipper gjennom som før) oppretter, endrer og sletter faggrupper. Vanlige
 * medlemmer leser. Alle ID-er i en endring valideres mot prosjektet faggruppen hører til —
 * en fremmed ProjectMember-ID eller ansvarlig fra et annet prosjekt avvises med BAD_REQUEST.
 */
async function krevAktiveProsjektmedlemmer(
  db: Prisma.TransactionClient,
  projectId: string,
  memberIds: string[],
): Promise<void> {
  const unike = [...new Set(memberIds)];
  if (unike.length === 0) return;
  const antall = await db.projectMember.count({
    where: { id: { in: unike }, projectId, ...aktivtMedlemWhere },
  });
  if (antall !== unike.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ett eller flere av medlemmene hører ikke til prosjektet.",
    });
  }
}

async function krevAnsvarligIProsjekt(
  db: Prisma.TransactionClient,
  projectId: string,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  const medlem = await db.projectMember.findFirst({
    where: { userId, projectId, ...aktivtMedlemWhere },
    select: { id: true },
  });
  if (!medlem) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Ansvarlig må være medlem av prosjektet.",
    });
  }
}

export const faggruppeRouter = router({
  // Hent alle faggrupper for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.faggruppe.findMany({
        where: { projectId: input.projectId },
        include: {
          ansvarlig: { select: { id: true, name: true, email: true } },
          faggruppeKoblinger: {
            // Bare aktive koblinger hos aktive prosjektmedlemmer (L2b).
            where: { ...aktivtMedlemWhere, projectMember: aktivtMedlemWhere },
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
          _count: {
            select: {
              // F0: tell kun ikke-slettede — ellers viser faggruppe-siden
              // papirkurv-dokumenter som ikke finnes i sjekkliste-/oppgave-lista.
              bestillerChecklists: { where: IKKE_SLETTET },
              utforerChecklists: { where: IKKE_SLETTET },
              bestillerTasks: { where: IKKE_SLETTET },
              utforerTasks: { where: IKKE_SLETTET },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent én faggruppe med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, faggruppe.projectId);
      return ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          faggruppeKoblinger: {
            // Bare aktive koblinger hos aktive prosjektmedlemmer (L2b).
            where: { ...aktivtMedlemWhere, projectMember: aktivtMedlemWhere },
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
        },
      });
    }),

  // Opprett ny faggruppe
  opprett: protectedProcedure
    .input(createFaggruppeSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      await krevAktiveProsjektmedlemmer(ctx.prisma, input.projectId, input.memberIds);
      const { memberIds, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        const faggruppe = await tx.faggruppe.create({ data });
        if (memberIds.length > 0) {
          await tx.faggruppeKobling.createMany({
            data: memberIds.map((memberId) => ({
              projectMemberId: memberId,
              faggruppeId: faggruppe.id,
            })),
            skipDuplicates: true,
          });
        }
        return faggruppe;
      });
    }),

  // Oppdater faggruppe
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        faggruppeNummer: z.string().max(20).optional(),
        organizationNumber: z.string().optional(),
        color: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        companyName: z.string().max(255).optional(),
        ansvarligId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserAdmin(ctx.userId, faggruppe.projectId);
      await krevAnsvarligIProsjekt(ctx.prisma, faggruppe.projectId, input.ansvarligId);
      const { id, ...data } = input;
      return ctx.prisma.faggruppe.update({ where: { id }, data });
    }),

  // Kopier faggruppe fra et prosjekt til et annet (eller samme)
  kopier: protectedProcedure
    .input(copyFaggruppeSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.targetProjectId);
      const kilde = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.sourceFaggruppeId },
      });
      // Kilden kan ligge i et annet prosjekt, men bare et brukeren selv har tilgang til.
      if (kilde.projectId !== input.targetProjectId) {
        await verifiserProsjektmedlem(ctx.userId, kilde.projectId);
      }
      await krevAktiveProsjektmedlemmer(ctx.prisma, input.targetProjectId, input.memberIds);

      return ctx.prisma.$transaction(async (tx) => {
        const nyFaggruppe = await tx.faggruppe.create({
          data: {
            projectId: input.targetProjectId,
            name: input.name ?? kilde.name,
            faggruppeNummer: kilde.faggruppeNummer,
            organizationNumber: kilde.organizationNumber,
            color: input.color ?? kilde.color,
            industry: kilde.industry,
            companyName: kilde.companyName,
          },
        });

        if (input.memberIds.length > 0) {
          await tx.faggruppeKobling.createMany({
            data: input.memberIds.map((memberId) => ({
              projectMemberId: memberId,
              faggruppeId: nyFaggruppe.id,
            })),
            skipDuplicates: true,
          });
        }

        return nyFaggruppe;
      });
    }),

  // Sett ansvarlig for faggruppe
  settAnsvarlig: protectedProcedure
    .input(
      z.object({
        faggruppeId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.faggruppeId },
        select: { projectId: true },
      });
      await verifiserAdmin(ctx.userId, faggruppe.projectId);
      await krevAnsvarligIProsjekt(ctx.prisma, faggruppe.projectId, input.userId);
      return ctx.prisma.faggruppe.update({
        where: { id: input.faggruppeId },
        data: { ansvarligId: input.userId },
      });
    }),

  // Slett faggruppe
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true, name: true },
      });
      await verifiserAdmin(ctx.userId, faggruppe.projectId);

      // Sjekk om faggruppen har tilknyttede sjekklister, oppgaver, medlemmer eller flyter.
      // Medlem-koblinger er onDelete: Cascade og flyter onDelete: SetNull — begge ville
      // forsvunnet stille uten denne vakten (speiler slett-vernet i dokumentflyt.ts).
      const [sjekklisteAntall, oppgaveAntall, medlemAntall, eideFlyter, flytledd] = await Promise.all([
        ctx.prisma.checklist.count({
          where: {
            ...IKKE_SLETTET,
            OR: [
              { bestillerFaggruppeId: input.id },
              { utforerFaggruppeId: input.id },
            ],
          },
        }),
        ctx.prisma.task.count({
          where: {
            ...IKKE_SLETTET,
            OR: [
              { bestillerFaggruppeId: input.id },
              { utforerFaggruppeId: input.id },
            ],
          },
        }),
        // Kun aktive koblinger — periodeSlutt = null (C.13). Historiske skal ikke blokkere.
        ctx.prisma.faggruppeKobling.count({
          where: { faggruppeId: input.id, periodeSlutt: null },
        }),
        ctx.prisma.dokumentflyt.findMany({
          where: { faggruppeId: input.id },
          select: { name: true },
          orderBy: { name: "asc" },
        }),
        // F13c B: faggruppen som LEDD i en flyt. Leddene er onDelete: Cascade
        // (schema.prisma DokumentflytMedlem.faggruppe) — uten denne tellingen rev en
        // vellykket sletting leddene ut av andres flyter i stillhet (F13b funn B).
        ctx.prisma.dokumentflytMedlem.findMany({
          where: { faggruppeId: input.id, ...aktivtMedlemWhere },
          select: { dokumentflyt: { select: { name: true } } },
        }),
      ]);

      if (sjekklisteAntall > 0 || oppgaveAntall > 0) {
        const detaljer: string[] = [];
        if (sjekklisteAntall > 0) detaljer.push(`${sjekklisteAntall} sjekkliste${sjekklisteAntall !== 1 ? "r" : ""}`);
        if (oppgaveAntall > 0) detaljer.push(`${oppgaveAntall} oppgave${oppgaveAntall !== 1 ? "r" : ""}`);
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke slette «${faggruppe.name}» fordi den har ${detaljer.join(" og ")} tilknyttet. Flytt eller slett disse først.`,
        });
      }

      // Flytene faggruppen eier eller står som ledd i — hver flyt nevnes én gang.
      const berorteFlyter = [
        ...new Set([
          ...eideFlyter.map((f) => f.name),
          ...flytledd.map((l) => l.dokumentflyt.name),
        ]),
      ].sort((a, b) => a.localeCompare(b, "nb"));

      if (medlemAntall > 0 || berorteFlyter.length > 0) {
        const deler: string[] = [];
        if (medlemAntall > 0) {
          deler.push(`den har ${medlemAntall} medlem${medlemAntall !== 1 ? "mer" : ""}`);
        }
        if (berorteFlyter.length > 0) {
          deler.push(
            `den står i dokumentflyt${berorteFlyter.length !== 1 ? "ene" : "en"} ${berorteFlyter.map((n) => `«${n}»`).join(", ")}`,
          );
        }
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke slette «${faggruppe.name}» fordi ${deler.join(" og ")}. Fjern dem fra faggruppen og flytene først.`,
        });
      }

      return ctx.prisma.faggruppe.delete({ where: { id: input.id } });
    }),
});
