import { eq, asc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { vareLocal } from "../db/schema";
import { lagreVerdi, hentVerdi } from "./auth";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Vare-katalog-cache (Prosjektkort L3, 2026-11-06)
 *
 *  Speiler firmaets aktive varer lokalt for «+ Vareforbruk» på prosjektkortet,
 *  så føringen virker offline. Kilde: `vareforbruk.katalogForFirma` (kun id,
 *  navn, enhet, varenummer — ingen priser). Full overskriving pr. firma.
 *
 *  Prosjektene der Varelager er aktivt lagres i SecureStore pr. firma (som
 *  maskinførerbevis-statusen) — ingen egen tabell. Tom liste = knappen skjules.
 * ============================================================================ */

/** SecureStore-nøkkel: prosjekter med Varelager aktivt, pr. firma (JSON-array). */
export const VARELAGER_PROSJEKTER_KEY = "sitedoc_varelager_prosjekter";

type VarelagerPerOrg = { organizationId: string; prosjektIder: string[] };

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * FORBIDDEN (Varelager av / ikke medlem) og NOT_FOUND (eldre server uten ruten)
 * er gyldige svar: firmaet har ingen vare-føring fra kortet. Andre feil er
 * transiente og skal bevare cachen.
 */
export function erIngenVarelagerSvar(e: unknown): boolean {
  const kode = (e as { data?: { code?: string } })?.data?.code;
  return kode === "FORBIDDEN" || kode === "NOT_FOUND";
}

/**
 * Hent firmaets vare-katalog og overskriv lokal cache for firmaet. En feilet
 * pull (nett/token) kaster FØR den destruktive delete-en, så eksisterende cache
 * bevares (samme mønster som refreshMaskinKatalog).
 */
export async function refreshVareKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ varer: number }> {
  const db = hentDatabase();
  if (!db) return { varer: 0 };

  let svar: {
    varer: Array<{ id: string; navn: string; enhet: string; varenummer: string | null }>;
    prosjektIderMedVarelager: string[];
  };
  try {
    svar = await klient.vareforbruk.katalogForFirma.query({ organizationId });
  } catch (e) {
    if (!erIngenVarelagerSvar(e)) throw e;
    svar = { varer: [], prosjektIderMedVarelager: [] };
  }

  const naa = Date.now();
  db.delete(vareLocal).where(eq(vareLocal.organizationId, organizationId)).run();
  for (const v of svar.varer) {
    db.insert(vareLocal)
      .values({
        id: v.id,
        organizationId,
        navn: v.navn,
        enhet: v.enhet,
        varenummer: v.varenummer ?? null,
        sistOppdatert: naa,
      })
      .run();
  }

  const perOrg = await lesPerOrg();
  const neste = [
    ...perOrg.filter((o) => o.organizationId !== organizationId),
    { organizationId, prosjektIder: svar.prosjektIderMedVarelager },
  ];
  await lagreVerdi(VARELAGER_PROSJEKTER_KEY, JSON.stringify(neste));

  return { varer: svar.varer.length };
}

async function lesPerOrg(): Promise<VarelagerPerOrg[]> {
  const raw = await hentVerdi(VARELAGER_PROSJEKTER_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as VarelagerPerOrg[];
  } catch {
    return [];
  }
}

/** Prosjektene i firmaet der Varelager er aktivt (tom før første refresh). */
export async function hentVarelagerProsjekterLokalt(organizationId: string): Promise<string[]> {
  const perOrg = await lesPerOrg();
  return perOrg.find((o) => o.organizationId === organizationId)?.prosjektIder ?? [];
}

/** Firmaets varer fra lokal cache, sortert på navn. Tom hvis ikke populert. */
export function hentVarerLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(vareLocal)
    .where(eq(vareLocal.organizationId, organizationId))
    .orderBy(asc(vareLocal.navn))
    .all();
}
