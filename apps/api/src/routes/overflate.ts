import { z } from "zod";
import { join } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { byggOverflateFraLas } from "../services/overflateService";
import { parseLandXML } from "../services/landxmlParser";
import { skrivTinFil, type TinData } from "../services/tinFil";
import { utledRammeForLandXML, krevSammeRamme } from "../services/overflateRamme";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const OVERFLATE_DIR = join(UPLOADS_DIR, "overflater");

function tilDiskSti(fileUrl: string): string {
  return join(UPLOADS_DIR, fileUrl.replace(/^\/uploads\//, ""));
}

/** Skriv TIN-binæren til disk og returner /uploads-URL-en. */
async function lagreTin(tin: TinData): Promise<string> {
  await mkdir(OVERFLATE_DIR, { recursive: true });
  const filnavn = `${randomUUID()}.stin`;
  await skrivTinFil(join(OVERFLATE_DIR, filnavn), tin);
  return `/uploads/overflater/${filnavn}`;
}

/** Metadata-utvalg for lister/velgere — aldri hele TIN-en. */
const METADATA_SELECT = {
  id: true,
  projectId: true,
  byggeplassId: true,
  navn: true,
  kilde: true,
  pointCloudId: true,
  filUrl: true,
  malavstandM: true,
  bakkeMetode: true,
  ramme: true,
  origoBeskrivelse: true,
  punktAntall: true,
  boundingBox: true,
  createdAt: true,
} as const;

export const overflateRouter = router({
  // Lagrede overflater for et prosjekt (til velger + reload-persistens)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.overflate.findMany({
        where: {
          projectId: input.projectId,
          ...(input.byggeplassId ? { byggeplassId: input.byggeplassId } : {}),
        },
        select: METADATA_SELECT,
        orderBy: { createdAt: "desc" },
      });
    }),

  // Overflateberegn en LAS-punktsky (A→B→C) og lagre resultatet
  opprettFraPunktsky: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        pointCloudId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
        navn: z.string().min(1).max(255),
        malavstandM: z.number().positive().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const punktsky = await ctx.prisma.pointCloud.findUniqueOrThrow({
        where: { id: input.pointCloudId },
        select: { projectId: true, fileUrl: true, fileType: true, hasClassification: true, coordinateSystem: true },
      });
      // Prosjektisolering: punktskya må høre til samme prosjekt
      if (punktsky.projectId !== input.projectId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Punktskya tilhører et annet prosjekt." });
      }
      if (punktsky.fileType.toLowerCase() !== "las") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Kun LAS-punktskyer kan overflateberegnes i steg 1 (fikk .${punktsky.fileType}). LAZ/E57/PLY støttes ikke ennå.`,
        });
      }

      const resultat = await byggOverflateFraLas(tilDiskSti(punktsky.fileUrl), {
        harKlassifisering: punktsky.hasClassification,
        coordinateSystem: punktsky.coordinateSystem,
        malavstandM: input.malavstandM,
      });

      const filUrl = await lagreTin(resultat.tin);

      try {
        return await ctx.prisma.overflate.create({
          data: {
            projectId: input.projectId,
            byggeplassId: input.byggeplassId,
            navn: input.navn,
            kilde: "punktsky",
            pointCloudId: input.pointCloudId,
            filUrl,
            malavstandM: resultat.malavstandM,
            bakkeMetode: resultat.bakkeMetode,
            ramme: resultat.ramme,
            punktAntall: resultat.punktAntall,
            boundingBox: resultat.tin.bbox,
          },
          select: METADATA_SELECT,
        });
      } catch (e) {
        // Partial unique (point_cloud_id, malavstand_m): samme sky + samme målavstand finnes alt
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "En overflate for denne punktskya med samme målavstand finnes allerede.",
          });
        }
        throw e;
      }
    }),

  // Lagre en opplastet LandXML som overflate (så den overlever reload)
  lagreLandXML: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
        navn: z.string().min(1).max(255),
        fileUrl: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      let xml: string;
      try {
        xml = await readFile(tilDiskSti(input.fileUrl), "utf8");
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fant ikke den opplastede LandXML-fila." });
      }

      let parsed;
      try {
        parsed = parseLandXML(xml);
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Kunne ikke parse LandXML.",
        });
      }

      const filUrl = await lagreTin(parsed.tin);

      return ctx.prisma.overflate.create({
        data: {
          projectId: input.projectId,
          byggeplassId: input.byggeplassId,
          navn: input.navn || parsed.navn || "LandXML-overflate",
          kilde: "landxml",
          filUrl,
          // malavstandM/bakkeMetode: NULL for landxml (CHECK tillater det)
          ramme: utledRammeForLandXML(),
          punktAntall: parsed.tin.vertices.length / 3,
          boundingBox: parsed.tin.bbox,
        },
        select: METADATA_SELECT,
      });
    }),

  // 🔴 § F: hent to overflater for sammenligning — ramme-vakt PÅ SERVER.
  // Klienten kaller denne FØR beregnKuttFyll (som fortsatt kjører i nettleseren).
  // Ulik ramme → avvist her; klienten får aldri lov til å sammenligne.
  hentForSammenligning: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        toppId: z.string().uuid(),
        bunnId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const rader = await ctx.prisma.overflate.findMany({
        where: { projectId: input.projectId, id: { in: [input.toppId, input.bunnId] } },
        select: METADATA_SELECT,
      });
      const topp = rader.find((r) => r.id === input.toppId);
      const bunn = rader.find((r) => r.id === input.bunnId);
      // Prosjektisolering: begge må finnes I DETTE prosjektet
      if (!topp || !bunn) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke begge overflatene i dette prosjektet." });
      }

      // 🔴 Ramme-vakten. Fjernes dette kallet, går en sammenligning på tvers av
      // koordinatrammer gjennom med et feil volumtall (integrasjonstest feiler da).
      krevSammeRamme(topp.ramme, bunn.ramme);

      return { topp, bunn, ramme: topp.ramme };
    }),

  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const o = await ctx.prisma.overflate.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, o.projectId);
      return ctx.prisma.overflate.delete({ where: { id: input.id } });
    }),
});
