import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import type { PrismaClient } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";
import {
  finnPeriodeKonflikt,
  planleggOverforing,
  tilIsoDato,
  trengerOppmoteValg,
  type OppmotePeriodeInput,
} from "@sitedoc/shared";

// ============================================================================
//  Ansattens oppmøtested med perioder — POST 2026-11-15 (12) D.
//
//  Ansatt:     hentMine (egne perioder + «trenger valg»; setter fast sted
//              automatisk når firmaet har nøyaktig ett aktivt kontor),
//              settMittFaste (KUN første gang — finnes et fast sted, er det
//              firmaadmin som endrer).
//  Firmaadmin: hentForFirma, opprett, oppdater (midlertidig/byggeplass),
//              slett. Nytt fast sted lukker det forrige (tilDato = ny fraDato
//              − 1) i samme transaksjon; historikken står, så etterregistrering
//              i gammel periode gir gammelt sted.
//
//  Ansatt (del B): overforing — Tur/Retur til annet kontor i reise-kortet
//              setter/avslutter et ÅPENT midlertidig kontor (kilde='overforing').
//
//  Firmagrensen sjekkes alltid her: medlem, oppmøtested og prosjekt må tilhøre
//  input.organizationId, ellers NOT_FOUND (vi røper ikke at de finnes).
// ============================================================================

const isoDato = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være YYYY-MM-DD");

type Db = Pick<
  PrismaClient,
  "oppmotePeriode" | "organizationMember" | "oppmotested" | "project" | "user" | "$transaction"
>;

function tilDbDato(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Dagen før en ISO-dato (UTC-trygt). */
export function dagenFor(iso: string): string {
  const d = tilDbDato(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return tilIsoDato(d);
}

type PeriodeRad = {
  id: string;
  type: string;
  fast: boolean;
  oppmotestedId: string | null;
  projectId: string | null;
  fraDato: Date;
  tilDato: Date | null;
  kilde: string | null;
};

function tilInput(p: PeriodeRad): OppmotePeriodeInput & { id: string } {
  return {
    id: p.id,
    type: p.type === "byggeplass" ? "byggeplass" : "kontor",
    fast: p.fast,
    oppmotestedId: p.oppmotestedId,
    projectId: p.projectId,
    fraDato: tilIsoDato(p.fraDato),
    tilDato: p.tilDato ? tilIsoDato(p.tilDato) : null,
    kilde: p.kilde === "overforing" ? "overforing" : "admin",
  };
}

const PERIODE_SELECT = {
  id: true,
  type: true,
  fast: true,
  oppmotestedId: true,
  projectId: true,
  fraDato: true,
  tilDato: true,
  kilde: true,
} as const;

/** Innlogget brukers AKTIVE medlemskap i firmaet, ellers FORBIDDEN. */
async function hentEgetMedlem(db: Db, userId: string, organizationId: string) {
  const medlem = await db.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true, status: true, createdAt: true },
  });
  if (!medlem || medlem.status !== "aktiv") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Bruker tilhører ikke denne organisasjonen" });
  }
  return medlem;
}

async function hentMedlemForFirma(db: Db, id: string, organizationId: string) {
  const medlem = await db.organizationMember.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!medlem) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Ansatt finnes ikke eller tilhører ikke ditt firma" });
  }
  return medlem;
}

async function verifiserMaal(
  db: Db,
  organizationId: string,
  maal: { oppmotestedId?: string | null; projectId?: string | null },
): Promise<void> {
  if (maal.oppmotestedId) {
    const sted = await db.oppmotested.findFirst({
      where: { id: maal.oppmotestedId, organizationId },
      select: { id: true },
    });
    if (!sted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Oppmøtested finnes ikke eller tilhører ikke ditt firma" });
    }
  }
  if (maal.projectId) {
    const prosjekt = await db.project.findFirst({
      where: { id: maal.projectId, primaryOrganizationId: organizationId },
      select: { id: true },
    });
    if (!prosjekt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Prosjektet finnes ikke eller tilhører ikke ditt firma" });
    }
  }
}

function avvisKonflikt(ny: OppmotePeriodeInput, ovrige: readonly OppmotePeriodeInput[]): void {
  const konflikt = finnPeriodeKonflikt(ny, ovrige);
  if (!konflikt) return;
  const tekst =
    ny.type === "byggeplass"
      ? "Overlapper en annen byggeplass-periode på samme prosjekt"
      : ny.fast
        ? "Nytt fast sted må starte etter at det forrige startet"
        : "Overlapper en annen midlertidig periode";
  throw new TRPCError({ code: "CONFLICT", message: tekst });
}

function erUnikBrudd(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const periodeInput = z
  .object({
    organizationId: z.string().uuid(),
    organizationMemberId: z.string().uuid(),
    type: z.enum(["kontor", "byggeplass"]),
    fast: z.boolean(),
    oppmotestedId: z.string().uuid().nullish(),
    projectId: z.string().uuid().nullish(),
    fraDato: isoDato,
    tilDato: isoDato.nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "kontor" && !v.oppmotestedId) {
      ctx.addIssue({ code: "custom", message: "Velg oppmøtested", path: ["oppmotestedId"] });
    }
    if (v.type === "byggeplass" && !v.projectId) {
      ctx.addIssue({ code: "custom", message: "Velg prosjekt", path: ["projectId"] });
    }
    if (v.type === "byggeplass" && v.fast) {
      ctx.addIssue({ code: "custom", message: "Fast sted er alltid et kontor", path: ["fast"] });
    }
    if (v.fast && v.tilDato) {
      ctx.addIssue({ code: "custom", message: "Fast sted har ingen sluttdato", path: ["tilDato"] });
    }
    if (v.type === "kontor" && !v.fast && !v.tilDato) {
      ctx.addIssue({ code: "custom", message: "Midlertidig sted krever sluttdato", path: ["tilDato"] });
    }
    if (v.tilDato && v.tilDato < v.fraDato) {
      ctx.addIssue({ code: "custom", message: "Til-dato er før fra-dato", path: ["tilDato"] });
    }
  });

/**
 * POST 2026-11-15 (13) del B — overføring fra reise-kortet. Strict: input kan
 * ikke bære `fast`, `type`, `kilde` eller `organizationMemberId` — medlemskapet
 * er alltid den innloggede brukerens eget (`hentEgetMedlem`).
 * `dato` er periodedatoen klienten har regnet ut med `periodeDatoFraOverforing`
 * (kl. 12-regelen); serveren bruker den som gitt.
 */
const overforingInput = z
  .object({
    /** Klient-UUID: id-en på perioden «start» oppretter (idempotens ved re-sending). */
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    handling: z.enum(["start", "slutt"]),
    oppmotestedId: z.string().uuid().optional(),
    dato: isoDato,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.handling === "start" && !v.oppmotestedId) {
      ctx.addIssue({ code: "custom", message: "Velg oppmøtested", path: ["oppmotestedId"] });
    }
  });

type OverforingUtfall = "opprettet" | "lukket" | "slettet" | "ingen";

/** Lukk en åpen overføring på `til`, eller slett den når `til` er før start (angre). */
async function lukkEllerSlett(
  db: Db,
  apen: OppmotePeriodeInput & { id: string },
  til: string,
  userId: string,
): Promise<{ utfall: OverforingUtfall; periode: (OppmotePeriodeInput & { id: string }) | null }> {
  if (til < apen.fraDato) {
    await db.oppmotePeriode.delete({ where: { id: apen.id } });
    return { utfall: "slettet", periode: null };
  }
  const rad = await db.oppmotePeriode.update({
    where: { id: apen.id },
    data: { tilDato: tilDbDato(til), sattAvUserId: userId, sattVed: new Date() },
    select: PERIODE_SELECT,
  });
  return { utfall: "lukket", periode: tilInput(rad) };
}

export const oppmotePeriodeRouter = router({
  // ── Ansatt ────────────────────────────────────────────────────────────────

  /**
   * Egne perioder (mobil-cache + web). Har firmaet nøyaktig ett aktivt kontor
   * og den ansatte aldri hatt et fast sted, settes det automatisk (idempotent:
   * den partielle unike indeksen stopper dobbel innsetting).
   */
  hentMine: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.prisma as Db;
      const medlem = await hentEgetMedlem(db, ctx.userId, input.organizationId);
      const kontorer = await db.oppmotested.findMany({
        where: { organizationId: input.organizationId, aktiv: true },
        select: { id: true },
      });
      let rader = await db.oppmotePeriode.findMany({
        where: { organizationMemberId: medlem.id, organizationId: input.organizationId },
        select: PERIODE_SELECT,
        orderBy: { fraDato: "asc" },
      });

      if (kontorer.length === 1 && !rader.some((r) => r.fast)) {
        try {
          await db.oppmotePeriode.create({
            data: {
              organizationId: input.organizationId,
              organizationMemberId: medlem.id,
              type: "kontor",
              fast: true,
              oppmotestedId: kontorer[0]!.id,
              fraDato: tilDbDato(tilIsoDato(medlem.createdAt)),
              sattAvUserId: ctx.userId,
            },
          });
        } catch (e) {
          if (!erUnikBrudd(e)) throw e;
        }
        rader = await db.oppmotePeriode.findMany({
          where: { organizationMemberId: medlem.id, organizationId: input.organizationId },
          select: PERIODE_SELECT,
          orderBy: { fraDato: "asc" },
        });
      }

      const perioder = rader.map(tilInput);
      return { perioder, trengerValg: trengerOppmoteValg(kontorer.length, perioder) };
    }),

  /**
   * Svar på «Hvor møter du vanligvis?». Kun første gang: har den ansatte
   * (noen gang) hatt et fast sted, avvises det — endring gjøres av firmaadmin.
   */
  settMittFaste: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid(), oppmotestedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.prisma as Db;
      const medlem = await hentEgetMedlem(db, ctx.userId, input.organizationId);
      const sted = await db.oppmotested.findFirst({
        where: { id: input.oppmotestedId, organizationId: input.organizationId, aktiv: true },
        select: { id: true },
      });
      if (!sted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Oppmøtested finnes ikke eller tilhører ikke ditt firma" });
      }
      const harFast = await db.oppmotePeriode.findFirst({
        where: { organizationMemberId: medlem.id, fast: true },
        select: { id: true },
      });
      const avvis = () =>
        new TRPCError({
          code: "FORBIDDEN",
          message: "Oppmøtestedet ditt er allerede satt — be firmaadmin endre det",
        });
      if (harFast) throw avvis();
      try {
        const rad = await db.oppmotePeriode.create({
          data: {
            organizationId: input.organizationId,
            organizationMemberId: medlem.id,
            type: "kontor",
            fast: true,
            oppmotestedId: input.oppmotestedId,
            fraDato: tilDbDato(tilIsoDato(medlem.createdAt)),
            sattAvUserId: ctx.userId,
          },
          select: PERIODE_SELECT,
        });
        return tilInput(rad);
      } catch (e) {
        if (erUnikBrudd(e)) throw avvis();
        throw e;
      }
    }),

  /**
   * Del B: Tur til annet kontor («start») / avslutt («slutt»). Rører KUN egen
   * åpen periode med kilde='overforing'; admin-perioder og fast sted er urørt.
   *  - start: lukker egen åpne overføring (tilDato = dato − 1; slettes om den
   *    da slutter før den startet) og oppretter ny i samme transaksjon.
   *    Tur til eget faste kontor → ingen periode. Konflikt med admin-periode
   *    → CONFLICT. Samme `id` igjen → samme rad (idempotent).
   *  - slutt: tilDato = dato; slutt før start → perioden slettes (angre).
   *    Ingen åpen overføring → ingen endring.
   */
  overforing: protectedProcedure.input(overforingInput).mutation(async ({ ctx, input }) => {
    const db = ctx.prisma as Db;
    const medlem = await hentEgetMedlem(db, ctx.userId, input.organizationId);

    if (input.handling === "start") {
      const sted = await db.oppmotested.findFirst({
        where: { id: input.oppmotestedId!, organizationId: input.organizationId, aktiv: true },
        select: { id: true },
      });
      if (!sted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Oppmøtested finnes ikke eller tilhører ikke ditt firma" });
      }
    }

    // Idempotens: perioden med denne id-en finnes alt (re-sending fra køen).
    const fins = await db.oppmotePeriode.findFirst({
      where: { id: input.id, organizationMemberId: medlem.id, organizationId: input.organizationId },
      select: PERIODE_SELECT,
    });
    if (fins) return { utfall: "opprettet" as OverforingUtfall, periode: tilInput(fins) };

    const perioder = (
      await db.oppmotePeriode.findMany({
        where: { organizationMemberId: medlem.id, organizationId: input.organizationId },
        select: PERIODE_SELECT,
      })
    ).map(tilInput);
    // Én regel med mobilens optimistiske skriving: planleggOverforing (shared).
    const plan = planleggOverforing(perioder, input);
    if (plan.utfall === "ingen") return { utfall: "ingen" as OverforingUtfall, periode: plan.periode };
    if (plan.utfall === "konflikt") {
      // En åpen midlertidig periode som IKKE er overføring (admin) → serveren vinner.
      throw new TRPCError({ code: "CONFLICT", message: "Overlapper en annen midlertidig periode" });
    }
    if (plan.utfall !== "opprettet") {
      return lukkEllerSlett(db, plan.apen, plan.til, ctx.userId);
    }

    const { apen, lukkTil, slettApen, ny } = plan;
    const ovrige = perioder
      .filter((p) => p !== apen)
      .concat(apen && !slettApen ? [{ ...apen, tilDato: lukkTil }] : []);
    avvisKonflikt(ny, ovrige);

    try {
      const rad = await db.$transaction(async (tx) => {
        if (apen && slettApen) await tx.oppmotePeriode.delete({ where: { id: apen.id } });
        else if (apen) {
          await tx.oppmotePeriode.update({
            where: { id: apen.id },
            data: { tilDato: tilDbDato(lukkTil!), sattAvUserId: ctx.userId, sattVed: new Date() },
          });
        }
        return tx.oppmotePeriode.create({
          data: {
            id: input.id,
            organizationId: input.organizationId,
            organizationMemberId: medlem.id,
            type: "kontor",
            fast: false,
            oppmotestedId: ny.oppmotestedId,
            fraDato: tilDbDato(input.dato),
            tilDato: null,
            kilde: "overforing",
            sattAvUserId: ctx.userId,
          },
          select: PERIODE_SELECT,
        });
      });
      return { utfall: "opprettet" as OverforingUtfall, periode: tilInput(rad) };
    } catch (e) {
      // Kappløp: samme id sendt samtidig, eller delindeksen «maks én åpen».
      if (erUnikBrudd(e)) {
        const igjen = await db.oppmotePeriode.findFirst({
          where: { id: input.id, organizationMemberId: medlem.id },
          select: PERIODE_SELECT,
        });
        if (igjen) return { utfall: "opprettet" as OverforingUtfall, periode: tilInput(igjen) };
        throw new TRPCError({ code: "CONFLICT", message: "Overlapper en annen midlertidig periode" });
      }
      throw e;
    }
  }),

  // ── Firmaadmin ────────────────────────────────────────────────────────────

  hentForFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const db = ctx.prisma as Db;
      const rader = await db.oppmotePeriode.findMany({
        where: { organizationId: input.organizationId },
        select: {
          ...PERIODE_SELECT,
          organizationMemberId: true,
          sattAvUserId: true,
          sattVed: true,
          oppmotested: { select: { navn: true } },
          project: { select: { name: true } },
        },
        orderBy: [{ organizationMemberId: "asc" }, { fraDato: "asc" }],
      });
      const sattAvIder = [...new Set(rader.map((r) => r.sattAvUserId))];
      const brukere = sattAvIder.length
        ? await db.user.findMany({ where: { id: { in: sattAvIder } }, select: { id: true, name: true } })
        : [];
      const navn = new Map(brukere.map((b) => [b.id, b.name]));
      return rader.map((r) => ({
        ...tilInput(r),
        organizationMemberId: r.organizationMemberId,
        oppmotestedNavn: r.oppmotested?.navn ?? null,
        prosjektNavn: r.project?.name ?? null,
        sattAvNavn: navn.get(r.sattAvUserId) ?? null,
        sattVed: r.sattVed,
      }));
    }),

  /** Ny periode. Fast: lukker det gjeldende faste stedet i samme transaksjon. */
  opprett: protectedProcedure.input(periodeInput).mutation(async ({ ctx, input }) => {
    await autoriserAdminForFirma(ctx.userId, input.organizationId);
    const db = ctx.prisma as Db;
    await hentMedlemForFirma(db, input.organizationMemberId, input.organizationId);
    await verifiserMaal(db, input.organizationId, input);

    const ny: OppmotePeriodeInput = {
      type: input.type,
      fast: input.fast,
      oppmotestedId: input.type === "kontor" ? input.oppmotestedId ?? null : null,
      projectId: input.type === "byggeplass" ? input.projectId ?? null : null,
      fraDato: input.fraDato,
      tilDato: input.tilDato ?? null,
    };
    const ovrige = (
      await db.oppmotePeriode.findMany({
        where: { organizationMemberId: input.organizationMemberId },
        select: PERIODE_SELECT,
      })
    ).map(tilInput);
    avvisKonflikt(ny, ovrige);

    const apenFast = ny.fast ? ovrige.find((p) => p.fast && p.tilDato == null) : undefined;
    try {
      return await db.$transaction(async (tx) => {
        if (apenFast) {
          await tx.oppmotePeriode.update({
            where: { id: apenFast.id },
            data: { tilDato: tilDbDato(dagenFor(ny.fraDato)) },
          });
        }
        const rad = await tx.oppmotePeriode.create({
          data: {
            organizationId: input.organizationId,
            organizationMemberId: input.organizationMemberId,
            type: ny.type,
            fast: ny.fast,
            oppmotestedId: ny.oppmotestedId,
            projectId: ny.projectId,
            fraDato: tilDbDato(ny.fraDato),
            tilDato: ny.tilDato ? tilDbDato(ny.tilDato) : null,
            sattAvUserId: ctx.userId,
          },
          select: PERIODE_SELECT,
        });
        return tilInput(rad);
      });
    } catch (e) {
      // Kappløp om gjeldende fast sted: den partielle unike indeksen slår inn.
      if (erUnikBrudd(e)) {
        throw new TRPCError({ code: "CONFLICT", message: "Den ansatte har allerede et gjeldende fast sted" });
      }
      throw e;
    }
  }),

  /**
   * Endre en midlertidig kontor- eller byggeplass-periode (sted/prosjekt og
   * datoer). Fast sted endres ved å sette et nytt fast sted (historikken står).
   */
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
        oppmotestedId: z.string().uuid().nullish(),
        projectId: z.string().uuid().nullish(),
        fraDato: isoDato,
        tilDato: isoDato.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const db = ctx.prisma as Db;
      const eks = await db.oppmotePeriode.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
        select: { ...PERIODE_SELECT, organizationMemberId: true },
      });
      if (!eks) throw new TRPCError({ code: "NOT_FOUND", message: "Perioden finnes ikke" });
      if (eks.fast) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fast sted endres ved å sette et nytt fast sted" });
      }
      const erKontor = eks.type === "kontor";
      const ny: OppmotePeriodeInput = {
        type: erKontor ? "kontor" : "byggeplass",
        fast: false,
        oppmotestedId: erKontor ? input.oppmotestedId ?? eks.oppmotestedId : null,
        projectId: erKontor ? null : input.projectId ?? eks.projectId,
        fraDato: input.fraDato,
        tilDato: input.tilDato ?? null,
      };
      if (erKontor && !ny.tilDato) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Midlertidig sted krever sluttdato" });
      }
      if (ny.tilDato && ny.tilDato < ny.fraDato) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Til-dato er før fra-dato" });
      }
      await verifiserMaal(db, input.organizationId, ny);
      const ovrige = (
        await db.oppmotePeriode.findMany({
          where: { organizationMemberId: eks.organizationMemberId, id: { not: eks.id } },
          select: PERIODE_SELECT,
        })
      ).map(tilInput);
      avvisKonflikt(ny, ovrige);
      const rad = await db.oppmotePeriode.update({
        where: { id: eks.id },
        data: {
          oppmotestedId: ny.oppmotestedId,
          projectId: ny.projectId,
          fraDato: tilDbDato(ny.fraDato),
          tilDato: ny.tilDato ? tilDbDato(ny.tilDato) : null,
          sattAvUserId: ctx.userId,
          sattVed: new Date(),
        },
        select: PERIODE_SELECT,
      });
      return tilInput(rad);
    }),

  /**
   * Slett en periode. Slettes det gjeldende faste stedet, gjenåpnes det
   * forrige faste (det som ble lukket da dette ble satt) — slett = angre.
   */
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const db = ctx.prisma as Db;
      const eks = await db.oppmotePeriode.findFirst({
        where: { id: input.id, organizationId: input.organizationId },
        select: { ...PERIODE_SELECT, organizationMemberId: true },
      });
      if (!eks) throw new TRPCError({ code: "NOT_FOUND", message: "Perioden finnes ikke" });
      // Et lukket fast sted er historikk: sletting ville gitt et datohull der
      // etterregistrering får «ikke valgt» (ingen reise) — stille lønnseffekt.
      if (eks.fast && eks.tilDato != null) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "firma.ansatte.oppmote.feil.lukketFast" });
      }

      return db.$transaction(async (tx) => {
        await tx.oppmotePeriode.delete({ where: { id: eks.id } });
        if (eks.fast && eks.tilDato == null) {
          const forrige = await tx.oppmotePeriode.findFirst({
            where: {
              organizationMemberId: eks.organizationMemberId,
              fast: true,
              tilDato: tilDbDato(dagenFor(tilIsoDato(eks.fraDato))),
            },
            select: { id: true },
          });
          if (forrige) {
            await tx.oppmotePeriode.update({ where: { id: forrige.id }, data: { tilDato: null } });
          }
        }
        return { id: eks.id };
      });
    }),
});
