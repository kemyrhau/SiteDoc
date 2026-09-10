import { z } from "zod";
import crypto from "crypto";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  addExistingMemberSchema,
  addExistingMembersManySchema,
  registrerMedlemSchema,
} from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import { sendInvitasjonsEpost } from "../services/epost";
import { aktivAnsattIFirmaWhere, sikreProsjektmedlemmer } from "../services/ansatt";
import {
  verifiserAdmin,
  verifiserAdminEllerFirmaansvarlig,
  hentProsjektRolleNivaa,
  erGruppeansvarlig,
  verifiserProsjektmedlem,
  hentBrukerTillatelser,
  hentBrukersOrg,
  hentBrukersFlytMedlemskap,
  hentBrukersOpprettFlytMedlemskap,
  autoriserAdminForFirma,
} from "../trpc/tilgangskontroll";

export const medlemRouter = router({
  // Hent alle medlemmer for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // FIRMA-kolonnen i kontakter-matrisen: firma utledes fra OrganizationMember
      // (legacy User.organizationId ble droppet i migrering O5c 2026-05-13). Vi
      // henter brukerens medlemskap + prosjektets eier-org for multi-org-regelen.
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });
      const primaryOrgId = prosjekt?.primaryOrganizationId ?? null;

      const medlemmer = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              canLogin: true,
              language: true,
              hmsKortNr: true,
              hmsKortUtloper: true,
              organizationMembers: {
                select: {
                  organizationId: true,
                  organization: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
          faggruppeKoblinger: {
            include: { faggruppe: { select: { id: true, name: true, color: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Multi-org-regel: vis brukerens EGET firma — (1) membership som matcher
      // prosjektets eier-org (intern ansatt), ellers (2) første membership
      // deterministisk (ekstern UE viser sitt eget firma). Ingen → null → «—».
      return medlemmer.map((m) => {
        if (!m.user) return { ...m, user: null };
        const { organizationMembers, ...userRest } = m.user;
        const valgt =
          organizationMembers.find((om) => om.organizationId === primaryOrgId) ??
          organizationMembers[0] ??
          null;
        // Persondata-gjerde (2026-09-10): SAMME diskriminator som medlem.oppdater
        // bruker server-side — er personen ansatt i prosjektets eier-firma, eies
        // kontaktinfoen av HR og redigeres kun via firmaadmin-veien. Flagget lar
        // personkortet vise kontaktinfo som read-only i stedet for å la brukeren
        // skrive og så feile på lagring (FORBIDDEN).
        const erAnsattIEierFirma =
          !!primaryOrgId &&
          organizationMembers.some((om) => om.organizationId === primaryOrgId);
        return {
          ...m,
          user: {
            ...userRest,
            erAnsattIEierFirma,
            organization: valgt
              ? { id: valgt.organization.id, name: valgt.organization.name }
              : null,
          },
        };
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

  // Hent flytene innlogget bruker er medlem av (alle tre bindinger: person/faggruppe/gruppe).
  // Brukes av de fire klient-opprett-flatene for å utlede bestiller/utfører-faggruppe når
  // brukeren er person-/gruppe-direkte medlem (uten egen faggruppe).
  hentMineFlyter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    // Eksplisitt `string[]`-retur: klienten trenger kun flyt-ID-ene, og en trivial
    // returtype holder tRPC-router-typen liten (unngår TS2589 på tunge tRPC-sider).
    // Any-rolle (synlighet) — IKKE for opprett-kandidater (bruk hentMineOpprettFlyter).
    .query(async ({ ctx, input }): Promise<string[]> => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return hentBrukersFlytMedlemskap(ctx.userId, input.projectId);
    }),

  // Flyt-ID-ene der bruker er OPPRETTER-medlem (rolle "registrator") — kilde for
  // opprett-kandidater i sjekkliste-mal-modalen. Speiler server-B2(b) (F1).
  hentMineOpprettFlyter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<string[]> => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return hentBrukersOpprettFlytMedlemskap(ctx.userId, input.projectId);
    }),

  // Hent mine tillatelser i et prosjekt
  hentMineTillatelser: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      return [...tillatelser];
    }),

  // Én komplett registrering i ÉN transaksjon (registreringsmodell fase 1):
  // finn/opprett bruker → prosjektmedlem → valgfrie faggrupper, brukergrupper og
  // flyt-roller. Feiler ett ledd, rulles ALT tilbake — vi ender aldri med en person
  // som finnes i kontakter men ikke i flyten (halvveis-tilstanden vi rydder bort).
  // Erstatter medlem.leggTil + gruppe.leggTilMedlem. Invitasjon/e-post er best-effort
  // UTENFOR tx (et nettverkskall skal ikke holde en DB-tx åpen; e-postfeil svelges som før).
  registrer: protectedProcedure
    .input(registrerMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      // Rollenivå uten hard-kast, så en ren gruppeansvarlig kan slippe inn på
      // gruppe-binding-veien (ansettelses-/frysevakt kaster fortsatt).
      const { erAdmin, erFirmaansvarlig } = await hentProsjektRolleNivaa(ctx.userId, input.projectId);

      // Auth-trapp, splittet (2026-09-10):
      //  - flyt-binding: FORTSATT admin-only (flyten konfigureres ikke herfra).
      //  - gruppe-binding: admin ELLER gruppeansvarlig for HVER forespurt gruppe
      //    (ALLE, ikke minst én — sender du tre og eier én, avvises hele kallet).
      //  - basis (kontakt uten gruppe/flyt): admin ELLER firmaansvarlig (uendret rett).
      if (input.flytBindinger.length > 0 && !erAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bare administratorer kan koble en kontakt til en dokumentflyt",
        });
      }
      if (input.gruppeIder.length > 0 && !erAdmin) {
        const ansvarligForAlle = (
          await Promise.all(
            input.gruppeIder.map((gid) => erGruppeansvarlig(ctx.userId!, input.projectId, gid)),
          )
        ).every(Boolean);
        if (!ansvarligForAlle) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Du kan bare legge til medlemmer i grupper du er gruppeansvarlig for",
          });
        }
      }
      if (
        input.gruppeIder.length === 0 &&
        input.flytBindinger.length === 0 &&
        !erAdmin &&
        !erFirmaansvarlig
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Krever administrator- eller firmaansvarlig-rettighet",
        });
      }

      // Firmaansvarlig-begrensninger (fra leggTil): kun eget firma, ingen admin-opprettelse,
      // og en eksisterende bruker må tilhøre samme firma (per B.7).
      let organizationId = input.organizationId;
      if (!erAdmin) {
        const inviterendeOrgId = await hentBrukersOrg(ctx.userId);
        if (!inviterendeOrgId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Du tilhører ingen organisasjon" });
        }
        if (organizationId && organizationId !== inviterendeOrgId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Du kan kun invitere brukere til ditt eget firma",
          });
        }
        organizationId = inviterendeOrgId;
        if (input.role === "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Kun administratorer kan opprette admin-brukere",
          });
        }
        // Eksisterende bruker (userId → eksakt; ellers e-post) må være i samme firma.
        const eksisterende = input.userId
          ? await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } })
          : await ctx.prisma.user.findFirst({
              where: { email: input.email, canLogin: true },
              select: { id: true },
              orderBy: { createdAt: "asc" },
            });
        if (eksisterende) {
          const eksisterendeOrgId = await hentBrukersOrg(eksisterende.id);
          if (eksisterendeOrgId && eksisterendeOrgId !== inviterendeOrgId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Brukeren tilhører et annet firma" });
          }
        }
      } else if (organizationId) {
        // Krav 1a (firmatilknytning 2026-09-10): admin-grenen validerte IKKE
        // organizationId i det hele tatt — en prosjektadmin (eller firma-admin) i
        // ETT prosjekt kunne knytte en person til et HVILKET SOM HELST firma, også
        // et ekte kundefirma han ikke har noe med, og :306 opprettet
        // OrganizationMember uten videre sjekk. Skillet er Organization.erKunde:
        //   - skall-firma (kun part i prosjekt/flyt) = prosjektets sak → prosjektadmin OK
        //   - kundefirma (bruker SiteDoc) = en ANSETTELSE → firmaadmin i DET firmaet
        // autoriserAdminForFirma = sitedoc_admin ELLER firma_admin på org. Speiler
        // regeltabellen «Inn i et kundefirma» (Kenneth-vedtak).
        const org = await ctx.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { erKunde: true },
        });
        if (!org) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Firma finnes ikke" });
        }
        if (org.erKunde) {
          await autoriserAdminForFirma(ctx.userId, organizationId);
        }
      }

      // Kryss-prosjekt-vern: flyt-ene og gruppene MÅ høre til dette prosjektet.
      if (input.flytBindinger.length > 0) {
        const flytIder = [...new Set(input.flytBindinger.map((f) => f.dokumentflytId))];
        const funnet = await ctx.prisma.dokumentflyt.findMany({
          where: { id: { in: flytIder }, projectId: input.projectId },
          select: { id: true },
        });
        if (funnet.length !== flytIder.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ukjent dokumentflyt for dette prosjektet" });
        }
      }
      if (input.gruppeIder.length > 0) {
        const funnet = await ctx.prisma.projectGroup.findMany({
          where: { id: { in: input.gruppeIder }, projectId: input.projectId },
          select: { id: true },
        });
        if (funnet.length !== input.gruppeIder.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ukjent brukergruppe for dette prosjektet" });
        }
      }

      const fulltNavn = `${input.firstName} ${input.lastName}`;

      // Alle bindinger i én transaksjon. Feiler ett ledd → hele registreringen rulles tilbake.
      const resultat = await ctx.prisma.$transaction(async (tx) => {
        // 1. Finn/opprett bruker. userId → EKSAKT (findUnique); ellers e-post (findFirst,
        //    canLogin, eldste først — B.7: e-post ikke globalt unik, sikreste nøkkel vinner).
        let user = input.userId
          ? await tx.user.findUnique({ where: { id: input.userId } })
          : await tx.user.findFirst({
              where: { email: input.email, canLogin: true },
              orderBy: { createdAt: "asc" },
            });

        if (!user) {
          if (input.userId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke brukeren" });
          }
          user = await tx.user.create({
            data: { email: input.email, name: fulltNavn, phone: input.phone },
          });
        } else {
          // Fyll KUN manglende felter — aldri overskriv eksisterende navn/telefon.
          const oppdatering: { name?: string; phone?: string } = {};
          if (!user.name) oppdatering.name = fulltNavn;
          if (input.phone && !user.phone) oppdatering.phone = input.phone;
          if (Object.keys(oppdatering).length > 0) {
            user = await tx.user.update({ where: { id: user.id }, data: oppdatering });
          }
        }

        // 2. Sikre OrganizationMember-rad hvis bruker skal tilhøre et firma.
        if (organizationId) {
          await tx.organizationMember.upsert({
            where: { userId_organizationId: { userId: user.id, organizationId } },
            create: { userId: user.id, organizationId, ansattRolle: "ansatt", firmaRoller: [] },
            update: {},
          });
        }

        // 3. Finn/opprett ProjectMember (idempotent — dobbelttrykk gir ikke to rader).
        let projectMember = await tx.projectMember.findUnique({
          where: { userId_projectId: { userId: user.id, projectId: input.projectId } },
        });
        if (!projectMember) {
          projectMember = await tx.projectMember.create({
            data: { userId: user.id, projectId: input.projectId, role: input.role },
          });
        }

        // 4. Faggruppe-koblinger (upsert — idempotent).
        for (const faggruppeId of input.faggruppeIder) {
          await tx.faggruppeKobling.upsert({
            where: {
              projectMemberId_faggruppeId: { projectMemberId: projectMember.id, faggruppeId },
            },
            create: { projectMemberId: projectMember.id, faggruppeId },
            update: {},
          });
        }

        // 5. Brukergruppe-medlemskap (upsert — idempotent).
        for (const groupId of input.gruppeIder) {
          await tx.projectGroupMember.upsert({
            where: {
              groupId_projectMemberId: { groupId, projectMemberId: projectMember.id },
            },
            create: { groupId, projectMemberId: projectMember.id },
            update: {},
          });
        }

        // 6. Flyt-roller — idempotent: hopp over ledd som allerede finnes (rolle+steg).
        for (const binding of input.flytBindinger) {
          const finnes = await tx.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: binding.dokumentflytId,
              projectMemberId: projectMember.id,
              rolle: binding.rolle,
              steg: binding.steg,
            },
            select: { id: true },
          });
          if (!finnes) {
            await tx.dokumentflytMedlem.create({
              data: {
                dokumentflytId: binding.dokumentflytId,
                projectMemberId: projectMember.id,
                rolle: binding.rolle,
                steg: binding.steg,
              },
            });
          }
        }

        return {
          userId: user.id,
          userEmail: user.email,
          harNavn: !!user.name,
          projectMemberId: projectMember.id,
        };
      });

      // 7. Invitasjon + e-post — best-effort UTENFOR tx. Kun hvis brukeren ikke har
      //    logget inn (ingen Account), og kun én gang (dedup på ventende invitasjon).
      const harKonto = await ctx.prisma.account.findFirst({ where: { userId: resultat.userId } });
      if (!harKonto) {
        try {
          const eksisterendeInvitasjon = await ctx.prisma.projectInvitation.findFirst({
            where: {
              email: resultat.userEmail.toLowerCase(),
              projectId: input.projectId,
              status: "pending",
            },
          });
          if (!eksisterendeInvitasjon) {
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
                email: resultat.userEmail.toLowerCase(),
                token,
                projectId: input.projectId,
                role: input.role,
                faggruppeId: input.faggruppeIder[0] ?? undefined,
                groupId: input.gruppeIder[0] ?? undefined,
                invitedByUserId: ctx.userId,
                expiresAt: utloper,
              },
            });

            await sendInvitasjonsEpost({
              til: resultat.userEmail,
              invitasjonstoken: token,
              prosjektNavn: prosjekt.name,
              invitertAvNavn: inviterer.name ?? "En kollega",
              melding: input.melding,
            });
          }
        } catch (error) {
          console.error("Kunne ikke sende invitasjons-e-post:", error);
        }
      }

      return ctx.prisma.projectMember.findUnique({
        where: { id: resultat.projectMemberId },
        include: {
          user: true,
          faggruppeKoblinger: { include: { faggruppe: true } },
        },
      });
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

      // Persondata-gjerde (2026-09-10): kontaktinfo (navn/e-post/telefon) for
      // firmaets EGNE ansatte eies av HR og endres kun via firmaadmin-veien
      // (organisasjon.oppdaterBruker, gated med verifiserFirmaAdmin). Prosjektadmin
      // skal SE folk, ikke ENDRE dem. Skillet er hvem personen ER, ikke hvem som
      // redigerer: eksterne kontakter (byggherre, konsulent — uten ansettelse i
      // eier-firmaet) har ingen annen vedlikeholder, så dem redigerer prosjektadmin
      // fortsatt. Prosjektrolle (input.role) er prosjektdata og gjerdes IKKE.
      const endrerKontaktinfo =
        input.name !== undefined ||
        input.email !== undefined ||
        input.phone !== undefined;
      if (endrerKontaktinfo) {
        const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
          where: { id: input.projectId },
          select: { primaryOrganizationId: true },
        });
        if (prosjekt.primaryOrganizationId) {
          const erFirmaansatt = await ctx.prisma.organizationMember.findFirst({
            where: {
              userId: medlem.userId,
              organizationId: prosjekt.primaryOrganizationId,
            },
            select: { id: true },
          });
          if (erFirmaansatt) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "Kontaktinfo for firmaets ansatte endres av firmaadministrator under Firma → Ansatte.",
            });
          }
        }
      }

      // Oppdater User-felter
      const brukerOppdatering: { name?: string; email?: string; phone?: string | null } = {};
      if (input.name !== undefined) brukerOppdatering.name = input.name;
      if (input.phone !== undefined) brukerOppdatering.phone = input.phone || null;
      if (input.email !== undefined && input.email !== medlem.user.email) {
        // Per B.7: composite (email, organizationId) — sjekk konflikt innen SAMME firma
        const malOrgId = await hentBrukersOrg(medlem.userId);
        const eksisterende = malOrgId
          ? await ctx.prisma.user.findFirst({
              where: {
                email: input.email,
                organizationMembers: { some: { organizationId: malOrgId } },
              },
            })
          : await ctx.prisma.user.findFirst({
              where: { email: input.email, organizationMembers: { none: {} } },
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

  // Legg et prosjektmedlem til i en faggruppe (oppretter FaggruppeKobling).
  // Symmetrisk tvilling av fjernFraFaggruppe: samme (projectMemberId, faggruppeId)-
  // signatur, samme verifiserAdmin-gate. upsert (ikke create) så dobbelttrykk ikke
  // gir to koblinger eller en unik-feil — @@unique([projectMemberId, faggruppeId]).
  leggTilFaggruppe: protectedProcedure
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

  // Fjern et prosjektmedlem fra en faggruppe (fjerner FaggruppeKobling).
  // Trygt hard-delete: FaggruppeKobling har ingen barn-relasjoner (schema.prisma:682-683),
  // dokumenter peker på Faggruppe og ikke på koblingen (Checklist/Task/Godkjenning),
  // og person-direkte flytbindinger ligger i egne DokumentflytMedlem-rader. Ingen blir
  // foreldreløse — personen mister kun sin egen tilgang til faggruppens dokumenter (Lag 2,
  // som leser koblingens eksistens, ikke periodeSlutt). Målt 2026-09-08.
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

  // Hent firma-brukere som ikke er prosjektmedlem ennå.
  // Brukes av «Velg fra firma»-flyt — admin slipper å skrive e-post.
  hentLedigeFirmaBrukere: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserAdminEllerFirmaansvarlig(ctx.userId, input.projectId);

      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });

      if (!prosjekt.primaryOrganizationId) return [];

      const eksisterende = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId, userId: { not: null } },
        select: { userId: true },
      });
      const eksisterendeIder = eksisterende
        .map((m) => m.userId)
        .filter((id): id is string => id !== null);

      const medlemmer = await ctx.prisma.organizationMember.findMany({
        where: {
          // «Aktiv, brukbar ansatt i firmaet» — delt kandidatregel (services/ansatt.ts).
          // Tidligere hadde denne kun `user.canLogin` og glemte `status:"aktiv"` → en
          // deaktivert ansatt var valgbar. Nå kan ikke halve regelen forsvinne.
          ...aktivAnsattIFirmaWhere(prosjekt.primaryOrganizationId),
          userId: { notIn: eksisterendeIder },
        },
        select: {
          avdelingId: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { user: { name: "asc" } },
      });

      return medlemmer.map((m) => ({ ...m.user, avdelingId: m.avdelingId }));
    }),

  // Legg til en eksisterende firma-bruker som prosjektmedlem (ingen e-post sendt).
  // Krever at userId tilhører samme firma som prosjektet.
  leggTilEksisterende: protectedProcedure
    .input(addExistingMemberSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdminEllerFirmaansvarlig(ctx.userId, input.projectId);

      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });

      const bruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, canLogin: true, name: true, email: true },
      });
      if (!bruker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bruker ikke funnet" });
      }
      if (!bruker.canLogin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bruker er deaktivert (canLogin = false)",
        });
      }
      const brukerOrgId = await hentBrukersOrg(input.userId);
      if (brukerOrgId !== prosjekt.primaryOrganizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Bruker tilhører ikke samme firma som prosjektet",
        });
      }

      // Idempotent: avvis hvis allerede medlem.
      const eksisterende = await ctx.prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId: input.userId, projectId: input.projectId },
        },
        select: { id: true },
      });
      if (eksisterende) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bruker er allerede medlem av prosjektet",
        });
      }

      const nyMedlem = await ctx.prisma.projectMember.create({
        data: {
          userId: input.userId,
          projectId: input.projectId,
          role: input.role,
          faggruppeKoblinger: {
            create: input.faggruppeIder.map((fid) => ({ faggruppeId: fid })),
          },
        },
        include: {
          user: true,
          faggruppeKoblinger: { include: { faggruppe: true } },
        },
      });

      return nyMedlem;
    }),

  // Aktive avdelinger i prosjektets eier-firma, med antall AKTIVE brukbare ansatte
  // (samme kandidatregel som hentLedigeFirmaBrukere). Mater avdelingsvalget i
  // ansattvelgeren. Gatet som medlem-tillegg (prosjektadmin/firmaansvarlig) — ikke
  // firmaadmin-only som avdeling.hentAlle, som ville stengt prosjektadmin ute.
  hentAvdelingerForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserAdminEllerFirmaansvarlig(ctx.userId, input.projectId);

      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });
      if (!prosjekt.primaryOrganizationId) return [];
      const orgId = prosjekt.primaryOrganizationId;

      const avdelinger = await ctx.prisma.avdeling.findMany({
        where: { organizationId: orgId, aktiv: true },
        select: {
          id: true,
          navn: true,
          organizationMembers: {
            where: aktivAnsattIFirmaWhere(orgId),
            select: { userId: true },
          },
        },
        orderBy: { navn: "asc" },
      });

      return avdelinger.map((a) => ({
        id: a.id,
        navn: a.navn,
        // Bruker-IDene i avdelingen (aktive/brukbare) — klienten ekspanderer
        // avdelingsvalg til disse og teller ærlig hvor mange tilgang gis til.
        brukerIder: a.organizationMembers
          .map((m) => m.userId)
          .filter((id): id is string => id !== null),
      }));
    }),

  // Batch: legg til flere eksisterende firma-ansatte som prosjektmedlemmer (ansattvelger).
  // Deler ProjectMember-sikringen med dokumentflyt.leggTilAnsatteIRolle (services/ansatt.ts).
  leggTilEksisterendeMange: protectedProcedure
    .input(addExistingMembersManySchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdminEllerFirmaansvarlig(ctx.userId, input.projectId);

      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });
      if (!prosjekt.primaryOrganizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prosjektet har ikke et eier-firma å hente ansatte fra",
        });
      }

      const res = await sikreProsjektmedlemmer(ctx.prisma, {
        projectId: input.projectId,
        organizationId: prosjekt.primaryOrganizationId,
        userIds: input.userIds,
        role: input.role,
        faggruppeIder: input.faggruppeIder,
      });

      return {
        lagtTil: res.lagtTil,
        alleredeMedlem: res.alleredeMedlem,
        ugyldige: res.ugyldige.length,
      };
    }),
});
