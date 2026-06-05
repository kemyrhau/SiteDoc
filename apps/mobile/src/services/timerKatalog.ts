import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  lonnsartLocal,
  aktivitetLocal,
  tilleggLocal,
  externalCostObjectLocal,
} from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Timer-katalog-cache (Runde 2)
 *
 *  Speiler firmaets aktive lønnsarter, aktiviteter og tillegg lokalt.
 *  Refresh ved login + ved manuell trigger. Ikke delta-sync i Runde 2 —
 *  full overskriving er enkelt og katalog er typisk < 100 rader per type.
 *
 *  Mobil-UI leser kun fra lokal cache når dagsseddel åpnes — sikrer at
 *  velgere fungerer offline. Ny katalog-rad fra firma-admin krever sync.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned hele aktiv katalog fra server og overskriv lokal cache.
 * Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshKatalog(klient: TrpcKlient): Promise<{
  lonnsarter: number;
  aktiviteter: number;
  tillegg: number;
  underprosjekter: number;
}> {
  const db = hentDatabase();
  if (!db) {
    return { lonnsarter: 0, aktiviteter: 0, tillegg: 0, underprosjekter: 0 };
  }

  const [lonnsarter, aktiviteter, tillegg, underprosjekter] = await Promise.all([
    klient.timer.lonnsart.list.query(),
    klient.timer.aktivitet.list.query(),
    klient.timer.tillegg.list.query(),
    klient.eksternKostObjekt.list.query().catch((e) => {
      // Ikke-kritisk hvis ECO-router mangler eller bruker ikke har firma
      console.warn("[KATALOG] ECO-pull feilet:", e);
      return [] as Array<{
        id: string;
        organizationId: string;
        projectId: string;
        proAdmId: string;
        kortNavn: string;
        kilde: string;
        status: string;
        timerregistreringApen: boolean;
      }>;
    }),
  ]);

  const naa = Date.now();

  // Lønnsarter — full overskriving
  db.delete(lonnsartLocal).run();
  for (const l of lonnsarter) {
    db.insert(lonnsartLocal)
      .values({
        id: l.id,
        organizationId: l.organizationId,
        type: l.type,
        kode: l.kode,
        navn: l.navn,
        prisMotKunde: l.prisMotKunde?.toString() ?? null,
        internkostnad: l.internkostnad?.toString() ?? null,
        sats: l.sats?.toString() ?? null,
        satsEnhet: l.satsEnhet,
        rekkefolge: l.rekkefolge,
        aktiv: l.aktiv,
        erStandardvalg: l.erStandardvalg ?? false,
        seedNivaa: l.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  db.delete(aktivitetLocal).run();
  for (const a of aktiviteter) {
    db.insert(aktivitetLocal)
      .values({
        id: a.id,
        organizationId: a.organizationId,
        kode: a.kode,
        navn: a.navn,
        aktiv: a.aktiv,
        seedNivaa: a.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  db.delete(tilleggLocal).run();
  for (const tl of tillegg) {
    db.insert(tilleggLocal)
      .values({
        id: tl.id,
        organizationId: tl.organizationId,
        kode: tl.kode,
        navn: tl.navn,
        type: tl.type,
        prisMotKunde: tl.prisMotKunde?.toString() ?? null,
        internkostnad: tl.internkostnad?.toString() ?? null,
        rekkefolge: tl.rekkefolge,
        aktiv: tl.aktiv,
        seedNivaa: tl.seedNivaa,
        sistOppdatert: naa,
      })
      .run();
  }

  // Underprosjekter (ECO) — full overskriving
  db.delete(externalCostObjectLocal).run();
  for (const eco of underprosjekter) {
    db.insert(externalCostObjectLocal)
      .values({
        id: eco.id,
        organizationId: eco.organizationId,
        projectId: eco.projectId,
        proAdmId: eco.proAdmId,
        kortNavn: eco.kortNavn,
        kilde: eco.kilde,
        status: eco.status,
        timerregistreringApen: eco.timerregistreringApen,
        sistOppdatert: naa,
      })
      .run();
  }

  return {
    lonnsarter: lonnsarter.length,
    aktiviteter: aktiviteter.length,
    tillegg: tillegg.length,
    underprosjekter: underprosjekter.length,
  };
}

/**
 * Synkron lese-funksjon for UI: hent aktive lønnsarter fra lokal cache.
 * Returnerer tom array hvis cache ikke er populert (typisk før første sync).
 */
export function hentLonnsarterLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(lonnsartLocal)
    .where(
      and(
        eq(lonnsartLocal.organizationId, organizationId),
        eq(lonnsartLocal.aktiv, true),
      ),
    )
    .all();
}

/**
 * Variant B: hent firmaets default-lønnsart (erStandardvalg=true) fra lokal
 * cache. Brukes til å forhåndsvelge lønnsart på første rad av en tom sedel.
 * Returnerer null hvis ingen er markert (f.eks. migrerte firma med tom katalog).
 */
export function hentStandardLonnsartLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(lonnsartLocal)
    .where(
      and(
        eq(lonnsartLocal.organizationId, organizationId),
        eq(lonnsartLocal.aktiv, true),
        eq(lonnsartLocal.erStandardvalg, true),
      ),
    )
    .all();
  return rader[0] ?? null;
}

export function hentAktiviteterLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(aktivitetLocal)
    .where(
      and(
        eq(aktivitetLocal.organizationId, organizationId),
        eq(aktivitetLocal.aktiv, true),
      ),
    )
    .all();
}

export function hentTilleggLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(tilleggLocal)
    .where(
      and(
        eq(tilleggLocal.organizationId, organizationId),
        eq(tilleggLocal.aktiv, true),
      ),
    )
    .all();
}

/**
 * Hjelper: finn én lønnsart fra lokal cache (for å vise navn på rader
 * uten å hente på nytt fra server).
 */
export function finnLonnsartLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(lonnsartLocal)
    .where(eq(lonnsartLocal.id, id))
    .all();
  return rader[0] ?? null;
}

export function finnTilleggLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(tilleggLocal)
    .where(eq(tilleggLocal.id, id))
    .all();
  return rader[0] ?? null;
}

export function finnAktivitetLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(aktivitetLocal)
    .where(eq(aktivitetLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/**
 * Hent aktive Underprosjekter (ECO) for et prosjekt fra lokal cache.
 * Filterer både på status="aktiv" og timerregistreringApen=true.
 */
export function hentUnderprosjekterLokalt(projectId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(externalCostObjectLocal)
    .where(
      and(
        eq(externalCostObjectLocal.projectId, projectId),
        eq(externalCostObjectLocal.status, "aktiv"),
        eq(externalCostObjectLocal.timerregistreringApen, true),
      ),
    )
    .all();
}

export function finnUnderprosjektLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(externalCostObjectLocal)
    .where(eq(externalCostObjectLocal.id, id))
    .all();
  return rader[0] ?? null;
}
