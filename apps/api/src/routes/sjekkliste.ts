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
} from "../trpc/tilgangskontroll";
import { sendDokumentVarsling, hentMottakerEposter } from "../services/epost";
import { oversettFritekst } from "../services/oversettelse-service";

// Felttyper der verdi er fritekst som skal oversettes
const FRITEKST_TYPER = new Set(["text_field"]);

export const sjekklisteRouter = router({
  // Hent alle sjekklister for et prosjekt (via mal)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        buildingId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);

      return ctx.prisma.checklist.findMany({
        where: {
          template: { projectId: input.projectId },
          ...(input.status ? { status: input.status } : {}),
          ...(input.buildingId ? { OR: [{ buildingId: input.buildingId }, { buildingId: null }] } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          building: { select: { id: true, name: true, number: true } },
          drawing: { select: { id: true, name: true, floor: true } },
          recipientUser: { select: { id: true, name: true } },
          recipientGroup: { select: { id: true, name: true } },
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
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          building: { select: { id: true, name: true } },
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
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      return sjekkliste;
    }),

  // Opprett ny sjekkliste
  opprett: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        creatorEnterpriseId: z.string().uuid(),
        responderEnterpriseId: z.string().uuid(),
        title: z.string().max(255).optional(),
        workflowId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        buildingId: z.string().uuid().optional(),
        drawingId: z.string().uuid().optional(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser at bruker tilhører oppretter-entreprisen
      await verifiserEntrepriseTilhorighet(ctx.userId, input.creatorEnterpriseId);

      // Sjekk grense for gratisbrukere (10 sjekklister per prosjekt)
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker.role !== "sitedoc_admin") {
        const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
          where: { id: input.creatorEnterpriseId },
          select: { projectId: true },
        });
        const antall = await ctx.prisma.checklist.count({
          where: { creatorEnterprise: { projectId: entreprise.projectId } },
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

        // Sjekk om workflowId er en Workflow eller DokumentFlyt
        let workflowId: string | undefined;
        let dokumentflytId: string | undefined;
        if (input.workflowId) {
          const workflow = await tx.workflow.findUnique({
            where: { id: input.workflowId },
            select: { id: true },
          });
          if (workflow) {
            workflowId = input.workflowId;
          } else {
            // Sjekk om det er en DokumentFlyt-ID (ny modell)
            const df = await tx.dokumentflyt.findUnique({
              where: { id: input.workflowId },
              select: { id: true },
            });
            if (df) {
              dokumentflytId = input.workflowId;
            }
          }
        }

        // Finn hovedansvarlig fra dokumentflyt (svarer med erHovedansvarlig)
        let recipientUserId: string | undefined;
        let recipientGroupId: string | undefined;
        if (dokumentflytId) {
          const hovedansvarlig = await tx.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId,
              rolle: "svarer",
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
            creatorEnterpriseId: input.creatorEnterpriseId,
            responderEnterpriseId: input.responderEnterpriseId,
            title: tittel,
            creatorUserId: ctx.userId,
            number: nummer,
            workflowId,
            dokumentflytId,
            subject: input.subject,
            buildingId: input.buildingId,
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
        creatorEnterpriseId: z.string().uuid().optional(),
        responderEnterpriseId: z.string().uuid().optional(),
        drawingId: z.string().uuid().nullable().optional(),
        buildingId: z.string().uuid().nullable().optional(),
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
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      // Entreprise-endring kun tillatt i utkast-status
      if ((input.creatorEnterpriseId || input.responderEnterpriseId) && sjekkliste.status !== "draft") {
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
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
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
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: { data: input.data as Prisma.InputJsonValue },
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
        sjekkliste.creatorEnterpriseId, sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
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
        senderId: z.string().uuid(),
        kommentar: z.string().optional(),
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
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
        },
      });

      const projectId = sjekkliste.template.projectId;

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      // Hjelpefunksjon for varsling
      const varsle = async (erVideresending: boolean) => {
        const eposter = await hentMottakerEposter(ctx.prisma, {
          recipientUserId: input.recipientUserId,
          recipientGroupId: input.recipientGroupId,
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

      // Videresending
      if (input.nyStatus === "forwarded") {
        if (!input.recipientUserId && !input.recipientGroupId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Videresending krever en mottaker" });
        }
        const resultat = await ctx.prisma.$transaction(async (tx) => {
          const oppdatert = await tx.checklist.update({
            where: { id: input.id },
            data: {
              recipientUserId: input.recipientUserId ?? null,
              recipientGroupId: input.recipientGroupId ?? null,
            },
          });
          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: sjekkliste.status,
              toStatus: "received",
              comment: input.kommentar ? `Videresendt: ${input.kommentar}` : "Videresendt",
              recipientUserId: input.recipientUserId,
              recipientGroupId: input.recipientGroupId,
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

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: effektivStatus,
            ...(input.nyStatus === "sent" ? {
              recipientUserId: input.recipientUserId ?? null,
              recipientGroupId: input.recipientGroupId ?? null,
            } : {}),
          },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: "sent",
            comment: input.kommentar,
            recipientUserId: input.recipientUserId,
            recipientGroupId: input.recipientGroupId,
          },
        });

        if (input.nyStatus === "sent") {
          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: "sent",
              toStatus: "received",
            },
          });
        }

        return oppdatert;
      });

      // Varsle mottaker ved sending
      if (input.nyStatus === "sent") {
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
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
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
});
