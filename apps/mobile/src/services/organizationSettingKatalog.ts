import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { organizationSettingLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  OrganizationSetting-katalog-cache (T4-d 2026-05-16)
 *
 *  Cacher firma-defaults for normal arbeidsdag (standardStartTid/SluttTid/
 *  PauseMin) + tillattRedigerVedAttestering-flagg. Brukes som fallback i
 *  hentEffektivArbeidstidLokal når kalenderen ikke har overstyringer for
 *  datoen.
 *
 *  Én rad per firma (organizationId som PK). Refresh ved login + nett-
 *  gjenkomst.
 *
 *  Vi cacher ikke timezone, tilgang-policies osv. — de hentes ved behov via
 *  trpc.organisasjon.hentSetting og er ikke nødvendige for Timer-modulens
 *  offline-flyt.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned OrganizationSetting for firmaet og overskriv lokal cache.
 * Idempotent.
 */
export async function refreshOrganizationSettingKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ ok: boolean }> {
  const db = hentDatabase();
  if (!db) return { ok: false };

  // Bruker hentArbeidstidDefaults (T4-d) — medlems-tilgjengelig subset
  // av OrganizationSetting. hentSetting krever firma-admin og kan ikke
  // brukes for vanlige ansatte.
  const setting = await klient.organisasjon.hentArbeidstidDefaults
    .query({ organizationId })
    .catch((e) => {
      console.warn("[ORG-SETTING-KATALOG] Pull feilet:", e);
      return null;
    });

  if (!setting) return { ok: false };

  const naa = Date.now();

  // upsert via delete + insert — organization_id er PK så vi unngår
  // ON CONFLICT-syntaks (Drizzle SQLite støtter onConflictDoUpdate, men
  // delete+insert er enklere å lese og raden er en singleton).
  db.delete(organizationSettingLocal)
    .where(eq(organizationSettingLocal.organizationId, organizationId))
    .run();

  db.insert(organizationSettingLocal)
    .values({
      organizationId,
      standardStartTid: setting.standardStartTid ?? "07:00",
      standardSluttTid: setting.standardSluttTid ?? "15:00",
      standardPauseMin: setting.standardPauseMin ?? 30,
      tillattRedigerVedAttestering: setting.tillattRedigerVedAttestering ?? false,
      // T.5: null betyr ingen avrunding. undefined fra server (eldre klient
      // mot ny server) tolkes også som ingen avrunding.
      tidsrundingMinutter: setting.tidsrundingMinutter ?? null,
      // 2026-05-28: null = ingen firma-default (midtpunkt-fallback).
      standardPauseFra: setting.standardPauseFra ?? null,
      // Fase 3 (§ B): reise-regelsett. Defaultes hvis server-feltet mangler
      // (eldre server mot ny klient) — samme verdier som schema-default.
      reiseTerskelMin: setting.reiseTerskelMin ?? 30,
      reiseUnderTerskelType: setting.reiseUnderTerskelType ?? "arbeidstid",
      reiseOverTerskelType: setting.reiseOverTerskelType ?? "reisetid",
      reisetidTellerOvertid: setting.reisetidTellerOvertid ?? false,
      reiseLonnsartId: setting.reiseLonnsartId ?? null,
      sistOppdatert: naa,
    })
    .run();

  return { ok: true };
}

/**
 * Synkron lese-funksjon for UI: hent setting for firmaet fra lokal cache.
 * Returnerer null hvis cache ikke er populert.
 */
export function hentOrganizationSettingLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(organizationSettingLocal)
    .where(eq(organizationSettingLocal.organizationId, organizationId))
    .all();
  return rader[0] ?? null;
}
