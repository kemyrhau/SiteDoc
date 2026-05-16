import { eq, and, desc } from "drizzle-orm";
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

export type EffektivArbeidstid = {
  startTid: string; // HH:MM
  sluttTid: string; // HH:MM
  pauseMin: number;
  dagsnorm: number; // timer (sluttTid - startTid - pauseMin)
};

// Sikkerhetsnett: brukes hvis cache er tom (første gang appen kjøres offline).
const DEFAULT_START_TID = "07:00";
const DEFAULT_SLUTT_TID = "15:00";
const DEFAULT_PAUSE_MIN = 30;

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

  const rader = await klient.firma.kalender.hentForMobil
    .query({ organizationId, fraAar, tilAar })
    .catch((e) => {
      console.warn("[KALENDER-KATALOG] Pull feilet:", e);
      return [] as Array<{
        id: string;
        organizationId: string;
        aar: number;
        dato: Date;
        type: string;
        navn: string;
        timerOverstyr: unknown;
        standardStartTid: string | null;
        standardSluttTid: string | null;
        pauseMin: number | null;
        aktiv: boolean;
      }>;
    });

  const naaMs = Date.now();

  // Full overskriving for firmaet i den valgte perioden — enklere enn delta-
  // sync og kalender-volumet er lavt (< 50 rader per år per firma).
  db.delete(arbeidstidskalenderLocal)
    .where(eq(arbeidstidskalenderLocal.organizationId, organizationId))
    .run();

  for (const r of rader) {
    const datoIso =
      r.dato instanceof Date ? r.dato.toISOString().slice(0, 10) : String(r.dato).slice(0, 10);
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
export function hentEffektivArbeidstidLokal(
  organizationId: string,
  dato: Date,
): EffektivArbeidstid {
  const db = hentDatabase();
  if (!db) {
    return {
      startTid: DEFAULT_START_TID,
      sluttTid: DEFAULT_SLUTT_TID,
      pauseMin: DEFAULT_PAUSE_MIN,
      dagsnorm: beregnDagsnorm(DEFAULT_START_TID, DEFAULT_SLUTT_TID, DEFAULT_PAUSE_MIN),
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

  return {
    startTid,
    sluttTid,
    pauseMin,
    dagsnorm: beregnDagsnorm(startTid, sluttTid, pauseMin),
  };
}

function beregnDagsnorm(
  startTid: string,
  sluttTid: string,
  pauseMin: number,
): number {
  const startMinutter = hhmmTilMinutter(startTid);
  const sluttMinutter = hhmmTilMinutter(sluttTid);
  const arbeidsMinutter = sluttMinutter - startMinutter - pauseMin;
  return Math.max(0, arbeidsMinutter / 60);
}

function hhmmTilMinutter(hhmm: string): number {
  const deler = hhmm.split(":");
  const timer = Number(deler[0] ?? 0);
  const minutter = Number(deler[1] ?? 0);
  return timer * 60 + minutter;
}
