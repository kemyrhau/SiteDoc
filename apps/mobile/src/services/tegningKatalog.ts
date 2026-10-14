import { eq, and, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { tegningLocal, byggeplassNavLocal, dokumentSpeil } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Tegning-katalog-cache (offline-navigasjon, RETUR 2 2026-10-14)
 *
 *  Speiler tegningslista + byggeplass-lista + viewer-metadata lokalt, så
 *  navigasjonen virker fra KALD START i flymodus (ikke bare for tegninger som
 *  var åpnet online i samme økt). Kopi av sjekklisteKatalog-mønsteret:
 *   - full overskriving PER PROSJEKT (rører aldri andre prosjekter),
 *   - userId-synlighetsvakt (ny bruker ser aldri forrige brukers speil),
 *   - uncaught pull (feilet henting kaster FØR den destruktive scope-deleten,
 *     så kalleren beholder eksisterende cache i stedet for å tømme den),
 *   - `sistOppdatert` (Unix ms) for «Sist oppdatert …»-visning.
 *
 *  Refresh kjøres av «Forbered til offline» (lokasjoner/mer) + når
 *  lokasjoner/tegninger-skjermen er online. Viewer-metadataen (hentMedId +
 *  markører) bor i `dokument_speil` med `dokument_type="tegning"`.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];
const TEGNING_DOKTYPE = "tegning";

/** Siste URL-ledd = UUID-filnavn = samme revisjonsnøkkel som filcachen/manifestet. */
function revisjonsNokkelFor(fileUrl: string | null, mobilFileUrl: string | null): string | null {
  const url = mobilFileUrl ?? fileUrl;
  if (!url) return null;
  const deler = url.split("/");
  return deler[deler.length - 1] ?? null;
}

/* --- Tegningsliste --------------------------------------------------------- */

export interface TegningLokalRad {
  id: string;
  name: string;
  drawingNumber: string | null;
  discipline: string | null;
  floor: string | null;
  byggeplassId: string | null;
  fileType: string | null;
  fileUrl: string | null;
  mobilFileUrl: string | null;
  antallRevisjoner: number | null;
  sistOppdatert: number;
}

interface RaTegning {
  id: string;
  name: string;
  drawingNumber?: string | null;
  discipline?: string | null;
  floor?: string | null;
  byggeplassId?: string | null;
  fileType?: string | null;
  fileUrl?: string | null;
  mobilFileUrl?: string | null;
  _count?: { revisions?: number } | null;
}

/**
 * Last ned hele prosjektets tegninger og overskriv lokal katalog for DETTE
 * prosjektet + denne brukeren. Idempotent. Uncaught pull (se filhode).
 */
export async function refreshTegningKatalog(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
): Promise<{ tegninger: number }> {
  const db = hentDatabase();
  if (!db || !userId) return { tegninger: 0 };

  // Kaster FØR scope-deleten ved feil → kalleren beholder eksisterende cache.
  const rader = (await klient.tegning.hentForProsjekt.query({ projectId })) as RaTegning[];

  const naa = Date.now();
  // Full overskriving PER PROSJEKT (alle brukeres rader) — `id` er global PK, så to
  // brukere kan ikke ha samme tegning samtidig; en ny brukers refresh fjerner forrige
  // brukers rader aktivt, og userId-leddet på LESING er synlighetsvakten. Speiler
  // sjekkliste_local. Rører aldri andre prosjekter.
  db.delete(tegningLocal).where(eq(tegningLocal.projectId, projectId)).run();
  for (const r of rader) {
    db.insert(tegningLocal)
      .values({
        id: r.id,
        projectId,
        userId,
        byggeplassId: r.byggeplassId ?? null,
        name: r.name,
        drawingNumber: r.drawingNumber ?? null,
        discipline: r.discipline ?? null,
        floor: r.floor ?? null,
        fileType: r.fileType ?? null,
        fileUrl: r.fileUrl ?? null,
        mobilFileUrl: r.mobilFileUrl ?? null,
        revisjonsNokkel: revisjonsNokkelFor(r.fileUrl ?? null, r.mobilFileUrl ?? null),
        antallRevisjoner: r._count?.revisions ?? null,
        sistOppdatert: naa,
      })
      .run();
  }
  return { tegninger: rader.length };
}

/** Synkron lese-funksjon for tegningslista (hele prosjektet; kalleren byggeplass-scoper). */
export function hentTegningerLokalt(projectId: string, userId: string): TegningLokalRad[] {
  const db = hentDatabase();
  if (!db || !userId) return [];
  return db
    .select()
    .from(tegningLocal)
    .where(and(eq(tegningLocal.projectId, projectId), eq(tegningLocal.userId, userId)))
    .orderBy(desc(tegningLocal.sistOppdatert))
    .all()
    .map((r) => ({
      id: r.id,
      name: r.name,
      drawingNumber: r.drawingNumber,
      discipline: r.discipline,
      floor: r.floor,
      byggeplassId: r.byggeplassId,
      fileType: r.fileType,
      fileUrl: r.fileUrl,
      mobilFileUrl: r.mobilFileUrl,
      antallRevisjoner: r.antallRevisjoner,
      sistOppdatert: r.sistOppdatert,
    }));
}

/** Nyeste `sistOppdatert` for prosjektets tegningskatalog (null = ikke lagret). */
export function hentTegningSistOppdatert(projectId: string, userId: string): number | null {
  const db = hentDatabase();
  if (!db || !userId) return null;
  const rad = db
    .select({ sistOppdatert: tegningLocal.sistOppdatert })
    .from(tegningLocal)
    .where(and(eq(tegningLocal.projectId, projectId), eq(tegningLocal.userId, userId)))
    .orderBy(desc(tegningLocal.sistOppdatert))
    .limit(1)
    .all();
  return rad[0]?.sistOppdatert ?? null;
}

/* --- Byggeplass-navigasjon ------------------------------------------------- */

export interface ByggeplassNavRad {
  id: string;
  name: string;
  number: number | null;
  status: string | null;
}

interface RaByggeplass {
  id: string;
  name: string;
  number?: number | null;
  status?: string | null;
}

/**
 * Last ned prosjektets byggeplasser og overskriv lokal nav-katalog for DETTE
 * prosjektet + brukeren. Prosjekt-scopet (dekker standalone, ulikt byggeplass_local).
 */
export async function refreshByggeplassNavKatalog(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
): Promise<{ byggeplasser: number }> {
  const db = hentDatabase();
  if (!db || !userId) return { byggeplasser: 0 };

  const rader = (await klient.bygning.hentForProsjekt.query({ projectId })) as RaByggeplass[];

  const naa = Date.now();
  // Full overskriving per prosjekt (se refreshTegningKatalog) — `id` er global PK.
  db.delete(byggeplassNavLocal).where(eq(byggeplassNavLocal.projectId, projectId)).run();
  for (const b of rader) {
    db.insert(byggeplassNavLocal)
      .values({
        id: b.id,
        projectId,
        userId,
        navn: b.name,
        number: b.number ?? null,
        status: b.status ?? null,
        sistOppdatert: naa,
      })
      .run();
  }
  return { byggeplasser: rader.length };
}

/** Synkron lese-funksjon: prosjektets byggeplasser fra lokal nav-katalog. */
export function hentByggeplasserNavLokalt(projectId: string, userId: string): ByggeplassNavRad[] {
  const db = hentDatabase();
  if (!db || !userId) return [];
  return db
    .select()
    .from(byggeplassNavLocal)
    .where(and(eq(byggeplassNavLocal.projectId, projectId), eq(byggeplassNavLocal.userId, userId)))
    .all()
    .map((b) => ({ id: b.id, name: b.navn, number: b.number, status: b.status }));
}

/* --- Viewer-metadata (hentMedId + markører) i dokument_speil --------------- */

export interface TegningDetaljSpeil {
  detalj: unknown;
  oppgaver: unknown[];
  kontrollpunkter: unknown[];
  omrader: unknown[];
}

/**
 * Lagre viewer-metadataen for én tegning: hentMedId-svaret + markørene (oppgaver,
 * kontrollpunkter, områder) som JSON-blob i dokument_speil (dokument_type="tegning").
 * Henter selv de fire kildene (bieffekt-fritt), så kalleren bare gir tegningId.
 * Idempotent upsert på komposit-PK. Kaster videre ved nettfeil (kalleren håndterer).
 */
export async function lagreTegningDetaljSpeil(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
  tegningId: string,
): Promise<void> {
  const db = hentDatabase();
  if (!db || !userId || !tegningId) return;

  // Hver gren tilordnes en `unknown`-variabel hver for seg — en Promise.all-tuppel over
  // de fire tRPC-retur-typene tvinger en dyp union og trigger TS2589 (samme mønster som
  // dokumentSpeil.forhaandslastDokumenter). Markør-kildene er valgfrie (tom ved feil).
  const detalj: unknown = await klient.tegning.hentMedId.query({ id: tegningId });
  let oppgaver: unknown[] = [];
  let kontrollpunkter: unknown[] = [];
  let omrader: unknown[] = [];
  try { oppgaver = (await klient.oppgave.hentForTegning.query({ drawingId: tegningId })) as unknown[]; } catch { /* markører valgfrie */ }
  try { kontrollpunkter = (await klient.kontrollplan.hentForTegning.query({ drawingId: tegningId })) as unknown[]; } catch { /* */ }
  try { omrader = (await klient.omrade.hentForTegning.query({ tegningId })) as unknown[]; } catch { /* */ }

  const blob: TegningDetaljSpeil = { detalj, oppgaver, kontrollpunkter, omrader };

  const naa = Date.now();
  db.delete(dokumentSpeil)
    .where(
      and(
        eq(dokumentSpeil.dokumentType, TEGNING_DOKTYPE),
        eq(dokumentSpeil.id, tegningId),
        eq(dokumentSpeil.userId, userId),
      ),
    )
    .run();
  db.insert(dokumentSpeil)
    .values({
      id: tegningId,
      dokumentType: TEGNING_DOKTYPE,
      projectId,
      userId,
      json: JSON.stringify(blob),
      hentetAt: naa,
    })
    .run();
}

/**
 * Skriv viewer-metadataen fra ALLEREDE lastede data (write-through ved online-visning,
 * ingen ekstra nettkall). Idempotent upsert på komposit-PK. No-op uten db/id/userId.
 */
export function lagreTegningDetaljFraData(
  projectId: string,
  userId: string,
  tegningId: string,
  blob: TegningDetaljSpeil,
): void {
  const db = hentDatabase();
  if (!db || !userId || !tegningId || blob.detalj == null) return;
  const naa = Date.now();
  db.delete(dokumentSpeil)
    .where(
      and(
        eq(dokumentSpeil.dokumentType, TEGNING_DOKTYPE),
        eq(dokumentSpeil.id, tegningId),
        eq(dokumentSpeil.userId, userId),
      ),
    )
    .run();
  db.insert(dokumentSpeil)
    .values({
      id: tegningId,
      dokumentType: TEGNING_DOKTYPE,
      projectId,
      userId,
      json: JSON.stringify(blob),
      hentetAt: naa,
    })
    .run();
}

/** Les viewer-metadataen for én tegning fra speilet. null = ikke lagret/korrupt. */
export function hentTegningDetaljLokalt(
  tegningId: string,
  userId: string,
): { blob: TegningDetaljSpeil; hentetVed: number } | null {
  const db = hentDatabase();
  if (!db || !userId || !tegningId) return null;
  const rad = db
    .select()
    .from(dokumentSpeil)
    .where(
      and(
        eq(dokumentSpeil.dokumentType, TEGNING_DOKTYPE),
        eq(dokumentSpeil.id, tegningId),
        eq(dokumentSpeil.userId, userId),
      ),
    )
    .all()[0];
  if (!rad) return null;
  try {
    return { blob: JSON.parse(rad.json) as TegningDetaljSpeil, hentetVed: rad.hentetAt };
  } catch {
    return null;
  }
}

/* --- Opprydding ------------------------------------------------------------ */

/**
 * Tøm hele tegning-speilet (katalog + byggeplass-nav + viewer-blober) ved utlogging/
 * brukerbytte (RETUR 2-krav). userId-vakten hindrer lekkasje mellom brukere uansett,
 * men dette fjerner dataene aktivt. Kalt fra auth.loggUt.
 */
export function tomTegningSpeil(): void {
  const db = hentDatabase();
  if (!db) return;
  try {
    db.delete(tegningLocal).run();
    db.delete(byggeplassNavLocal).run();
    db.delete(dokumentSpeil).where(eq(dokumentSpeil.dokumentType, TEGNING_DOKTYPE)).run();
  } catch {
    /* opprydding er best-effort — logout skal aldri feile på dette */
  }
}
