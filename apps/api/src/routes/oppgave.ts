import { z } from "zod";
import type { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@sitedoc/shared";
import { isValidStatusTransition } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import {
  byggTilgangsFilter,
  verifiserFaggruppeTilhorighet,
  verifiserDokumentTilgang,
  verifiserFlytRolle,
  verifiserProsjektmedlem,
  hentBrukerTillatelser,
} from "../trpc/tilgangskontroll";
import { sendDokumentVarsling, hentMottakerEposter } from "../services/epost";

/** Hent projectId fra faggruppe (standard) eller template (HMS uten faggruppe) */
function hentProjectId(oppgave: {
  bestillerFaggruppe?: { projectId: string } | null;
  template?: { projectId?: string } | null;
}): string {
  const pid = oppgave.bestillerFaggruppe?.projectId ?? oppgave.template?.projectId;
  if (!pid) throw new TRPCError({ code: "BAD_REQUEST", message: "Kan ikke utlede prosjekt-ID" });
  return pid;
}
import { oversettFritekst } from "../services/oversettelse-service";
import { byggTransferSnapshot } from "../services/transfer-snapshot";

const FRITEKST_TYPER = new Set(["text_field"]);

export const oppgaveRouter = router({
  // Hent alle oppgaver for et prosjekt
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

      return ctx.prisma.task.findMany({
        where: {
          OR: [
            { bestillerFaggruppe: { projectId: input.projectId } },
            { template: { projectId: input.projectId }, bestillerFaggruppeId: null },
          ],
          ...(input.status ? { status: input.status } : {}),
          ...(input.byggeplassId ? { OR: [{ drawing: { byggeplassId: input.byggeplassId } }, { drawingId: null }] } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
          bestiller: true,
          bestillerFaggruppe: true,
          utforerFaggruppe: true,
          drawing: { select: { id: true, name: true, floor: true, byggeplass: { select: { id: true, name: true } } } },
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
                  faggruppe: { select: { id: true, name: true } },
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

  // Hent oppgavemarkører for en tegning
  hentForTegning: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const drawing = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.drawingId },
        select: { byggeplass: { select: { projectId: true } } },
      });
      if (!drawing.byggeplass) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tegningen er ikke tilknyttet en lokasjon" });
      }
      await verifiserProsjektmedlem(ctx.userId, drawing.byggeplass.projectId);

      return ctx.prisma.task.findMany({
        where: {
          drawingId: input.drawingId,
          positionX: { not: null },
          positionY: { not: null },
        },
        select: {
          id: true,
          title: true,
          number: true,
          status: true,
          positionX: true,
          positionY: true,
          template: { select: { prefix: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Hent én oppgave med alle detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            include: {
              objects: { orderBy: { sortOrder: "asc" } },
              project: { select: { sourceLanguage: true } },
            },
          },
          bestiller: true,
          bestillerFaggruppe: true,
          utforerFaggruppe: true,
          drawing: {
            include: {
              byggeplass: { select: { id: true, name: true } },
            },
          },
          checklist: {
            include: {
              template: { select: { prefix: true, name: true } },
            },
          },
          images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] },
          transfers: {
            include: {
              sender: { select: { id: true, name: true } },
              recipientUser: { select: { id: true, name: true } },
              recipientGroup: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          comments: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Tilgangssjekk via oppretter-faggruppens prosjekt
      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      // Sett lestAvMottakerVed når mottaker åpner mens status er «sent»
      if (
        oppgave.status === "sent" &&
        oppgave.recipientUserId === ctx.userId &&
        !oppgave.lestAvMottakerVed
      ) {
        await ctx.prisma.task.update({
          where: { id: oppgave.id },
          data: { lestAvMottakerVed: new Date() },
        });
        oppgave.lestAvMottakerVed = new Date();
      }

      return oppgave;
    }),

  // Hent kommentarer for en oppgave
  hentKommentarer: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: { select: { domain: true, projectId: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      return ctx.prisma.taskComment.findMany({
        where: { taskId: input.taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Legg til kommentar på en oppgave
  leggTilKommentar: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: { select: { domain: true, projectId: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      return ctx.prisma.taskComment.create({
        data: {
          taskId: input.taskId,
          userId: ctx.userId,
          content: input.content,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }),

  // Hent oppgaver knyttet til en sjekkliste
  hentForSjekkliste: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verifiser tilgang til sjekklisten
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.checklistId },
        include: { template: { select: { projectId: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        undefined,
        sjekkliste.id,
        "checklist",
      );

      return ctx.prisma.task.findMany({
        where: { checklistId: input.checklistId },
        select: {
          id: true,
          number: true,
          checklistFieldId: true,
          title: true,
          status: true,
          template: { select: { prefix: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Opprett ny oppgave
  opprett: protectedProcedure
    .input(
      z.object({
        bestillerFaggruppeId: z.string().uuid().optional(),
        utforerFaggruppeId: z.string().uuid().optional(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        dueDate: z.string().datetime().optional(),
        templateId: z.string().uuid(),
        drawingId: z.string().uuid().optional(),
        positionX: z.number().min(0).max(100).optional(),
        positionY: z.number().min(0).max(100).optional(),
        dokumentflytId: z.string().uuid().optional(),
        checklistId: z.string().uuid().optional(),
        checklistFieldId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hent malen for å sjekke domain (HMS vs standard)
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
        select: { prefix: true, domain: true, projectId: true },
      });

      const erHms = mal.domain === "hms";

      // HMS-oppgaver: auto-rut til HMS-gruppen, ingen faggruppe
      let recipientGroupId: string | undefined;
      if (erHms) {
        await verifiserProsjektmedlem(ctx.userId, mal.projectId);

        // Finn HMS-gruppen i prosjektet
        const hmsGruppe = await ctx.prisma.projectGroup.findFirst({
          where: {
            projectId: mal.projectId,
            domains: { array_contains: ["hms"] },
          },
          select: { id: true },
        });

        if (!hmsGruppe) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "HMS-gruppe ikke konfigurert i dette prosjektet. Opprett en gruppe med HMS-domene under Oppsett → Brukere.",
          });
        }

        recipientGroupId = hmsGruppe.id;
      } else {
        // Standard: faggrupper påkrevd
        if (!input.bestillerFaggruppeId || !input.utforerFaggruppeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bestiller- og utfører-faggruppe er påkrevd for denne oppgavetypen",
          });
        }
        await verifiserFaggruppeTilhorighet(ctx.userId, input.bestillerFaggruppeId);
      }

      // Sjekk grense for gratisbrukere (10 oppgaver per prosjekt)
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker.role !== "sitedoc_admin") {
        const antall = await ctx.prisma.task.count({
          where: { template: { projectId: mal.projectId } },
        });
        if (antall >= 10) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Grensen på 10 oppgaver per prosjekt er nådd. Kontakt SiteDoc for å oppgradere.",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        let nummer: number | undefined;

        if (mal.prefix) {
          const maks = await tx.task.aggregate({
            where: {
              templateId: input.templateId,
              number: { not: null },
            },
            _max: { number: true },
          });
          nummer = (maks._max.number ?? 0) + 1;
        }

        // Finn hovedansvarlig fra dokumentflyt (standard flyt)
        let recipientUserId: string | undefined;
        if (!erHms && input.dokumentflytId) {
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

        return tx.task.create({
          data: {
            templateId: input.templateId,
            bestillerUserId: ctx.userId,
            eierUserId: ctx.userId,
            bestillerFaggruppeId: input.bestillerFaggruppeId ?? null,
            utforerFaggruppeId: input.utforerFaggruppeId ?? null,
            title: input.title,
            description: input.description,
            priority: input.priority,
            number: nummer,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            drawingId: input.drawingId,
            positionX: input.positionX,
            positionY: input.positionY,
            dokumentflytId: input.dokumentflytId,
            checklistId: input.checklistId,
            checklistFieldId: input.checklistFieldId,
            status: "draft",
            recipientUserId,
            recipientGroupId,
          },
        });
      });
    }),

  // Oppdater oppgave
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        dueDate: z.string().datetime().optional(),
        bestillerFaggruppeId: z.string().uuid().optional(),
        utforerFaggruppeId: z.string().uuid().optional(),
        drawingId: z.string().uuid().nullable().optional(),
        positionX: z.number().min(0).max(100).nullable().optional(),
        positionY: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: { select: { domain: true, projectId: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      // Append-only: Oppgaver kan kun redigeres i utkast-status
      if (oppgave.status !== "draft") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Oppgaver kan ikke redigeres etter sending — kun tilføyelser er tillatt",
        });
      }

      const { id, ...data } = input;
      return ctx.prisma.task.update({
        where: { id },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
      });
    }),

  // Oppdater oppgavedata (fylling av felter)
  oppdaterData: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: {
            select: {
              domain: true,
              projectId: true,
              objects: { select: { id: true, type: true } },
            },
          },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      // Fritekst-oversettelse Lag 3
      const projectId = hentProjectId(oppgave);
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: projectId },
        select: { sourceLanguage: true },
      });
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { language: true },
      });
      const prosjektSpraak = prosjekt?.sourceLanguage ?? "nb";
      const brukerSpraak = bruker?.language ?? "nb";

      if (brukerSpraak !== prosjektSpraak && oppgave.template?.objects) {
        try {
          const data = input.data as Record<string, Record<string, unknown>>;
          const objektTyper = new Map(oppgave.template.objects.map((o) => [o.id, o.type]));
          const teksterÅOversette: string[] = [];

          for (const [feltId, felt] of Object.entries(data)) {
            if (!felt || typeof felt !== "object") continue;
            if ((felt as Record<string, unknown>).original) continue;
            const type = objektTyper.get(feltId);
            if (type && FRITEKST_TYPER.has(type) && typeof felt.verdi === "string" && felt.verdi.trim()) {
              teksterÅOversette.push(felt.verdi);
            }
            if (typeof felt.kommentar === "string" && felt.kommentar.trim()) {
              teksterÅOversette.push(felt.kommentar);
            }
          }

          if (teksterÅOversette.length > 0) {
            const oversettMap = await oversettFritekst(
              ctx.prisma, teksterÅOversette, brukerSpraak, prosjektSpraak,
            );
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
          console.warn("Auto-oversettelse feilet, lagrer uten oversettelse:", oversettFeil);
        }
      }

      // Feltvis merge i transaksjon: hent fersk data og merg kun innsendte felt
      return ctx.prisma.$transaction(async (tx) => {
        const fersk = await tx.task.findUniqueOrThrow({
          where: { id: input.id },
          select: { data: true },
        });
        const eksisterende = (fersk.data ?? {}) as Record<string, unknown>;
        const merget = { ...eksisterende, ...input.data };

        return tx.task.update({
          where: { id: input.id },
          data: { data: merget as Prisma.InputJsonValue },
        });
      });
    }),

  // Forbedre oversettelse: manuell redigering eller re-oversettelse med bedre motor
  forbedreOversettelse: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      feltId: z.string(),
      manuellVerdi: z.string().optional(),
      manuellKommentar: z.string().optional(),
      motor: z.enum(["opus-mt", "google", "deepl"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: { select: { domain: true, projectId: true } },
        },
      });
      const projectId = hentProjectId(oppgave);
      await verifiserDokumentTilgang(
        ctx.userId, projectId,
        oppgave.bestillerFaggruppeId, oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      const data = (oppgave.data ?? {}) as Record<string, Record<string, unknown>>;
      const felt = data[input.feltId];
      if (!felt) throw new TRPCError({ code: "NOT_FOUND", message: "Felt ikke funnet" });

      const original = felt.original as { spraak: string; verdi?: string; kommentar?: string } | undefined;
      if (!original) throw new TRPCError({ code: "BAD_REQUEST", message: "Ingen original å forbedre" });

      if (input.motor) {
        const prosjekt = await ctx.prisma.project.findUnique({
          where: { id: projectId },
          select: { sourceLanguage: true },
        });
        const modul = await ctx.prisma.projectModule.findUnique({
          where: { projectId_moduleSlug: { projectId, moduleSlug: "oversettelse" } },
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
        if (input.manuellVerdi !== undefined) felt.verdi = input.manuellVerdi;
        if (input.manuellKommentar !== undefined) felt.kommentar = input.manuellKommentar;
      }

      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { data: data as Prisma.InputJsonValue },
      });
    }),

  // Endre status
  endreStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyStatus: z.union([documentStatusSchema, z.literal("forwarded")]),
        senderId: z.string().uuid().optional(), // Deprecated — bruker ctx.userId
        kommentar: z.string().optional(),
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
        /** Ny dokumentflyt-ID ved videresending til annen faggruppe */
        dokumentflytId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true, project: { select: { name: true } } } },
          template: { select: { domain: true, prefix: true, projectId: true, project: { select: { name: true } } } },
          utforerFaggruppe: { select: { name: true } },
        },
      });

      const projectId = hentProjectId(oppgave);

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        projectId,
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      // Rollevalidering: sjekk at bruker har riktig rolle i dokumentflyten
      await verifiserFlytRolle(
        ctx.userId,
        projectId,
        oppgave.dokumentflytId,
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.status,
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
        const nummer = oppgave.template?.prefix && oppgave.number
          ? `${oppgave.template.prefix}-${String(oppgave.number).padStart(3, "0")}`
          : undefined;
        void sendDokumentVarsling({
          til: eposter,
          dokumentType: "oppgave",
          dokumentTittel: oppgave.title ?? "Uten tittel",
          dokumentNummer: nummer,
          prosjektNavn: oppgave.bestillerFaggruppe?.project?.name ?? oppgave.template?.project?.name ?? "",
          prosjektId: projectId,
          dokumentId: oppgave.id,
          avsenderNavn: avsender?.name ?? "Ukjent",
          kommentar: input.kommentar,
          erVideresending,
        });
      };

      // Bygg snapshot for tidslinje-kontekst
      const snapshot = await byggTransferSnapshot({
        senderId: ctx.userId,
        projektId: projectId,
        dokumentStatus: oppgave.status,
        bestillerFaggruppeId: oppgave.bestillerFaggruppeId,
        utforerFaggruppeId: oppgave.utforerFaggruppeId,
        dokumentflytId: oppgave.dokumentflytId,
      });

      // Utled ny eier basert på mottaker:
      // Person → personen. Gruppe → gruppens hovedansvarlig. Fallback: beholder gjeldende.
      const utledNyEier = async (recipientUserId?: string | null, recipientGroupId?: string | null): Promise<string | undefined> => {
        if (recipientUserId) return recipientUserId;
        if (recipientGroupId && oppgave.dokumentflytId) {
          const gruppemedlem = await ctx.prisma.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: oppgave.dokumentflytId,
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

      // Videresending: bytt mottaker, evt. bytt dokumentflyt + faggruppe
      if (input.nyStatus === "forwarded") {
        if (!input.recipientUserId && !input.recipientGroupId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Videresending krever en mottaker" });
        }

        // Sjekk om dokumentflyt/faggruppe endres
        let flytBytteData: { dokumentflytId: string; utforerFaggruppeId: string; nyFaggruppeNavn: string; nyFlytNavn: string } | null = null;
        if (input.dokumentflytId && input.dokumentflytId !== oppgave.dokumentflytId) {
          const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
            where: { id: input.dokumentflytId },
            include: { faggruppe: { select: { id: true, name: true } } },
          });
          if (!nyFlyt.faggruppeId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler faggruppe" });
          }
          flytBytteData = {
            dokumentflytId: input.dokumentflytId,
            utforerFaggruppeId: nyFlyt.faggruppeId,
            nyFaggruppeNavn: nyFlyt.faggruppe?.name ?? "Ukjent",
            nyFlytNavn: nyFlyt.name,
          };

          // Kryssfaggruppe-validering: kun prosjekteier/registrator/admin kan sende på tvers
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
                  message: "Kun prosjekteier eller registrator kan sende på tvers av faggrupper",
                });
              }
            }
          }
        }

        const gammelFaggruppeNavn = oppgave.utforerFaggruppe?.name ?? "Ukjent";
        const nyEier = await utledNyEier(input.recipientUserId, input.recipientGroupId);

        const resultat = await ctx.prisma.$transaction(async (tx) => {
          const oppdatert = await tx.task.update({
            where: { id: input.id },
            data: {
              recipientUserId: input.recipientUserId ?? null,
              recipientGroupId: input.recipientGroupId ?? null,
              ...(nyEier ? { eierUserId: nyEier } : {}),
              ...(flytBytteData ? {
                dokumentflytId: flytBytteData.dokumentflytId,
                utforerFaggruppeId: flytBytteData.utforerFaggruppeId,
              } : {}),
            },
          });

          const kommentar = flytBytteData
            ? (input.kommentar ? `Videresendt til ${flytBytteData.nyFaggruppeNavn}: ${input.kommentar}` : `Videresendt fra ${gammelFaggruppeNavn} til ${flytBytteData.nyFaggruppeNavn}`)
            : (input.kommentar ? `Videresendt: ${input.kommentar}` : "Videresendt");

          await tx.documentTransfer.create({
            data: {
              taskId: input.id,
              senderId: ctx.userId,
              fromStatus: oppgave.status,
              toStatus: oppgave.status,
              comment: kommentar,
              recipientUserId: input.recipientUserId,
              recipientGroupId: input.recipientGroupId,
              ...snapshot,
              ...(flytBytteData ? {
                recipientEnterpriseName: flytBytteData.nyFaggruppeNavn,
                dokumentflytName: flytBytteData.nyFlytNavn,
              } : {}),
            },
          });
          return oppdatert;
        });
        void varsle(true);
        return resultat;
      }

      if (!isValidStatusTransition(oppgave.status, input.nyStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ugyldig statusovergang fra "${oppgave.status}" til "${input.nyStatus}"`,
        });
      }

      // Auto-mottatt: sent → received umiddelbart
      const effektivStatus = input.nyStatus === "sent" ? "received" : input.nyStatus;

      // Besvar (responded): finn forrige avsender og send tilbake
      let besvarMottaker: { recipientUserId?: string | null; recipientGroupId?: string | null } = {};
      if (input.nyStatus === "responded") {
        const sisteTransfer = await ctx.prisma.documentTransfer.findFirst({
          where: { taskId: input.id },
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
        const oppdatert = await tx.task.update({
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
            taskId: input.id,
            senderId: ctx.userId,
            fromStatus: oppgave.status,
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
              taskId: input.id,
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

  // Slett oppgave (kun i utkast-status)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
          template: { select: { domain: true, projectId: true } },
        },
      });

      await verifiserDokumentTilgang(
        ctx.userId,
        hentProjectId(oppgave),
        oppgave.bestillerFaggruppeId,
        oppgave.utforerFaggruppeId,
        oppgave.template?.domain,
        oppgave.id,
        "task",
      );

      if (oppgave.status !== "draft" && oppgave.status !== "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kun oppgaver i utkast- eller avbrutt-status kan slettes",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.documentTransfer.deleteMany({ where: { taskId: input.id } });
        await tx.image.deleteMany({ where: { taskId: input.id } });
        await tx.task.delete({ where: { id: input.id } });
        return { success: true };
      });
    }),

  // Bytt eier av oppgave — kun prosjekteier eller registrator/admin
  byttEier: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyEierUserId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          bestillerFaggruppe: { select: { projectId: true } },
        },
      });

      const projectId = hentProjectId(oppgave);

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

      // Valider at ny eier tilhører samme faggruppe
      const nyEierMedlem = await ctx.prisma.projectMember.findFirst({
        where: {
          userId: input.nyEierUserId,
          projectId,
          ...(oppgave.bestillerFaggruppeId ? { faggruppeKoblinger: { some: { faggruppeId: oppgave.bestillerFaggruppeId } } } : {}),
        },
      });

      if (!nyEierMedlem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ny eier må tilhøre samme faggruppe som dokumentet",
        });
      }

      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { eierUserId: input.nyEierUserId },
      });
    }),

  // Flytt oppgave til en annen dokumentflyt (Sentralbord)
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
      const erAdmin = tillatelser.has("create_checklists") && tillatelser.has("create_tasks");
      const erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks");

      // Sjekk om bruker er prosjektadmin
      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true, name: true } });
      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
      });
      const erProjektAdmin = bruker?.role === "sitedoc_admin" || medlem?.role === "admin";

      if (!erProjektAdmin && !erRegistrator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin og registratorer kan flytte dokumenter" });
      }

      // Hent oppgaven
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          utforerFaggruppe: { select: { name: true } },
        },
      });

      // Verifiser status
      const tillattStatus = ["draft", "sent", "received", "in_progress"];
      if (!tillattStatus.includes(oppgave.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kan ikke flytte dokumenter med status: " + oppgave.status });
      }

      // Hent ny dokumentflyt
      const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id: input.nyDokumentflytId },
        include: { faggruppe: { select: { id: true, name: true } } },
      });

      if (!nyFlyt.faggruppeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler faggruppe" });
      }

      const gammelFaggruppeNavn = oppgave.utforerFaggruppe?.name ?? "Ukjent";
      const nyFaggruppeNavn = nyFlyt.faggruppe?.name ?? "Ukjent";
      const brukerNavn = bruker?.name ?? "Ukjent";

      return ctx.prisma.$transaction(async (tx) => {
        // Oppdater oppgaven
        await tx.task.update({
          where: { id: input.id },
          data: {
            dokumentflytId: input.nyDokumentflytId,
            utforerFaggruppeId: nyFlyt.faggruppeId!,
            recipientUserId: input.recipientUserId ?? null,
          },
        });

        // Systemlogg via DocumentTransfer
        await tx.documentTransfer.create({
          data: {
            taskId: input.id,
            senderId: ctx.userId,
            recipientUserId: input.recipientUserId,
            recipientGroupId: input.recipientGroupId,
            fromStatus: oppgave.status,
            toStatus: oppgave.status,
            comment: `Flyttet av ${brukerNavn} fra ${gammelFaggruppeNavn} til ${nyFaggruppeNavn}`,
            senderEnterpriseName: gammelFaggruppeNavn,
            recipientEnterpriseName: nyFaggruppeNavn,
            dokumentflytName: nyFlyt.name,
            senderRolle: "registrator",
          },
        });

        return { success: true };
      });
    }),
});
