import { eq, and, desc } from "drizzle-orm";
import { STANDARD_ARBEIDSTID_FALLBACK } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import {
  arbeidstidskalenderLocal,
  organizationSettingLocal,
} from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Kalender-katalog-cache (T4-d / T9d 2026-05-16)
 *
 *  Speiler ArbeidstidsKalender lokalt for offline-beregning av effektiv
 *  arbeidstid via hentEffektivArbeidstidLokal. Periode = currentYear ± 1
 *  (locked design 2026-05-16) — håndterer desember/januar uten ny pull.
 *
 *  Refresh ved login + nett-gjenkomst. Full overskriving for firmaet.
 *  Soft-deleted (aktiv=false) rader skrives også; helper-spørringer
 *  filtrerer på aktiv=true.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * B6 v3 (L1-B): KUN klokkeslett — forhåndsutfylling og pausevinduer. 🔴 Ingen
 * `dagsnorm`-felt: lønnsnormen er server-utledet og leses via `hentDagsnormLokalt`
 * (svar-cachen), ALDRI regnet lokalt. Typen uten `dagsnorm` er kompileringsgarantien
 * mot at en tids-kaller sniker inn en lokalt regnet norm.
 */
export type ArbeidsdagTider = {
  startTid: string; // HH:MM
  sluttTid: string; // HH:MM
  pauseMin: number;
};

// Sikkerhetsnett: brukes hvis cache er tom (første gang appen kjøres offline).
// ORDRE 2 STEG 1 (2026-08-20): delt kilde — @sitedoc/shared arbeidstidDefault.
const DEFAULT_START_TID = STANDARD_ARBEIDSTID_FALLBACK.startTid;
const DEFAULT_SLUTT_TID = STANDARD_ARBEIDSTID_FALLBACK.sluttTid;
const DEFAULT_PAUSE_MIN = STANDARD_ARBEIDSTID_FALLBACK.pauseMin;

/**
 * Last ned kalender-rader for periode currentYear ± 1 og overskriv lokal
 * cache for firmaet. Idempotent.
 */
export async function refreshKalenderKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ rader: number }> {
  const db = hentDatabase();
  if (!db) return { rader: 0 };

  const naa = new Date();
  const aar = naa.getUTCFullYear();
  const fraAar = aar - 1;
  const tilAar = aar + 1;

  // Cache-bevaring (device-funn 2026-08-08, samme mønster som maskinKatalog):
  // pullen fanges IKKE → feilet pull kaster FØR den scope-delete under, kalleren
  // beholder eksisterende cache. Vellykket tom liste (firma uten kalender-
  // overstyringer — svært vanlig) er gyldig → slett + refyll tomt for firmaet i
  // perioden. Tidligere `.catch(() => [])` tømte kalender-cachen ved transient feil.
  const rader = await klient.firma.kalender.hentForMobil.query({
    organizationId,
    fraAar,
    tilAar,
  });

  const naaMs = Date.now();

  // Full overskriving for firmaet i den valgte perioden — enklere enn delta-
  // sync og kalender-volumet er lavt (< 50 rader per år per firma).
  db.delete(arbeidstidskalenderLocal)
    .where(eq(arbeidstidskalenderLocal.organizationId, organizationId))
    .run();

  for (const r of rader) {
    // r.dato er ISO-streng over tRPC (tidligere union med Date fra catch-fallback-
    // typen som nå er fjernet). Widening til unknown bevarer den runtime-defensive
    // Date-grenen uten å bryte typecheck.
    const datoRaw: unknown = r.dato;
    const datoIso =
      datoRaw instanceof Date
        ? datoRaw.toISOString().slice(0, 10)
        : String(datoRaw).slice(0, 10);
    const timerOverstyr =
      r.timerOverstyr === null || r.timerOverstyr === undefined
        ? null
        : Number(r.timerOverstyr);
    db.insert(arbeidstidskalenderLocal)
      .values({
        id: r.id,
        organizationId: r.organizationId,
        aar: r.aar,
        dato: datoIso,
        type: r.type,
        navn: r.navn,
        timerOverstyr,
        standardStartTid: r.standardStartTid,
        standardSluttTid: r.standardSluttTid,
        pauseMin: r.pauseMin,
        aktiv: r.aktiv,
        sistOppdatert: naaMs,
      })
      .run();
  }

  return { rader: rader.length };
}

/**
 * Hent alle aktive kalender-rader for et år (UI-vy).
 */
export function hentKalenderForAarLokalt(organizationId: string, aar: number) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(arbeidstidskalenderLocal)
    .where(
      and(
        eq(arbeidstidskalenderLocal.organizationId, organizationId),
        eq(arbeidstidskalenderLocal.aar, aar),
        eq(arbeidstidskalenderLocal.aktiv, true),
      ),
    )
    .all();
}

/**
 * Lokal speil av apps/api/src/services/timer/arbeidstid.ts:hentEffektivArbeidstid.
 * Leser fra organization_setting_local + arbeidstidskalender_local — ingen nett.
 *
 * Logikk (T.4):
 *   1) Firma-default fra OrganizationSetting (eller hardkodet fallback).
 *   2) Hvis dato faller innenfor aktiv sommertid-periode (siste aktive
 *      sommertid_start ≤ dato + aktiv sommertid_slutt ≥ dato, samme år),
 *      overstyr fra sommertid_start-raden.
 *   3) Dagsnorm = (sluttTid - startTid) - pauseMin, i timer.
 *
 * Halvdag håndteres ikke her — det er per-rad-overstyring på timerOverstyr
 * og registreres direkte i UI (T4-e).
 */
export function hentArbeidsdagTiderLokalt(
  organizationId: string,
  dato: Date,
): ArbeidsdagTider {
  const db = hentDatabase();
  if (!db) {
    return {
      startTid: DEFAULT_START_TID,
      sluttTid: DEFAULT_SLUTT_TID,
      pauseMin: DEFAULT_PAUSE_MIN,
    };
  }

  const setting = db
    .select()
    .from(organizationSettingLocal)
    .where(eq(organizationSettingLocal.organizationId, organizationId))
    .all()[0];

  let startTid = setting?.standardStartTid ?? DEFAULT_START_TID;
  let sluttTid = setting?.standardSluttTid ?? DEFAULT_SLUTT_TID;
  let pauseMin = setting?.standardPauseMin ?? DEFAULT_PAUSE_MIN;

  const aar = dato.getUTCFullYear();
  const datoIso = dato.toISOString().slice(0, 10);

  // Siste aktive sommertid_start ≤ dato i samme år.
  const sommertidStart = db
    .select()
    .from(arbeidstidskalenderLocal)
    .where(
      and(
        eq(arbeidstidskalenderLocal.organizationId, organizationId),
        eq(arbeidstidskalenderLocal.aar, aar),
        eq(arbeidstidskalenderLocal.type, "sommertid_start"),
        eq(arbeidstidskalenderLocal.aktiv, true),
      ),
    )
    .orderBy(desc(arbeidstidskalenderLocal.dato))
    .all()
    .find((r) => r.dato <= datoIso);

  if (sommertidStart) {
    // Aktiv sommertid_slutt ≥ dato samme år — bekrefter at perioden ikke
    // alt er avsluttet.
    const sommertidSlutt = db
      .select()
      .from(arbeidstidskalenderLocal)
      .where(
        and(
          eq(arbeidstidskalenderLocal.organizationId, organizationId),
          eq(arbeidstidskalenderLocal.aar, aar),
          eq(arbeidstidskalenderLocal.type, "sommertid_slutt"),
          eq(arbeidstidskalenderLocal.aktiv, true),
        ),
      )
      .all()
      .find((r) => r.dato >= datoIso);

    if (sommertidSlutt) {
      if (sommertidStart.standardStartTid !== null) {
        startTid = sommertidStart.standardStartTid;
      }
      if (sommertidStart.standardSluttTid !== null) {
        sluttTid = sommertidStart.standardSluttTid;
      }
      if (sommertidStart.pauseMin !== null) {
        pauseMin = sommertidStart.pauseMin;
      }
    }
  }

  return { startTid, sluttTid, pauseMin };
}
