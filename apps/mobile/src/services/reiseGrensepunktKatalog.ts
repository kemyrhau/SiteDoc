import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { reiseGrensepunktLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Reise-grensepunkt-katalog-cache (avstandsbånd, 2026-09-11)
 *
 *  Cacher firmaets reise-avstandsskala (grenseM → lonnsartId) offline, slik at
 *  `hentReiseLonnsartId(orgId, avstandM)` kan velge riktig reise-lønnsart etter
 *  avstand uten nett. Speiler serverens `OrganizationReiseGrense`; pullen går via
 *  `hentArbeidstidDefaults` (member-lesbart T4-d-subsett — samme prosedyre som
 *  `organizationSettingKatalog` bruker, IKKE firma-admin-`hentSetting`).
 *
 *  Komposit-PK (organizationId, grenseM) gjør delete+insert trygt — samme
 *  begrunnelse som singleton-raden i org-setting-katalogen. Refresh ved login +
 *  nett-gjenkomst (TimerSyncProvider).
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned firmaets reise-grensepunkter og overskriv lokal cache. Idempotent.
 * Tom skala på server → cachen tømmes (firma uten bånd = ingen lokale rader =
 * resolveren faller tilbake på reiseLonnsartId/navne-match, som før).
 */
export async function refreshReiseGrensepunktKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ ok: boolean }> {
  const db = hentDatabase();
  if (!db) return { ok: false };

  const setting = await klient.organisasjon.hentArbeidstidDefaults
    .query({ organizationId })
    .catch((e) => {
      console.warn("[REISE-GRENSE-KATALOG] Pull feilet:", e);
      return null;
    });

  if (!setting) return { ok: false };

  const naa = Date.now();

  // Erstatt hele firmaets sett: slett + sett inn. Overlapp er strukturelt umulig
  // (komposit-PK), så ingen ON CONFLICT-håndtering trengs.
  db.delete(reiseGrensepunktLocal)
    .where(eq(reiseGrensepunktLocal.organizationId, organizationId))
    .run();

  const grenser = setting.reiseGrenser ?? [];
  if (grenser.length > 0) {
    db.insert(reiseGrensepunktLocal)
      .values(
        grenser.map((g) => ({
          organizationId,
          grenseM: g.grenseM,
          lonnsartId: g.lonnsartId ?? null,
          sistOppdatert: naa,
        })),
      )
      .run();
  }

  return { ok: true };
}

/**
 * Synkron lese-funksjon for resolveren: hent firmaets grensepunkter fra lokal
 * cache. Tom array hvis cache ikke er populert (firma uten bånd, eller ennå ikke
 * synket) — resolveren tolker det som «ingen bånd» → fallback.
 */
export function hentReiseGrensepunkterLokalt(
  organizationId: string,
): { grenseM: number; lonnsartId: string | null }[] {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select({
      grenseM: reiseGrensepunktLocal.grenseM,
      lonnsartId: reiseGrensepunktLocal.lonnsartId,
    })
    .from(reiseGrensepunktLocal)
    .where(eq(reiseGrensepunktLocal.organizationId, organizationId))
    .all();
}
