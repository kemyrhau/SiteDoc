import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { autoriserAdminForFirma, hentBrukersOrg } from "../trpc/tilgangskontroll";
import {
  syncProjektModulerPaaAktiver,
  syncProjektModulerPaaDeaktiver,
  skrivOrganizationModuleAktiver,
  skrivOrganizationModuleDeaktiver,
  hentAktiveFirmamoduler,
} from "../services/firmamodul";
import { hentFirmaFraBrreg, BrregError } from "../services/brreg";

/**
 * Verifiser at bruker er firmaadmin for et firma.
 *
 * Steg 1b Fase C — orgId er påkrevd. Klienten må sende `valgtFirma.id` fra
 * `useFirma()`-konteksten. Sitedoc_admin kan administrere alle firmaer;
 * company_admin kun sitt eget.
 */
async function verifiserFirmaAdmin(
  _prisma: typeof prisma,
  userId: string,
  inputOrgId: string,
): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

export const organisasjonRouter = router({
  // Hent alle organisasjoner (for firma-dropdown i admin)
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  /**
   * Hent firmaer brukeren kan administrere — for global firma-velger i Toppbar.
   * - sitedoc_admin: alle firmaer
   * - company_admin: kun eget firma
   * - vanlig user: tom liste (firma-velger ikke relevant — admin-funksjon)
   */
  hentTilgjengelige: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return [];
    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { role: true },
    });

    // Steg 1e Fase B: aktiveFirmamoduler avledes fra OrganizationModule-tabellen.
    const beriker = async (orgs: { id: string; name: string; erKunde: boolean }[]) => {
      const moduler = await ctx.prisma.organizationModule.findMany({
        where: {
          organizationId: { in: orgs.map((o) => o.id) },
          status: "aktiv",
        },
        select: { organizationId: true, moduleSlug: true },
      });
      const perOrg = new Map<string, string[]>();
      for (const m of moduler) {
        const liste = perOrg.get(m.organizationId) ?? [];
        liste.push(m.moduleSlug);
        perOrg.set(m.organizationId, liste);
      }
      return orgs.map((o) => ({
        ...o,
        aktiveFirmamoduler: perOrg.get(o.id) ?? [],
      }));
    };

    if (bruker.role === "sitedoc_admin") {
      // Skall-firmaer (erKunde=false) skjules — kun reelle kundefirmaer i velgeren.
      const orgs = await ctx.prisma.organization.findMany({
        where: { erKunde: true },
        select: { id: true, name: true, erKunde: true },
        orderBy: { name: "asc" },
      });
      return beriker(orgs);
    }

    // O-3b: hent brukerens org via OrganizationMember (fallback User.organizationId)
    const orgId = await hentBrukersOrg(ctx.userId);
    if (bruker.role === "company_admin" && orgId) {
      const orgs = await ctx.prisma.organization.findMany({
        where: { id: orgId },
        select: { id: true, name: true, erKunde: true },
      });
      return beriker(orgs);
    }

    return [];
  }),

  // Opprett ny organisasjon
  opprett: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.organization.create({
        data: { name: input.name },
        select: { id: true, name: true },
      });
    }),

  // Hent innlogget brukers organisasjon (null hvis ingen).
  // Steg 1e Fase B: beriker med aktiveFirmamoduler fra OrganizationModule.
  hentMin: protectedProcedure.query(async ({ ctx }) => {
    // O-3b: hent brukerens org via OrganizationMember (fallback User.organizationId)
    const orgId = await hentBrukersOrg(ctx.userId);
    if (!orgId) return null;

    const [org, aktiveFirmamoduler] = await Promise.all([
      ctx.prisma.organization.findUnique({
        where: { id: orgId },
      }),
      hentAktiveFirmamoduler(orgId),
    ]);
    if (!org) return null;
    return { ...org, aktiveFirmamoduler };
  }),

  // Hent organisasjon tilknyttet et prosjekt (via ProjectOrganization)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgProject = await ctx.prisma.projectOrganization.findFirst({
        where: { projectId: input.projectId },
        include: { organization: true },
      });
      return orgProject?.organization ?? null;
    }),

  // Hent organisasjon med ID (kun firmaadmin).
  // Fase A: id-feltet er allerede orgId — autoriserer direkte mot input.
  // Steg 1e Fase B: beriker med aktiveFirmamoduler fra OrganizationModule.
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.id);

      const [org, aktiveFirmamoduler] = await Promise.all([
        ctx.prisma.organization.findUniqueOrThrow({ where: { id: input.id } }),
        hentAktiveFirmamoduler(input.id),
      ]);
      return { ...org, aktiveFirmamoduler };
    }),

  // Hent organisasjonens prosjekter (kun firmaadmin)
  hentProsjekter: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

    const orgProsjekter = await ctx.prisma.projectOrganization.findMany({
      where: { organizationId: orgId },
      include: {
        project: {
          include: {
            members: { select: { id: true } },
            faggrupper: { select: { id: true } },
          },
        },
      },
      orderBy: { project: { createdAt: "desc" } },
    });

    return orgProsjekter.map((op) => ({
      id: op.project.id,
      projectNumber: op.project.projectNumber,
      name: op.project.name,
      status: op.project.status,
      antallMedlemmer: op.project.members.length,
      antallFaggrupper: op.project.faggrupper.length,
      createdAt: op.project.createdAt,
    }));
  }),

  // Hent organisasjonens ansatte (kun firmaadmin)
  // O-4b: leses via OrganizationMember + user-relasjon
  hentBrukere: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

    const members = await ctx.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        ansattnummer: true,
        avdelingId: true,
        ansattRolle: true,
        firmaRoller: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      phone: m.user.phone,
      role: m.user.role,
      createdAt: m.user.createdAt,
      memberId: m.id,
      ansattnummer: m.ansattnummer,
      avdelingId: m.avdelingId,
      ansattRolle: m.ansattRolle,
      firmaRoller: m.firmaRoller,
    }));
  }),

  // Oppdater organisasjon (firmaadmin for sin egen, sitedoc_admin for vilkårlig).
  // Fase A: konsolidert via verifiserFirmaAdmin med valgfri organizationId-input.
  oppdater: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).optional(),
        organizationNumber: z.string().optional().nullable(),
        invoiceAddress: z.string().optional().nullable(),
        invoiceEmail: z.string().email().optional().nullable(),
        ehfEnabled: z.boolean().optional(),
        logoUrl: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId: inputOrgId, ...data } = input;
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, inputOrgId);

      return ctx.prisma.organization.update({
        where: { id: orgId },
        data,
      });
    }),

  // Legg til prosjekt til organisasjonen (kun firmaadmin)
  leggTilProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      return ctx.prisma.projectOrganization.upsert({
        where: {
          projectId_organizationId: {
            projectId: input.projectId,
            organizationId: orgId,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          projectId: input.projectId,
        },
      });
    }),

  // Fjern prosjekt fra organisasjonen (kun firmaadmin)
  fjernProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      return ctx.prisma.projectOrganization.delete({
        where: {
          projectId_organizationId: {
            projectId: input.projectId,
            organizationId: orgId,
          },
        },
      });
    }),

  // Hent integrasjonsstatus for organisasjonen (kun firmaadmin)
  hentIntegrasjonerStatus: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

    const integrasjoner = await ctx.prisma.organizationIntegration.findMany({
      where: { organizationId: orgId },
      select: {
        type: true,
        aktiv: true,
        url: true,
        createdAt: true,
      },
    });

    return integrasjoner.map((i) => ({
      type: i.type,
      aktiv: i.aktiv,
      url: i.url,
      harNøkkel: true, // Hvis raden finnes, har den en nøkkel — aldri send apiKey til klient
      createdAt: i.createdAt,
    }));
  }),

  // Endre rolle for en bruker i organisasjonen (kun firmaadmin)
  endreRolle: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        rolle: z.enum(["user", "company_admin"]),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      // Verifiser at målbrukeren tilhører samme organisasjon
      // O-3b: hent målbrukerens org via OrganizationMember (fallback User.organizationId)
      const målbrukerOrgId = await hentBrukersOrg(input.userId);
      const målbruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { role: true },
      });

      if (!målbruker || målbrukerOrgId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brukeren tilhører ikke din organisasjon",
        });
      }

      // Kan ikke endre sitedoc_admin
      if (målbruker.role === "sitedoc_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kan ikke endre rolle for systemadministrator",
        });
      }

      // Kan ikke degradere seg selv
      if (input.userId === ctx.userId && input.rolle !== "company_admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kan ikke fjerne din egen admin-rolle",
        });
      }

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.rolle },
        select: { id: true, role: true },
      });
    }),

  // Inviter ny bruker til firmaet (firma-admin)
  // Oppretter User direkte med organizationId + rolle. Bruker logger inn via OAuth
  // (Google/Microsoft) med matchende e-post første gang.
  inviterBruker: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        navn: z.string().min(1).max(200),
        email: z.string().email(),
        telefon: z.string().max(50).optional(),
        rolle: z.enum(["user", "company_admin"]),
        ansattnummer: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      const eksisterende = await ctx.prisma.user.findFirst({
        where: { email: input.email, canLogin: true },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

      if (eksisterende) {
        // O-3b: hent eksisterende brukers org via OrganizationMember (fallback User.organizationId)
        const eksisterendeOrgId = await hentBrukersOrg(eksisterende.id);
        if (eksisterendeOrgId === orgId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Brukeren er allerede medlem av firmaet",
          });
        }
        if (eksisterendeOrgId && eksisterendeOrgId !== orgId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Brukeren tilhører et annet firma",
          });
        }
        // Orphan-bruker — adopter inn i firmaet via OrganizationMember (under)
        const adoptert = await ctx.prisma.user.update({
          where: { id: eksisterende.id },
          data: {
            role: input.rolle,
            ...(input.telefon ? { phone: input.telefon } : {}),
          },
          select: { id: true, name: true, email: true, role: true },
        });

        // O-4b: opprett/oppdater OrganizationMember-rad (firmaRoller speiler legacy role)
        await ctx.prisma.organizationMember.upsert({
          where: { userId_organizationId: { userId: adoptert.id, organizationId: orgId } },
          create: {
            userId: adoptert.id,
            organizationId: orgId,
            ansattnummer: input.ansattnummer ?? null,
            ansattRolle: "ansatt",
            firmaRoller: input.rolle === "company_admin" ? ["firma_admin"] : [],
          },
          update: { ansattnummer: input.ansattnummer ?? null },
        });

        return adoptert;
      }

      const opprettet = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.navn,
          phone: input.telefon,
          role: input.rolle,
          canLogin: true,
        },
        select: { id: true, name: true, email: true, role: true },
      });

      // O-4b: opprett OrganizationMember-rad for ny bruker
      await ctx.prisma.organizationMember.upsert({
        where: { userId_organizationId: { userId: opprettet.id, organizationId: orgId } },
        create: {
          userId: opprettet.id,
          organizationId: orgId,
          ansattnummer: input.ansattnummer ?? null,
          ansattRolle: "ansatt",
          firmaRoller: input.rolle === "company_admin" ? ["firma_admin"] : [],
        },
        update: { ansattnummer: input.ansattnummer ?? null },
      });

      return opprettet;
    }),

  // Oppdater eksisterende firma-bruker (firma-admin)
  // Kan endre navn, e-post, telefon og rolle. Sitedoc_admin er beskyttet.
  oppdaterBruker: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        organizationId: z.string().uuid(),
        navn: z.string().min(1).max(200).optional(),
        email: z.string().email().optional(),
        telefon: z.string().max(50).nullable().optional(),
        rolle: z.enum(["user", "company_admin"]).optional(),
        ansattnummer: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      // O-3b: hent målbrukerens org via OrganizationMember (fallback User.organizationId)
      const målbrukerOrgId = await hentBrukersOrg(input.userId);
      const målbruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { role: true, email: true },
      });

      if (!målbruker || målbrukerOrgId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brukeren tilhører ikke din organisasjon",
        });
      }

      if (målbruker.role === "sitedoc_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kan ikke endre systemadministrator",
        });
      }

      if (input.userId === ctx.userId && input.rolle && input.rolle !== "company_admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kan ikke fjerne din egen admin-rolle",
        });
      }

      if (input.email && input.email !== målbruker.email) {
        const epostKonflikt = await ctx.prisma.user.findFirst({
          where: {
            email: input.email,
            canLogin: true,
            id: { not: input.userId },
          },
          select: { id: true },
        });
        if (epostKonflikt) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "E-postadressen er allerede i bruk",
          });
        }
      }

      const data: {
        name?: string;
        email?: string;
        phone?: string | null;
        role?: string;
        ansattnummer?: string | null;
      } = {};
      if (input.navn !== undefined) data.name = input.navn;
      if (input.email !== undefined) data.email = input.email;
      if (input.telefon !== undefined) data.phone = input.telefon;
      if (input.rolle !== undefined) data.role = input.rolle;

      const oppdatert = await ctx.prisma.user.update({
        where: { id: input.userId },
        data,
        select: { id: true, name: true, email: true, phone: true, role: true },
      });

      // ansattnummer eies av OrganizationMember (O-5b)
      if (input.ansattnummer !== undefined) {
        await ctx.prisma.organizationMember.updateMany({
          where: { userId: input.userId, organizationId: orgId },
          data: { ansattnummer: input.ansattnummer || null },
        });
      }

      const medlem = await ctx.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
        select: { ansattnummer: true },
      });
      return { ...oppdatert, ansattnummer: medlem?.ansattnummer ?? null };
    }),

  // Tildel granulær firma-rolle (per A.25 — f.eks. "hms_ansvarlig")
  // O-3a: skriver til OrganizationMember.firmaRoller. OrganizationRole-tabellen droppes i O-5.
  tildelOrgRolle: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.string().min(1), // "hms_ansvarlig" osv.
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      // Validering: målbruker må tilhøre samme firma (via OrganizationMember-rad)
      const member = await ctx.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
        select: { id: true, firmaRoller: true },
      });
      if (!member) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bruker tilhører ikke samme firma",
        });
      }

      // Idempotent — Set-deduplisering sikrer at flere tildelings-kall ikke feiler
      const oppdaterteRoller = Array.from(new Set([...member.firmaRoller, input.role]));
      return ctx.prisma.organizationMember.update({
        where: { id: member.id },
        data: { firmaRoller: oppdaterteRoller },
      });
    }),

  // Fjern granulær firma-rolle (per A.25)
  // O-3a: skriver til OrganizationMember.firmaRoller. OrganizationRole-tabellen droppes i O-5.
  fjernOrgRolle: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.string().min(1),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      const member = await ctx.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: orgId } },
        select: { id: true, firmaRoller: true },
      });
      if (!member) {
        return { fjernet: 0 };
      }

      const eksisterte = member.firmaRoller.includes(input.role);
      if (!eksisterte) {
        return { fjernet: 0 };
      }

      const oppdaterteRoller = member.firmaRoller.filter((r) => r !== input.role);
      await ctx.prisma.organizationMember.update({
        where: { id: member.id },
        data: { firmaRoller: oppdaterteRoller },
      });

      return { fjernet: 1 };
    }),

  // Hent OrganizationSetting for innlogget brukers firma.
  // Upserts default-rad ved første kall (eldre Organization-rader kan mangle setting).
  hentSetting: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);
    return ctx.prisma.organizationSetting.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId },
      update: {},
    });
  }),

  // Oppdater OrganizationSetting (alle felter valgfrie, gjør upsert).
  oppdaterSetting: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        timezone: z.string().min(1).optional(),
        timerTilgangDefault: z
          .enum(["alle-ansatte", "kun-prosjektmedlemmer", "sertifiserte"])
          .optional(),
        vareforbrukTilgangDefault: z
          .enum(["alle-ansatte", "kun-prosjektmedlemmer", "sertifiserte"])
          .optional(),
        maskinbrukTilgangDefault: z
          .enum(["alle-ansatte", "kun-prosjektmedlemmer", "sertifiserte"])
          .optional(),
        kompetanseRegistreringTilgang: z
          .enum(["firma_admin", "bruker_egen", "alle"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId: inputOrgId, ...settingData } = input;
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, inputOrgId);
      return ctx.prisma.organizationSetting.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          ...settingData,
        },
        update: settingData,
      });
    }),

  /**
   * Aktiver eller deaktiver firmamodul (Steg 1c Fase B).
   *
   * Aktiver: setter har_*_modul=true + syncer ProjectModule-rader for alle
   * prosjekter firmaet er knyttet til (primary eller partner) — eksisterende
   * rader reaktiveres, nye opprettes med status='aktiv'.
   *
   * Deaktiver: setter har_*_modul=false + setter alle ProjectModule-rader for
   * firmaet til status='arkivert'. Rader beholdes — historikk bevares.
   *
   * Atomisk via $transaction. Tilgang gates til sitedoc_admin og firmaets
   * company_admin via autoriserAdminForFirma.
   */
  settFirmamodul: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        slug: z.enum(["timer", "maskin", "varelager"]),
        aktiver: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId, input.organizationId);

      // Steg 1e Fase C: OrganizationModule er eneste sannhetskilde.
      // har_*_modul-flaggene er droppet — ingen dual-write.
      return ctx.prisma.$transaction(async (tx) => {
        if (input.aktiver) {
          await skrivOrganizationModuleAktiver(tx, orgId, input.slug, ctx.userId);
          await syncProjektModulerPaaAktiver(tx, orgId, input.slug);
        } else {
          await skrivOrganizationModuleDeaktiver(tx, orgId, input.slug, ctx.userId);
          await syncProjektModulerPaaDeaktiver(tx, orgId, input.slug);
        }

        return { ok: true };
      });
    }),

  /**
   * Slå opp firma i Brønnøysund Enhetsregisteret på organisasjonsnummer.
   * Åpent API — ingen autentisering kreves mot Brreg, men vi krever
   * innlogget bruker for å forhindre at endepunktet brukes som anonym proxy.
   */
  hentFraBrreg: protectedProcedure
    .input(z.object({ orgnr: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await hentFirmaFraBrreg(input.orgnr);
      } catch (e) {
        if (e instanceof BrregError) {
          const code =
            e.kode === "UGYLDIG_ORGNR"
              ? "BAD_REQUEST"
              : e.kode === "IKKE_FUNNET"
                ? "NOT_FOUND"
                : "INTERNAL_SERVER_ERROR";
          throw new TRPCError({ code, message: e.message });
        }
        throw e;
      }
    }),
});
