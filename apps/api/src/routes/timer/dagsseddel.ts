import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { verifiserProsjektmedlem } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";

const STATUS_VERDIER = ["draft", "sent", "returned", "accepted"] as const;
type DagsseddelStatus = (typeof STATUS_VERDIER)[number];

/**
 * Status-livssyklus per Runde 1B-spec:
 *   draft     — redigerbar (av eier)
 *   sent      — låst (venter på leder)
 *   returned  — redigerbar (leder ba om endringer)
 *   accepted  — låst permanent (attestert)
 *
 * timerLockEtterDager (OrganizationSetting) sjekkes kun for status="draft".
 * null = ingen alders-grense.
 */
function erRedigerbar(status: string): boolean {
  return status === "draft" || status === "returned";
}

async function hentBrukerOrgId(userId: string): Promise<string> {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!bruker.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ingen organisasjon tilknyttet" });
  }
  return bruker.organizationId;
}

/**
 * Sjekk om bruker kan godkjenne dagssedler for et prosjekt.
 * Leder = ProjectMember.role i {"admin","project_manager"} eller
 * sitedoc_admin / company_admin med matchende org.
 */
async function erProsjektLeder(userId: string, projectId: string): Promise<boolean> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, organizationId: true },
  });
  if (!bruker) return false;
  if (bruker.role === "sitedoc_admin") return true;

  if (bruker.role === "company_admin" && bruker.organizationId) {
    const orgProsjekt = await prisma.projectOrganization.findFirst({
      where: { organizationId: bruker.organizationId, projectId },
    });
    if (orgProsjekt) return true;
  }

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });
  return medlem?.role === "admin" || medlem?.role === "project_manager";
}

async function krevProsjektLeder(userId: string, projectId: string): Promise<void> {
  if (!(await erProsjektLeder(userId, projectId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Kun prosjektleder eller administrator kan godkjenne dagssedler",
    });
  }
}

/**
 * Hent dagsseddel og verifiser at innlogget bruker eier den (eller er admin).
 * Kaster NOT_FOUND hvis ikke funnet, FORBIDDEN hvis ikke eget.
 */
async function hentEgenDagsseddel(
  prismaTimer: Prisma.TransactionClient | typeof import("@sitedoc/db-timer").prismaTimer,
  ctxUserId: string,
  sheetId: string,
) {
  const sheet = await (prismaTimer as typeof import("@sitedoc/db-timer").prismaTimer).dailySheet.findUnique({
    where: { id: sheetId },
  });
  if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

  // Eierskap: kun den som sedelen tilhører, eller admin/firmaadmin
  if (sheet.userId !== ctxUserId) {
    const bruker = await prisma.user.findUniqueOrThrow({
      where: { id: ctxUserId },
      select: { role: true, organizationId: true },
    });
    const erAdmin =
      bruker.role === "sitedoc_admin" ||
      (bruker.role === "company_admin" && bruker.organizationId === sheet.organizationId);
    if (!erAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Du eier ikke denne dagsseddelen",
      });
    }
  }

  return sheet;
}

async function sjekkAldersgrense(
  organizationId: string,
  status: string,
  dato: Date,
): Promise<void> {
  if (status !== "draft") return; // Kun draft har alders-grense
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId },
    select: { timerLockEtterDager: true },
  });
  const grense = setting?.timerLockEtterDager;
  if (grense === null || grense === undefined) return; // null = ingen grense

  const naa = new Date();
  const dagerSiden = Math.floor((naa.getTime() - dato.getTime()) / (1000 * 60 * 60 * 24));
  if (dagerSiden > grense) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Dagsseddel er låst — eldre enn ${grense} dager (firma-policy)`,
    });
  }
}

export const dagsseddelRouter = router({
  // List dagssedler for innlogget bruker, eller for et prosjekt (admin-perspektiv senere).
  list: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
          // Hent egne sedler hvis userId ikke sendes
          userId: z.string().uuid().optional(),
          // Periode-filter — alt med dato i [fra, til] inklusivt. ISO-dato uten tidsone.
          fra: z.string().optional(),
          til: z.string().optional(),
          status: z.enum(STATUS_VERDIER).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);

      // Default: kun egne dagssedler
      const userId = input?.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres seddel: krev admin
      if (userId !== ctx.userId) {
        const bruker = await prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true, organizationId: true },
        });
        if (
          bruker.role !== "sitedoc_admin" &&
          !(bruker.role === "company_admin" && bruker.organizationId === orgId)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Krever admin for å se andres dagssedler",
          });
        }
      }

      const where: Prisma.DailySheetWhereInput = {
        organizationId: orgId,
        userId,
        ...(input?.projectId ? { projectId: input.projectId } : {}),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.fra || input?.til
          ? {
              dato: {
                ...(input.fra ? { gte: new Date(input.fra) } : {}),
                ...(input.til ? { lte: new Date(input.til) } : {}),
              },
            }
          : {}),
      };

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where,
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          timer: true,
          tillegg: true,
        },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
        take: 200,
      });

      // Berik med totaltimer (sum av alle SheetTimer-rader) for liste-visning
      return sedler.map((s) => ({
        ...s,
        totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
        antallRader: s.timer.length + s.tillegg.length,
      }));
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);
      const [aktivitet, timer, tillegg, prosjekt] = await Promise.all([
        ctx.prismaTimer.aktivitet.findUnique({ where: { id: sheet.aktivitetId } }),
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.project.findUnique({
          where: { id: sheet.projectId },
          select: { id: true, name: true, projectNumber: true },
        }),
      ]);
      return { ...sheet, aktivitet, timer, tillegg, prosjekt };
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        // Idempotens-nøkkel — klient genererer UUID, server upserter
        clientUuid: z.string().uuid(),
        projectId: z.string().uuid(),
        aktivitetId: z.string().uuid(),
        avdelingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        dato: z.string(), // ISO-dato (YYYY-MM-DD)
        startAt: z.string().nullable().optional(), // ISO timestamp
        endAt: z.string().nullable().optional(),
        pauseMin: z.number().int().min(0).default(0),
        beskrivelse: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);
      await krevTimerAktivert(orgId);

      // Verifiser prosjekt-tilgang (kaster FORBIDDEN ved feil)
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Verifiser at aktiviteten tilhører firmaet
      const aktivitet = await ctx.prismaTimer.aktivitet.findFirst({
        where: { id: input.aktivitetId, organizationId: orgId },
      });
      if (!aktivitet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aktivitet finnes ikke i firmaets katalog",
        });
      }

      const dato = new Date(input.dato);

      // Idempotent upsert via clientUuid
      try {
        return await ctx.prismaTimer.dailySheet.upsert({
          where: { clientUuid: input.clientUuid },
          create: {
            clientUuid: input.clientUuid,
            organizationId: orgId,
            userId: ctx.userId,
            registrertAvUserId: ctx.userId,
            projectId: input.projectId,
            aktivitetId: input.aktivitetId,
            avdelingId: input.avdelingId ?? null,
            byggeplassId: input.byggeplassId ?? null,
            dato,
            startAt: input.startAt ? new Date(input.startAt) : null,
            endAt: input.endAt ? new Date(input.endAt) : null,
            pauseMin: input.pauseMin,
            beskrivelse: input.beskrivelse ?? null,
            status: "draft",
          },
          // Re-send av samme clientUuid: returner eksisterende uten endring
          update: {},
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Du har allerede en dagsseddel for denne datoen og prosjektet",
          });
        }
        throw e;
      }
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        aktivitetId: z.string().uuid().optional(),
        avdelingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        dato: z.string().optional(),
        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),
        pauseMin: z.number().int().min(0).optional(),
        beskrivelse: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);

      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const data: Prisma.DailySheetUpdateInput = {};
      if (input.aktivitetId !== undefined) {
        data.aktivitet = { connect: { id: input.aktivitetId } };
      }
      if (input.avdelingId !== undefined) data.avdelingId = input.avdelingId;
      if (input.byggeplassId !== undefined) data.byggeplassId = input.byggeplassId;
      if (input.dato !== undefined) data.dato = new Date(input.dato);
      if (input.startAt !== undefined) {
        data.startAt = input.startAt ? new Date(input.startAt) : null;
      }
      if (input.endAt !== undefined) {
        data.endAt = input.endAt ? new Date(input.endAt) : null;
      }
      if (input.pauseMin !== undefined) data.pauseMin = input.pauseMin;
      if (input.beskrivelse !== undefined) data.beskrivelse = input.beskrivelse;

      return ctx.prismaTimer.dailySheet.update({
        where: { id: input.id },
        data,
      });
    }),

  // ----- Timer-rader (lønnsart × timer) ----------------------------------
  tilfoyTimerRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        lonnsartId: z.string().uuid(),
        timer: z.number().min(0).max(24),
        externalCostObjectId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      // Verifiser lønnsart tilhører samme firma
      const lonnsart = await ctx.prismaTimer.lonnsart.findFirst({
        where: { id: input.lonnsartId, organizationId: sheet.organizationId },
      });
      if (!lonnsart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lønnsart finnes ikke i firmaets katalog",
        });
      }

      return ctx.prismaTimer.sheetTimer.create({
        data: {
          sheetId: input.sheetId,
          lonnsartId: input.lonnsartId,
          timer: input.timer,
          externalCostObjectId: input.externalCostObjectId ?? null,
        },
      });
    }),

  oppdaterTimerRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        lonnsartId: z.string().uuid().optional(),
        timer: z.number().min(0).max(24).optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const data: Prisma.SheetTimerUpdateInput = {};
      if (input.lonnsartId !== undefined) {
        data.lonnsart = { connect: { id: input.lonnsartId } };
      }
      if (input.timer !== undefined) data.timer = input.timer;
      if (input.externalCostObjectId !== undefined) {
        data.externalCostObjectId = input.externalCostObjectId;
      }

      return ctx.prismaTimer.sheetTimer.update({
        where: { id: input.id },
        data,
      });
    }),

  fjernTimerRad: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }

      return ctx.prismaTimer.sheetTimer.delete({ where: { id: input.id } });
    }),

  // ----- Tillegg-rader ---------------------------------------------------
  tilfoyTilleggRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        tilleggId: z.string().uuid(),
        antall: z.number().min(0),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const tillegg = await ctx.prismaTimer.tillegg.findFirst({
        where: { id: input.tilleggId, organizationId: sheet.organizationId },
      });
      if (!tillegg) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tillegg finnes ikke i firmaets katalog",
        });
      }

      return ctx.prismaTimer.sheetTillegg.create({
        data: {
          sheetId: input.sheetId,
          tilleggId: input.tilleggId,
          antall: input.antall,
          kommentar: input.kommentar ?? null,
        },
      });
    }),

  oppdaterTilleggRad: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tilleggId: z.string().uuid().optional(),
        antall: z.number().min(0).optional(),
        kommentar: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }
      await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

      const data: Prisma.SheetTilleggUpdateInput = {};
      if (input.tilleggId !== undefined) {
        data.tillegg = { connect: { id: input.tilleggId } };
      }
      if (input.antall !== undefined) data.antall = input.antall;
      if (input.kommentar !== undefined) data.kommentar = input.kommentar;

      return ctx.prismaTimer.sheetTillegg.update({
        where: { id: input.id },
        data,
      });
    }),

  fjernTilleggRad: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTillegg.findUnique({
        where: { id: input.id },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, rad.sheetId);
      if (!erRedigerbar(sheet.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Dagsseddel er låst (status: ${sheet.status})`,
        });
      }

      return ctx.prismaTimer.sheetTillegg.delete({ where: { id: input.id } });
    }),

  // ----- Status-overgang -------------------------------------------------
  // draft → sent. Krever minst én timer-rad. Leder-godkjenning (sent → returned/accepted)
  // implementeres i Runde 1C.
  send: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);

      if (sheet.status !== "draft" && sheet.status !== "returned") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke sende dagsseddel med status «${sheet.status}»`,
        });
      }

      const antallTimerRader = await ctx.prismaTimer.sheetTimer.count({
        where: { sheetId: sheet.id },
      });
      if (antallTimerRader === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Dagsseddel må ha minst én timer-rad før den kan sendes",
        });
      }

      return ctx.prismaTimer.dailySheet.update({
        where: { id: sheet.id },
        data: { status: "sent" },
      });
    }),

  // Slett egen dagsseddel — kun draft-status tillatt
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);
      if (sheet.status !== "draft") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun utkast (draft) kan slettes",
        });
      }
      // Cascade på sheetId-FK sletter SheetTimer + SheetTillegg automatisk
      return ctx.prismaTimer.dailySheet.delete({ where: { id: sheet.id } });
    }),

  // ============================================================================
  //  Leder-godkjenning (Runde 1C)
  // ============================================================================

  // Hent alle dagssedler med status=sent som innlogget bruker er leder for.
  // Brukes av leder-vy /dashbord/[prosjektId]/timer/godkjenning.
  hentTilGodkjenning: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await krevProsjektLeder(ctx.userId, input.projectId);

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          projectId: input.projectId,
          status: "sent",
        },
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          timer: true,
          tillegg: true,
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Berik med ansatt-navn (cross-package: må slå opp i kjernen-DB)
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));
      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true, ansattnummer: true },
      });
      const brukerMap = new Map(brukere.map((b) => [b.id, b]));

      return sedler.map((s) => ({
        ...s,
        ansatt: brukerMap.get(s.userId) ?? null,
        totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
        antallRader: s.timer.length + s.tillegg.length,
      }));
    }),

  // Boolean-flagg som sidebar/UI bruker for å gate Godkjenning-lenken.
  kanGodkjenne: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return erProsjektLeder(ctx.userId, input.projectId);
    }),

  // Returner — leder ber om endringer. status="sent" → "returned".
  // Setter lederKommentar (påkrevd ved retur per spec).
  returner: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kommentar: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan returneres (status: ${sheet.status})`,
        });
      }
      await krevProsjektLeder(ctx.userId, sheet.projectId);

      return ctx.prismaTimer.dailySheet.update({
        where: { id: input.id },
        data: {
          status: "returned",
          lederKommentar: input.kommentar.trim(),
        },
      });
    }),

  // Attester — leder godkjenner. status="sent" → "accepted".
  // Snapshotter pris fra katalog inn i hver SheetTimer/SheetTillegg-rad
  // (Fase 0 A.7) så fremtidige katalog-endringer ikke påvirker historikken.
  attester: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan attesteres (status: ${sheet.status})`,
        });
      }
      await krevProsjektLeder(ctx.userId, sheet.projectId);

      // Hent alle rader + tilhørende katalog-data for snapshot
      const [timerRader, tilleggRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: input.id },
          include: { lonnsart: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: input.id },
          include: { tillegg: true },
        }),
      ]);

      const naa = new Date();

      // Atomisk transaksjon: skriv snapshot + flytt status i én batch
      await ctx.prismaTimer.$transaction([
        ...timerRader.map((rad) =>
          ctx.prismaTimer.sheetTimer.update({
            where: { id: rad.id },
            data: {
              attestertSnapshot: {
                lonnsartId: rad.lonnsart.id,
                kode: rad.lonnsart.kode,
                navn: rad.lonnsart.navn,
                type: rad.lonnsart.type,
                prisMotKunde: rad.lonnsart.prisMotKunde?.toString() ?? null,
                internkostnad: rad.lonnsart.internkostnad?.toString() ?? null,
                sats: rad.lonnsart.sats?.toString() ?? null,
                satsEnhet: rad.lonnsart.satsEnhet,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ...tilleggRader.map((rad) =>
          ctx.prismaTimer.sheetTillegg.update({
            where: { id: rad.id },
            data: {
              attestertSnapshot: {
                tilleggId: rad.tillegg.id,
                kode: rad.tillegg.kode,
                navn: rad.tillegg.navn,
                type: rad.tillegg.type,
                prisMotKunde: rad.tillegg.prisMotKunde?.toString() ?? null,
                internkostnad: rad.tillegg.internkostnad?.toString() ?? null,
                attestertVed: naa.toISOString(),
              },
            },
          }),
        ),
        ctx.prismaTimer.dailySheet.update({
          where: { id: input.id },
          data: {
            status: "accepted",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
      ]);

      return ctx.prismaTimer.dailySheet.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),
});
