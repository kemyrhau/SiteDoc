import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { byggTilgangsFilter, erHmsAdmin, harFirmaHmsTilgang, verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { documentStatusSchema, isValidStatusTransition } from "@sitedoc/shared";
import { prisma } from "@sitedoc/db";

/**
 * Bygger Prisma WHERE-fragment for HMS-synlighet (privat/åpen) på Task/Checklist.
 *
 * Regler:
 * - sitedoc_admin og ikke-medlem: ser alt / defensiv null (returnerer null)
 * - HMS-admin (prosjekt-admin ∪ HMS-gruppe ∪ firma-`hms_ansvarlig`): ser alt HMS
 * - Vanlig bruker: ser kun dokumenter der mal er "apen", ELLER de selv er innsender/mottaker
 *
 * HMS-admin-mengden er delt med `verifiserHmsHandling` via `erHmsAdmin` — én
 * definisjon, aldri duplisert (dedikert HMS-løp, D2).
 *
 * Returneres som AND-fragment som komponeres med byggTilgangsFilter.
 */
async function byggHmsSynlighetsFilter(
  userId: string,
  projectId: string,
): Promise<Record<string, unknown> | null> {
  // Admin-sjekk
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return null;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { id: true },
  });
  if (!medlem) {
    // byggTilgangsFilter kaster allerede FORBIDDEN — defensiv null her hindrer
    // duplikatkast; kalleren har allerede verifisert via tilgangsFilter.
    return null;
  }

  // HMS-admin ser alt HMS (prosjekt-admin ∪ HMS-gruppe ∪ firma-hms_ansvarlig) —
  // delt kilde med verifiserHmsHandling.
  if (await erHmsAdmin(userId, projectId)) return null;

  // Vanlig bruker: "apen" ELLER innsender/mottaker
  return {
    OR: [
      { template: { is: { hmsSynlighet: "apen" } } },
      { bestillerUserId: userId },
      { recipientUserId: userId },
    ],
  };
}

function komponerWhere(
  base: Record<string, unknown>,
  ...fragmenter: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const aktive = fragmenter.filter((f): f is Record<string, unknown> => !!f);
  if (aktive.length === 0) return base;
  return { AND: [base, ...aktive] };
}

const TASK_SELECT = {
  id: true,
  title: true,
  number: true,
  status: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  data: true,
  template: {
    select: {
      id: true,
      prefix: true,
      name: true,
      domain: true,
      subdomain: true,
      hmsSynlighet: true,
      objects: { select: { id: true, label: true, type: true } },
    },
  },
  bestiller: { select: { id: true, name: true } },
  bestillerUserId: true,
  bestillerFaggruppe: { select: { id: true, name: true } },
  recipientUser: { select: { id: true, name: true } },
  recipientUserId: true,
  recipientGroup: { select: { id: true, name: true } },
} as const;

const CHECKLIST_SELECT = {
  id: true,
  title: true,
  number: true,
  status: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  data: true,
  template: {
    select: {
      id: true,
      prefix: true,
      name: true,
      domain: true,
      subdomain: true,
      hmsSynlighet: true,
      objects: { select: { id: true, label: true, type: true } },
    },
  },
  bestiller: { select: { id: true, name: true } },
  bestillerUserId: true,
  bestillerFaggruppe: { select: { id: true, name: true } },
  recipientUser: { select: { id: true, name: true } },
  recipientUserId: true,
  recipientGroup: { select: { id: true, name: true } },
} as const;

export const hmsRouter = router({
  /**
   * Er innlogget bruker HMS-admin på prosjektet? Tynn eksponering av
   * `erHmsAdmin` (tilgangskontroll.ts) slik at web-klienten kan vise/skjule
   * HMS-admin-handlingene («Besvar»/«Lukk»/«Gjenåpne») i det dedikerte
   * HMS-løpet (Ordre B) — logikken forblir server-eid, aldri duplisert på
   * klienten. sitedoc_admin behandles som HMS-admin (matcher guard-bypass i
   * verifiserHmsHandling).
   */
  erHmsAdmin: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker?.role === "sitedoc_admin") return true;
      return erHmsAdmin(ctx.userId, input.projectId);
    }),

  /**
   * Hent alle HMS-dokumenter på et prosjekt, kategorisert på subdomain.
   * Filtrerer på privat-synlighet (innsender + HMS-ansvarlige + admin ser alt).
   */
  hentDokumenter: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        subdomain: z.enum(["avvik", "sja", "ruh"]).optional(),
        byggeplassId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);
      const synlighetsFilter = await byggHmsSynlighetsFilter(ctx.userId, input.projectId);

      const statusFilter = input.status ? { status: input.status } : {};

      // Byggeplass-filter (asymmetri): Task har drawingId (filtreres via drawing.byggeplassId);
      // Checklist har byggeplassId direkte. Prosjekt-brede dokumenter (uten byggeplass/tegning)
      // inkluderes alltid — de er relevante for arbeid på alle byggeplasser.
      const taskByggeplassClause = input.byggeplassId
        ? {
            OR: [
              { drawing: { byggeplassId: input.byggeplassId } },
              { drawingId: null },
            ],
          }
        : null;
      const checklistByggeplassClause = input.byggeplassId
        ? {
            OR: [
              { byggeplassId: input.byggeplassId },
              { byggeplassId: null },
            ],
          }
        : null;

      const avvikPromise = (input.subdomain === undefined || input.subdomain === "avvik")
        ? ctx.prisma.task.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "avvik" } },
                AND: [
                  {
                    OR: [
                      { bestillerFaggruppe: { projectId: input.projectId } },
                      { bestillerFaggruppeId: null },
                    ],
                  },
                  ...(taskByggeplassClause ? [taskByggeplassClause] : []),
                ],
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            select: TASK_SELECT,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const sjaPromise = (input.subdomain === undefined || input.subdomain === "sja")
        ? ctx.prisma.checklist.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "sja" } },
                ...(checklistByggeplassClause ?? {}),
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            select: CHECKLIST_SELECT,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      // RUH henter fra task — samme shape som avvik. RUH-malen har
      // category="oppgave" (vedtatt 2026-05-29; tidligere "sjekkliste").
      const ruhPromise = (input.subdomain === undefined || input.subdomain === "ruh")
        ? ctx.prisma.task.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "ruh" } },
                AND: [
                  {
                    OR: [
                      { bestillerFaggruppe: { projectId: input.projectId } },
                      { bestillerFaggruppeId: null },
                    ],
                  },
                  ...(taskByggeplassClause ? [taskByggeplassClause] : []),
                ],
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            select: TASK_SELECT,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const [avvik, sja, ruh] = await Promise.all([avvikPromise, sjaPromise, ruhPromise]);
      return { avvik, sja, ruh };
    }),

  /**
   * Hent HMS-oversikt på tvers av alle prosjekter i et firma.
   *
   * Trinn 2 av firma-HMS-dashboard (2026-05-29). Krever firma-admin eller
   * hms_ansvarlig på orgId (via harFirmaHmsTilgang). Bypass-er
   * byggHmsSynlighetsFilter og byggTilgangsFilter — auth-grunnlaget er
   * firma-rollen, ikke prosjektmedlemskap.
   *
   * Returnerer:
   * - prosjekter: filter-velger-data (id, name, byggeplasser)
   * - dokumenter: { avvik, sja, ruh } med template.project + byggeplass-info
   * - statistikk: 4 KPI-er (apneAvvikPerProsjekt, sjaFrekvensPerMaaned,
   *   ruhRatePerMaaned, saksbehandlingstidMedianDager)
   */
  hentFirmaOversikt: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        prosjektIds: z.array(z.string().uuid()).optional(),
        byggeplassIds: z.array(z.string().uuid()).optional(),
        status: documentStatusSchema.optional(),
        subdomain: z.enum(["avvik", "sja", "ruh"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const harTilgang = await harFirmaHmsTilgang(ctx.userId, input.organizationId);
      if (!harTilgang) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Krever firma-admin eller hms_ansvarlig",
        });
      }

      // Hent alle prosjekter i firmaet (filter-velger-data + filter-anchor)
      const alleProsjekter = await ctx.prisma.project.findMany({
        where: {
          primaryOrganizationId: input.organizationId,
          ...(input.prosjektIds ? { id: { in: input.prosjektIds } } : {}),
        },
        select: {
          id: true,
          name: true,
          byggeplasser: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });

      const projectIdList = alleProsjekter.map((p) => p.id);

      if (projectIdList.length === 0) {
        return {
          prosjekter: [],
          dokumenter: { avvik: [], sja: [], ruh: [] },
          statistikk: {
            apneAvvikPerProsjekt: {},
            sjaFrekvensPerMaaned: {},
            ruhRatePerMaaned: {},
            saksbehandlingstidMedianDager: null,
          },
        };
      }

      const statusFilter = input.status ? { status: input.status } : {};

      // Byggeplass-filter (asymmetri Task vs Checklist, samme som Del 1)
      const taskByggeplassClause = input.byggeplassIds && input.byggeplassIds.length > 0
        ? {
            OR: [
              { drawing: { byggeplassId: { in: input.byggeplassIds } } },
              { drawingId: null },
            ],
          }
        : null;
      const checklistByggeplassClause = input.byggeplassIds && input.byggeplassIds.length > 0
        ? {
            OR: [
              { byggeplassId: { in: input.byggeplassIds } },
              { byggeplassId: null },
            ],
          }
        : null;

      const avvikPromise = (input.subdomain === undefined || input.subdomain === "avvik")
        ? ctx.prisma.task.findMany({
            where: {
              ...statusFilter,
              template: { is: { projectId: { in: projectIdList }, domain: "hms", subdomain: "avvik" } },
              ...(taskByggeplassClause ?? {}),
            },
            select: {
              ...TASK_SELECT,
              template: {
                select: {
                  id: true,
                  prefix: true,
                  name: true,
                  domain: true,
                  subdomain: true,
                  hmsSynlighet: true,
                  objects: { select: { id: true, label: true, type: true } },
                  project: { select: { id: true, name: true } },
                },
              },
              drawing: { select: { byggeplass: { select: { id: true, name: true } } } },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const sjaPromise = (input.subdomain === undefined || input.subdomain === "sja")
        ? ctx.prisma.checklist.findMany({
            where: {
              ...statusFilter,
              template: { is: { projectId: { in: projectIdList }, domain: "hms", subdomain: "sja" } },
              ...(checklistByggeplassClause ?? {}),
            },
            select: {
              ...CHECKLIST_SELECT,
              template: {
                select: {
                  id: true,
                  prefix: true,
                  name: true,
                  domain: true,
                  subdomain: true,
                  hmsSynlighet: true,
                  objects: { select: { id: true, label: true, type: true } },
                  project: { select: { id: true, name: true } },
                },
              },
              byggeplass: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      // RUH henter fra task — samme shape som avvik (vedtatt 2026-05-29).
      const ruhPromise = (input.subdomain === undefined || input.subdomain === "ruh")
        ? ctx.prisma.task.findMany({
            where: {
              ...statusFilter,
              template: { is: { projectId: { in: projectIdList }, domain: "hms", subdomain: "ruh" } },
              ...(taskByggeplassClause ?? {}),
            },
            select: {
              ...TASK_SELECT,
              template: {
                select: {
                  id: true,
                  prefix: true,
                  name: true,
                  domain: true,
                  subdomain: true,
                  hmsSynlighet: true,
                  objects: { select: { id: true, label: true, type: true } },
                  project: { select: { id: true, name: true } },
                },
              },
              drawing: { select: { byggeplass: { select: { id: true, name: true } } } },
            },
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const [avvik, sja, ruh] = await Promise.all([avvikPromise, sjaPromise, ruhPromise]);

      // ---------- Statistikk-aggregering ----------
      const LUKKET = new Set(["closed", "approved", "cancelled"]);
      const apneAvvikPerProsjekt: Record<string, number> = {};
      for (const t of avvik) {
        if (LUKKET.has(t.status)) continue;
        const pid = (t as { template: { project: { id: string } | null } }).template.project?.id;
        if (!pid) continue;
        apneAvvikPerProsjekt[pid] = (apneAvvikPerProsjekt[pid] ?? 0) + 1;
      }

      const tolvMndTilbake = new Date();
      tolvMndTilbake.setMonth(tolvMndTilbake.getMonth() - 12);
      const formatMaaned = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const sjaFrekvensPerMaaned: Record<string, number> = {};
      for (const c of sja) {
        const created = new Date(c.createdAt);
        if (created < tolvMndTilbake) continue;
        const key = formatMaaned(created);
        sjaFrekvensPerMaaned[key] = (sjaFrekvensPerMaaned[key] ?? 0) + 1;
      }

      const ruhRatePerMaaned: Record<string, number> = {};
      for (const c of ruh) {
        const created = new Date(c.createdAt);
        if (created < tolvMndTilbake) continue;
        const key = formatMaaned(created);
        ruhRatePerMaaned[key] = (ruhRatePerMaaned[key] ?? 0) + 1;
      }

      // Saksbehandlingstid: median dager fra createdAt til updatedAt for lukkede avvik.
      // updatedAt brukes som proxy for closedAt — fungerer så lenge siste oppdatering
      // er statusovergang til closed.
      const lukkedeDager: number[] = [];
      for (const t of avvik) {
        if (t.status !== "closed") continue;
        const created = new Date(t.createdAt).getTime();
        const closed = new Date(t.updatedAt).getTime();
        const dager = (closed - created) / 86400000;
        if (dager >= 0) lukkedeDager.push(dager);
      }
      lukkedeDager.sort((a, b) => a - b);
      let saksbehandlingstidMedianDager: number | null = null;
      if (lukkedeDager.length > 0) {
        const midt = Math.floor(lukkedeDager.length / 2);
        if (lukkedeDager.length % 2 === 0) {
          const a = lukkedeDager[midt - 1] ?? 0;
          const b = lukkedeDager[midt] ?? 0;
          saksbehandlingstidMedianDager = (a + b) / 2;
        } else {
          saksbehandlingstidMedianDager = lukkedeDager[midt] ?? 0;
        }
      }

      // Audit-markør for private dokumenter — egen oppfølger for Activity-rad.
      // eslint-disable-next-line no-console
      console.log(
        `[firma-hms-oversikt] userId=${ctx.userId} orgId=${input.organizationId} ` +
          `prosjekter=${projectIdList.length} avvik=${avvik.length} sja=${sja.length} ruh=${ruh.length}`,
      );

      return {
        prosjekter: alleProsjekter,
        dokumenter: { avvik, sja, ruh },
        statistikk: {
          apneAvvikPerProsjekt,
          sjaFrekvensPerMaaned,
          ruhRatePerMaaned,
          saksbehandlingstidMedianDager,
        },
      };
    }),

  // Hurtig-behandling av avvik (Task) fra firma-HMS-dashbord.
  // Lar firma_admin / hms_ansvarlig endre status og legge til intern kommentar
  // uten å være medlem av faggruppen — bypasser flyt-rolle-validering.
  // Bevisst begrenset: ingen videresending, ingen eier-bytte (drill-ned for det).
  // Trinn 4 av firma-HMS-dashboard (2026-05-29).
  firmaBehandleAvvik: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        taskId: z.string().uuid(),
        nyStatus: documentStatusSchema.optional(),
        kommentar: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.nyStatus && !input.kommentar?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Oppgi status, kommentar eller begge",
        });
      }

      const harTilgang = await harFirmaHmsTilgang(ctx.userId, input.organizationId);
      if (!harTilgang) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Krever firma-admin eller HMS-ansvarlig",
        });
      }

      const oppgave = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: {
          id: true,
          status: true,
          template: { select: { domain: true, projectId: true } },
          bestillerFaggruppe: { select: { projectId: true } },
        },
      });
      if (!oppgave) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Avvik ikke funnet" });
      }

      // Verifiser at oppgaven hører til et prosjekt i firmaet
      const projectId = oppgave.template?.projectId ?? oppgave.bestillerFaggruppe?.projectId;
      if (!projectId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Oppgave mangler prosjekt",
        });
      }
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: projectId },
        select: { primaryOrganizationId: true },
      });
      if (prosjekt?.primaryOrganizationId !== input.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Oppgave hører ikke til firmaet",
        });
      }

      // Begrens til HMS-domene (avvik er HMS i firma-dashbordet)
      if (oppgave.template?.domain !== "hms") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Hurtig-behandling kun for HMS-avvik",
        });
      }

      // Valider status-overgang hvis oppgitt
      if (input.nyStatus && input.nyStatus !== oppgave.status) {
        if (!isValidStatusTransition(oppgave.status, input.nyStatus)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Ugyldig statusovergang ${oppgave.status} → ${input.nyStatus}`,
          });
        }
        await ctx.prisma.task.update({
          where: { id: input.taskId },
          data: { status: input.nyStatus },
        });
      }

      if (input.kommentar?.trim()) {
        await ctx.prisma.taskComment.create({
          data: {
            taskId: input.taskId,
            userId: ctx.userId,
            content: input.kommentar.trim(),
          },
        });
      }

      return { ok: true };
    }),
});
