import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { equipmentLocal } from "../db/schema";
import { lagreVerdi, hentVerdi } from "./auth";
import type { trpc } from "../lib/trpc";

/** T.11: SecureStore-nøkkel for maskinførerbevis-status per org (JSON-array). */
export const MASKINFORERBEVIS_KEY = "sitedoc_maskinforerbevis";

type MaskinforerbevisPerOrg = {
  organizationId: string;
  harGyldigMaskinforerbevis: boolean;
};

/* ============================================================================
 *  Maskin-katalog-cache (Runde 2.6 2026-05-02)
 *
 *  Speiler firmaets aktive Equipment lokalt for offline-velger ved
 *  sheet_machine-registrering. Refresh ved login + nett-gjenkomst.
 *  Full overskriving — typisk 100-500 rader (~50 KB) per firma.
 *
 *  Soft-skjul-mønster: tom liste = Maskin-modul ikke aktivert eller firmaet
 *  har ingen utstyr. Mobil-UI skjuler maskin-seksjonen i begge tilfeller.
 *  Per arkitektur (maskin.md § Cross-modul-integrasjon) returnerer
 *  trpc.maskin.equipment.list naturlig [] når Maskin-modul er av.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned hele aktiv Equipment-katalog fra server og overskriv lokal cache.
 * Pensjonerte/utgåtte ekskluderes fra default-listen, men bevares i cache så
 * gamle dagsseddel-rader kan vise navnet på utstyr som er tatt ut av drift.
 *
 * Pr 2026-05-02 har equipment.list `inkluderUtgaatt: false` som default,
 * dvs. utgåtte cachet IKKE. Hvis vi senere trenger å vise navn på utgåtte
 * i historikk-rader, må kallet utvides med `inkluderUtgaatt: true` og UI
 * filtrere ved velger-tid.
 */
export async function refreshMaskinKatalog(klient: TrpcKlient): Promise<{
  equipment: number;
}> {
  const db = hentDatabase();
  if (!db) return { equipment: 0 };

  const equipment = await klient.maskin.equipment.list.query().catch((e) => {
    // Ikke-kritisk hvis ruten ikke er tilgjengelig (f.eks. token utløpt)
    console.warn("[MASKIN-KATALOG] Equipment-pull feilet:", e);
    return [] as Array<{
      id: string;
      organizationId: string;
      kategori: string;
      type: string | null;
      merke: string | null;
      modell: string | null;
      internNavn: string | null;
      internNummer: string | null;
      registreringsnummer: string | null;
      status: string;
    }>;
  });

  const naa = Date.now();

  // Full overskriving — atomisk i forhold til velger-spørringer
  // (SQLite serialiserer skriving). Equipment-listen er liten nok til at
  // delta-sync ikke gir merkbar gevinst.
  db.delete(equipmentLocal).run();
  for (const e of equipment) {
    db.insert(equipmentLocal)
      .values({
        id: e.id,
        organizationId: e.organizationId,
        kategori: e.kategori,
        type: e.type ?? null,
        merke: e.merke ?? null,
        modell: e.modell ?? null,
        internNavn: e.internNavn ?? null,
        internNummer: e.internNummer ?? null,
        registreringsnummer: e.registreringsnummer ?? null,
        status: e.status,
        sistOppdatert: naa,
      })
      .run();
  }

  // T.11: hent innlogget brukers maskinførerbevis-status (per org) sammen med
  // equipment-cachen — samme livssyklus (login + nett-gjenkomst). Lagres i
  // SecureStore, ikke SQLite (ingen migrering). Ikke-kritisk hvis ruten feiler.
  const status = await klient.kompetanse.minMaskinstatus
    .query()
    .catch((e) => {
      console.warn("[MASKIN-KATALOG] Maskinførerbevis-pull feilet:", e);
      return { perOrg: [] as MaskinforerbevisPerOrg[] };
    });
  await lagreVerdi(MASKINFORERBEVIS_KEY, JSON.stringify(status.perOrg));

  return { equipment: equipment.length };
}

/**
 * T.11: synkron-vennlig lese-helper for maskinførerbevis-status. Leser
 * SecureStore (async) og returnerer om innlogget bruker har gyldig bevis i
 * gitt org. Default `true` ved manglende status — unngår falsk-flagg før
 * første sync. (Soft-flagg, aldri blokkerende.)
 */
export async function harMaskinforerbevisLokalt(
  organizationId: string,
): Promise<boolean> {
  const raw = await hentVerdi(MASKINFORERBEVIS_KEY);
  if (!raw) return true;
  try {
    const perOrg = JSON.parse(raw) as MaskinforerbevisPerOrg[];
    const treff = perOrg.find((o) => o.organizationId === organizationId);
    return treff?.harGyldigMaskinforerbevis ?? false;
  } catch {
    return true;
  }
}

/**
 * Synkron lese-funksjon for UI: hent aktive Equipment for firmaet fra lokal
 * cache. Returnerer tom array hvis cache ikke er populert.
 */
export function hentEquipmentLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(equipmentLocal)
    .where(eq(equipmentLocal.organizationId, organizationId))
    .all();
}

/**
 * Hjelper: finn én Equipment-rad fra lokal cache (for å vise navn på
 * sheet_machine_local-rader uten å hente fra server).
 */
export function finnEquipmentLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(equipmentLocal)
    .where(eq(equipmentLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/**
 * Hjelper: hent equipment filtert på status. Standardlister bruker dette
 * for å ekskludere utgåtte fra velger.
 */
export function hentEquipmentMedStatus(organizationId: string, status: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(equipmentLocal)
    .where(
      and(
        eq(equipmentLocal.organizationId, organizationId),
        eq(equipmentLocal.status, status),
      ),
    )
    .all();
}
