import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

// Felles includes for kontrollplan-spørringer
const punktIncludes = {
  sjekklisteMal: { select: { id: true, name: true, prefix: true, kontrollomrade: true } },
  faggruppe: { select: { id: true, name: true, color: true } },
  omrade: { select: { id: true, navn: true, type: true } },
  sjekkliste: { select: { id: true, status: true } },
  avhengerAv: { select: { id: true, status: true, sjekklisteMal: { select: { name: true } }, omrade: { select: { navn: true } } } },
} as const;

export const kontrollplanRouter = router({
  // Hent kontrollplan for en byggeplass (med punkter og milepeler)
  hentForByggeplass: protectedProcedure
    .input(z.object({ byggeplassId: z.string() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.kontrollplan.findUnique({
        where: { projectId_byggeplassId: { projectId: byggeplass.projectId, byggeplassId: input.byggeplassId } },
        include: {
          punkter: {
            include: punktIncludes,
            orderBy: { opprettet: "asc" },
          },
          milepeler: { orderBy: { sortering: "asc" } },
        },
      });
    }),

  // Opprett eller hent kontrollplan for byggeplass
  opprettEllerHent: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      byggeplassId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { name: true },
      });
      return ctx.prisma.kontrollplan.upsert({
        where: { projectId_byggeplassId: { projectId: input.projectId, byggeplassId: input.byggeplassId } },
        create: {
          projectId: input.projectId,
          byggeplassId: input.byggeplassId,
          navn: `Kontrollplan — ${byggeplass.name}`,
        },
        update: {},
        include: {
          punkter: {
            include: punktIncludes,
            orderBy: { opprettet: "asc" },
          },
          milepeler: { orderBy: { sortering: "asc" } },
        },
      });
    }),

  // Bulk-opprett punkter (flervalg av områder med individuelle frister)
  opprettPunkter: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      sjekklisteMalId: z.string().uuid(),
      faggruppeId: z.string().uuid(),
      milepelId: z.string().nullish(),
      punkter: z.array(z.object({
        omradeId: z.string().nullish(),
        fristUke: z.number().int().min(1).max(53).nullish(),
        fristAar: z.number().int().min(2024).max(2100).nullish(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const opprettet = await ctx.prisma.$transaction(
        input.punkter.map((p) =>
          ctx.prisma.kontrollplanPunkt.create({
            data: {
              kontrollplanId: input.kontrollplanId,
              sjekklisteMalId: input.sjekklisteMalId,
              faggruppeId: input.faggruppeId,
              milepelId: input.milepelId ?? undefined,
              omradeId: p.omradeId ?? undefined,
              fristUke: p.fristUke ?? undefined,
              fristAar: p.fristAar ?? undefined,
            },
            include: punktIncludes,
          })
        )
      );

      // Logg historikk for alle punkter
      await ctx.prisma.kontrollplanHistorikk.createMany({
        data: opprettet.map((punkt) => ({
          punktId: punkt.id,
          brukerId: ctx.userId,
          handling: "opprettet",
        })),
      });

      return opprettet;
    }),

  // Oppdater et punkt (frist, faggruppe, status, milepæl, avhengighet)
  oppdaterPunkt: protectedProcedure
    .input(z.object({
      punktId: z.string(),
      sjekklisteMalId: z.string().uuid().optional(),
      faggruppeId: z.string().uuid().optional(),
      fristUke: z.number().int().min(1).max(53).nullish(),
      fristAar: z.number().int().min(2024).max(2100).nullish(),
      status: z.enum(["planlagt", "pagar", "utfort", "godkjent"]).optional(),
      milepelId: z.string().nullable().optional(),
      avhengerAvId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);

      // Valider statusovergang
      if (input.status) {
        const gyldige: Record<string, string[]> = {
          planlagt: ["pagar"],
          pagar: ["utfort", "planlagt"],
          utfort: ["godkjent", "pagar"],
          godkjent: [],
        };
        if (!gyldige[punkt.status]?.includes(input.status)) {
          throw new Error(`Ugyldig statusovergang: ${punkt.status} → ${input.status}`);
        }
      }

      const { punktId, status, ...data } = input;
      const oppdatert = await ctx.prisma.kontrollplanPunkt.update({
        where: { id: punktId },
        data: {
          ...data,
          ...(status ? { status } : {}),
          ...(data.milepelId === null ? { milepelId: null } : {}),
          ...(data.avhengerAvId === null ? { avhengerAvId: null } : {}),
        },
        include: punktIncludes,
      });

      // Logg historikk
      const handling = status
        ? status === "pagar" ? "startet" : status === "utfort" ? "utfort" : status === "godkjent" ? "godkjent" : "endret"
        : "endret";
      await ctx.prisma.kontrollplanHistorikk.create({
        data: {
          punktId,
          brukerId: ctx.userId,
          handling,
        },
      });

      return oppdatert;
    }),

  // Slett punkt (kun planlagt)
  slettPunkt: protectedProcedure
    .input(z.object({ punktId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      if (punkt.status !== "planlagt") {
        throw new Error("Kun planlagte punkter kan slettes");
      }
      return ctx.prisma.kontrollplanPunkt.delete({ where: { id: input.punktId } });
    }),

  // Opprett milepæl
  opprettMilepel: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      navn: z.string().min(1),
      maalUke: z.number().int().min(1).max(53),
      maalAar: z.number().int().min(2024).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);
      const maks = await ctx.prisma.milepel.aggregate({
        where: { kontrollplanId: input.kontrollplanId },
        _max: { sortering: true },
      });
      return ctx.prisma.milepel.create({
        data: {
          ...input,
          sortering: (maks._max.sortering ?? 0) + 1,
        },
      });
    }),

  // Oppdater milepæl
  oppdaterMilepel: protectedProcedure
    .input(z.object({
      milepelId: z.string(),
      navn: z.string().min(1).optional(),
      maalUke: z.number().int().min(1).max(53).optional(),
      maalAar: z.number().int().min(2024).max(2100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const milepel = await ctx.prisma.milepel.findUniqueOrThrow({
        where: { id: input.milepelId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, milepel.kontrollplan.projectId);
      const { milepelId, ...data } = input;
      return ctx.prisma.milepel.update({ where: { id: milepelId }, data });
    }),

  // Slett milepæl (kun hvis ingen punkter tilknyttet)
  slettMilepel: protectedProcedure
    .input(z.object({ milepelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const milepel = await ctx.prisma.milepel.findUniqueOrThrow({
        where: { id: input.milepelId },
        include: {
          kontrollplan: { select: { projectId: true } },
          _count: { select: { punkter: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, milepel.kontrollplan.projectId);
      if (milepel._count.punkter > 0) {
        throw new Error("Kan ikke slette milepæl med tilknyttede punkter");
      }
      return ctx.prisma.milepel.delete({ where: { id: input.milepelId } });
    }),

  // Oppdater kontrollplan-status (livssyklus)
  oppdaterStatus: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      status: z.enum(["utkast", "aktiv", "godkjent", "arkivert"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true, status: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const gyldige: Record<string, string[]> = {
        utkast: ["aktiv"],
        aktiv: ["godkjent"],
        godkjent: ["arkivert"],
        arkivert: [],
      };
      if (!gyldige[kontrollplan.status]?.includes(input.status)) {
        throw new Error(`Ugyldig statusovergang: ${kontrollplan.status} → ${input.status}`);
      }

      return ctx.prisma.kontrollplan.update({
        where: { id: input.kontrollplanId },
        data: {
          status: input.status,
          ...(input.status === "godkjent" ? { godkjentDato: new Date(), godkjentAvId: ctx.userId } : {}),
        },
      });
    }),

  // Skyv frister for et område +/- N uker
  skyvOmrade: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      omradeId: z.string(),
      antallUker: z.number().int(), // positiv = fremover, negativ = bakover
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      // Hent alle punkter for dette området i denne kontrollplanen
      const punkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: input.kontrollplanId, omradeId: input.omradeId },
      });

      // Skyv frist kun for planlagte og pågående punkter (ikke utført/godkjent)
      const oppdateringer = punkter
        .filter((p) => p.fristUke !== null && p.fristAar !== null && (p.status === "planlagt" || p.status === "pagar"))
        .map((p) => {
          let nyUke = (p.fristUke ?? 0) + input.antallUker;
          let nyAar = p.fristAar ?? new Date().getFullYear();
          // Håndter uke-overflyt
          while (nyUke > 52) { nyUke -= 52; nyAar++; }
          while (nyUke < 1) { nyUke += 52; nyAar--; }
          return ctx.prisma.kontrollplanPunkt.update({
            where: { id: p.id },
            data: { fristUke: nyUke, fristAar: nyAar },
          });
        });

      await ctx.prisma.$transaction(oppdateringer);

      // Logg historikk
      await ctx.prisma.kontrollplanHistorikk.createMany({
        data: punkter.map((p) => ({
          punktId: p.id,
          brukerId: ctx.userId,
          handling: "endret",
          kommentar: `Frist forskjøvet ${input.antallUker > 0 ? "+" : ""}${input.antallUker} uker (område-skyv)`,
        })),
      });

      return { antallOppdatert: oppdateringer.length };
    }),

  // Hent kontrollplan-status for alle byggeplasser (modul-kort)
  hentStatusForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const byggeplasser = await ctx.prisma.byggeplass.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          name: true,
          kontrollplaner: {
            select: {
              id: true,
              status: true,
              _count: { select: { punkter: true } },
            },
          },
        },
        orderBy: { number: "asc" },
      });
      return byggeplasser.map((b) => ({
        id: b.id,
        name: b.name,
        kontrollplan: b.kontrollplaner[0] ?? null,
      }));
    }),
});
