import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem, verifiserAdmin } from "../trpc/tilgangskontroll";

const polygonPunktSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

// Steg 2 (2026-09-23): `trase` er en fjerde type. En trasé er en LINJE, ikke en flate —
// `polygon` er valgfritt for den (skjemaet defaulter til [], ingen type krever areal).
const omradeType = z.enum(["sone", "rom", "etasje", "trase"]);

// Entall/flertall for slettevakt-meldingen (mikrotekst-standard: oppgi tallet + neste steg,
// ikke bare «kan ikke slettes» — en nektelse uten tall sender brukeren på leting).
function tall(n: number, entall: string, flertall: string): string {
  return `${n} ${n === 1 ? entall : flertall}`;
}

// Slettevakt-melding: navngir HVER referansevei som er > 0. To veier — kontrollplanpunkter
// (ekte FK) og rapportobjekter (myk JSON-referanse i Checklist.data/Task.data).
function byggSlettevaktMelding(kpAntall: number, roAntall: number): string {
  const deler: string[] = [];
  if (kpAntall > 0) deler.push(tall(kpAntall, "kontrollplanpunkt", "kontrollplanpunkter"));
  if (roAntall > 0) deler.push(tall(roAntall, "rapportobjekt", "rapportobjekter"));
  return `Området brukes av ${deler.join(" og ")} og kan ikke slettes. Gi det nytt navn, eller flytt det som bruker det, først.`;
}

export const omradeRouter = router({
  // Hent alle områder for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.omrade.findMany({
        where: {
          projectId: input.projectId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          byggeplass: { select: { id: true, name: true } },
          tegning: { select: { id: true, name: true, drawingNumber: true } },
        },
        orderBy: [{ byggeplass: { number: "asc" } }, { sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Hent områder for en bestemt byggeplass
  hentForByggeplass: protectedProcedure
    .input(z.object({
      byggeplassId: z.string(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.omrade.findMany({
        where: {
          byggeplassId: input.byggeplassId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          tegning: { select: { id: true, name: true, drawingNumber: true } },
        },
        orderBy: [{ sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Hent områder for en bestemt tegning
  hentForTegning: protectedProcedure
    .input(z.object({ tegningId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.tegningId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.omrade.findMany({
        where: { tegningId: input.tegningId },
        orderBy: [{ sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Bruksantall pr. område for en byggeplass (til område-admin-lista, steg 1). Leser begge
  // referanseveier — kontrollplanpunkter (FK) + rapportobjekter (myk JSON-referanse) — i ÉN rå
  // spørring, SAMME telling som slettevakten bruker (én kilde for «hva som bruker området»).
  // Lesetilgang: alle medlemmer ser lista; bare admin kan endre den.
  bruksAntall: protectedProcedure
    .input(z.object({ byggeplassId: z.string() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      const rader = await ctx.prisma.$queryRaw<{ id: string; kp: bigint; ro: bigint }[]>`
        SELECT o.id,
          (SELECT count(*) FROM kontrollplan_punkter kp WHERE kp.omrade_id = o.id) AS kp,
          (SELECT count(*) FROM checklists c WHERE c.data::text LIKE '%"' || o.id || '"%')
          + (SELECT count(*) FROM tasks t WHERE t.data::text LIKE '%"' || o.id || '"%') AS ro
        FROM omrader o
        WHERE o.byggeplass_id = ${input.byggeplassId}
      `;
      return rader.map((r) => ({ id: r.id, kpAntall: Number(r.kp), roAntall: Number(r.ro) }));
    }),

  // Opprett nytt område. ADMIN-gatet (Kenneth 2026-09-23: «og bare admin») — en stabil
  // navneliste tåler ikke at hvem som helst kan skrive «Austadvegn». Lesetilgangen er urørt.
  opprett: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      byggeplassId: z.string(),
      tegningId: z.string().uuid().optional(),
      navn: z.string().min(1).max(255),
      type: omradeType.default("sone"),
      polygon: z.array(polygonPunktSchema).default([]),
      farge: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const maks = await ctx.prisma.omrade.aggregate({
        where: { byggeplassId: input.byggeplassId },
        _max: { sortering: true },
      });
      return ctx.prisma.omrade.create({
        data: {
          ...input,
          polygon: input.polygon,
          sortering: (maks._max.sortering ?? 0) + 1,
        },
      });
    }),

  // Oppdater område (omdøp/type/farge/sortering). ADMIN-gatet. Omdøping er utveien når et
  // navn er feil — den viktigste enkeltoperasjonen for at identiteten skal være stabil.
  oppdater: protectedProcedure
    .input(z.object({
      id: z.string(),
      navn: z.string().min(1).max(255).optional(),
      type: omradeType.optional(),
      polygon: z.array(polygonPunktSchema).optional(),
      farge: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      tegningId: z.string().uuid().nullable().optional(),
      sortering: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, polygon, ...data } = input;
      const omrade = await ctx.prisma.omrade.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserAdmin(ctx.userId, omrade.projectId);
      return ctx.prisma.omrade.update({
        where: { id },
        data: {
          ...data,
          ...(polygon !== undefined ? { polygon } : {}),
        },
      });
    }),

  // Slett område. ADMIN-gatet + SLETTEVAKT (Kenneth 2026-09-23: «blokkér hvis feltet inneholder
  // data fra før»). Uten vakt ville `onDelete: SetNull` (schema.prisma:2472) nullstilt `omradeId`
  // på alle kontrollplanpunktene, og `@@unique([kontrollplanId, omradeId, sjekklisteMalId])`
  // (:2483) fanger IKKE resultatet — Postgres regner NULL som distinkt (Test A dokumenterer det).
  // Resultatet ville vært stille duplikater. Rapportobjekter (Rom/Sone-egenskap) refererer området
  // som en MYK streng i Checklist.data/Task.data (ingen FK) → telles med tekst-treff på den siterte
  // id-en, som også fanger nestede repeater-verdier.
  slett: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const omrade = await ctx.prisma.omrade.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserAdmin(ctx.userId, omrade.projectId);

      const kpAntall = await ctx.prisma.kontrollplanPunkt.count({ where: { omradeId: input.id } });
      const roMonster = `%"${input.id}"%`;
      const roRader = await ctx.prisma.$queryRaw<{ antall: bigint }[]>`
        SELECT (SELECT count(*) FROM checklists WHERE data::text LIKE ${roMonster})
             + (SELECT count(*) FROM tasks WHERE data::text LIKE ${roMonster}) AS antall
      `;
      const roAntall = Number(roRader[0]?.antall ?? 0);

      if (kpAntall + roAntall > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: byggSlettevaktMelding(kpAntall, roAntall),
        });
      }
      return ctx.prisma.omrade.delete({ where: { id: input.id } });
    }),
});
