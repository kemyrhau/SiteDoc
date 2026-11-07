import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import type { Context } from "../trpc/context";
import {
  verifiserProsjektmedlem,
  aktivtProsjektmedlemWhere,
  aktivtMedlemWhere,
  verifiserOrganisasjonTilgang,
  erFirmaAdmin,
} from "../trpc/tilgangskontroll";
import { verifiserByggeplassIProsjekt } from "../services/tegningVakt";
import {
  krevVarelagerAktivert,
  erVarelagerAktivert,
  VarelagerModulIkkeAktivertError,
} from "../services/varelager/moduleGate";

/** Statuser der sedelens eier selv kan endre vareforbruket på den. */
const SEDEL_AAPEN_FOR_EIER = ["draft", "returned"];

/**
 * ORDRE 33: vareforbruk på en dagsseddel følger sedelen. Eieren kan endre mens
 * sedelen er åpen (utkast/returnert); ellers kreves sitedoc_admin, prosjektadmin
 * eller firma_admin i SEDELENS firma (ikke prosjektets — UE-sedler på HE-prosjekt).
 * Meldingen er en i18n-nøkkel som klienten oversetter.
 */
async function krevVareforbrukPaaSedel(
  userId: string,
  sheet: { userId: string; status: string; organizationId: string },
  projectId: string,
): Promise<void> {
  if (sheet.userId === userId && SEDEL_AAPEN_FOR_EIER.includes(sheet.status)) return;
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role === "sitedoc_admin") return;
  const medlem = await prisma.projectMember.findFirst({
    where: aktivtProsjektmedlemWhere(userId, projectId),
    select: { role: true },
  });
  if (medlem?.role === "admin") return;
  if (await erFirmaAdmin(userId, sheet.organizationId)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: sheet.userId === userId ? "vareforbruk.feil.sedelSendt" : "vareforbruk.feil.annensSedel",
  });
}

/** Sedel-vakten for en eksisterende linje. Linje uten (eller med forsvunnet) sedel er uberørt. */
async function krevVareforbrukLinjeAapen(
  prismaTimer: Context["prismaTimer"],
  userId: string,
  dagsseddelId: string | null,
  projectId: string,
): Promise<void> {
  if (!dagsseddelId) return;
  const sheet = await prismaTimer.dailySheet.findUnique({
    where: { id: dagsseddelId },
    select: { userId: true, status: true, organizationId: true },
  });
  if (sheet) await krevVareforbrukPaaSedel(userId, sheet, projectId);
}

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

  const medlem = await prisma.projectMember.findFirst({
    where: aktivtProsjektmedlemWhere(userId, projectId),
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
  // Prosjektkort L3 (2026-11-06, Kenneth godkjente forslag A): vare-velgeren på
  // prosjektkortet (web + mobil-cache). `vare.list` krever firmaadmin, så en
  // arbeider trenger en egen, smal lese-rute. KUN fire felt pr. vare — ingen
  // priser eller admin-felt. `prosjektIderMedVarelager` = brukerens aktive
  // prosjekter i firmaet der modulen er på (samme resolver som API-porten),
  // så mobil kan skjule «+ Vareforbruk» offline.
  katalogForFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);
      if (!(await erVarelagerAktivert(input.organizationId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Varelager-modulen er ikke aktivert for dette firmaet",
        });
      }

      const [varer, prosjekter] = await Promise.all([
        ctx.prismaVarelager.vare.findMany({
          where: { organizationId: input.organizationId, aktiv: true },
          select: { id: true, navn: true, enhet: true, varenummer: true },
          orderBy: [{ navn: "asc" }],
        }),
        prisma.project.findMany({
          where: {
            primaryOrganizationId: input.organizationId,
            members: { some: { userId: ctx.userId, ...aktivtMedlemWhere } },
          },
          select: { id: true },
        }),
      ]);

      const aktive = await Promise.all(
        prosjekter.map(async (p) =>
          (await erVarelagerAktivert(input.organizationId, p.id)) ? p.id : null,
        ),
      );

      return {
        varer: varer.map((v) => ({
          id: v.id,
          navn: v.navn,
          enhet: v.enhet,
          varenummer: v.varenummer,
        })),
        prosjektIderMedVarelager: aktive.filter((id): id is string => id !== null),
      };
    }),

  // Prosjektkort L1 (2026-11-05): innlogget brukers eget vareforbruk for én
  // dato på tvers av firmaets prosjekter — Varer-kolonnen på prosjektkortet.
  // Firma-isolert (kun prosjekter med primaryOrganizationId = firmaet) og
  // bruker-isolert (registrertAvUserId = ctx.userId). Kun lesing.
  hentMineForDato: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Forventet YYYY-MM-DD"),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);

      const prosjekter = await prisma.project.findMany({
        where: { primaryOrganizationId: input.organizationId },
        select: { id: true },
      });
      if (prosjekter.length === 0) return [];

      const rader = await ctx.prismaVarelager.vareforbruk.findMany({
        where: {
          registrertAvUserId: ctx.userId,
          dato: new Date(input.dato),
          projectId: { in: prosjekter.map((p) => p.id) },
        },
        select: {
          id: true,
          projectId: true,
          byggeplassId: true,
          dagsseddelId: true,
          antall: true,
          vare: { select: { id: true, navn: true, enhet: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      return rader.map((r) => ({ ...r, antall: Number(r.antall) }));
    }),

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
        // Prosjektkort L3: valgfri klient-generert id for idempotent mobil-synk.
        // Samme id sendt på nytt → den eksisterende raden returneres, ingen ny.
        id: z.string().uuid().optional(),
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
      const userId = ctx.userId;

      // Idempotens (L3): en mobil-synk som sender samme id to ganger (svar tapt
      // på nett) skal gi én linje. Kun egen rad returneres; en fremmed rad med
      // samme id avvises.
      const hentEksisterende = async () => {
        if (!input.id) return null;
        const rad = await ctx.prismaVarelager.vareforbruk.findUnique({
          where: { id: input.id },
        });
        if (rad && rad.registrertAvUserId !== userId) {
          throw new TRPCError({ code: "CONFLICT", message: "Id-en er i bruk" });
        }
        return rad;
      };
      const eksisterende = await hentEksisterende();
      if (eksisterende) return eksisterende;

      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // ORDRE 29 #14: byggeplassen (hoved-DB) MÅ tilhøre prosjektet.
      if (input.byggeplassId) {
        await verifiserByggeplassIProsjekt(ctx.prisma, input.byggeplassId, input.projectId);
      }
      const organizationId = await krevVarelagerForProsjekt(input.projectId);
      await krevTilgangPolicy(ctx.userId, organizationId, input.projectId);

      await validerVareTilhoererFirma(input.vareId, organizationId, ctx.prismaVarelager);

      if (input.externalCostObjectId) {
        await validerEco(input.externalCostObjectId, organizationId, input.projectId);
      }

      if (input.dagsseddelId) {
        // T.1 (2026-05-11): DailySheet har ikke lenger projectId. Sjekk i stedet
        // at sedelen tilhører eier-bruker og at minst én rad på sedelen er for
        // samme prosjekt (eller at sedel finnes — Vareforbruk har egen projectId
        // som primær prosjekt-referanse).
        const sheet = await ctx.prismaTimer.dailySheet.findUnique({
          where: { id: input.dagsseddelId },
          select: {
            userId: true,
            status: true,
            organizationId: true,
            timer: { where: { projectId: input.projectId }, select: { id: true }, take: 1 },
          },
        });
        if (!sheet) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dagsseddelen finnes ikke",
          });
        }
        if (sheet.timer.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dagsseddelen har ingen timer-rader for dette prosjektet",
          });
        }
        await krevVareforbrukPaaSedel(userId, sheet, input.projectId);
      }

      let opprettet;
      try {
        opprettet = await ctx.prismaVarelager.vareforbruk.create({
          data: {
            ...(input.id ? { id: input.id } : {}),
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
      } catch (e) {
        // To samtidige sendinger med samme id: den andre treffer PK-en (P2002)
        // → returner raden den første skrev.
        const rad = (e as { code?: string }).code === "P2002" ? await hentEksisterende() : null;
        if (!rad) throw e;
        return rad;
      }

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
          dagsseddelId: true,
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
      await krevVareforbrukLinjeAapen(ctx.prismaTimer, ctx.userId, rad.dagsseddelId, rad.projectId);
      // ORDRE 29 #14: ny byggeplass MÅ tilhøre radens prosjekt. `null` = fjern, ingen sjekk.
      if (input.byggeplassId) {
        await verifiserByggeplassIProsjekt(ctx.prisma, input.byggeplassId, rad.projectId);
      }
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
          dagsseddelId: true,
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
      await krevVareforbrukLinjeAapen(ctx.prismaTimer, ctx.userId, rad.dagsseddelId, rad.projectId);
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
