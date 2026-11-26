import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma, resolverOrgFraInput } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";
import { sikreAnsattLonnsgruppeApi } from "../../services/lonnsgruppe";
import { sikreStandardLonnsgruppe, type prismaTimer as PrismaTimerInstans } from "@sitedoc/db-timer";

type TimerKlient = typeof PrismaTimerInstans;

/**
 * L1 LØNNSGRUPPER — server (spec-lonnsgrupper.md § 2 og § 7 L1, Kenneth 2026-11-26):
 * «Hvert firma lager egne grupper. lønnsgruppe- må styre hvilke timerader den enkelte har
 * tilgang på. Hvis lønnsgruppe ikke er valgt, gjelder den for alle.»
 *
 * Firma-grensen sjekkes her på serveren for hvert kall: lesing med resolverOrgFraInput (som
 * lonnsart.list), skriving med autoriserAdminForFirma. Grupper slettes aldri, de slås av.
 * «Ordinær» (erStandard) kan gis nytt navn, men ikke slås av. En gruppe med ansatte kan ikke slås av.
 */

const navnSchema = z.string().trim().min(1).max(100);

function erUnikBrudd(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const GJELDER_TYPER = ["lonnsart", "tillegg", "utleggskategori"] as const;

export const lonnsgruppeRouter = router({
  // Firmaets grupper. Standardgruppa først. Lages hvis firmaet mangler den (vernet i § 2).
  list: protectedProcedure
    .input(
      z
        .object({
          inkluderInaktiv: z.boolean().default(false),
          organizationId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);
      await sikreStandardLonnsgruppe(ctx.prismaTimer, orgId);
      const grupper = await ctx.prismaTimer.lonnsgruppe.findMany({
        where: { organizationId: orgId, ...(input?.inkluderInaktiv ? {} : { aktiv: true }) },
        orderBy: [{ erStandard: "desc" }, { rekkefolge: "asc" }, { navn: "asc" }],
        include: { _count: { select: { ansatte: true } } },
      });
      return grupper.map(({ _count, ...g }) => ({ ...g, antallAnsatte: _count.ansatte }));
    }),

  opprett: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid(), navn: navnSchema }))
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      await krevTimerAktivert(input.organizationId);
      await sikreStandardLonnsgruppe(ctx.prismaTimer, input.organizationId);
      try {
        return await ctx.prismaTimer.lonnsgruppe.create({
          data: { organizationId: input.organizationId, navn: input.navn, erStandard: false, aktiv: true },
        });
      } catch (e) {
        if (erUnikBrudd(e)) {
          throw new TRPCError({ code: "CONFLICT", message: `Lønnsgruppe «${input.navn}» finnes allerede` });
        }
        throw e;
      }
    }),

  // Gi nytt navn — også standardgruppa (B9).
  giNyttNavn: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid(), id: z.string().uuid(), navn: navnSchema }))
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const gruppe = await hentFirmasGruppe(ctx.prismaTimer, input.organizationId, input.id);
      try {
        return await ctx.prismaTimer.lonnsgruppe.update({ where: { id: gruppe.id }, data: { navn: input.navn } });
      } catch (e) {
        if (erUnikBrudd(e)) {
          throw new TRPCError({ code: "CONFLICT", message: `Lønnsgruppe «${input.navn}» finnes allerede` });
        }
        throw e;
      }
    }),

  // Slå av / på. Av nektes for standardgruppa (B9) og for en gruppe med ansatte (flytt dem først).
  settAktiv: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid(), id: z.string().uuid(), aktiv: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const gruppe = await hentFirmasGruppe(ctx.prismaTimer, input.organizationId, input.id);
      if (!input.aktiv) {
        if (gruppe.erStandard) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Standardgruppa kan ikke slås av" });
        }
        const antall = await ctx.prismaTimer.ansattLonnsgruppe.count({ where: { lonnsgruppeId: gruppe.id } });
        if (antall > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Gruppa har ${antall} ansatte. Flytt dem til en annen gruppe først`,
          });
        }
      }
      return ctx.prismaTimer.lonnsgruppe.update({ where: { id: gruppe.id }, data: { aktiv: input.aktiv } });
    }),

  // Sett den ansattes gruppe (B1: én pr. ansatt, B6: gjelder fra nå). Den ansatte må være medlem i firmaet.
  settAnsatt: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid(), userId: z.string().uuid(), lonnsgruppeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const medlem = await ctx.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: input.organizationId } },
        select: { id: true },
      });
      if (!medlem) throw new TRPCError({ code: "NOT_FOUND", message: "Personen er ikke ansatt i firmaet" });
      return sikreAnsattLonnsgruppeApi(ctx.prismaTimer, {
        organizationId: input.organizationId,
        userId: input.userId,
        lonnsgruppeId: input.lonnsgruppeId,
        sattAvUserId: ctx.userId,
      });
    }),

  // «Gjelder lønnsgrupper» på en lønnsart, et tillegg eller en utleggskategori. Erstatter settet.
  // Tom liste = gjelder alle. Historikk røres ikke (lagrede rader peker på arten med id).
  settGjelder: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        type: z.enum(GJELDER_TYPER),
        id: z.string().uuid(),
        lonnsgruppeIder: z.array(z.string().uuid()).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const orgId = input.organizationId;
      const ider = [...new Set(input.lonnsgruppeIder)];

      const finnes =
        input.type === "lonnsart"
          ? await ctx.prismaTimer.lonnsart.findFirst({ where: { id: input.id, organizationId: orgId }, select: { id: true } })
          : input.type === "tillegg"
            ? await ctx.prismaTimer.tillegg.findFirst({ where: { id: input.id, organizationId: orgId }, select: { id: true } })
            : await ctx.prismaTimer.expenseCategory.findFirst({ where: { id: input.id, organizationId: orgId }, select: { id: true } });
      if (!finnes) throw new TRPCError({ code: "NOT_FOUND", message: "Finnes ikke i firmaet" });

      if (ider.length > 0) {
        const grupper = await ctx.prismaTimer.lonnsgruppe.count({
          where: { id: { in: ider }, organizationId: orgId, aktiv: true },
        });
        if (grupper !== ider.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ukjent eller avslått lønnsgruppe" });
        }
      }

      await ctx.prismaTimer.$transaction(async (tx) => {
        if (input.type === "lonnsart") {
          await tx.lonnsartLonnsgruppe.deleteMany({ where: { lonnsartId: input.id } });
          if (ider.length) await tx.lonnsartLonnsgruppe.createMany({ data: ider.map((g) => ({ lonnsartId: input.id, lonnsgruppeId: g })) });
        } else if (input.type === "tillegg") {
          await tx.tilleggLonnsgruppe.deleteMany({ where: { tilleggId: input.id } });
          if (ider.length) await tx.tilleggLonnsgruppe.createMany({ data: ider.map((g) => ({ tilleggId: input.id, lonnsgruppeId: g })) });
        } else {
          await tx.expenseCategoryLonnsgruppe.deleteMany({ where: { expenseCategoryId: input.id } });
          if (ider.length) {
            await tx.expenseCategoryLonnsgruppe.createMany({
              data: ider.map((g) => ({ expenseCategoryId: input.id, lonnsgruppeId: g })),
            });
          }
        }
      });
      return { id: input.id, lonnsgruppeIder: ider };
    }),
});

async function hentFirmasGruppe(prismaTimer: TimerKlient, organizationId: string, id: string) {
  const gruppe = await prismaTimer.lonnsgruppe.findFirst({ where: { id, organizationId } });
  if (!gruppe) throw new TRPCError({ code: "NOT_FOUND", message: "Lønnsgruppa finnes ikke i firmaet" });
  return gruppe;
}
