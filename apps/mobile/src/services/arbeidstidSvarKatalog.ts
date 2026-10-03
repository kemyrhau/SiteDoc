import { eq, and, gte, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { arbeidstidSvarLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Arbeidstid-svar-cache (B6 v3, L1-B, 2026-10-02)
 *
 *  Telefonen REGNER ikke lønnsnormen — den henter SVARET fra serverens ene
 *  utledning (`organisasjon.hentEffektivArbeidstid`) og cacher det pr. (firma,
 *  dato). Hentes ved «Start dag», «Slutt dag», sedel-åpning, «+ Ny» og pull-sync.
 *  `hentDagsnormLokalt` leser KUN denne cachen (regner aldri); null = ingen svar
 *  → forslaget lages uten overtid-splitt (trinn 3, UNDERbetaling-risiko → markør).
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/** Hvor gammelt (ms) et svar kan være og fortsatt brukes som «cachet» (30 dager). */
const CACHE_MAKS_ALDER_MS = 30 * 24 * 60 * 60 * 1000;

export type DagsnormSvar = {
  dato: string;
  dagsnorm: number;
  startTid: string;
  sluttTid: string;
  pauseMin: number;
  normKilde: "fast" | "kalender";
  pauseEtterTimer: number;
  pauseReferanse: "fastStart" | "ankomst";
  /** "server" = svar for datoen; "cachet" = siste kjente svar ≤ 30 dager gammelt. */
  normStatus: "server" | "cachet";
  /** Unix ms da svaret ble hentet — for B5 NormSnapshot.hentetAt (ISO ved bruk). */
  hentetAt: number;
};

/**
 * Hent serverens norm-svar for (firma, dato) og cache det lokalt (upsert pr.
 * (org, dato)). Best-effort: feiler stille når nettet er borte — da beholder
 * cachen eksisterende svar, og `hentDagsnormLokalt` faller til cachet/ukjent.
 * `naa` injiserbar for test (ingen expo-avhengighet i signaturen).
 */
export async function hentOgCacheArbeidstidSvar(
  klient: TrpcKlient,
  organizationId: string,
  dato: string,
  naa: () => number = Date.now,
): Promise<boolean> {
  const db = hentDatabase();
  if (!db) return false;
  try {
    const svar = await klient.organisasjon.hentEffektivArbeidstid.query({
      organizationId,
      dato,
    });
    db.insert(arbeidstidSvarLocal)
      .values({
        organizationId,
        dato,
        dagsnorm: svar.dagsnorm,
        startTid: svar.startTid,
        sluttTid: svar.sluttTid,
        pauseMin: svar.pauseMin,
        normKilde: svar.normKilde,
        pauseEtterTimer: svar.pauseEtterTimer,
        pauseReferanse: svar.pauseReferanse,
        hentetAt: naa(),
      })
      .onConflictDoUpdate({
        target: [arbeidstidSvarLocal.organizationId, arbeidstidSvarLocal.dato],
        set: {
          dagsnorm: svar.dagsnorm,
          startTid: svar.startTid,
          sluttTid: svar.sluttTid,
          pauseMin: svar.pauseMin,
          normKilde: svar.normKilde,
          pauseEtterTimer: svar.pauseEtterTimer,
          pauseReferanse: svar.pauseReferanse,
          hentetAt: naa(),
        },
      })
      .run();
    return true;
  } catch {
    // Offline / feilet pull → behold eksisterende cache; markøren signaliserer.
    return false;
  }
}

/**
 * Les lønnsnormen for (firma, dato) fra svar-cachen. REGNER ALDRI.
 *  1. Eksakt svar for datoen → `normStatus: "server"`.
 *  2. Ellers siste svar for firmaet hentet ≤ 30 dager siden → `"cachet"`.
 *  3. Ingenting → `null` (kalleren lager forslag uten overtid-splitt, trinn 3).
 */
export function hentDagsnormLokalt(
  organizationId: string,
  dato: string,
  naa: () => number = Date.now,
): DagsnormSvar | null {
  const db = hentDatabase();
  if (!db) return null;

  const eksakt = db
    .select()
    .from(arbeidstidSvarLocal)
    .where(
      and(
        eq(arbeidstidSvarLocal.organizationId, organizationId),
        eq(arbeidstidSvarLocal.dato, dato),
      ),
    )
    .all()[0];
  if (eksakt) return tilSvar(eksakt, "server");

  const grense = naa() - CACHE_MAKS_ALDER_MS;
  const nyeste = db
    .select()
    .from(arbeidstidSvarLocal)
    .where(
      and(
        eq(arbeidstidSvarLocal.organizationId, organizationId),
        gte(arbeidstidSvarLocal.hentetAt, grense),
      ),
    )
    .orderBy(desc(arbeidstidSvarLocal.hentetAt))
    .all()[0];
  if (nyeste) return tilSvar(nyeste, "cachet");

  return null;
}

function tilSvar(
  rad: typeof arbeidstidSvarLocal.$inferSelect,
  normStatus: "server" | "cachet",
): DagsnormSvar {
  return {
    dato: rad.dato,
    dagsnorm: rad.dagsnorm,
    startTid: rad.startTid,
    sluttTid: rad.sluttTid,
    pauseMin: rad.pauseMin,
    normKilde: rad.normKilde === "kalender" ? "kalender" : "fast",
    pauseEtterTimer: rad.pauseEtterTimer,
    pauseReferanse: rad.pauseReferanse === "fastStart" ? "fastStart" : "ankomst",
    normStatus,
    hentetAt: rad.hentetAt,
  };
}
