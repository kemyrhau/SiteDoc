import { z } from "zod";
import type { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@sitedoc/shared";
import { isValidStatusTransition } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import {
  byggTilgangsFilter,
  verifiserEntrepriseTilhorighet,
  verifiserDokumentTilgang,
  verifiserFlytRolle,
  hentBrukerTillatelser,
} from "../trpc/tilgangskontroll";
import { sendDokumentVarsling, hentMottakerEposter } from "../services/epost";
import { oversettFritekst } from "../services/oversettelse-service";
import { byggTransferSnapshot } from "../services/transfer-snapshot";

// Felttyper der verdi er fritekst som skal oversettes
const FRITEKST_TYPER = new Set(["text_field"]);

export const sjekklisteRouter = router({
  // Hent alle sjekklister for et prosjekt (via mal)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        byggeplassId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);

      return ctx.prisma.checklist.findMany({
        where: {
          template: { projectId: input.projectId },
          ...(input.status ? { status: input.status } : {}),
          ...(input.byggeplassId ? { OR: [{ byggeplassId: input.byggeplassId }, { byggeplassId: null }] } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
          bestillerEnterprise: true,
          utforerEnterprise: true,
          bestiller: true,
          byggeplass: { select: { id: true, name: true, number: true } },
          drawing: { select: { id: true, name: true, floor: true } },
          recipientUser: { select: { id: true, name: true } },
          recipientGroup: { select: { id: true, name: true } },
          dokumentflyt: {
            select: {
              id: true,
              name: true,
              medlemmer: {
                select: {
                  id: true,
                  rolle: true,
                  steg: true,
                  enterprise: { select: { id: true, name: true } },
                  projectMember: { include: { user: { select: { id: true, name: true } } } },
                  group: { select: { id: true, name: true } },
                },
                orderBy: { steg: "asc" },
              },
            },
          },
          _count: { select: { images: true, transfers: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent én sjekkliste med alle detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } }, project: { select: { sourceLanguage: true } } } },
          bestillerEnterprise: true,
          utforerEnterprise: true,
          bestiller: true,
          byggeplass: { select: { id: true, name: true } },
          drawing: { select: { id: true, name: true, drawingNumber: true } },
          images: true,
          transfers: {
            include: {
              sender: { select: { id: true, name: true } },
              recipientUser: { select: { id: true, name: true } },
              recipientGroup: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          changeLog: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // Tilgangssjekk — hent projectId og domain fra malen
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      return sjekkliste;
    }),

  // Opprett ny sjekkliste
  opprett: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        bestillerEnterpriseId: z.string().uuid(),
        utforerEnterpriseId: z.string().uuid(),
        title: z.string().max(255).optional(),
        dokumentflytId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        byggeplassId: z.string().uuid().optional(),
        drawingId: z.string().uuid().optional(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser at bruker tilhører oppretter-entreprisen
      await verifiserEntrepriseTilhorighet(ctx.userId, input.bestillerEnterpriseId);

      // Sjekk grense for gratisbrukere (10 sjekklister per prosjekt)
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker.role !== "sitedoc_admin") {
        const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
          where: { id: input.bestillerEnterpriseId },
          select: { projectId: true },
        });
        const antall = await ctx.prisma.checklist.count({
          where: { bestillerEnterprise: { projectId: entreprise.projectId } },
        });
        if (antall >= 10) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Grensen på 10 sjekklister per prosjekt er nådd. Kontakt SiteDoc for å oppgradere.",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Finn malens prefix, navn og prosjekt for autonummerering
        const mal = await tx.reportTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          select: { prefix: true, name: true, projectId: true },
        });

        let nummer: number | undefined;
        if (mal.prefix) {
          // Finn høyeste nummer for denne malen i prosjektet
          const maks = await tx.checklist.aggregate({
            where: {
              templateId: input.templateId,
              number: { not: null },
            },
            _max: { number: true },
          });
          nummer = (maks._max.number ?? 0) + 1;
        }

        // Auto-generer tittel fra malnavn (nummer vises separat i Nr-kolonne)
        const tittel = input.title?.trim() || mal.name;

        // Finn hovedansvarlig fra dokumentflyt (utfører med erHovedansvarlig)
        let recipientUserId: string | undefined;
        let recipientGroupId: string | undefined;
        if (input.dokumentflytId) {
          const hovedansvarlig = await tx.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: input.dokumentflytId,
              rolle: "utforer",
              erHovedansvarlig: true,
            },
            include: {
              projectMember: { select: { userId: true } },
            },
          });
          if (hovedansvarlig?.projectMember) {
            recipientUserId = hovedansvarlig.projectMember.userId;
          } else if (hovedansvarlig?.groupId) {
            recipientGroupId = hovedansvarlig.groupId;
          }
        }

        return tx.checklist.create({
          data: {
            templateId: input.templateId,
            bestillerEnterpriseId: input.bestillerEnterpriseId,
            utforerEnterpriseId: input.utforerEnterpriseId,
            title: tittel,
            bestillerUserId: ctx.userId,
            eierUserId: ctx.userId,
            number: nummer,
            dokumentflytId: input.dokumentflytId,
            subject: input.subject,
            byggeplassId: input.byggeplassId,
            drawingId: input.drawingId,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            status: "draft",
            recipientUserId,
            recipientGroupId,
          },
        });
      });
    }),

  // Oppdater sjekkliste-metadata (entrepriser, tittel etc.)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(255).optional(),
        bestillerEnterpriseId: z.string().uuid().optional(),
        utforerEnterpriseId: z.string().uuid().optional(),
        drawingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        positionX: z.number().min(0).max(100).nullable().optional(),
        positionY: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: { template: { select: { projectId: true, domain: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Entreprise-endring kun tillatt i utkast-status
      if ((input.bestillerEnterpriseId || input.utforerEnterpriseId) && sjekkliste.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entrepriser kan kun endres i utkast-status",
        });
      }

      const { id, ...data } = input;
      return ctx.prisma.checklist.update({
        where: { id },
        data,
      });
    }),

  // Oppdater sjekklistedata (fylling av felter)
  oppdaterData: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk + hent eksisterende data og mal-innstilling
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            select: {
              projectId: true,
              domain: true,
              enableChangeLog: true,
              objects: { select: { id: true, label: true, type: true } },
            },
          },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Generer endringslogg hvis aktivert på malen
      const endringsloggRader: {
        checklistId: string;
        userId: string;
        fieldId: string;
        fieldLabel: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];

      if (sjekkliste.template.enableChangeLog) {
        const gammelData = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;
        const nyData = input.data as Record<string, Record<string, unknown>>;
        const displayTyper = new Set(["heading", "subtitle"]);

        const objektMap = new Map(
          sjekkliste.template.objects
            .filter((o) => !displayTyper.has(o.type))
            .map((o) => [o.id, o.label]),
        );

        for (const [feltId, nyVerdi] of Object.entries(nyData)) {
          const label = objektMap.get(feltId);
          if (!label) continue;

          const gammelVerdi = gammelData[feltId];
          const gammelV = gammelVerdi?.verdi ?? null;
          const nyV = nyVerdi?.verdi ?? null;

          const gammelStr = gammelV != null ? JSON.stringify(gammelV) : null;
          const nyStr = nyV != null ? JSON.stringify(nyV) : null;

          if (gammelStr !== nyStr) {
            endringsloggRader.push({
              checklistId: input.id,
              userId: ctx.userId,
              fieldId: feltId,
              fieldLabel: label,
              oldValue: gammelStr,
              newValue: nyStr,
            });
          }
        }
      }

      // Fritekst-oversettelse Lag 3: auto-oversett når brukerens språk != prosjektspråk
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: sjekkliste.template.projectId },
        select: { sourceLanguage: true },
      });
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { language: true },
      });
      const prosjektSpraak = prosjekt?.sourceLanguage ?? "nb";
      const brukerSpraak = bruker?.language ?? "nb";

      if (brukerSpraak !== prosjektSpraak) {
        try {
          const data = input.data as Record<string, Record<string, unknown>>;
          const objektTyper = new Map(sjekkliste.template.objects.map((o) => [o.id, o.type]));
          const teksterÅOversette: string[] = [];

          // Samle fritekst-verdier og kommentarer
          for (const [feltId, felt] of Object.entries(data)) {
            if (!felt || typeof felt !== "object") continue;
            // Ikke oversett hvis original allerede finnes (admin redigerer oversettelsen)
            if ((felt as Record<string, unknown>).original) continue;

            const type = objektTyper.get(feltId);
            // Tekstfelt-verdier
            if (type && FRITEKST_TYPER.has(type) && typeof felt.verdi === "string" && felt.verdi.trim()) {
              teksterÅOversette.push(felt.verdi);
            }
            // Kommentarer på alle felttyper
            if (typeof felt.kommentar === "string" && felt.kommentar.trim()) {
              teksterÅOversette.push(felt.kommentar);
            }
          }

          if (teksterÅOversette.length > 0) {
            const oversettMap = await oversettFritekst(
              ctx.prisma, teksterÅOversette, brukerSpraak, prosjektSpraak,
            );

            // Flytt originaler og sett oversettelser
            for (const [feltId, felt] of Object.entries(data)) {
              if (!felt || typeof felt !== "object" || (felt as Record<string, unknown>).original) continue;
              const type = objektTyper.get(feltId);
              const feltObj = felt as Record<string, unknown>;
              const harFritekstVerdi = type && FRITEKST_TYPER.has(type) && typeof feltObj.verdi === "string" && (feltObj.verdi as string).trim();
              const harKommentar = typeof feltObj.kommentar === "string" && (feltObj.kommentar as string).trim();

              if (harFritekstVerdi || harKommentar) {
                feltObj.original = {
                  spraak: brukerSpraak,
                  verdi: harFritekstVerdi ? feltObj.verdi : undefined,
                  kommentar: harKommentar ? feltObj.kommentar : undefined,
                };
                if (harFritekstVerdi) feltObj.verdi = oversettMap.get(feltObj.verdi as string) ?? feltObj.verdi;
                if (harKommentar) feltObj.kommentar = oversettMap.get(feltObj.kommentar as string) ?? feltObj.kommentar;
              }
            }
          }
        } catch (oversettFeil) {
          // Oversettelse er best-effort — lagring skal aldri feile pga. oversettelsesserver
          console.warn("Auto-oversettelse feilet, lagrer uten oversettelse:", oversettFeil);
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Feltvis merge: hent fersk data fra DB og merg kun innsendte felt
        const fersk = await tx.checklist.findUniqueOrThrow({
          where: { id: input.id },
          select: { data: true },
        });
        const eksisterende = (fersk.data ?? {}) as Record<string, unknown>;
        const merget = { ...eksisterende, ...input.data };

        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: { data: merget as Prisma.InputJsonValue },
        });

        if (endringsloggRader.length > 0) {
          await tx.checklistChangeLog.createMany({ data: endringsloggRader });
        }

        return oppdatert;
      });
    }),

  // Forbedre oversettelse: manuell redigering eller re-oversettelse med bedre motor
  forbedreOversettelse: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      feltId: z.string(),
      // Enten manuell tekst ELLER motor for re-oversettelse
      manuellVerdi: z.string().optional(),
      manuellKommentar: z.string().optional(),
      motor: z.enum(["opus-mt", "google", "deepl"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: { template: { select: { projectId: true, domain: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId, sjekkliste.template.projectId,
        sjekkliste.bestillerEnterpriseId, sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      const data = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;
      const felt = data[input.feltId];
      if (!felt) throw new TRPCError({ code: "NOT_FOUND", message: "Felt ikke funnet" });

      const original = felt.original as { spraak: string; verdi?: string; kommentar?: string } | undefined;
      if (!original) throw new TRPCError({ code: "BAD_REQUEST", message: "Ingen original å forbedre" });

      if (input.motor) {
        // Re-oversett med valgt motor
        const prosjekt = await ctx.prisma.project.findUnique({
          where: { id: sjekkliste.template.projectId },
          select: { sourceLanguage: true },
        });
        const modul = await ctx.prisma.projectModule.findUnique({
          where: { projectId_moduleSlug: { projectId: sjekkliste.template.projectId, moduleSlug: "oversettelse" } },
        });
        const apiKey = (modul?.config as { apiKey?: string })?.apiKey;
        const prosjektSpraak = prosjekt?.sourceLanguage ?? "nb";

        const tekster: string[] = [];
        if (original.verdi) tekster.push(original.verdi);
        if (original.kommentar) tekster.push(original.kommentar);

        if (tekster.length > 0) {
          const { oversettMedMotor } = await import("../services/oversettelse-service");
          const oversatte = await oversettMedMotor(tekster, original.spraak, prosjektSpraak, input.motor, apiKey);
          let idx = 0;
          if (original.verdi) { felt.verdi = oversatte[idx++]; }
          if (original.kommentar) { felt.kommentar = oversatte[idx]; }
        }
      } else {
        // Manuell redigering
        if (input.manuellVerdi !== undefined) felt.verdi = input.manuellVerdi;
        if (input.manuellKommentar !== undefined) felt.kommentar = input.manuellKommentar;
      }

      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { data: data as Prisma.InputJsonValue },
      });
    }),

  // Endre status (med overgangslogging)
  endreStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyStatus: z.union([documentStatusSchema, z.literal("forwarded")]),
        senderId: z.string().uuid().optional(), // Deprecated — bruker ctx.userId
        kommentar: z.string().optional(),
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
        /** Ny dokumentflyt-ID ved videresending til annen entreprise */
        dokumentflytId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            select: {
              projectId: true,
              domain: true,
              prefix: true,
              project: { select: { name: true } },
            },
          },
          utforerEnterprise: { select: { name: true } },
        },
      });

      const projectId = sjekkliste.template.projectId;

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        projectId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Rollevalidering: sjekk at bruker har riktig rolle i dokumentflyten
      await verifiserFlytRolle(
        ctx.userId,
        projectId,
        sjekkliste.dokumentflytId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.status,
        input.nyStatus,
      );

      // Hjelpefunksjon for varsling (bruker input-mottaker eller besvar-mottaker)
      const varsle = async (erVideresending: boolean, overrideMottaker?: { recipientUserId?: string | null; recipientGroupId?: string | null }) => {
        const mottaker = overrideMottaker ?? { recipientUserId: input.recipientUserId, recipientGroupId: input.recipientGroupId };
        const eposter = await hentMottakerEposter(ctx.prisma, {
          recipientUserId: mottaker.recipientUserId ?? undefined,
          recipientGroupId: mottaker.recipientGroupId ?? undefined,
          ekskluderUserId: ctx.userId,
        });
        if (eposter.length === 0) return;
        const avsender = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
        const nummer = sjekkliste.template.prefix && sjekkliste.number
          ? `${sjekkliste.template.prefix}-${String(sjekkliste.number).padStart(3, "0")}`
          : undefined;
        void sendDokumentVarsling({
          til: eposter,
          dokumentType: "sjekkliste",
          dokumentTittel: sjekkliste.title ?? "Uten tittel",
          dokumentNummer: nummer,
          prosjektNavn: sjekkliste.template.project.name,
          prosjektId: projectId,
          dokumentId: sjekkliste.id,
          avsenderNavn: avsender?.name ?? "Ukjent",
          kommentar: input.kommentar,
          erVideresending,
        });
      };

      // Bygg snapshot for tidslinje-kontekst
      const snapshot = await byggTransferSnapshot({
        senderId: ctx.userId,
        projektId: projectId,
        dokumentStatus: sjekkliste.status,
        bestillerEnterpriseId: sjekkliste.bestillerEnterpriseId,
        utforerEnterpriseId: sjekkliste.utforerEnterpriseId,
        dokumentflytId: sjekkliste.dokumentflytId,
      });

      // Utled ny eier basert på mottaker:
      // Person → personen. Gruppe → gruppens hovedansvarlig. Fallback: beholder gjeldende.
      const utledNyEier = async (recipientUserId?: string | null, recipientGroupId?: string | null): Promise<string | undefined> => {
        if (recipientUserId) return recipientUserId;
        if (recipientGroupId && sjekkliste.dokumentflytId) {
          const gruppemedlem = await ctx.prisma.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: sjekkliste.dokumentflytId,
              groupId: recipientGroupId,
              erHovedansvarlig: true,
            },
            include: { hovedansvarligPerson: { select: { userId: true } } },
          });
          if (gruppemedlem?.hovedansvarligPerson?.userId) {
            return gruppemedlem.hovedansvarligPerson.userId;
          }
        }
        return undefined; // Beholder gjeldende eier
      };

      // Videresending: bytt mottaker, evt. bytt dokumentflyt + entreprise
      if (input.nyStatus === "forwarded") {
        if (!input.recipientUserId && !input.recipientGroupId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Videresending krever en mottaker" });
        }

        // Sjekk om dokumentflyt/entreprise endres
        let flytBytteData: { dokumentflytId: string; utforerEnterpriseId: string; nyEntrepriseNavn: string; nyFlytNavn: string } | null = null;
        if (input.dokumentflytId && input.dokumentflytId !== sjekkliste.dokumentflytId) {
          const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
            where: { id: input.dokumentflytId },
            include: { enterprise: { select: { id: true, name: true } } },
          });
          if (!nyFlyt.enterpriseId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler entreprise" });
          }
          flytBytteData = {
            dokumentflytId: input.dokumentflytId,
            utforerEnterpriseId: nyFlyt.enterpriseId,
            nyEntrepriseNavn: nyFlyt.enterprise?.name ?? "Ukjent",
            nyFlytNavn: nyFlyt.name,
          };

          // Kryssentreprise-validering: kun prosjekteier/registrator/admin kan sende på tvers
          const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } });
          if (bruker?.role !== "sitedoc_admin") {
            const medlem = await ctx.prisma.projectMember.findUnique({
              where: { userId_projectId: { userId: ctx.userId, projectId } },
            });
            if (medlem?.role !== "admin") {
              const tillatelser = await hentBrukerTillatelser(ctx.userId, projectId);
              const erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks");
              if (!erRegistrator) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Kun prosjekteier eller registrator kan sende på tvers av entrepriser",
                });
              }
            }
          }
        }

        const gammelEntrepriseNavn = sjekkliste.utforerEnterprise?.name ?? "Ukjent";

        const nyEier = await utledNyEier(input.recipientUserId, input.recipientGroupId);

        const resultat = await ctx.prisma.$transaction(async (tx) => {
          const oppdatert = await tx.checklist.update({
            where: { id: input.id },
            data: {
              recipientUserId: input.recipientUserId ?? null,
              recipientGroupId: input.recipientGroupId ?? null,
              ...(nyEier ? { eierUserId: nyEier } : {}),
              ...(flytBytteData ? {
                dokumentflytId: flytBytteData.dokumentflytId,
                utforerEnterpriseId: flytBytteData.utforerEnterpriseId,
              } : {}),
            },
          });

          const kommentar = flytBytteData
            ? (input.kommentar ? `Videresendt til ${flytBytteData.nyEntrepriseNavn}: ${input.kommentar}` : `Videresendt fra ${gammelEntrepriseNavn} til ${flytBytteData.nyEntrepriseNavn}`)
            : (input.kommentar ? `Videresendt: ${input.kommentar}` : "Videresendt");

          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: sjekkliste.status,
              toStatus: sjekkliste.status,
              comment: kommentar,
              recipientUserId: input.recipientUserId,
              recipientGroupId: input.recipientGroupId,
              ...snapshot,
              ...(flytBytteData ? {
                recipientEnterpriseName: flytBytteData.nyEntrepriseNavn,
                dokumentflytName: flytBytteData.nyFlytNavn,
              } : {}),
            },
          });
          return oppdatert;
        });
        void varsle(true);
        return resultat;
      }

      if (!isValidStatusTransition(sjekkliste.status, input.nyStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ugyldig statusovergang fra "${sjekkliste.status}" til "${input.nyStatus}"`,
        });
      }

      // Auto-mottatt: sent → received umiddelbart
      const effektivStatus = input.nyStatus === "sent" ? "received" : input.nyStatus;

      // Besvar (responded): finn forrige avsender og send tilbake
      let besvarMottaker: { recipientUserId?: string | null; recipientGroupId?: string | null } = {};
      if (input.nyStatus === "responded") {
        const sisteTransfer = await ctx.prisma.documentTransfer.findFirst({
          where: { checklistId: input.id },
          orderBy: { createdAt: "desc" },
          select: { senderId: true },
        });
        if (sisteTransfer?.senderId) {
          besvarMottaker = { recipientUserId: sisteTransfer.senderId, recipientGroupId: null };
        }
      }

      // Utled ny eier ved sending eller besvar
      let eierOppdatering: { eierUserId: string } | Record<string, never> = {};
      if (input.nyStatus === "sent") {
        const nyEier = await utledNyEier(input.recipientUserId, input.recipientGroupId);
        if (nyEier) eierOppdatering = { eierUserId: nyEier };
      } else if (input.nyStatus === "responded" && besvarMottaker.recipientUserId) {
        eierOppdatering = { eierUserId: besvarMottaker.recipientUserId };
      }

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: effektivStatus,
            ...eierOppdatering,
            ...(input.nyStatus === "sent" ? {
              recipientUserId: input.recipientUserId ?? null,
              recipientGroupId: input.recipientGroupId ?? null,
            } : {}),
            ...(input.nyStatus === "responded" ? besvarMottaker : {}),
          },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: input.nyStatus,
            comment: input.kommentar,
            ...(input.nyStatus === "sent" ? {
              recipientUserId: input.recipientUserId,
              recipientGroupId: input.recipientGroupId,
            } : {}),
            ...(input.nyStatus === "responded" && besvarMottaker.recipientUserId ? {
              recipientUserId: besvarMottaker.recipientUserId,
            } : {}),
            ...snapshot,
          },
        });

        if (input.nyStatus === "sent") {
          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: "sent",
              toStatus: "received",
              ...snapshot,
            },
          });
        }

        return oppdatert;
      });

      // Varsle mottaker ved sending, besvar, godkjenning, avvisning
      if (input.nyStatus === "responded" && besvarMottaker.recipientUserId) {
        void varsle(false, besvarMottaker);
      } else if (["sent", "approved", "rejected"].includes(input.nyStatus)) {
        void varsle(false);
      }

      return resultat;
    }),

  // Slett sjekkliste (blokkeres hvis tilknyttede oppgaver finnes)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true, domain: true } },
          _count: { select: { tasks: true } },
        },
      });

      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerEnterpriseId,
        sjekkliste.utforerEnterpriseId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      if (sjekkliste.status !== "draft" && sjekkliste.status !== "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kun sjekklister i utkast- eller avbrutt-status kan slettes",
        });
      }

      if (sjekkliste._count.tasks > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Kan ikke slette sjekklisten fordi den har ${sjekkliste._count.tasks} tilknyttede oppgaver`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.documentTransfer.deleteMany({ where: { checklistId: input.id } });
        await tx.image.deleteMany({ where: { checklistId: input.id } });
        await tx.checklist.delete({ where: { id: input.id } });
        return { success: true };
      });
    }),

  // Bytt eier av sjekkliste — kun prosjekteier eller registrator/admin
  byttEier: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyEierUserId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true } },
        },
      });

      const projectId = sjekkliste.template.projectId;

      // Sjekk at bruker er admin eller registrator
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId } },
      });
      const erAdmin = bruker.role === "sitedoc_admin" || medlem?.role === "admin";

      if (!erAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun prosjekteier eller admin kan bytte eier",
        });
      }

      // Valider at ny eier tilhører samme entreprise
      const nyEierMedlem = await ctx.prisma.projectMember.findFirst({
        where: {
          userId: input.nyEierUserId,
          projectId,
          enterprises: { some: { enterpriseId: sjekkliste.bestillerEnterpriseId } },
        },
      });

      if (!nyEierMedlem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ny eier må tilhøre samme entreprise som dokumentet",
        });
      }

      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { eierUserId: input.nyEierUserId },
      });
    }),

  // Flytt sjekkliste til en annen dokumentflyt (Sentralbord)
  // @deprecated — Bruk endreStatus med nyStatus="forwarded" + dokumentflytId i stedet. Beholdes for bakoverkompatibilitet
  flytt: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        nyDokumentflytId: z.string().uuid(),
        /** Ny mottaker utledet fra ny dokumentflyt */
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser admin eller registrator
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      const erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks");

      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true, name: true } });
      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
      });
      const erProjektAdmin = bruker?.role === "sitedoc_admin" || medlem?.role === "admin";

      if (!erProjektAdmin && !erRegistrator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin og registratorer kan flytte dokumenter" });
      }

      // Hent sjekklisten
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          utforerEnterprise: { select: { name: true } },
        },
      });

      // Verifiser status
      const tillattStatus = ["draft", "sent", "received", "in_progress"];
      if (!tillattStatus.includes(sjekkliste.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kan ikke flytte dokumenter med status: " + sjekkliste.status });
      }

      // Hent ny dokumentflyt
      const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id: input.nyDokumentflytId },
        include: { enterprise: { select: { id: true, name: true } } },
      });

      if (!nyFlyt.enterpriseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler entreprise" });
      }

      const gammelEntrepriseNavn = sjekkliste.utforerEnterprise?.name ?? "Ukjent";
      const nyEntrepriseNavn = nyFlyt.enterprise?.name ?? "Ukjent";
      const brukerNavn = bruker?.name ?? "Ukjent";

      return ctx.prisma.$transaction(async (tx) => {
        await tx.checklist.update({
          where: { id: input.id },
          data: {
            dokumentflytId: input.nyDokumentflytId,
            utforerEnterpriseId: nyFlyt.enterpriseId!,
            recipientUserId: input.recipientUserId ?? null,
          },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            recipientUserId: input.recipientUserId,
            recipientGroupId: input.recipientGroupId,
            fromStatus: sjekkliste.status,
            toStatus: sjekkliste.status,
            comment: `Flyttet av ${brukerNavn} fra ${gammelEntrepriseNavn} til ${nyEntrepriseNavn}`,
            senderEnterpriseName: gammelEntrepriseNavn,
            recipientEnterpriseName: nyEntrepriseNavn,
            dokumentflytName: nyFlyt.name,
            senderRolle: "registrator",
          },
        });

        return { success: true };
      });
    }),
});
