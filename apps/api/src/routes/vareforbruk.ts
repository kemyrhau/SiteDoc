import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import {
  krevVarelagerAktivert,
  VarelagerModulIkkeAktivertError,
} from "../services/varelager/moduleGate";

/**
 * Hent prosjektets eier-firma + sjekk at modulen er aktiv på prosjekt-nivå.
 * Returnerer organizationId for videre validering.
 */
async function krevVarelagerForProsjekt(projectId: string): Promise<string> {
  const prosjekt = await prisma.project.findUnique({
    where: { id: projectId },
    select: { primaryOrganizationId: true },
  });
  if (!prosjekt || !prosjekt.primaryOrganizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Prosjektet har ikke et eier-firma satt",
    });
  }
  try {
    await krevVarelagerAktivert(prosjekt.primaryOrganizationId, projectId);
  } catch (e) {
    if (e instanceof VarelagerModulIkkeAktivertError) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Varelager-modulen er ikke aktivert for dette prosjektet",
      });
    }
    throw e;
  }
  return prosjekt.primaryOrganizationId;
}

/**
 * Tilgang-policy: håndhev OrganizationSetting.vareforbrukTilgangDefault.
 *
 *   - alle-ansatte         → kun harProsjektTilgang (verifiserProsjektmedlem
 *                            håndterer dette + company_admin-fallback).
 *   - kun-prosjektmedlemmer → krever ekte ProjectMember-rad (ikke kun
 *                              company_admin-bypass).
 *   - sertifiserte         → fallback til kun-prosjektmedlemmer (Kompetanse-
 *                              sjekk utsettes til Kompetansetype får
 *                              «kreves for vareregistrering»-flagg).
 */
async function krevTilgangPolicy(
  userId: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId },
    select: { vareforbrukTilgangDefault: true },
  });
  const policy = setting?.vareforbrukTilgangDefault ?? "alle-ansatte";

  if (policy === "alle-ansatte") {
    await verifiserProsjektmedlem(userId, projectId);
    return;
  }

  // kun-prosjektmedlemmer eller sertifiserte (sertifiserte = fallback til
  // kun-prosjektmedlemmer i Sesjon 2). Bruker må ha ekte ProjectMember-rad.
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { id: true },
  });
  if (!medlem) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bare prosjektmedlemmer kan registrere vareforbruk",
    });
  }
}

async function validerEco(
  externalCostObjectId: string,
  organizationId: string,
  projectId: string,
): Promise<void> {
  const eco = await prisma.externalCostObject.findUnique({
    where: { id: externalCostObjectId },
  });
  if (!eco || eco.slettetVed !== null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Underprosjektet finnes ikke",
    });
  }
  if (eco.organizationId !== organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Underprosjektet tilhører ikke firmaet",
    });
  }
  if (eco.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Underprosjektet tilhører ikke samme prosjekt",
    });
  }
  if (eco.status !== "aktiv" || !eco.timerregistreringApen) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Underprosjektet er ikke åpent for registrering",
    });
  }
}

async function validerVareTilhoererFirma(
  vareId: string,
  organizationId: string,
  prismaVarelager: typeof import("@sitedoc/db-varelager").prismaVarelager,
): Promise<void> {
  const vare = await prismaVarelager.vare.findUnique({
    where: { id: vareId },
    select: { organizationId: true, aktiv: true },
  });
  if (!vare || vare.organizationId !== organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Varen tilhører ikke dette firmaet",
    });
  }
  if (!vare.aktiv) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Varen er deaktivert",
    });
  }
}

export const vareforbrukRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        fra: z.string().optional(),
        til: z.string().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        dagsseddelId: z.string().uuid().nullable().optional(),
        vareId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevVarelagerForProsjekt(input.projectId);

      const where: {
        projectId: string;
        dato?: { gte?: Date; lte?: Date };
        byggeplassId?: string | null;
        dagsseddelId?: string | null;
        vareId?: string;
      } = { projectId: input.projectId };

      if (input.fra || input.til) {
        where.dato = {};
        if (input.fra) where.dato.gte = new Date(input.fra);
        if (input.til) where.dato.lte = new Date(input.til);
      }
      if (input.byggeplassId !== undefined) where.byggeplassId = input.byggeplassId;
      if (input.dagsseddelId !== undefined) where.dagsseddelId = input.dagsseddelId;
      if (input.vareId) where.vareId = input.vareId;

      const rader = await ctx.prismaVarelager.vareforbruk.findMany({
        where,
        include: {
          vare: {
            select: { id: true, navn: true, varenummer: true, enhet: true, kategoriId: true },
          },
        },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
      });

      // Berik med registrert-av brukernavn (svak FK, ikke Prisma-relasjon)
      const userIds = Array.from(new Set(rader.map((r) => r.registrertAvUserId)));
      const brukere = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const brukerMap = new Map(brukere.map((b) => [b.id, b]));

      return rader.map((r) => ({
        ...r,
        registrertAv: brukerMap.get(r.registrertAvUserId) ?? null,
        erLast: r.attestertSnapshot !== null,
      }));
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        include: { vare: true },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });

      await verifiserProsjektmedlem(ctx.userId, rad.projectId);
      await krevVarelagerForProsjekt(rad.projectId);

      const bruker = await prisma.user.findUnique({
        where: { id: rad.registrertAvUserId },
        select: { id: true, name: true, email: true },
      });

      return { ...rad, registrertAv: bruker, erLast: rad.attestertSnapshot !== null };
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        dato: z.string(),
        vareId: z.string().uuid(),
        antall: z.number().positive(),
        byggeplassId: z.string().uuid().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        kommentar: z.string().max(2000).nullable().optional(),
        dagsseddelId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const organizationId = await krevVarelagerForProsjekt(input.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, input.projectId);

      await validerVareTilhoererFirma(input.vareId, organizationId, ctx.prismaVarelager);

      if (input.externalCostObjectId) {
        await validerEco(input.externalCostObjectId, organizationId, input.projectId);
      }

      if (input.dagsseddelId) {
        const sheet = await ctx.prismaTimer.dailySheet.findUnique({
          where: { id: input.dagsseddelId },
          select: { userId: true, projectId: true },
        });
        if (!sheet || sheet.projectId !== input.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dagsseddelen tilhører ikke samme prosjekt",
          });
        }
      }

      const opprettet = await ctx.prismaVarelager.vareforbruk.create({
        data: {
          projectId: input.projectId,
          dato: new Date(input.dato),
          vareId: input.vareId,
          antall: input.antall,
          byggeplassId: input.byggeplassId ?? null,
          externalCostObjectId: input.externalCostObjectId ?? null,
          kommentar: input.kommentar?.trim() || null,
          dagsseddelId: input.dagsseddelId ?? null,
          registrertAvUserId: ctx.userId,
        },
      });

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: input.projectId,
            targetType: "vareforbruk",
            targetId: opprettet.id,
            action: "vare.registrert",
            payload: {
              vareId: input.vareId,
              antall: input.antall,
              dagsseddelId: input.dagsseddelId ?? null,
            },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return opprettet;
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        dato: z.string().optional(),
        antall: z.number().positive().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        externalCostObjectId: z.string().uuid().nullable().optional(),
        kommentar: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        select: {
          projectId: true,
          attestertSnapshot: true,
        },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      if (rad.attestertSnapshot !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vareforbruket er attestert og kan ikke endres",
        });
      }

      await verifiserProsjektmedlem(ctx.userId, rad.projectId);
      const organizationId = await krevVarelagerForProsjekt(rad.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, rad.projectId);

      if (input.externalCostObjectId) {
        await validerEco(input.externalCostObjectId, organizationId, rad.projectId);
      }

      const { id, dato, antall, byggeplassId, externalCostObjectId, kommentar } = input;
      const oppdatert = await ctx.prismaVarelager.vareforbruk.update({
        where: { id },
        data: {
          ...(dato !== undefined ? { dato: new Date(dato) } : {}),
          ...(antall !== undefined ? { antall } : {}),
          ...(byggeplassId !== undefined ? { byggeplassId } : {}),
          ...(externalCostObjectId !== undefined ? { externalCostObjectId } : {}),
          ...(kommentar !== undefined ? { kommentar: kommentar?.trim() || null } : {}),
        },
      });

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: rad.projectId,
            targetType: "vareforbruk",
            targetId: id,
            action: "vare.endret",
            payload: { antall: oppdatert.antall.toString() },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return oppdatert;
    }),

  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
        where: { id: input.id },
        select: {
          projectId: true,
          vareId: true,
          attestertSnapshot: true,
        },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      if (rad.attestertSnapshot !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Vareforbruket er attestert og kan ikke slettes",
        });
      }

      await verifiserProsjektmedlem(ctx.userId, rad.projectId);
      const organizationId = await krevVarelagerForProsjekt(rad.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, rad.projectId);

      await ctx.prismaVarelager.vareforbruk.delete({ where: { id: input.id } });

      // Activity-log (best-effort)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId,
            projectId: rad.projectId,
            targetType: "vareforbruk",
            targetId: input.id,
            action: "vare.slettet",
            payload: { vareId: rad.vareId },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      return { ok: true };
    }),
});
