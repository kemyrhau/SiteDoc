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
          maskiner: true,
        },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
        take: 200,
      });

      // Berik med totaltimer (sum av alle SheetTimer-rader) for liste-visning
      return sedler.map((s) => ({
        ...s,
        totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
        antallRader: s.timer.length + s.tillegg.length + s.maskiner.length,
      }));
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await hentEgenDagsseddel(ctx.prismaTimer, ctx.userId, input.id);
      const [aktivitet, timer, tillegg, maskiner, prosjekt] = await Promise.all([
        sheet.aktivitetId
          ? ctx.prismaTimer.aktivitet.findUnique({ where: { id: sheet.aktivitetId } })
          : Promise.resolve(null),
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: sheet.id },
          orderBy: { createdAt: "asc" },
        }),
        ctx.prisma.project.findUnique({
          where: { id: sheet.projectId },
          select: { id: true, name: true, projectNumber: true },
        }),
      ]);
      return { ...sheet, aktivitet, timer, tillegg, maskiner, prosjekt };
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

  // ----- Timer-rader (lønnsart × timer × aktivitet) -----------------------
  // Per C9 (2026-05-02): aktivitetId er per rad. Klient sender alltid
  // (default fra sedel hvis ikke overstyrt).
  tilfoyTimerRad: protectedProcedure
    .input(
      z.object({
        sheetId: z.string().uuid(),
        lonnsartId: z.string().uuid(),
        aktivitetId: z.string().uuid(),
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

      // Verifiser lønnsart + aktivitet tilhører samme firma
      const [lonnsart, aktivitet] = await Promise.all([
        ctx.prismaTimer.lonnsart.findFirst({
          where: { id: input.lonnsartId, organizationId: sheet.organizationId },
        }),
        ctx.prismaTimer.aktivitet.findFirst({
          where: { id: input.aktivitetId, organizationId: sheet.organizationId },
        }),
      ]);
      if (!lonnsart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lønnsart finnes ikke i firmaets katalog",
        });
      }
      if (!aktivitet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Aktivitet finnes ikke i firmaets katalog",
        });
      }

      return ctx.prismaTimer.sheetTimer.create({
        data: {
          sheetId: input.sheetId,
          lonnsartId: input.lonnsartId,
          aktivitetId: input.aktivitetId,
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
        aktivitetId: z.string().uuid().optional(),
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
      if (input.aktivitetId !== undefined) {
        data.aktivitet = { connect: { id: input.aktivitetId } };
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
  // draft → sent. Krever minst én timer-rad. Leder-attestering (sent → returned/accepted)
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
  //  Leder-attestering (Runde 1C)
  // ============================================================================

  // Hent alle dagssedler med status=sent som innlogget bruker er leder for.
  // Brukes av leder-vy /dashbord/[prosjektId]/timer/attestering.
  hentTilAttestering: protectedProcedure
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

  // @deprecated alias for hentTilAttestering — beholdes 1 uke per CLAUDE.md
  // API-bakoverkompatibilitet-regel. Fjernes etter 2026-05-09.
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

  // Boolean-flagg som sidebar/UI bruker for å gate Attestering-lenken.
  kanAttestere: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return erProsjektLeder(ctx.userId, input.projectId);
    }),

  // @deprecated alias for kanAttestere — beholdes 1 uke per CLAUDE.md
  // API-bakoverkompatibilitet-regel. Fjernes etter 2026-05-09.
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
      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: input.id },
          include: { lonnsart: true, aktivitet: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: input.id },
          include: { tillegg: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: input.id },
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
                aktivitetId: rad.aktivitet.id,
                aktivitetKode: rad.aktivitet.kode,
                aktivitetNavn: rad.aktivitet.navn,
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
        // Maskin-snapshot per A.7. Equipment-prising er ikke spec'd ennå
        // (Maskin Fase 1+) — lagrer kun rad-data + timestamp. Pris-felt
        // tilføyes når prising besluttes.
        ...maskinRader.map((rad) =>
          ctx.prismaTimer.sheetMachine.update({
            where: { id: rad.id },
            data: {
              attestertSnapshot: {
                vehicleId: rad.vehicleId,
                timer: rad.timer.toString(),
                mengde: rad.mengde !== null ? rad.mengde.toString() : null,
                enhet: rad.enhet,
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

  // ============================================================================
  //  Mobil offline-sync (Runde 2)
  // ============================================================================

  /**
   * Pull: hent alle dagssedler for innlogget bruker som er endret etter
   * gitt timestamp. Brukes ved app-oppstart, ved nett-gjenkomst og ved
   * pull-to-refresh på mobil.
   *
   * Returnerer fulle sedler med rader (timer + tillegg) — mobil overskriver
   * lokal kopi så lenge lokal har syncStatus="synced". Hvis lokal har
   * "pending"-endringer, markeres lokal "conflict" (server-wins-regel).
   */
  hentEndringerSiden: protectedProcedure
    .input(
      z.object({
        sistSynkronisert: z.string().optional(), // ISO timestamp eller undefined for full pull
        // Begrens til siste N dager hvis full pull, for å unngå å laste hele historikken
        maksDagerTilbake: z.number().int().min(1).max(365).default(90),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);
      await krevTimerAktivert(orgId);

      const sistSynk = input.sistSynkronisert
        ? new Date(input.sistSynkronisert)
        : null;

      // Full pull (ingen sistSynk): hent kun nyere enn maksDagerTilbake
      const minDato = new Date();
      minDato.setDate(minDato.getDate() - input.maksDagerTilbake);

      const where: Prisma.DailySheetWhereInput = {
        organizationId: orgId,
        userId: ctx.userId,
        ...(sistSynk
          ? { updatedAt: { gt: sistSynk } }
          : { dato: { gte: minDato } }),
      };

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where,
        include: { timer: true, tillegg: true, maskiner: true },
        orderBy: { updatedAt: "desc" },
      });

      return {
        serverTid: new Date().toISOString(),
        sedler: sedler.map((s) => ({
          id: s.id,
          clientUuid: s.clientUuid,
          userId: s.userId,
          organizationId: s.organizationId,
          projectId: s.projectId,
          aktivitetId: s.aktivitetId,
          avdelingId: s.avdelingId,
          byggeplassId: s.byggeplassId,
          dato: s.dato.toISOString().slice(0, 10),
          startAt: s.startAt?.toISOString() ?? null,
          endAt: s.endAt?.toISOString() ?? null,
          pauseMin: s.pauseMin,
          status: s.status,
          beskrivelse: s.beskrivelse,
          lederKommentar: s.lederKommentar,
          attestertVed: s.attestertVed?.toISOString() ?? null,
          updatedAt: s.updatedAt.toISOString(),
          timer: s.timer.map((t) => ({
            id: t.id,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId,
            timer: Number(t.timer),
          })),
          tillegg: s.tillegg.map((tl) => ({
            id: tl.id,
            tilleggId: tl.tilleggId,
            antall: Number(tl.antall),
            kommentar: tl.kommentar,
          })),
          maskiner: s.maskiner.map((m) => ({
            id: m.id,
            vehicleId: m.vehicleId,
            timer: Number(m.timer),
            mengde: m.mengde !== null ? Number(m.mengde) : null,
            enhet: m.enhet,
          })),
        })),
      };
    }),

  /**
   * Push: batch-upsert fra mobil. Tar en array av lokale dagssedler med
   * tilhørende rader. Hver seddel kjøres i sin egen $transaction —
   * resultater er uavhengige per seddel.
   *
   * Returnerer Array<{clientUuid, resultat, serverData?, feilmelding?}>:
   *   - "ok"       — opprettet eller oppdatert OK
   *   - "conflict" — server-versjonen er låst (accepted) eller nyere — server-wins
   *   - "feilet"   — andre feil (validering, FK-brudd, transient)
   *
   * Ingen rollback på tvers av sedler — én korrupt seddel blokkerer ikke
   * de andre. Mobil håndterer hver seddel separat basert på resultat.
   */
  syncBatch: protectedProcedure
    .input(
      z.object({
        sedler: z.array(
          z.object({
            clientUuid: z.string().uuid(),
            projectId: z.string().uuid(),
            aktivitetId: z.string().uuid(),
            avdelingId: z.string().uuid().nullable().optional(),
            byggeplassId: z.string().uuid().nullable().optional(),
            dato: z.string(), // ISO YYYY-MM-DD
            startAt: z.string().nullable().optional(),
            endAt: z.string().nullable().optional(),
            pauseMin: z.number().int().min(0).default(0),
            status: z.enum(STATUS_VERDIER),
            beskrivelse: z.string().nullable().optional(),
            timer: z.array(
              z.object({
                id: z.string().uuid(),
                lonnsartId: z.string().uuid(),
                aktivitetId: z.string().uuid(),
                externalCostObjectId: z.string().uuid().nullable().optional(),
                timer: z.number().min(0).max(24),
              }),
            ),
            tillegg: z.array(
              z.object({
                id: z.string().uuid(),
                tilleggId: z.string().uuid(),
                antall: z.number().min(0),
                kommentar: z.string().nullable().optional(),
              }),
            ),
            maskiner: z
              .array(
                z.object({
                  id: z.string().uuid(),
                  vehicleId: z.string().uuid(),
                  timer: z.number().min(0).max(24),
                  mengde: z.number().min(0).nullable().optional(),
                  enhet: z.string().max(20).nullable().optional(),
                }),
              )
              .default([]),
          }),
        ).max(100), // Begrens batch-størrelse for å unngå tidsavbrudd
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);
      await krevTimerAktivert(orgId);

      type ResultatRad = {
        clientUuid: string;
        resultat: "ok" | "conflict" | "feilet";
        serverData?: {
          id: string;
          status: DagsseddelStatus;
          lederKommentar: string | null;
          attestertVed: string | null;
          updatedAt: string;
        };
        feilmelding?: string;
      };

      const resultater: ResultatRad[] = [];

      for (const lokal of input.sedler) {
        try {
          // Sjekk eksisterende — verifiser eierskap + om låst
          const eksisterende = await ctx.prismaTimer.dailySheet.findUnique({
            where: { clientUuid: lokal.clientUuid },
          });

          if (eksisterende) {
            if (eksisterende.userId !== ctx.userId) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "feilet",
                feilmelding: "Dagsseddel eies av annen bruker",
              });
              continue;
            }
            if (eksisterende.organizationId !== orgId) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "feilet",
                feilmelding: "Dagsseddel tilhører annet firma",
              });
              continue;
            }
            // Server-wins: hvis server har accepted, klient kan ikke endre
            if (eksisterende.status === "accepted") {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                serverData: {
                  id: eksisterende.id,
                  status: eksisterende.status as DagsseddelStatus,
                  lederKommentar: eksisterende.lederKommentar,
                  attestertVed: eksisterende.attestertVed?.toISOString() ?? null,
                  updatedAt: eksisterende.updatedAt.toISOString(),
                },
                feilmelding: "Sedlen er attestert og kan ikke endres",
              });
              continue;
            }
            // Server-wins: hvis server-status er sent og klient prøver å redigere innhold,
            // er det konflikt (kun "send"-overgang draft→sent eller returned→sent er OK)
            if (
              eksisterende.status === "sent" &&
              lokal.status !== "sent"
            ) {
              resultater.push({
                clientUuid: lokal.clientUuid,
                resultat: "conflict",
                serverData: {
                  id: eksisterende.id,
                  status: eksisterende.status as DagsseddelStatus,
                  lederKommentar: eksisterende.lederKommentar,
                  attestertVed: eksisterende.attestertVed?.toISOString() ?? null,
                  updatedAt: eksisterende.updatedAt.toISOString(),
                },
                feilmelding: "Sedlen er sendt til attestering og venter på leder",
              });
              continue;
            }
          } else {
            // Ny seddel — verifiser prosjekttilgang
            await verifiserProsjektmedlem(ctx.userId, lokal.projectId);
          }

          // Verifiser aktivitet tilhører firmaet
          const aktivitet = await ctx.prismaTimer.aktivitet.findFirst({
            where: { id: lokal.aktivitetId, organizationId: orgId },
          });
          if (!aktivitet) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: "Aktivitet finnes ikke i firmaets katalog",
            });
            continue;
          }

          // Verifiser alle lønnsarter, aktiviteter (per rad) og tillegg tilhører firmaet
          const lonnsartIder = Array.from(
            new Set(lokal.timer.map((t) => t.lonnsartId)),
          );
          const aktivitetIderIRader = Array.from(
            new Set(lokal.timer.map((t) => t.aktivitetId)),
          );
          const tilleggIder = Array.from(
            new Set(lokal.tillegg.map((tl) => tl.tilleggId)),
          );
          const [lonnsartTreff, aktivitetIRaderTreff, tilleggTreff] = await Promise.all([
            lonnsartIder.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.lonnsart.findMany({
                  where: { id: { in: lonnsartIder }, organizationId: orgId },
                  select: { id: true },
                }),
            aktivitetIderIRader.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.aktivitet.findMany({
                  where: { id: { in: aktivitetIderIRader }, organizationId: orgId },
                  select: { id: true },
                }),
            tilleggIder.length === 0
              ? Promise.resolve([])
              : ctx.prismaTimer.tillegg.findMany({
                  where: { id: { in: tilleggIder }, organizationId: orgId },
                  select: { id: true },
                }),
          ]);
          if (lonnsartTreff.length !== lonnsartIder.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: "En eller flere lønnsarter finnes ikke i firmaets katalog",
            });
            continue;
          }
          if (aktivitetIRaderTreff.length !== aktivitetIderIRader.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: "En eller flere aktiviteter finnes ikke i firmaets katalog",
            });
            continue;
          }
          if (tilleggTreff.length !== tilleggIder.length) {
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: "Et eller flere tillegg finnes ikke i firmaets katalog",
            });
            continue;
          }

          const dato = new Date(lokal.dato);

          // Klient kan ikke sette accepted — lederen attesterer på server
          // Klient kan sette draft, sent (etter "send"-knapp), eller behold returned
          const innkommendeStatus =
            lokal.status === "accepted" ? "sent" : lokal.status;

          // Per-seddel transaksjon: upsert sedel + erstatt rader atomisk
          const oppdatert = await ctx.prismaTimer.$transaction(async (tx) => {
            const sedel = await tx.dailySheet.upsert({
              where: { clientUuid: lokal.clientUuid },
              create: {
                clientUuid: lokal.clientUuid,
                organizationId: orgId,
                userId: ctx.userId,
                registrertAvUserId: ctx.userId,
                projectId: lokal.projectId,
                aktivitetId: lokal.aktivitetId,
                avdelingId: lokal.avdelingId ?? null,
                byggeplassId: lokal.byggeplassId ?? null,
                dato,
                startAt: lokal.startAt ? new Date(lokal.startAt) : null,
                endAt: lokal.endAt ? new Date(lokal.endAt) : null,
                pauseMin: lokal.pauseMin,
                status: innkommendeStatus,
                beskrivelse: lokal.beskrivelse ?? null,
                syncStatus: "synced",
                syncedAt: new Date(),
              },
              update: {
                aktivitetId: lokal.aktivitetId,
                avdelingId: lokal.avdelingId ?? null,
                byggeplassId: lokal.byggeplassId ?? null,
                dato,
                startAt: lokal.startAt ? new Date(lokal.startAt) : null,
                endAt: lokal.endAt ? new Date(lokal.endAt) : null,
                pauseMin: lokal.pauseMin,
                status: innkommendeStatus,
                beskrivelse: lokal.beskrivelse ?? null,
                syncStatus: "synced",
                syncedAt: new Date(),
              },
            });

            // Erstatt alle rader (deleteMany + createMany) — sedel er sync-atom.
            // Cascade på sheetId-FK + Restrict på lonnsart/aktivitet/tillegg er
            // allerede håndtert via relasjoner. Vi unngår å treffe accepted-rader
            // fordi status="accepted" returnerer "conflict" tidligere i flyten.
            await tx.sheetTimer.deleteMany({ where: { sheetId: sedel.id } });
            await tx.sheetTillegg.deleteMany({ where: { sheetId: sedel.id } });
            await tx.sheetMachine.deleteMany({ where: { sheetId: sedel.id } });

            if (lokal.timer.length > 0) {
              await tx.sheetTimer.createMany({
                data: lokal.timer.map((t) => ({
                  id: t.id,
                  sheetId: sedel.id,
                  lonnsartId: t.lonnsartId,
                  aktivitetId: t.aktivitetId,
                  externalCostObjectId: t.externalCostObjectId ?? null,
                  timer: t.timer,
                })),
              });
            }
            if (lokal.tillegg.length > 0) {
              await tx.sheetTillegg.createMany({
                data: lokal.tillegg.map((tl) => ({
                  id: tl.id,
                  sheetId: sedel.id,
                  tilleggId: tl.tilleggId,
                  antall: tl.antall,
                  kommentar: tl.kommentar ?? null,
                })),
              });
            }
            if (lokal.maskiner.length > 0) {
              await tx.sheetMachine.createMany({
                data: lokal.maskiner.map((m) => ({
                  id: m.id,
                  sheetId: sedel.id,
                  vehicleId: m.vehicleId,
                  timer: m.timer,
                  mengde: m.mengde ?? null,
                  enhet: m.enhet ?? null,
                })),
              });
            }

            return sedel;
          });

          resultater.push({
            clientUuid: lokal.clientUuid,
            resultat: "ok",
            serverData: {
              id: oppdatert.id,
              status: oppdatert.status as DagsseddelStatus,
              lederKommentar: oppdatert.lederKommentar,
              attestertVed: oppdatert.attestertVed?.toISOString() ?? null,
              updatedAt: oppdatert.updatedAt.toISOString(),
            },
          });
        } catch (e) {
          if (e instanceof TRPCError) {
            // Tilgangsfeil (FORBIDDEN fra verifiserProsjektmedlem) regnes som feilet,
            // ikke conflict — klienten kan ikke fikse dette med ny pull.
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding: e.message,
            });
            continue;
          }
          if (e instanceof Prisma.PrismaClientKnownRequestError) {
            // P2002: brudd på unique-constraint (typisk userId+projectId+dato)
            // — klient har duplisert seddel under tidligere offline-økt
            resultater.push({
              clientUuid: lokal.clientUuid,
              resultat: "feilet",
              feilmelding:
                e.code === "P2002"
                  ? "Duplisert dagsseddel for samme dato og prosjekt"
                  : `DB-feil: ${e.code}`,
            });
            continue;
          }
          // Ukjent feil — la klient retry
          const melding = e instanceof Error ? e.message : "Ukjent feil";
          resultater.push({
            clientUuid: lokal.clientUuid,
            resultat: "feilet",
            feilmelding: melding,
          });
        }
      }

      return { serverTid: new Date().toISOString(), resultater };
    }),

  // ============================================================================
  //  Maskin-rader (C9 2026-05-02) — sheet_machines lever i db-timer fordi
  //  Timer eier dagsseddelen. Equipment-katalog leveres av Maskin-modul via
  //  service-lag (cross-modul-konvensjon per arkitektur-syntese § 6.1.1).
  //  Vehicle-validering mot db-maskin gjøres ikke her — svak FK per A.20.
  // ============================================================================

  maskin: router({
    tilfoy: protectedProcedure
      .input(
        z.object({
          sheetId: z.string().uuid(),
          vehicleId: z.string().uuid(),
          timer: z.number().min(0).max(24),
          mengde: z.number().min(0).nullable().optional(),
          enhet: z.string().max(20).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          input.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }
        await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

        return ctx.prismaTimer.sheetMachine.create({
          data: {
            sheetId: input.sheetId,
            vehicleId: input.vehicleId,
            timer: input.timer,
            mengde: input.mengde ?? null,
            enhet: input.enhet ?? null,
          },
        });
      }),

    oppdater: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          vehicleId: z.string().uuid().optional(),
          timer: z.number().min(0).max(24).optional(),
          mengde: z.number().min(0).nullable().optional(),
          enhet: z.string().max(20).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const rad = await ctx.prismaTimer.sheetMachine.findUnique({
          where: { id: input.id },
        });
        if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          rad.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }
        await sjekkAldersgrense(sheet.organizationId, sheet.status, sheet.dato);

        const data: Prisma.SheetMachineUpdateInput = {};
        if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId;
        if (input.timer !== undefined) data.timer = input.timer;
        if (input.mengde !== undefined) data.mengde = input.mengde;
        if (input.enhet !== undefined) data.enhet = input.enhet;

        return ctx.prismaTimer.sheetMachine.update({
          where: { id: input.id },
          data,
        });
      }),

    fjern: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const rad = await ctx.prismaTimer.sheetMachine.findUnique({
          where: { id: input.id },
        });
        if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

        const sheet = await hentEgenDagsseddel(
          ctx.prismaTimer,
          ctx.userId,
          rad.sheetId,
        );
        if (!erRedigerbar(sheet.status)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Dagsseddel er låst (status: ${sheet.status})`,
          });
        }

        return ctx.prismaTimer.sheetMachine.delete({ where: { id: input.id } });
      }),
  }),

  // ============================================================================
  //  hentDagstotal (C9 2026-05-02) — sum timer på tvers av prosjekter for én
  //  bruker × én dato. Brukstilfelle: mobil viser «Du har ført Xt i dag på N
  //  prosjekter» øverst i ny-dagsseddel-flyten. Multi-sedel per dag er gyldig
  //  per unique-constraint (userId, projectId, dato).
  // ============================================================================

  hentDagstotal: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(), // default = innlogget bruker
        dato: z.string(), // ISO YYYY-MM-DD
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);
      const userId = input.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres dagstotal: krev admin
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
            message: "Krever admin for å se andres dagstotal",
          });
        }
      }

      const dato = new Date(input.dato);

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          organizationId: orgId,
          userId,
          dato,
        },
        include: { timer: true },
      });

      const projektIder = sedler.map((s) => s.projectId);
      const prosjekter =
        projektIder.length === 0
          ? []
          : await prisma.project.findMany({
              where: { id: { in: projektIder } },
              select: { id: true, name: true, projectNumber: true },
            });
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      const perProsjekt = sedler.map((s) => ({
        sheetId: s.id,
        projectId: s.projectId,
        projectNavn: prosjektMap.get(s.projectId)?.name ?? null,
        projectNummer: prosjektMap.get(s.projectId)?.projectNumber ?? null,
        status: s.status,
        timer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
      }));

      const totalTimer = perProsjekt.reduce((acc, p) => acc + p.timer, 0);

      return {
        dato: input.dato,
        userId,
        totalTimer,
        antallSedler: sedler.length,
        perProsjekt,
      };
    }),
});
