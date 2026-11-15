import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { planleggOverforing, type OverforingPlan } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { oppmoteOverforingKo, oppmotePeriodeLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";
import { hentOppmotePerioderLokalt, refreshOppmotePeriodeKatalog } from "./oppmotePeriodeKatalog";

/* ============================================================================
 *  Overføring til annet kontor fra reise-kortet (POST 2026-11-15 (13) del B)
 *
 *  1. `registrerOverforing` regner planen med den delte `planleggOverforing`
 *     (samme regel som serveren), skriver den optimistisk i
 *     oppmote_periode_local og legger kallet i oppmote_overforing_ko.
 *  2. `sendOverforingKo` (TimerSyncProvider, etter syncTimer + syncVareforbruk)
 *     sender kallene i rekkefølge. Suksess OG permanent avvisning (CONFLICT,
 *     NOT_FOUND, FORBIDDEN, BAD_REQUEST) fjerner kallet; nettfeil lar køen stå.
 *     Deretter overskriver refresh lokal tilstand — serveren vinner.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

export interface OverforingArgs {
  userId: string;
  organizationId: string;
  handling: "start" | "slutt";
  oppmotestedId?: string | null;
  /** Periodedato, ferdig regnet med `periodeDatoFraOverforing` (kl. 12-regelen). */
  dato: string;
  /** Kallets/den nye periodens id (UI setter den i reiseRegel.overforing.periodeId). */
  id?: string;
}

export interface OverforingRegistrert {
  utfall: OverforingPlan["utfall"];
  /** Perioden reisen hører til: ny ved «opprettet», lukket ved «lukket», ellers åpen/null. */
  periodeId: string | null;
}

/** Optimistisk lokal skriving + kø. Konflikt/ingen endring legger ingenting i køen. */
export function registrerOverforing(args: OverforingArgs): OverforingRegistrert {
  const db = hentDatabase();
  if (!db) return { utfall: "ingen", periodeId: null };
  const perioder = hentOppmotePerioderLokalt(args.userId, args.organizationId);
  const plan = planleggOverforing(perioder, args);
  if (plan.utfall === "konflikt") return { utfall: "konflikt", periodeId: null };
  if (plan.utfall === "ingen") return { utfall: "ingen", periodeId: plan.periode?.id ?? null };

  const naa = Date.now();
  const lukkEllerSlett = (id: string, til: string, slett: boolean) => {
    if (slett) db.delete(oppmotePeriodeLocal).where(eq(oppmotePeriodeLocal.id, id)).run();
    else db.update(oppmotePeriodeLocal).set({ tilDato: til, sistOppdatert: naa }).where(eq(oppmotePeriodeLocal.id, id)).run();
  };

  // id = periodens id ved «start» → serveren oppretter samme rad (idempotent ved re-sending).
  const id = args.id ?? randomUUID();
  if (plan.utfall === "opprettet") {
    if (plan.apen) lukkEllerSlett(plan.apen.id, plan.lukkTil!, plan.slettApen);
    db.insert(oppmotePeriodeLocal)
      .values({
        id,
        userId: args.userId,
        organizationId: args.organizationId,
        type: "kontor",
        fast: false,
        oppmotestedId: plan.ny.oppmotestedId,
        projectId: null,
        fraDato: plan.ny.fraDato,
        tilDato: null,
        kilde: "overforing",
        sistOppdatert: naa,
      })
      .run();
  } else {
    lukkEllerSlett(plan.apen.id, plan.til, plan.utfall === "slettet");
  }

  db.insert(oppmoteOverforingKo)
    .values({
      id,
      userId: args.userId,
      organizationId: args.organizationId,
      handling: args.handling,
      oppmotestedId: args.handling === "start" ? (args.oppmotestedId ?? null) : null,
      dato: args.dato,
      opprettet: naa,
      forsok: 0,
      feilmelding: null,
    })
    .run();
  const periodeId =
    plan.utfall === "opprettet" ? id : plan.utfall === "lukket" ? plan.apen.id : null;
  return { utfall: plan.utfall, periodeId };
}

/** Server-avvisning som ikke løses ved å prøve igjen (vs. nett-/tokenfeil). */
function erPermanent(e: unknown): boolean {
  const kode = (e as { data?: { code?: string } })?.data?.code;
  return kode === "CONFLICT" || kode === "NOT_FOUND" || kode === "FORBIDDEN" || kode === "BAD_REQUEST";
}

/** Send brukerens ventende overføringer i rekkefølge. Nettfeil stopper og lar køen stå. */
export async function sendOverforingKo(
  klient: TrpcKlient,
  userId: string,
): Promise<{ sendt: number; avvist: number; venter: number }> {
  const db = hentDatabase();
  const res = { sendt: 0, avvist: 0, venter: 0 };
  if (!db) return res;
  const ko = db
    .select()
    .from(oppmoteOverforingKo)
    .where(eq(oppmoteOverforingKo.userId, userId))
    // rowid som nest-nøkkel: to trykk i samme millisekund beholder rekkefølgen.
    .orderBy(asc(oppmoteOverforingKo.opprettet), sql`rowid`)
    .all();
  const berorteFirma = new Set<string>();

  for (let i = 0; i < ko.length; i++) {
    const kall = ko[i]!;
    try {
      await klient.oppmotePeriode.overforing.mutate({
        id: kall.id,
        organizationId: kall.organizationId,
        handling: kall.handling === "slutt" ? "slutt" : "start",
        ...(kall.oppmotestedId ? { oppmotestedId: kall.oppmotestedId } : {}),
        dato: kall.dato,
      });
      res.sendt++;
    } catch (e) {
      if (!erPermanent(e)) {
        // Nettfeil: behold rekkefølgen — resten venter til neste synk.
        db.update(oppmoteOverforingKo)
          .set({ forsok: kall.forsok + 1, feilmelding: e instanceof Error ? e.message : String(e) })
          .where(eq(oppmoteOverforingKo.id, kall.id))
          .run();
        res.venter = ko.length - i;
        break;
      }
      console.warn("[OPPMOTE-OVERFORING] avvist av server:", e);
      res.avvist++;
    }
    db.delete(oppmoteOverforingKo)
      .where(and(eq(oppmoteOverforingKo.id, kall.id), eq(oppmoteOverforingKo.userId, userId)))
      .run();
    berorteFirma.add(kall.organizationId);
  }

  // Serveren vinner: lokal periode-cache overskrives for firmaene som ble berørt.
  for (const org of berorteFirma) {
    await refreshOppmotePeriodeKatalog(klient, userId, org).catch((e) =>
      console.warn("[OPPMOTE-OVERFORING] refresh feilet:", e),
    );
  }
  return res;
}
