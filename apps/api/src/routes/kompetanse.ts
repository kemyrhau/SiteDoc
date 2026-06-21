import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserKompetanseSkriveTilgang,
  hentBrukersOrg,
} from "../trpc/tilgangskontroll";
import {
  beregnFilHash,
  parseCsvFil,
  parseXlsxFil,
} from "../utils/kompetanseImport";
import { harGyldigMaskinforerbevis } from "../services/kompetanse/maskinforerbevis";

/**
 * Verifiser at bruker er firmaadmin for et firma.
 *
 * Steg 1b Fase C — orgId er påkrevd. Klienten må sende `valgtFirma.id`.
 */
async function verifiserFirmaAdmin(
  userId: string,
  inputOrgId: string,
): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

export const kompetanseRouter = router({
  // T.11: mobil henter sin EGEN maskinførerbevis-status per org hen er medlem
  // i. Lett payload (ett boolean per org) — speiles til SecureStore på mobil,
  // ikke SQLite. Ingen firma-admin-gate: bruker spør om egen status.
  minMaskinstatus: protectedProcedure.query(async ({ ctx }) => {
    const medlemskap = await ctx.prisma.organizationMember.findMany({
      where: { userId: ctx.userId },
      select: { organizationId: true },
    });
    const perOrg = await Promise.all(
      medlemskap.map(async (m) => ({
        organizationId: m.organizationId,
        harGyldigMaskinforerbevis: await harGyldigMaskinforerbevis(
          ctx.userId,
          m.organizationId,
        ),
      })),
    );
    return { perOrg };
  }),

  // Hent kompetansematrise for hele firmaet (brukere × kompetansetyper)
  // Returnerer flat data — UI bygger matrise-rendering
  hentMatrise: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

    const medlemmer = await ctx.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        user: { canLogin: true },
      },
      select: {
        ansattnummer: true,
        avdelingId: true,
        avdeling: { select: { id: true, navn: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const brukere = medlemmer.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      ansattnummer: m.ansattnummer,
      avdelingId: m.avdelingId,
      avdeling: m.avdeling,
    }));
    const brukerIder = brukere.map((b) => b.id);

    const [kompetansetyper, koblinger] = await Promise.all([
      ctx.prisma.kompetansetype.findMany({
        where: { organizationId: orgId, aktiv: true },
        select: { id: true, navn: true, kategori: true },
        orderBy: [{ kategori: "asc" }, { navn: "asc" }],
      }),
      ctx.prisma.ansattKompetanse.findMany({
        where: { userId: { in: brukerIder } },
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
    .input(z.object({
      userId: z.string().uuid(),
      organizationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      // Verifiser at målbruker tilhører samme firma
      const malMedlem = await ctx.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
        select: { id: true },
      });
      if (!malMedlem) {
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
      const malOrgId = await hentBrukersOrg(input.userId);
      const type = malOrgId
        ? await ctx.prisma.kompetansetype.findFirst({
            where: { id: input.kompetansetypeId, organizationId: malOrgId },
            select: { id: true },
          })
        : null;
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

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

      // Match ansattnumre mot OrganizationMember-rader i samme firma
      // O-4b: leses fra OrganizationMember (User.ansattnummer droppes i O-5)
      const ansattnumre = [
        ...new Set(parseresultat.rader.map((r) => r.ansattnummer)),
      ];
      const brukerMedlemmer =
        ansattnumre.length === 0
          ? []
          : await ctx.prisma.organizationMember.findMany({
              where: {
                organizationId: orgId,
                ansattnummer: { in: ansattnumre },
              },
              select: { userId: true, ansattnummer: true },
            });
      const brukere = brukerMedlemmer.map((m) => ({
        id: m.userId,
        ansattnummer: m.ansattnummer,
      }));
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

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
      // O-4b: leses fra OrganizationMember
      const ansattnumre = [
        ...new Set(parseresultat.rader.map((r) => r.ansattnummer)),
      ];
      const brukerMedlemmer = await ctx.prisma.organizationMember.findMany({
        where: { organizationId: orgId, ansattnummer: { in: ansattnumre } },
        select: { userId: true, ansattnummer: true },
      });
      const brukere = brukerMedlemmer.map((m) => ({
        id: m.userId,
        ansattnummer: m.ansattnummer,
      }));
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
