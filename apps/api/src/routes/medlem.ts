import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc/trpc";
import { addMemberSchema } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import { sendInvitasjonsEpost } from "../services/epost";
import {
  verifiserAdmin,
  verifiserAdminEllerFirmaansvarlig,
  verifiserProsjektmedlem,
  hentBrukerTillatelser,
} from "../trpc/tilgangskontroll";

export const medlemRouter = router({
  // Hent alle medlemmer for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
          faggruppeKoblinger: {
            include: { faggruppe: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Hent mine faggrupper i et prosjekt (for innlogget bruker)
  hentMineFaggrupper: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: ctx.userId,
            projectId: input.projectId,
          },
        },
        include: {
          faggruppeKoblinger: {
            include: { faggruppe: true },
          },
        },
      });

      if (!medlem) return [];

      // Registratorer (create_checklists/create_tasks) eller admin → se alle faggrupper
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      const erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks");
      if (erRegistrator || medlem.role === "admin") {
        const alle = await ctx.prisma.faggruppe.findMany({
          where: { projectId: input.projectId },
          orderBy: { name: "asc" },
        });
        return alle;
      }

      return medlem.faggruppeKoblinger.map((me) => me.faggruppe);
    }),

  // Hent mine tillatelser i et prosjekt
  hentMineTillatelser: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      return [...tillatelser];
    }),

  // Legg til medlem i prosjekt (krever admin eller firmaansvarlig)
  leggTil: protectedProcedure
    .input(addMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const { erAdmin } = await verifiserAdminEllerFirmaansvarlig(ctx.userId, input.projectId);

      // Firmaansvarlig: kun invitere brukere med samme organizationId
      if (!erAdmin) {
        const inviterende = await ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { organizationId: true },
        });

        if (!inviterende.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Du tilhører ingen organisasjon",
          });
        }

        // Sjekk at organizationId matcher
        if (input.organizationId && input.organizationId !== inviterende.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Du kan kun invitere brukere til ditt eget firma",
          });
        }

        // Tving organizationId til eget firma
        input.organizationId = inviterende.organizationId;

        // Firmaansvarlig kan ikke opprette admins
        if (input.role === "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Kun administratorer kan opprette admin-brukere",
          });
        }

        // Sjekk at eksisterende bruker tilhører samme firma (per B.7: findFirst)
        const eksisterendeBruker = await ctx.prisma.user.findFirst({
          where: { email: input.email, canLogin: true },
          select: { organizationId: true },
          orderBy: { createdAt: "asc" },
        });
        if (eksisterendeBruker && eksisterendeBruker.organizationId && eksisterendeBruker.organizationId !== inviterende.organizationId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Brukeren tilhører et annet firma",
          });
        }
      }

      // Slå opp bruker på e-post (per B.7: findFirst — eldste aktive først)
      let user = await ctx.prisma.user.findFirst({
        where: { email: input.email, canLogin: true },
        orderBy: { createdAt: "asc" },
      });

      if (!user) {
        user = await ctx.prisma.user.create({
          data: {
            email: input.email,
            name: `${input.firstName} ${input.lastName}`,
            phone: input.phone,
            organizationId: input.organizationId,
          },
        });
      } else {
        // Oppdater manglende felter (navn, telefon, firma)
        const oppdatering: { name?: string; phone?: string; organizationId?: string } = {};
        if (!user.name) oppdatering.name = `${input.firstName} ${input.lastName}`;
        if (input.phone && !user.phone) oppdatering.phone = input.phone;
        if (input.organizationId && !user.organizationId) oppdatering.organizationId = input.organizationId;
        if (Object.keys(oppdatering).length > 0) {
          user = await ctx.prisma.user.update({
            where: { id: user.id },
            data: oppdatering,
          });
        }
      }

      // Sjekk om medlemskap allerede finnes
      const eksisterende = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: input.projectId,
          },
        },
      });

      if (eksisterende) {
        // Legg til nye faggruppe-tilknytninger
        if (input.faggruppeIder.length > 0) {
          for (const entId of input.faggruppeIder) {
            await ctx.prisma.faggruppeKobling.upsert({
              where: {
                projectMemberId_faggruppeId: {
                  projectMemberId: eksisterende.id,
                  faggruppeId: entId,
                },
              },
              create: {
                projectMemberId: eksisterende.id,
                faggruppeId: entId,
              },
              update: {},
            });
          }
        }
        return ctx.prisma.projectMember.findUnique({
          where: { id: eksisterende.id },
          include: {
            user: true,
            faggruppeKoblinger: { include: { faggruppe: true } },
          },
        });
      }

      const nyMedlem = await ctx.prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: input.projectId,
          role: input.role,
          faggruppeKoblinger: {
            create: input.faggruppeIder.map((entId) => ({
              faggruppeId: entId,
            })),
          },
        },
        include: {
          user: true,
          faggruppeKoblinger: { include: { faggruppe: true } },
        },
      });

      // Send invitasjons-e-post hvis brukeren ikke har logget inn (ingen Account)
      const harKonto = await ctx.prisma.account.findFirst({
        where: { userId: user.id },
      });

      if (!harKonto) {
        try {
          const token = crypto.randomBytes(32).toString("base64url");
          const utloper = new Date();
          utloper.setDate(utloper.getDate() + 7);

          const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
            where: { id: input.projectId },
            select: { name: true },
          });

          const inviterer = await ctx.prisma.user.findUniqueOrThrow({
            where: { id: ctx.userId },
            select: { name: true },
          });

          await ctx.prisma.projectInvitation.create({
            data: {
              email: user.email,
              token,
              projectId: input.projectId,
              role: input.role,
              faggruppeId: input.faggruppeIder[0] ?? undefined,
              invitedByUserId: ctx.userId,
              expiresAt: utloper,
            },
          });

          await sendInvitasjonsEpost({
            til: user.email,
            invitasjonstoken: token,
            prosjektNavn: prosjekt.name,
            invitertAvNavn: inviterer.name ?? "En kollega",
            melding: input.melding,
          });
        } catch (error) {
          console.error("Kunne ikke sende invitasjons-e-post:", error);
        }
      }

      return nyMedlem;
    }),

  // Fjern medlem fra prosjekt (krever admin)
  fjern: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.delete({
        where: { id: input.id },
      });
    }),

  // Oppdater rolle på medlem (krever admin)
  oppdaterRolle: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        role: z.enum(["member", "admin"]),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.projectMember.update({
        where: { id: input.id },
        data: { role: input.role },
        include: {
          user: true,
          faggruppeKoblinger: { include: { faggruppe: true } },
        },
      });
    }),

  // Oppdater medlem (navn, e-post, telefon, rolle).
  // organizationId kan IKKE endres via dette endepunktet — sikkerhetsfiks per
  // SCREENING-29-1 (oppryddings-plan-2026-04-28.md). Tidligere lot endepunktet
  // prosjektadmin endre annen brukers User.organizationId, som brøt firma-
  // isolering og B.7 Modell A. Hvis legitim use-case for å flytte bruker mellom
  // firma trengs, lag separat organisasjon.flyttBruker-mutation gated med
  // verifiserSiteDocAdmin.
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["member", "admin"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.projectMember.findUniqueOrThrow({
        where: { id: input.id },
        include: { user: true },
      });

      // User kan være null hvis User-rad er slettet (per B.7 SetNull-cascade).
      // Bruker-oppdatering er ikke meningsfull i den tilstanden.
      if (!medlem.user || !medlem.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bruker er fjernet — kan ikke redigere medlem",
        });
      }

      // Oppdater User-felter
      const brukerOppdatering: { name?: string; email?: string; phone?: string | null } = {};
      if (input.name !== undefined) brukerOppdatering.name = input.name;
      if (input.phone !== undefined) brukerOppdatering.phone = input.phone || null;
      if (input.email !== undefined && input.email !== medlem.user.email) {
        // Per B.7: composite (email, organizationId) — sjekk konflikt innen SAMME firma
        const eksisterende = await ctx.prisma.user.findFirst({
          where: { email: input.email, organizationId: medlem.user.organizationId },
        });
        if (eksisterende) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "E-postadressen er allerede i bruk",
          });
        }
        brukerOppdatering.email = input.email;
      }

      if (Object.keys(brukerOppdatering).length > 0) {
        await ctx.prisma.user.update({
          where: { id: medlem.userId },
          data: brukerOppdatering,
        });
      }

      // Oppdater rolle hvis endret
      if (input.role !== undefined) {
        await ctx.prisma.projectMember.update({
          where: { id: input.id },
          data: { role: input.role },
        });
      }

      return ctx.prisma.projectMember.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: true,
          faggruppeKoblinger: { include: { faggruppe: true } },
        },
      });
    }),

  // Tilknytt et eksisterende prosjektmedlem til en faggruppe
  tilknyttFaggruppe: protectedProcedure
    .input(
      z.object({
        projectMemberId: z.string().uuid(),
        faggruppeId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.faggruppeKobling.upsert({
        where: {
          projectMemberId_faggruppeId: {
            projectMemberId: input.projectMemberId,
            faggruppeId: input.faggruppeId,
          },
        },
        create: {
          projectMemberId: input.projectMemberId,
          faggruppeId: input.faggruppeId,
        },
        update: {},
      });
    }),

  // Fjern et prosjektmedlem fra en faggruppe (fjerner FaggruppeKobling)
  fjernFraFaggruppe: protectedProcedure
    .input(
      z.object({
        projectMemberId: z.string().uuid(),
        faggruppeId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      return ctx.prisma.faggruppeKobling.delete({
        where: {
          projectMemberId_faggruppeId: {
            projectMemberId: input.projectMemberId,
            faggruppeId: input.faggruppeId,
          },
        },
      });
    }),

  // Søk brukere på e-post (autocomplete)
  sokBrukere: protectedProcedure
    .input(z.object({ email: z.string().min(1), projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.user.findMany({
        where: {
          email: { contains: input.email, mode: "insensitive" },
        },
        take: 10,
        select: { id: true, name: true, email: true, image: true },
      });
    }),

  // Toggle firmaansvarlig-status for et prosjektmedlem
  settFirmaansvarlig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        erFirmaansvarlig: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      return ctx.prisma.projectMember.update({
        where: { id: input.id },
        data: { erFirmaansvarlig: input.erFirmaansvarlig },
      });
    }),

  // Toggle kanAttestere-kapabilitet (timer-attestering) for et prosjektmedlem.
  // role="admin" har implisitt attestering-tilgang via erProsjektLeder, men
  // kanAttestere lar prosjekt-admin gi eksplisitt opt-in til medlemmer
  // (role="member") som ikke skal være full prosjekt-admin.
  settKanAttestere: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        kanAttestere: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      return ctx.prisma.projectMember.update({
        where: { id: input.id },
        data: { kanAttestere: input.kanAttestere },
        select: { id: true, kanAttestere: true },
      });
    }),
});
