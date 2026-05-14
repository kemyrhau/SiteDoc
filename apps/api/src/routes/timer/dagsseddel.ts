import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserProsjektmedlem,
  hentBrukersOrg,
  krevBrukersOrg,
} from "../../trpc/tilgangskontroll";
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

/**
 * Sjekk om bruker kan godkjenne dagssedler for et prosjekt.
 * Leder = ProjectMember.role="admin" ELLER ProjectMember.kanAttestere=true,
 * eller sitedoc_admin / firma-admin i prosjektets firma.
 * (Boolean-kapabilitet vedtatt 2026-05-02 — erstatter "project_manager"-rolle.)
 */
async function erProsjektLeder(userId: string, projectId: string): Promise<boolean> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!bruker) return false;
  if (bruker.role === "sitedoc_admin") return true;

  const brukerOrgId = await hentBrukersOrg(userId);
  if (brukerOrgId) {
    const orgProsjekt = await prisma.projectOrganization.findFirst({
      where: { organizationId: brukerOrgId, projectId },
    });
    if (orgProsjekt) {
      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: brukerOrgId } },
        select: { firmaRoller: true },
      });
      if (member?.firmaRoller.includes("firma_admin")) return true;
    }
  }

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, kanAttestere: true },
  });
  return medlem?.role === "admin" || medlem?.kanAttestere === true;
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
      select: { role: true },
    });
    let erAdmin = bruker.role === "sitedoc_admin";
    if (!erAdmin) {
      const member = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: ctxUserId,
            organizationId: sheet.organizationId,
          },
        },
        select: { firmaRoller: true },
      });
      erAdmin = member?.firmaRoller.includes("firma_admin") ?? false;
    }
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
      const orgId = await krevBrukersOrg(ctx.userId);

      // Default: kun egne dagssedler
      const userId = input?.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres seddel: krev admin
      if (userId !== ctx.userId) {
        const bruker = await prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true },
        });
        let tillatt = bruker.role === "sitedoc_admin";
        if (!tillatt) {
          const member = await prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: ctx.userId, organizationId: orgId } },
            select: { firmaRoller: true },
          });
          tillatt = member?.firmaRoller.includes("firma_admin") ?? false;
        }
        if (!tillatt) {
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
      const [aktivitet, timer, tillegg, maskiner] = await Promise.all([
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
      ]);
      // T.1 (2026-05-11): DailySheet har ikke projectId. Bruk første rad som proxy.
      const projectId =
        timer[0]?.projectId ?? maskiner[0]?.projectId ?? tillegg[0]?.projectId ?? null;
      const prosjekt = projectId
        ? await ctx.prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, projectNumber: true },
          })
        : null;
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
      const orgId = await krevBrukersOrg(ctx.userId);
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
      // T.1 (2026-05-11): projectId lagres ikke på DailySheet — kun på rad-nivå.
      // input.projectId brukes til auth-sjekk (verifiserProsjektmedlem ovenfor).
      // Klient sender projectId ved opprettelse av rader (leggTilTimerRad etc.).
      try {
        return await ctx.prismaTimer.dailySheet.upsert({
          where: { clientUuid: input.clientUuid },
          create: {
            clientUuid: input.clientUuid,
            organizationId: orgId,
            userId: ctx.userId,
            registrertAvUserId: ctx.userId,
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
            message: "Du har allerede en dagsseddel for denne datoen",
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
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
        lonnsartId: z.string().uuid(),
        aktivitetId: z.string().uuid(),
        timer: z.number().min(0).max(24),
        fraTid: z.string().nullable().optional(),
        tilTid: z.string().nullable().optional(),
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
          projectId: input.projectId,
          byggeplassId: input.byggeplassId ?? null,
          lonnsartId: input.lonnsartId,
          aktivitetId: input.aktivitetId,
          timer: input.timer,
          fraTid: input.fraTid ?? null,
          tilTid: input.tilTid ?? null,
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
        projectId: z.string().uuid(),
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
          projectId: input.projectId,
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
          // T.1 (2026-05-11): projectId ligger på rad — filtrer via timer-relasjon.
          timer: { some: { projectId: input.projectId } },
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
        select: { id: true, name: true, email: true },
      });
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      const brukerMap = new Map(
        brukere.map((b) => [b.id, { ...b, ansattnummer: ansattnummerMap.get(b.id) ?? null }]),
      );

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
          // T.1 (2026-05-11): projectId ligger på rad — filtrer via timer-relasjon.
          timer: { some: { projectId: input.projectId } },
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
        select: { id: true, name: true, email: true },
      });
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      const brukerMap = new Map(
        brukere.map((b) => [b.id, { ...b, ansattnummer: ansattnummerMap.get(b.id) ?? null }]),
      );

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

  // ============================================================================
  //  Firma-attestering (T7-2a) — sedler på tvers av prosjekter
  // ============================================================================
  //
  // Brukes av firma-admin-vy /dashbord/firma/timer/attestering.
  // Gjelder sedler med minst én rad knyttet til et prosjekt eid av firmaet
  // (primary- eller partner-rolle via ProjectOrganization).

  hentTilAttesteringFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const prosjekter = await ctx.prisma.project.findMany({
        where: {
          projectOrganizations: {
            some: { organizationId: input.organizationId },
          },
        },
        select: { id: true, name: true, projectNumber: true },
      });
      const prosjektIder = prosjekter.map((p) => p.id);
      if (prosjektIder.length === 0) return [];

      // T7-2b1: delvis-attesterte sedler beholder sheet.status="sent" inntil ALLE
      // rader er attestert — eksisterende filter dekker dem. Inkluderer maskiner
      // og rad-status så klient kan vise fremdrift (X av Y attestert).
      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          status: "sent",
          timer: { some: { projectId: { in: prosjektIder } } },
        },
        include: {
          aktivitet: { select: { id: true, navn: true, kode: true } },
          timer: true,
          tillegg: true,
          maskiner: true,
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Berik med ansatt-info (cross-package til kjernen-DB)
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));
      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true },
      });
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      const brukerMap = new Map(
        brukere.map((b) => [b.id, { ...b, ansattnummer: ansattnummerMap.get(b.id) ?? null }]),
      );
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      return sedler.map((s) => {
        const projectId = s.timer[0]?.projectId ?? null;
        return {
          ...s,
          ansatt: brukerMap.get(s.userId) ?? null,
          prosjekt: projectId ? (prosjektMap.get(projectId) ?? null) : null,
          totaltimer: s.timer.reduce((acc, t) => acc + Number(t.timer), 0),
          antallRader: s.timer.length + s.tillegg.length,
        };
      });
    }),

  // Sidebar-gating for firma-attesterings-fanen.
  kanAttestereFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await autoriserAdminForFirma(ctx.userId, input.organizationId);
        return { kanAttestere: true };
      } catch {
        return { kanAttestere: false };
      }
    }),

  // Hent én dagsseddel som prosjektleder (for attestering-detaljside).
  // Skiller seg fra hentMedId ved at den autoriserer på krevProsjektLeder
  // (ProjectMember.role="admin" eller kanAttestere=true) i stedet for
  // eierskap. Beriker med ansatt-info fra kjernen.
  hentForAttestering: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // T.1 (2026-05-11): Hent rader først for å få projectId (per rad-nivå).
      // Bruker første rad som proxy for autorisering (PR 2A — full per-rad-auth
      // kommer i senere PR per T.3).
      const [timer, tillegg, maskiner] = await Promise.all([
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
      ]);
      const projectId =
        timer[0]?.projectId ?? maskiner[0]?.projectId ?? tillegg[0]?.projectId;
      if (!projectId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Dagsseddel har ingen rader — kan ikke autorisere",
        });
      }
      // T7-2b1 (2026-05-14): prosjektleder-auth som primær, firma-admin-fallback
      // slik at firma-admin-detalj-siden også kan bruke samme query.
      try {
        await krevProsjektLeder(ctx.userId, projectId);
      } catch {
        await autoriserAdminForFirma(ctx.userId, sheet.organizationId);
      }

      const [aktivitet, prosjekt, brukerData, ansattMedlem] = await Promise.all([
        sheet.aktivitetId
          ? ctx.prismaTimer.aktivitet.findUnique({
              where: { id: sheet.aktivitetId },
            })
          : Promise.resolve(null),
        ctx.prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true },
        }),
        prisma.user.findUnique({
          where: { id: sheet.userId },
          select: { id: true, name: true, email: true },
        }),
        prisma.organizationMember.findUnique({
          where: {
            userId_organizationId: {
              userId: sheet.userId,
              organizationId: sheet.organizationId,
            },
          },
          select: { ansattnummer: true },
        }),
      ]);
      const ansatt = brukerData
        ? { ...brukerData, ansattnummer: ansattMedlem?.ansattnummer ?? null }
        : null;
      return { ...sheet, aktivitet, timer, tillegg, maskiner, prosjekt, ansatt };
    }),

  // Flytt ECO på en timer-rad (Steg 4a 2026-05-03). Lederen kan endre
  // kostnadsbærer (externalCostObjectId) på en innsendt sedel før attestering.
  // Kun ECO-feltet kan endres — øvrige felter (timer/lønnsart/aktivitet)
  // er ansattens domene og endres ved retur. Etter attestering låser
  // snapshot-pattern (A.7) verdien permanent.
  flyttTimerRadEco: protectedProcedure
    .input(
      z.object({
        timerRadId: z.string().uuid(),
        externalCostObjectId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rad = await ctx.prismaTimer.sheetTimer.findUnique({
        where: { id: input.timerRadId },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: rad.sheetId },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });

      // T.1 (2026-05-11): projectId ligger på rad — bruk rad.projectId
      // for auth og ECO-validering.
      await krevProsjektLeder(ctx.userId, rad.projectId);

      // Status-vakt: kun "sent" tillates. "returned" er hos ansatten,
      // "accepted" er låst av snapshot, "draft" har aldri vært innom leder.
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan kun flytte ECO på innsendte sedler (status: ${sheet.status})`,
        });
      }

      // ECO-validering hvis ikke null — finnes, samme firma+prosjekt,
      // status=aktiv, åpen for timer-registrering
      if (input.externalCostObjectId !== null) {
        const eco = await prisma.externalCostObject.findUnique({
          where: { id: input.externalCostObjectId },
        });
        if (!eco || eco.slettetVed !== null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Underprosjektet finnes ikke",
          });
        }
        if (eco.organizationId !== sheet.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Underprosjektet tilhører ikke firmaet",
          });
        }
        if (eco.projectId !== rad.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Underprosjektet tilhører ikke samme prosjekt",
          });
        }
        if (eco.status !== "aktiv" || !eco.timerregistreringApen) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Underprosjektet er ikke åpent for timer-registrering",
          });
        }
      }

      const fraEcoId = rad.externalCostObjectId;
      const oppdatert = await ctx.prismaTimer.sheetTimer.update({
        where: { id: input.timerRadId },
        data: { externalCostObjectId: input.externalCostObjectId },
      });

      // Activity-log (best-effort — ikke blokker ved skrivefeil)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId: sheet.organizationId,
            projectId: rad.projectId,
            targetType: "sheet_timer",
            targetId: input.timerRadId,
            action: "timer.eco-flyttet",
            payload: {
              sheetId: sheet.id,
              fraEcoId,
              tilEcoId: input.externalCostObjectId,
            },
          },
        });
      } catch {
        // Ikke-blokkerende — selve flyttingen er allerede committed.
      }

      return oppdatert;
    }),

  // ============================================================================
  //  T7-2b1 — Per-rad-attestering (2026-05-14)
  //
  //  attesterRader / returnerRader er primær-mutations. attester / returner
  //  beholdes som thin wrappers for bakoverkompatibilitet (eldre mobil-app
  //  fortsetter å fungere) — fjernes ~1 uke etter klient-migrering.
  //
  //  Per-rad-status lever på SheetTimer/SheetTillegg/SheetMachine.attestertStatus
  //  ("pending" | "attestert" | "returnert"). Sedel-status på DailySheet.status
  //  er fortsatt arbeider-flyt-status ("draft" | "sent" | "returned" | "accepted").
  //  Sedel går til "accepted" først når ALLE rader er "attestert".
  // ============================================================================

  attesterRader: protectedProcedure
    .input(
      z.object({
        radIder: z.object({
          timerIder: z.array(z.string().uuid()).default([]),
          tilleggIder: z.array(z.string().uuid()).default([]),
          maskinIder: z.array(z.string().uuid()).default([]),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { timerIder, tilleggIder, maskinIder } = input.radIder;
      if (timerIder.length + tilleggIder.length + maskinIder.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingen rader valgt for attestering",
        });
      }

      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { id: { in: timerIder } },
          include: { lonnsart: true, aktivitet: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { id: { in: tilleggIder } },
          include: { tillegg: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { id: { in: maskinIder } },
        }),
      ]);

      if (
        timerRader.length !== timerIder.length ||
        tilleggRader.length !== tilleggIder.length ||
        maskinRader.length !== maskinIder.length
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Én eller flere rader finnes ikke",
        });
      }

      const alle = [
        ...timerRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
        ...tilleggRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
        ...maskinRader.map((r) => ({ sheetId: r.sheetId, projectId: r.projectId, attestertStatus: r.attestertStatus })),
      ];

      if (alle.some((r) => r.attestertStatus !== "pending")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun rader med status «pending» kan attesteres",
        });
      }

      // Auth: én sjekk per unike projectId
      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();
      const uniqueSheetIds = Array.from(new Set(alle.map((r) => r.sheetId)));

      // Bygg snapshot-operasjoner per rad (Fase 0 A.7)
      const operations = [
        ...timerRader.map((rad) =>
          ctx.prismaTimer.sheetTimer.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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
        ...maskinRader.map((rad) =>
          ctx.prismaTimer.sheetMachine.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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
      ];

      await ctx.prismaTimer.$transaction(operations);

      // Post-transaction: marker sedler som "accepted" hvis alle rader er attestert
      for (const sheetId of uniqueSheetIds) {
        const [pendingT, pendingTL, pendingM] = await Promise.all([
          ctx.prismaTimer.sheetTimer.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
          ctx.prismaTimer.sheetTillegg.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
          ctx.prismaTimer.sheetMachine.count({
            where: { sheetId, attestertStatus: { not: "attestert" } },
          }),
        ]);
        if (pendingT + pendingTL + pendingM === 0) {
          await ctx.prismaTimer.dailySheet.update({
            where: { id: sheetId },
            data: {
              status: "accepted",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
            },
          });
        }
      }

      return { antallAttestert: alle.length, ferdigeSedler: uniqueSheetIds };
    }),

  returnerRader: protectedProcedure
    .input(
      z.object({
        radIder: z.object({
          timerIder: z.array(z.string().uuid()).default([]),
          tilleggIder: z.array(z.string().uuid()).default([]),
          maskinIder: z.array(z.string().uuid()).default([]),
        }),
        kommentar: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { timerIder, tilleggIder, maskinIder } = input.radIder;
      if (timerIder.length + tilleggIder.length + maskinIder.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ingen rader valgt for retur",
        });
      }

      const [timerRader, tilleggRader, maskinRader] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { id: { in: timerIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { id: { in: tilleggIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { id: { in: maskinIder } },
          select: { id: true, sheetId: true, projectId: true, attestertStatus: true },
        }),
      ]);

      if (
        timerRader.length !== timerIder.length ||
        tilleggRader.length !== tilleggIder.length ||
        maskinRader.length !== maskinIder.length
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Én eller flere rader finnes ikke",
        });
      }

      const alle = [...timerRader, ...tilleggRader, ...maskinRader];
      if (alle.some((r) => r.attestertStatus !== "pending")) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Kun rader med status «pending» kan returneres",
        });
      }

      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();
      const uniqueSheetIds = Array.from(new Set(alle.map((r) => r.sheetId)));

      await ctx.prismaTimer.$transaction([
        ctx.prismaTimer.sheetTimer.updateMany({
          where: { id: { in: timerIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        ctx.prismaTimer.sheetTillegg.updateMany({
          where: { id: { in: tilleggIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        ctx.prismaTimer.sheetMachine.updateMany({
          where: { id: { in: maskinIder } },
          data: {
            attestertStatus: "returnert",
            attestertAvUserId: ctx.userId,
            attestertVed: naa,
          },
        }),
        // En returnert rad = sedelen må tilbake til arbeider for rettelse.
        // Pending-rader på samme sedel forblir pending — håndteres ved
        // re-attestering etter at arbeider sender på nytt.
        ctx.prismaTimer.dailySheet.updateMany({
          where: { id: { in: uniqueSheetIds } },
          data: {
            status: "returned",
            lederKommentar: input.kommentar.trim(),
          },
        }),
      ]);

      return { antallReturnert: alle.length, returnerSedler: uniqueSheetIds };
    }),

  // @deprecated Thin wrapper — kaller attesterRader for alle pending-rader på sedelen.
  // Beholdes for bakoverkompatibilitet (mobil-app pre-T7-2b1). Fjernes 1 uke etter
  // at klient-migrering er deployet til prod.
  attester: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sheet = await ctx.prismaTimer.dailySheet.findUnique({
        where: { id: input.id },
        select: { status: true },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan attesteres (status: ${sheet.status})`,
        });
      }

      const [timer, tillegg, maskin] = await Promise.all([
        ctx.prismaTimer.sheetTimer.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
        ctx.prismaTimer.sheetTillegg.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
        ctx.prismaTimer.sheetMachine.findMany({
          where: { sheetId: input.id, attestertStatus: "pending" },
          select: { id: true },
        }),
      ]);

      // Delegér til ny mutation-logikk via direkte funksjonskall ville krevd
      // ekstrahert helper; for å holde diff'en mindre, gjentar vi minimal
      // valideringslogikk her — autorisering og snapshot gjøres samme måte
      // som attesterRader.
      const timerRader = await ctx.prismaTimer.sheetTimer.findMany({
        where: { id: { in: timer.map((r) => r.id) } },
        include: { lonnsart: true, aktivitet: true },
      });
      const tilleggRader = await ctx.prismaTimer.sheetTillegg.findMany({
        where: { id: { in: tillegg.map((r) => r.id) } },
        include: { tillegg: true },
      });
      const maskinRader = await ctx.prismaTimer.sheetMachine.findMany({
        where: { id: { in: maskin.map((r) => r.id) } },
      });

      const alle = [...timerRader, ...tilleggRader, ...maskinRader];
      if (alle.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Ingen rader å attestere på sedelen",
        });
      }

      const uniqueProjectIds = Array.from(new Set(alle.map((r) => r.projectId)));
      await Promise.all(uniqueProjectIds.map((pid) => krevProsjektLeder(ctx.userId, pid)));

      const naa = new Date();

      await ctx.prismaTimer.$transaction([
        ...timerRader.map((rad) =>
          ctx.prismaTimer.sheetTimer.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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
        ...maskinRader.map((rad) =>
          ctx.prismaTimer.sheetMachine.update({
            where: { id: rad.id },
            data: {
              attestertStatus: "attestert",
              attestertAvUserId: ctx.userId,
              attestertVed: naa,
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

  // @deprecated Thin wrapper — kaller returnerRader for alle pending-rader.
  // Fjernes 1 uke etter klient-migrering.
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
        include: { timer: { take: 1, select: { projectId: true } } },
      });
      if (!sheet) throw new TRPCError({ code: "NOT_FOUND" });
      if (sheet.status !== "sent") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kun innsendte dagssedler kan returneres (status: ${sheet.status})`,
        });
      }
      const projectId = sheet.timer[0]?.projectId;
      if (!projectId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Dagsseddel har ingen rader — kan ikke autorisere",
        });
      }
      await krevProsjektLeder(ctx.userId, projectId);

      return ctx.prismaTimer.dailySheet.update({
        where: { id: input.id },
        data: {
          status: "returned",
          lederKommentar: input.kommentar.trim(),
        },
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
      const orgId = await krevBrukersOrg(ctx.userId);
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
          // T.1 (2026-05-11): projectId på rad-nivå — proxy via første rad.
          projectId: s.timer[0]?.projectId ?? s.maskiner[0]?.projectId ?? null,
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
      const orgId = await krevBrukersOrg(ctx.userId);
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
          // T.1 (2026-05-11): projectId/byggeplassId lagres på rad-nivå.
          // Mobil sender fortsatt lokal.projectId på sedel-nivå inntil mobil-PR
          // er ute — vi propagerer den til alle rader her.
          const oppdatert = await ctx.prismaTimer.$transaction(async (tx) => {
            const sedel = await tx.dailySheet.upsert({
              where: { clientUuid: lokal.clientUuid },
              create: {
                clientUuid: lokal.clientUuid,
                organizationId: orgId,
                userId: ctx.userId,
                registrertAvUserId: ctx.userId,
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
                  projectId: lokal.projectId,
                  byggeplassId: lokal.byggeplassId ?? null,
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
                  projectId: lokal.projectId,
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
                  projectId: lokal.projectId,
                  byggeplassId: lokal.byggeplassId ?? null,
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
          projectId: z.string().uuid(),
          byggeplassId: z.string().uuid().nullable().optional(),
          vehicleId: z.string().uuid(),
          timer: z.number().min(0).max(24),
          mengde: z.number().min(0).nullable().optional(),
          enhet: z.string().max(20).nullable().optional(),
          fraTid: z.string().nullable().optional(),
          tilTid: z.string().nullable().optional(),
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
            projectId: input.projectId,
            byggeplassId: input.byggeplassId ?? null,
            vehicleId: input.vehicleId,
            timer: input.timer,
            mengde: input.mengde ?? null,
            enhet: input.enhet ?? null,
            fraTid: input.fraTid ?? null,
            tilTid: input.tilTid ?? null,
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
      const orgId = await krevBrukersOrg(ctx.userId);
      const userId = input.userId ?? ctx.userId;

      // Hvis bruker ber om noen andres dagstotal: krev admin
      if (userId !== ctx.userId) {
        const bruker = await prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true },
        });
        let tillatt = bruker.role === "sitedoc_admin";
        if (!tillatt) {
          const member = await prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId: ctx.userId, organizationId: orgId } },
            select: { firmaRoller: true },
          });
          tillatt = member?.firmaRoller.includes("firma_admin") ?? false;
        }
        if (!tillatt) {
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

      // T.1 (2026-05-11): projectId ligger på rad. Aggregér per (sheetId, projectId)
      // for å beholde dagens UI-kontrakt («Du har ført Xt på N prosjekter»).
      type SheetProsjektRad = {
        sheetId: string;
        projectId: string;
        status: string;
        timer: number;
      };
      const radPerProsjekt = new Map<string, SheetProsjektRad>();
      for (const s of sedler) {
        for (const t of s.timer) {
          const noekkel = `${s.id}|${t.projectId}`;
          const eksisterende = radPerProsjekt.get(noekkel);
          if (eksisterende) {
            eksisterende.timer += Number(t.timer);
          } else {
            radPerProsjekt.set(noekkel, {
              sheetId: s.id,
              projectId: t.projectId,
              status: s.status,
              timer: Number(t.timer),
            });
          }
        }
      }
      const projektIder = Array.from(
        new Set(Array.from(radPerProsjekt.values()).map((r) => r.projectId)),
      );
      const prosjekter =
        projektIder.length === 0
          ? []
          : await prisma.project.findMany({
              where: { id: { in: projektIder } },
              select: { id: true, name: true, projectNumber: true },
            });
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      const perProsjekt = Array.from(radPerProsjekt.values()).map((r) => ({
        sheetId: r.sheetId,
        projectId: r.projectId,
        projectNavn: prosjektMap.get(r.projectId)?.name ?? null,
        projectNummer: prosjektMap.get(r.projectId)?.projectNumber ?? null,
        status: r.status,
        timer: r.timer,
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
