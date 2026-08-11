import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  utledOrdning,
  erGyldigOrdning,
  UTLEGG_ORDNINGER,
  type UtleggOrdning,
} from "@sitedoc/shared";
import { router, protectedProcedure } from "../../trpc/trpc";
import { resolverOrgFraInput, autoriserAdminForFirma } from "../../trpc/tilgangskontroll";

const ORDNING_ENUM = z.enum(
  UTLEGG_ORDNINGER as unknown as [UtleggOrdning, ...UtleggOrdning[]],
);

/**
 * ExpenseCategory-router (utleggs-ordningsmodell U3, 2026-08-08).
 *
 * Speiler `tilleggRouter.list` sitt milde tilgangsmønster (resolverOrgFraInput):
 * enhver arbeider som skal føre et utlegg må se firmaets utleggskatalog. CRUD
 * (opprett/oppdater/deaktiver) + overstyring-setting hører til firma-admin og
 * bygges i U5 — denne routeren eksponerer foreløpig KUN lesing + utledning.
 *
 * `list` returnerer hver kategori med DEN UTLEDEDE ordningen for et gitt
 * prosjekt (overstyring ?? firma-default, via delt `utledOrdning`) + kilden, så
 * web/mobil kan vise ordnings-pillen og kilde-linjen uten å reimplementere
 * utledningen. Feltarbeideren velger ALDRI ordning — den er utledet.
 *
 * NB (U1-default): alle eksisterende kategorier står på `ordning='utlegg'` til
 * firma-admin gjennomgår katalogen i U5. Uten prosjekt-overstyring gir `list`
 * derfor `ordning='utlegg'` for alt. `sats`/`fakturert` nås først via en
 * overstyring (U5) eller manuelt satt ordning i test-DB.
 */
export const expenseCategoryRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          inkluderInaktiv: z.boolean().default(false),
          organizationId: z.string().uuid().optional(),
          // Når satt: utled ordning per DETTE prosjektet (overstyring ?? default)
          // og merk kilden. Uten prosjekt returneres firma-default som ordning.
          projectId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);
      const inkluderInaktiv = input?.inkluderInaktiv ?? false;

      const kategorier = await ctx.prismaTimer.expenseCategory.findMany({
        where: {
          organizationId: orgId,
          ...(inkluderInaktiv ? {} : { aktiv: true }),
        },
        orderBy: { navn: "asc" },
      });

      // Prosjekt-overstyringer for dette prosjektet (om oppgitt) — én spørring,
      // slå opp per kategori. Ugyldige (drift-)verdier ignoreres av utledningen.
      const overstyringer = input?.projectId
        ? await ctx.prismaTimer.prosjektOrdningOverstyring.findMany({
            where: {
              prosjektId: input.projectId,
              expenseCategoryId: { in: kategorier.map((k) => k.id) },
            },
          })
        : [];
      const overstyringPerKategori = new Map<string, UtleggOrdning>();
      for (const o of overstyringer) {
        if (erGyldigOrdning(o.ordning)) {
          overstyringPerKategori.set(o.expenseCategoryId, o.ordning);
        }
      }

      return kategorier.map((k) => {
        // Firma-default fra katalogen (drift-sikring: ukjent verdi → 'utlegg').
        const firmaDefault: UtleggOrdning = erGyldigOrdning(k.ordning)
          ? k.ordning
          : "utlegg";
        const prosjektOverstyring =
          overstyringPerKategori.get(k.id) ?? null;
        const ordning = utledOrdning({ firmaDefault, prosjektOverstyring });
        return {
          id: k.id,
          navn: k.navn,
          aktiv: k.aktiv,
          firmaDefault,
          ordning,
          // Kilde-linjen på raden (8b): «firma-standard» / «overstyrt for prosjektet».
          kilde: prosjektOverstyring ? ("overstyrt" as const) : ("firma-standard" as const),
        };
      });
    }),

  // ===================================================================
  //  U4 (2026-08-11) — offline-katalog for mobil. Mobil trenger grunnlaget
  //  for ALLE arbeiderens prosjekter offline for å utlede ordningen ved
  //  føring (klient-stempel, ikke server-utledning ved sync). `list` er
  //  per-prosjekt og ferdig-resolvert — feil form for en org-bred cache.
  //  Derfor: rått grunnlag ut (kategorier + alle overstyringer), mobil
  //  deriverer selv via delt `utledOrdning` — «én delt utledning», ikke en
  //  fjerde implementasjon. Mildt tilgangsmønster (resolverOrgFraInput), som
  //  `list`: enhver arbeider som skal føre utlegg må se katalogen.
  // ===================================================================
  katalogForMobil: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);

      const kategorier = await ctx.prismaTimer.expenseCategory.findMany({
        where: { organizationId: orgId },
        orderBy: { navn: "asc" },
      });
      const katIder = kategorier.map((k) => k.id);
      // Alle overstyringer for firmaets kategorier (org-bredt, ikke per prosjekt):
      // mobil cacher dem og slår opp mot det aktuelle prosjektet ved føring.
      const overstyringer = katIder.length
        ? await ctx.prismaTimer.prosjektOrdningOverstyring.findMany({
            where: { expenseCategoryId: { in: katIder } },
          })
        : [];

      return {
        // Den resolvede org-en (én per kall) — mobil stempler den på hver
        // cachet kategori-rad for org-filtrert lokal lesing.
        organizationId: orgId,
        // aktiv følger med (ikke filtrert bort): en kategori kan deaktiveres
        // etter at en rad ble ført men før mobil pull-er — mobil trenger da
        // fortsatt navn/ordning for å vise raden. Registreringsvelgeren
        // filtrerer på aktiv=true selv.
        kategorier: kategorier.map((k) => ({
          id: k.id,
          navn: k.navn,
          aktiv: k.aktiv,
          // Drift-sikring: ukjent verdi → 'utlegg' (samme som `list`).
          ordning: (erGyldigOrdning(k.ordning) ? k.ordning : "utlegg") as UtleggOrdning,
        })),
        overstyringer: overstyringer
          .filter((o) => erGyldigOrdning(o.ordning))
          .map((o) => ({
            prosjektId: o.prosjektId,
            expenseCategoryId: o.expenseCategoryId,
            ordning: o.ordning as UtleggOrdning,
          })),
      };
    }),

  // ===================================================================
  //  U5 (2026-08-11) — firma-admin skriv: ordning per kategori + overstyring
  //  per prosjekt+kategori. verifiserFirmaAdmin-gated. ordningVedFoering på
  //  allerede førte SheetUtlegg-rader er IMMUTABEL — disse endringene gjelder
  //  KUN nye føringer (UI-mikrotekst forklarer det). sats er lovlig å sette
  //  (krav: «Verktøy til sats»); registreringsflaten deaktiverer den (U3-gap:
  //  ingen ExpenseCategory→lønnsart-bro).
  // ===================================================================

  // Sett firma-default ordning på en kategori.
  settOrdning: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        id: z.string().uuid(),
        ordning: ORDNING_ENUM,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const kat = await ctx.prismaTimer.expenseCategory.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!kat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utleggskategori finnes ikke i firmaet" });
      }
      return ctx.prismaTimer.expenseCategory.update({
        where: { id: input.id },
        data: { ordning: input.ordning },
      });
    }),

  // Sett/oppdater prosjekt-overstyring for én kategori (upsert på unik
  // (prosjektId, expenseCategoryId)). Verifiserer at kategori + prosjekt eies av firmaet.
  settOverstyring: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        prosjektId: z.string().uuid(),
        expenseCategoryId: z.string().uuid(),
        ordning: ORDNING_ENUM,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const kat = await ctx.prismaTimer.expenseCategory.findFirst({
        where: { id: input.expenseCategoryId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!kat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utleggskategori finnes ikke i firmaet" });
      }
      const prosjekt = await ctx.prisma.project.findFirst({
        where: {
          id: input.prosjektId,
          OR: [
            { primaryOrganizationId: input.organizationId },
            { projectOrganizations: { some: { organizationId: input.organizationId } } },
          ],
        },
        select: { id: true },
      });
      if (!prosjekt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Prosjektet tilhører ikke firmaet" });
      }
      const eks = await ctx.prismaTimer.prosjektOrdningOverstyring.findFirst({
        where: { prosjektId: input.prosjektId, expenseCategoryId: input.expenseCategoryId },
        select: { id: true },
      });
      if (eks) {
        return ctx.prismaTimer.prosjektOrdningOverstyring.update({
          where: { id: eks.id },
          data: { ordning: input.ordning },
        });
      }
      return ctx.prismaTimer.prosjektOrdningOverstyring.create({
        data: {
          prosjektId: input.prosjektId,
          expenseCategoryId: input.expenseCategoryId,
          ordning: input.ordning,
        },
      });
    }),

  // Fjern overstyring → kategorien følger firma-default igjen for prosjektet.
  fjernOverstyring: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        prosjektId: z.string().uuid(),
        expenseCategoryId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const kat = await ctx.prismaTimer.expenseCategory.findFirst({
        where: { id: input.expenseCategoryId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!kat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Utleggskategori finnes ikke i firmaet" });
      }
      await ctx.prismaTimer.prosjektOrdningOverstyring.deleteMany({
        where: { prosjektId: input.prosjektId, expenseCategoryId: input.expenseCategoryId },
      });
      return { ok: true };
    }),

  // Alle overstyringer for firmaets kategorier — driver firma-admin-panelet
  // (per kategori: hvilke prosjekter er overstyrt, til hva). Firma-admin-gated.
  listOverstyringer: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const kategorier = await ctx.prismaTimer.expenseCategory.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true },
      });
      const katIder = kategorier.map((k) => k.id);
      if (katIder.length === 0) return [];
      const overstyringer = await ctx.prismaTimer.prosjektOrdningOverstyring.findMany({
        where: { expenseCategoryId: { in: katIder } },
      });
      // Prosjektnavn (kjernen) for visning.
      const prosjektIder = [...new Set(overstyringer.map((o) => o.prosjektId))];
      const prosjekter = prosjektIder.length
        ? await ctx.prisma.project.findMany({
            where: { id: { in: prosjektIder } },
            select: { id: true, name: true, projectNumber: true },
          })
        : [];
      const navnPerProsjekt = new Map(prosjekter.map((p) => [p.id, p]));
      return overstyringer
        .filter((o) => erGyldigOrdning(o.ordning))
        .map((o) => ({
          id: o.id,
          prosjektId: o.prosjektId,
          prosjektNavn: navnPerProsjekt.get(o.prosjektId)?.name ?? null,
          prosjektNummer: navnPerProsjekt.get(o.prosjektId)?.projectNumber ?? null,
          expenseCategoryId: o.expenseCategoryId,
          ordning: o.ordning as UtleggOrdning,
        }));
    }),
});
