import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import type { PrismaClient } from "@sitedoc/db";

/**
 * Mannskap — §15-innsjekk/utsjekk per byggeplass (Fase 4, vy i PSI-modulen).
 *
 * Byggherreforskriften §15 (elektronisk oversiktsliste, katastrofe-mønstring) +
 * GDPR art. 6(1)(c) (rettslig forpliktelse, ikke samtykke). To-lags-grense:
 * presence ≠ lønnstid — INGEN FK til timer, ingen timer-skriving.
 *
 * ⭐ FELTNIVÅ-ISOLASJON (lovkrav): innsjekkTid/utsjekkTid er firma-isolert.
 * Kun arbeiderens EGET firma (delt OrganizationMember-org) + arbeideren selv +
 * sitedoc_admin ser klokkeslett. Byggherre/SHA-KU (annen org, når prosjektet via
 * ProjectOrganization) ser §15-aggregat: navn/arbeidsgiver/HMS-kort — ALDRI
 * tidspunkt. Isolasjonen skjer i serialiseringen (`filtrerTidsfelter`), ikke i DB.
 * Fase A-konservativ: kun samme arbeidsgiver ser tid (hovedentreprenør ser ikke
 * UE-arbeiders klokkeslett heller) — bevisst streng default.
 */

const KILDER = ["manuell", "qr", "geofence", "hmskort", "app"] as const;

// PSI-modulen må være aktiv på prosjektet (mannskap er en vy i PSI).
async function krevPsiModul(prisma: PrismaClient, projectId: string): Promise<void> {
  const modul = await prisma.projectModule.findUnique({
    where: { projectId_moduleSlug: { projectId, moduleSlug: "psi" } },
    select: { status: true },
  });
  if (!modul || modul.status !== "aktiv") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "PSI-modulen er ikke aktiv på dette prosjektet",
    });
  }
}

// 12t blindt sikkerhetsnett: retroaktiv utsjekk av glemte innsjekk. Kjøres lazy
// ved hver hent-sti (api mangler app-scheduler i Fase A). utsjekkTid settes til
// innsjekk + 12t (ikke now) så historikken forblir sannferdig; autoUtlogget=true
// gjør det synlig at det var systemet, ikke arbeideren, som lukket.
async function lazyCloseUtsjekk(prisma: PrismaClient, projectId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "psi_tilstedevarelse"
    SET "utsjekk_tid" = "innsjekk_tid" + interval '12 hours',
        "auto_utlogget" = true,
        "updated_at" = now()
    WHERE "utsjekk_tid" IS NULL
      AND "innsjekk_tid" < now() - interval '12 hours'
      AND "project_id" = ${projectId}
  `;
}

type PresenceRad = {
  id: string;
  byggeplassId: string | null;
  byggeplass: { id: string; name: string } | null;
  userId: string | null;
  guestName: string | null;
  guestCompany: string | null;
  hmsKortNr: string | null;
  harIkkeHmsKort: boolean;
  innsjekkTid: Date;
  utsjekkTid: Date | null;
  kilde: string;
  autoUtlogget: boolean;
  user: { id: string; name: string | null } | null;
};

// Eksplisitt returtype: hindrer at tRPC infererer den dype mapped-typen inn i
// AppRouter (holder klient-type-dybden nede — TS2589-forebygging per CLAUDE.md).
type PresenceVisning = {
  id: string;
  byggeplassId: string | null;
  byggeplassNavn: string | null;
  userId: string | null;
  navn: string | null;
  arbeidsgiver: string | null;
  hmsKortNr: string | null;
  harIkkeHmsKort: boolean;
  kilde: string;
  autoUtlogget: boolean;
  innsjekkTid: Date | null;
  utsjekkTid: Date | null;
  tidSkjult: boolean;
};

/**
 * Bygger visnings-rader med feltnivå-isolasjon. `visTid` per rad avgjør om
 * klokkeslett følger med (arbeiderens eget firma) eller strippes (byggherre).
 */
async function serialiserMedIsolasjon(
  prisma: PrismaClient,
  kallerUserId: string,
  projectId: string,
  rader: PresenceRad[],
): Promise<PresenceVisning[]> {
  // Kallerens rolle + arbeidsgiver-org(er)
  const kaller = await prisma.user.findUnique({
    where: { id: kallerUserId },
    select: { role: true },
  });
  const erSitedocAdmin = kaller?.role === "sitedoc_admin";
  const kallerOrgRader = await prisma.organizationMember.findMany({
    where: { userId: kallerUserId },
    select: { organizationId: true },
  });
  const kallerOrgIds = new Set(kallerOrgRader.map((r) => r.organizationId));

  // Arbeidsgiver-org + navn per arbeider i resultatet (§15 «arbeidsgiver»-kolonne)
  const brukerIds = Array.from(
    new Set(rader.map((r) => r.userId).filter((x): x is string => !!x)),
  );
  const medlemskap = brukerIds.length
    ? await prisma.organizationMember.findMany({
        where: { userId: { in: brukerIds } },
        select: { userId: true, organizationId: true, organization: { select: { name: true } } },
      })
    : [];
  // Foretrekk org som faktisk deltar på prosjektet (ProjectOrganization) som «arbeidsgiver»
  const prosjektOrgRader = await prisma.projectOrganization.findMany({
    where: { projectId },
    select: { organizationId: true },
  });
  const prosjektOrgIds = new Set(prosjektOrgRader.map((r) => r.organizationId));

  const arbeidsgiverPerBruker = new Map<
    string,
    { orgIds: Set<string>; navn: string | null }
  >();
  for (const m of medlemskap) {
    const eks = arbeidsgiverPerBruker.get(m.userId) ?? { orgIds: new Set(), navn: null };
    eks.orgIds.add(m.organizationId);
    // Navn: prioriter prosjekt-deltakende org, ellers første funne
    if (eks.navn === null || prosjektOrgIds.has(m.organizationId)) {
      eks.navn = m.organization.name;
    }
    arbeidsgiverPerBruker.set(m.userId, eks);
  }

  return rader.map((r) => {
    const arbeidsgiver = r.userId ? arbeidsgiverPerBruker.get(r.userId) : undefined;
    const arbeidsgiverNavn = arbeidsgiver?.navn ?? r.guestCompany ?? null;

    const deltArbeidsgiver =
      !!r.userId &&
      !!arbeidsgiver &&
      Array.from(arbeidsgiver.orgIds).some((id) => kallerOrgIds.has(id));
    const segSelv = !!r.userId && r.userId === kallerUserId;
    const visTid = erSitedocAdmin || segSelv || deltArbeidsgiver;

    return {
      id: r.id,
      byggeplassId: r.byggeplassId,
      byggeplassNavn: r.byggeplass?.name ?? null,
      userId: r.userId,
      navn: r.user?.name ?? r.guestName ?? null,
      arbeidsgiver: arbeidsgiverNavn,
      hmsKortNr: r.hmsKortNr,
      harIkkeHmsKort: r.harIkkeHmsKort,
      kilde: r.kilde,
      autoUtlogget: r.autoUtlogget,
      // ⭐ Feltnivå-isolasjon: byggherre ser aldri klokkeslett
      innsjekkTid: visTid ? r.innsjekkTid : null,
      utsjekkTid: visTid ? r.utsjekkTid : null,
      tidSkjult: !visTid,
    };
  });
}

const presenceInclude = {
  byggeplass: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} as const;

export const mannskapRouter = router({
  // Sjekk inn på byggeplass (idempotent — returnerer åpen rad om den finnes)
  sjekkInn: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
        kilde: z.enum(KILDER).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevPsiModul(ctx.prisma, input.projectId);

      // Lukk ev. glemt >12t åpen rad FØR idempotent-sjekken, så en foreldet
      // åpen rad ikke returneres som «allerede innsjekket».
      await lazyCloseUtsjekk(ctx.prisma, input.projectId);

      const byggeplassId = input.byggeplassId ?? null;

      // Idempotens: har brukeren allerede en åpen innsjekk på (byggeplass)?
      const aapen = await ctx.prisma.psiTilstedevarelse.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.userId,
          byggeplassId,
          utsjekkTid: null,
        },
      });
      if (aapen) return aapen;

      // Snapshot HMS-kort ved innsjekk (A.7 — fryses, ikke live-oppslag)
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { hmsKortNr: true },
      });

      return ctx.prisma.psiTilstedevarelse.create({
        data: {
          projectId: input.projectId,
          byggeplassId,
          userId: ctx.userId,
          hmsKortNr: bruker?.hmsKortNr ?? null,
          harIkkeHmsKort: !bruker?.hmsKortNr,
          innsjekkTid: new Date(),
          kilde: input.kilde ?? "app",
        },
      });
    }),

  // Sjekk ut fra byggeplass (egen åpen rad)
  sjekkUt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevPsiModul(ctx.prisma, input.projectId);

      const aapen = await ctx.prisma.psiTilstedevarelse.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.userId,
          utsjekkTid: null,
          ...(input.byggeplassId !== undefined
            ? { byggeplassId: input.byggeplassId }
            : {}),
        },
        orderBy: { innsjekkTid: "desc" },
      });
      if (!aapen) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ingen aktiv innsjekk å sjekke ut fra",
        });
      }

      return ctx.prisma.psiTilstedevarelse.update({
        where: { id: aapen.id },
        data: { utsjekkTid: new Date() },
      });
    }),

  // Egen aktive innsjekk (mobil: vet appen om jeg er sjekket inn?)
  minStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevPsiModul(ctx.prisma, input.projectId);
      await lazyCloseUtsjekk(ctx.prisma, input.projectId);
      const aapen = await ctx.prisma.psiTilstedevarelse.findFirst({
        where: { projectId: input.projectId, userId: ctx.userId, utsjekkTid: null },
        include: { byggeplass: { select: { id: true, name: true } } },
        orderBy: { innsjekkTid: "desc" },
      });
      return aapen
        ? {
            id: aapen.id,
            byggeplassId: aapen.byggeplassId,
            byggeplassNavn: aapen.byggeplass?.name ?? null,
            innsjekkTid: aapen.innsjekkTid,
          }
        : null;
    }),

  // «På plass nå» — sanntidsliste (utsjekkTid IS NULL) med feltnivå-isolasjon
  hentPaaPlassen: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevPsiModul(ctx.prisma, input.projectId);
      await lazyCloseUtsjekk(ctx.prisma, input.projectId);

      const rader = await ctx.prisma.psiTilstedevarelse.findMany({
        where: {
          projectId: input.projectId,
          utsjekkTid: null,
          ...(input.byggeplassId !== undefined
            ? { byggeplassId: input.byggeplassId }
            : {}),
        },
        include: presenceInclude,
        orderBy: { innsjekkTid: "asc" },
      });

      return serialiserMedIsolasjon(ctx.prisma, ctx.userId, input.projectId, rader);
    }),

  // §15-liste / historikk — for eksport (PDF er Fase D; data-klar nå)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable().optional(),
        fra: z.string().optional(), // ISO-dato
        til: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await krevPsiModul(ctx.prisma, input.projectId);
      await lazyCloseUtsjekk(ctx.prisma, input.projectId);

      const rader = await ctx.prisma.psiTilstedevarelse.findMany({
        where: {
          projectId: input.projectId,
          ...(input.byggeplassId !== undefined
            ? { byggeplassId: input.byggeplassId }
            : {}),
          ...(input.fra || input.til
            ? {
                innsjekkTid: {
                  ...(input.fra ? { gte: new Date(input.fra) } : {}),
                  ...(input.til ? { lte: new Date(`${input.til}T23:59:59.999Z`) } : {}),
                },
              }
            : {}),
        },
        include: presenceInclude,
        orderBy: { innsjekkTid: "desc" },
        take: 500,
      });

      return serialiserMedIsolasjon(ctx.prisma, ctx.userId, input.projectId, rader);
    }),
});
