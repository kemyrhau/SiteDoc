import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserKompetanseSkriveTilgang } from "../trpc/tilgangskontroll";
import {
  beregnFilHash,
  parseCsvFil,
  parseXlsxFil,
} from "../utils/kompetanseImport";

/**
 * Verifiser at bruker er firmaadmin for sin organisasjon.
 */
async function verifiserFirmaAdmin(userId: string): Promise<string> {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, organizationId: true },
  });

  if (bruker.role !== "company_admin" && bruker.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Krever firmaadmin-rettighet" });
  }

  if (!bruker.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ingen organisasjon tilknyttet" });
  }

  return bruker.organizationId;
}

export const kompetanseRouter = router({
  // Hent kompetansematrise for hele firmaet (brukere × kompetansetyper)
  // Returnerer flat data — UI bygger matrise-rendering
  hentMatrise: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId);

    const [brukere, kompetansetyper, koblinger] = await Promise.all([
      ctx.prisma.user.findMany({
        where: { organizationId: orgId, canLogin: true },
        select: {
          id: true,
          name: true,
          email: true,
          ansattnummer: true,
          avdelingId: true,
          avdeling: { select: { id: true, navn: true } },
        },
        orderBy: [{ name: "asc" }],
      }),
      ctx.prisma.kompetansetype.findMany({
        where: { organizationId: orgId, aktiv: true },
        select: { id: true, navn: true, kategori: true },
        orderBy: [{ kategori: "asc" }, { navn: "asc" }],
      }),
      ctx.prisma.ansattKompetanse.findMany({
        where: {
          user: { organizationId: orgId },
        },
        select: {
          id: true,
          userId: true,
          kompetansetypeId: true,
          utstedtDato: true,
          utloper: true,
          sertifikatNr: true,
          utstederOrgan: true,
        },
      }),
    ]);

    return { brukere, kompetansetyper, koblinger };
  }),

  // Hent alle AnsattKompetanse-rader for en spesifikk bruker (for detalj-vy)
  hentForBruker: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      // Verifiser at målbruker tilhører samme firma
      const malBruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { organizationId: true },
      });
      if (!malBruker || malBruker.organizationId !== orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bruker finnes ikke eller tilhører ikke ditt firma",
        });
      }

      return ctx.prisma.ansattKompetanse.findMany({
        where: { userId: input.userId },
        include: {
          kompetansetype: {
            select: { id: true, navn: true, kategori: true },
          },
        },
        orderBy: [
          { kompetansetype: { kategori: "asc" } },
          { kompetansetype: { navn: "asc" } },
        ],
      });
    }),

  // Opprett ny AnsattKompetanse-rad (Fase 0.5 § 2 + A.28 — Runde 2)
  // Gate: verifiserKompetanseSkriveTilgang (RBAC per OrganizationSetting)
  opprett: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        kompetansetypeId: z.string().uuid(),
        utstedtDato: z.string().date().nullable().optional(),
        utloper: z.string().date().nullable().optional(),
        utstederOrgan: z.string().max(255).nullable().optional(),
        sertifikatNr: z.string().max(100).nullable().optional(),
        notat: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserKompetanseSkriveTilgang(ctx.userId, input.userId);

      // Verifiser at kompetansetype tilhører samme firma som målbrukeren
      const malBruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { organizationId: true },
      });
      const type = await ctx.prisma.kompetansetype.findFirst({
        where: { id: input.kompetansetypeId, organizationId: malBruker.organizationId ?? undefined },
        select: { id: true },
      });
      if (!type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetansetype finnes ikke eller tilhører ikke samme firma",
        });
      }

      try {
        return await ctx.prisma.ansattKompetanse.create({
          data: {
            userId: input.userId,
            kompetansetypeId: input.kompetansetypeId,
            utstedtDato: input.utstedtDato ? new Date(input.utstedtDato) : null,
            utloper: input.utloper ? new Date(input.utloper) : null,
            utstederOrgan: input.utstederOrgan?.trim() || null,
            sertifikatNr: input.sertifikatNr?.trim() || null,
            notat: input.notat?.trim() || null,
            opprettetAvUserId: ctx.userId, // A.3-audit-spor (uten FK)
            importertVia: "manuell",
          },
          include: {
            kompetansetype: { select: { id: true, navn: true, kategori: true } },
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Denne brukeren har allerede en registrering for denne kompetansetypen",
          });
        }
        throw e;
      }
    }),

  // Oppdater AnsattKompetanse-rad (userId + kompetansetypeId kan IKKE endres)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        utstedtDato: z.string().date().nullable().optional(),
        utloper: z.string().date().nullable().optional(),
        utstederOrgan: z.string().max(255).nullable().optional(),
        sertifikatNr: z.string().max(100).nullable().optional(),
        notat: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eksisterende = await ctx.prisma.ansattKompetanse.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetanse-registrering finnes ikke",
        });
      }
      await verifiserKompetanseSkriveTilgang(ctx.userId, eksisterende.userId);

      const data: Prisma.AnsattKompetanseUpdateInput = {};
      if (input.utstedtDato !== undefined) {
        data.utstedtDato = input.utstedtDato ? new Date(input.utstedtDato) : null;
      }
      if (input.utloper !== undefined) {
        data.utloper = input.utloper ? new Date(input.utloper) : null;
      }
      if (input.utstederOrgan !== undefined) {
        data.utstederOrgan = input.utstederOrgan?.trim() || null;
      }
      if (input.sertifikatNr !== undefined) {
        data.sertifikatNr = input.sertifikatNr?.trim() || null;
      }
      if (input.notat !== undefined) {
        data.notat = input.notat?.trim() || null;
      }

      return ctx.prisma.ansattKompetanse.update({
        where: { id: input.id },
        data,
        include: {
          kompetansetype: { select: { id: true, navn: true, kategori: true } },
        },
      });
    }),

  // Slett AnsattKompetanse-rad
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const eksisterende = await ctx.prisma.ansattKompetanse.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetanse-registrering finnes ikke",
        });
      }
      await verifiserKompetanseSkriveTilgang(ctx.userId, eksisterende.userId);

      return ctx.prisma.ansattKompetanse.delete({
        where: { id: input.id },
      });
    }),

  // CSV/Excel-import (Fase 0.5 § 2 Runde 2.5 — A.28)
  // Forhåndsvisning: parser fil, validerer, returnerer preview UTEN å lagre.
  // filHash brukes i bekreft-steget for å garantere konsistens.
  importerForhandsvisning: protectedProcedure
    .input(
      z.object({
        filInnhold: z.string().max(7_000_000), // base64 ~5MB rå = ~7MB base64
        filtype: z.enum(["csv", "xlsx"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      const buffer = Buffer.from(input.filInnhold, "base64");
      if (buffer.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      const filHash = beregnFilHash(buffer);
      const parseresultat =
        input.filtype === "csv" ? parseCsvFil(buffer) : await parseXlsxFil(buffer);

      // Match ansattnumre mot eksisterende User-rader i samme firma
      const ansattnumre = [
        ...new Set(parseresultat.rader.map((r) => r.ansattnummer)),
      ];
      const brukere =
        ansattnumre.length === 0
          ? []
          : await ctx.prisma.user.findMany({
              where: {
                organizationId: orgId,
                ansattnummer: { in: ansattnumre },
              },
              select: { id: true, ansattnummer: true, name: true },
            });
      const brukerMap = new Map(
        brukere.map((b) => [b.ansattnummer ?? "", b.id]),
      );
      const ukjenteAnsattnumre = ansattnumre.filter((nr) => !brukerMap.has(nr));

      // Match kompetansetyper mot eksisterende
      const typeNavn = [
        ...new Set(parseresultat.rader.map((r) => r.kompetansetype)),
      ];
      const eksisterendeTyper =
        typeNavn.length === 0
          ? []
          : await ctx.prisma.kompetansetype.findMany({
              where: {
                organizationId: orgId,
                navn: { in: typeNavn },
              },
              select: { id: true, navn: true },
            });
      const typeMap = new Map(
        eksisterendeTyper.map((t) => [t.navn.toLowerCase(), t.id]),
      );
      const ukjenteKompetansetyper = typeNavn.filter(
        (n) => !typeMap.has(n.toLowerCase()),
      );

      // Tell duplikater (eksisterende AnsattKompetanse-rader)
      let duplikater = 0;
      if (brukere.length > 0 && eksisterendeTyper.length > 0) {
        const eksisterende = await ctx.prisma.ansattKompetanse.findMany({
          where: {
            userId: { in: brukere.map((b) => b.id) },
            kompetansetypeId: { in: eksisterendeTyper.map((t) => t.id) },
          },
          select: { userId: true, kompetansetypeId: true },
        });
        const eksisterendeSett = new Set(
          eksisterende.map((e) => `${e.userId}|${e.kompetansetypeId}`),
        );
        for (const rad of parseresultat.rader) {
          const userId = brukerMap.get(rad.ansattnummer);
          const typeId = typeMap.get(rad.kompetansetype.toLowerCase());
          if (userId && typeId && eksisterendeSett.has(`${userId}|${typeId}`)) {
            duplikater++;
          }
        }
      }

      return {
        filHash,
        totalt: parseresultat.rader.length,
        rader: parseresultat.rader.slice(0, 50).map((r) => ({
          radnummer: r.radnummer,
          ansattnummer: r.ansattnummer,
          kompetansetype: r.kompetansetype,
          utstedt: r.utstedt?.toISOString() ?? null,
          utloper: r.utloper?.toISOString() ?? null,
          ansattFunnet: brukerMap.has(r.ansattnummer),
          typeFunnet: typeMap.has(r.kompetansetype.toLowerCase()),
        })),
        ukjenteAnsattnumre,
        ukjenteKompetansetyper,
        duplikater,
        valideringsfeil: parseresultat.valideringsfeil,
      };
    }),

  // Bekreft import — atomisk lagring i prisma.$transaction.
  // Re-parser fil server-side og verifiserer at filHash matcher forhåndsvisning.
  importerBekreft: protectedProcedure
    .input(
      z.object({
        filInnhold: z.string().max(7_000_000),
        filtype: z.enum(["csv", "xlsx"]),
        filHash: z.string().length(64), // SHA-256 hex
        autoOpprettTyper: z.boolean(),
        overskrivEksisterende: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      const buffer = Buffer.from(input.filInnhold, "base64");
      if (buffer.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      // filHash-verifisering — sikrer konsistens mellom forhåndsvisning og bekreft
      const beregnetHash = beregnFilHash(buffer);
      if (beregnetHash !== input.filHash) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Fil-innholdet stemmer ikke med forhåndsvisningen. Last opp filen på nytt.",
        });
      }

      const parseresultat =
        input.filtype === "csv" ? parseCsvFil(buffer) : await parseXlsxFil(buffer);

      if (parseresultat.valideringsfeil.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Valideringsfeil: ${parseresultat.valideringsfeil.join("; ")}`,
        });
      }

      // Match ansattnumre — atomisk: avvis hele importen ved ukjente
      const ansattnumre = [
        ...new Set(parseresultat.rader.map((r) => r.ansattnummer)),
      ];
      const brukere = await ctx.prisma.user.findMany({
        where: { organizationId: orgId, ansattnummer: { in: ansattnumre } },
        select: { id: true, ansattnummer: true },
      });
      const brukerMap = new Map(
        brukere.map((b) => [b.ansattnummer ?? "", b.id]),
      );
      const ukjenteAnsattnumre = ansattnumre.filter((nr) => !brukerMap.has(nr));
      if (ukjenteAnsattnumre.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ukjente ansattnumre (atomisk avvist): ${ukjenteAnsattnumre.slice(0, 10).join(", ")}${
            ukjenteAnsattnumre.length > 10 ? "…" : ""
          }`,
        });
      }

      // Atomisk transaksjon: opprett nye typer, opprett/oppdater ansatt-kompetanser
      const result = await ctx.prisma.$transaction(async (tx) => {
        // 1. Hent eksisterende kompetansetyper
        const typeNavn = [
          ...new Set(parseresultat.rader.map((r) => r.kompetansetype)),
        ];
        const eksisterendeTyper = await tx.kompetansetype.findMany({
          where: { organizationId: orgId, navn: { in: typeNavn } },
          select: { id: true, navn: true },
        });
        const typeMap = new Map(
          eksisterendeTyper.map((t) => [t.navn.toLowerCase(), t.id]),
        );

        // 2. Opprett ukjente typer (hvis tillatt)
        const nyeTypeNavn = typeNavn.filter((n) => !typeMap.has(n.toLowerCase()));
        if (nyeTypeNavn.length > 0 && !input.autoOpprettTyper) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Ukjente kompetansetyper (auto-opprett er av): ${nyeTypeNavn.slice(0, 10).join(", ")}`,
          });
        }
        const nyeTyper: { navn: string; id: string }[] = [];
        for (const navn of nyeTypeNavn) {
          // Finn første rad med denne typen for å plukke kategori
          const førsteRad = parseresultat.rader.find(
            (r) => r.kompetansetype === navn,
          );
          const kategori = førsteRad?.kategori ?? "EGENDEFINERT";
          const ny = await tx.kompetansetype.create({
            data: {
              organizationId: orgId,
              navn,
              kategori,
              aktiv: true,
            },
            select: { id: true, navn: true },
          });
          nyeTyper.push(ny);
          typeMap.set(navn.toLowerCase(), ny.id);
        }

        // 3. Opprett/oppdater AnsattKompetanse-rader
        let opprettet = 0;
        let oppdatert = 0;
        let skippet = 0;
        for (const rad of parseresultat.rader) {
          const userId = brukerMap.get(rad.ansattnummer)!;
          const typeId = typeMap.get(rad.kompetansetype.toLowerCase())!;

          const eksisterende = await tx.ansattKompetanse.findUnique({
            where: {
              userId_kompetansetypeId: {
                userId,
                kompetansetypeId: typeId,
              },
            },
            select: { id: true },
          });

          if (eksisterende) {
            if (!input.overskrivEksisterende) {
              skippet++;
              continue;
            }
            await tx.ansattKompetanse.update({
              where: { id: eksisterende.id },
              data: {
                utstedtDato: rad.utstedt,
                utloper: rad.utloper,
                utstederOrgan: rad.utstederOrgan,
                sertifikatNr: rad.sertifikatNr,
                notat: rad.notat,
                importertVia: input.filtype,
                importertVed: new Date(),
              },
            });
            oppdatert++;
          } else {
            await tx.ansattKompetanse.create({
              data: {
                userId,
                kompetansetypeId: typeId,
                utstedtDato: rad.utstedt,
                utloper: rad.utloper,
                utstederOrgan: rad.utstederOrgan,
                sertifikatNr: rad.sertifikatNr,
                notat: rad.notat,
                opprettetAvUserId: ctx.userId,
                importertVia: input.filtype,
                importertVed: new Date(),
              },
            });
            opprettet++;
          }
        }

        return { opprettet, oppdatert, skippet, nyeTyper };
      });

      return {
        opprettet: result.opprettet,
        oppdatert: result.oppdatert,
        skippet: result.skippet,
        nyeKompetansetyper: result.nyeTyper.map((t) => t.navn),
      };
    }),
});
