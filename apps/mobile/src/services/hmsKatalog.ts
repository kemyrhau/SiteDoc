import { eq, and, or, isNull, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { hmsLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  HMS-katalog-cache (Offline-liste fase 1 for oppgaver/HMS, 2026-10-03)
 *
 *  Speiler HMS-lista lokalt for offline lesing. Samme mønster som
 *  sjekklisteKatalog/oppgaveKatalog: full overskriving PER PROSJEKT, refresh ved
 *  login + nett-gjenkomst (TimerSyncProvider) + «Forbered offline» (mer.tsx) +
 *  når list-skjermen er online.
 *
 *  ÉN tabell (hms_local) for alle tre kategoriene, skilt på `kategori`. HMS har
 *  ingen egen modell: avvik/RUH er Task, SJA er Checklist (skilt på
 *  ReportTemplate.domain="hms" + subdomain). `hms.hentDokumenter` leverer alle
 *  tre i ETT kall ({avvik, sja, ruh}) → én tabell gir atomisk refresh (ett
 *  delete+insert per prosjekt) og én lesevei.
 *
 *  Byggeplass (utledet effektiv): Task via tegning (drawing.byggeplassId),
 *  Checklist direkte (byggeplassId). Begge kollapser til samme «valgt ELLER
 *  byggeplass-løs»-regel. Serverens synlighetsfilter (privat/åpen) + draft-guard
 *  er anvendt ved henting → radene er en tro kopi av brukerens HMS-liste.
 *
 *  🔴 Bærer ALDRI `data`/vedlegg — hentDokumenter returnerer SIGNERTE vedleggs-
 *  URL-er (utløper 15 min). Kun visningsfelt. Synkes aldri opp.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

export type HmsKategori = "avvik" | "sja" | "ruh";

/** HmsRad-kompatibel form (index.tsx caster til HmsRad). */
export interface HmsLokalRad {
  id: string;
  title: string;
  status: string;
  number: number | null;
  updatedAt: string;
  template: { name: string; prefix: string | null } | null;
  bestillerFaggruppe: { name: string } | null;
}

export interface HmsLokalDokumenter {
  avvik: HmsLokalRad[];
  sja: HmsLokalRad[];
  ruh: HmsLokalRad[];
}

/** Rå server-rad fra hms.hentDokumenter (kun feltene speilet trenger). */
interface ServerHmsRad {
  id: string;
  title: string;
  status: string;
  number: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  template: { name: string; prefix: string | null } | null;
  bestillerFaggruppe: { name: string } | null;
  // Task (avvik/ruh): byggeplass via tegning. Checklist (sja): byggeplassId direkte.
  drawing?: { byggeplassId: string | null } | null;
  byggeplassId?: string | null;
}

function tilIso(v: Date | string | null | undefined): string {
  if (v == null) return new Date(0).toISOString();
  return typeof v === "string" ? new Date(v).toISOString() : v.toISOString();
}

/** Utledet effektiv byggeplass: Task → drawing.byggeplassId, Checklist → byggeplassId. */
function effektivByggeplass(r: ServerHmsRad): string | null {
  return r.drawing !== undefined ? r.drawing?.byggeplassId ?? null : r.byggeplassId ?? null;
}

/**
 * Last ned hele prosjektets HMS-dokumenter fra server og overskriv lokal cache
 * for DETTE prosjektet (alle tre kategorier). Idempotent. Rører aldri andre
 * prosjekters rader.
 */
export async function refreshHmsKatalog(
  klient: TrpcKlient,
  projectId: string,
): Promise<{ hms: number }> {
  const db = hentDatabase();
  if (!db) return { hms: 0 };

  // Cache-bevaring: pullen fanges IKKE. Feiler den, kaster den FØR scope-delete
  // → kalleren beholder eksisterende cache. Uten byggeplassId + uten subdomain:
  // hele prosjektet, alle tre kategorier.
  const svar = (await klient.hms.hentDokumenter.query({ projectId })) as {
    avvik: ServerHmsRad[];
    sja: ServerHmsRad[];
    ruh: ServerHmsRad[];
  };

  const naa = Date.now();
  const kategorier: Array<[HmsKategori, ServerHmsRad[]]> = [
    ["avvik", svar.avvik ?? []],
    ["sja", svar.sja ?? []],
    ["ruh", svar.ruh ?? []],
  ];

  // Full overskriving for DETTE prosjektet (alle kategorier) — rør ikke andre.
  db.delete(hmsLocal).where(eq(hmsLocal.projectId, projectId)).run();
  let antall = 0;
  for (const [kategori, rader] of kategorier) {
    for (const r of rader) {
      db.insert(hmsLocal)
        .values({
          id: r.id,
          projectId,
          kategori,
          title: r.title,
          status: r.status,
          number: r.number ?? null,
          createdAt: tilIso(r.createdAt),
          updatedAt: tilIso(r.updatedAt),
          byggeplassId: effektivByggeplass(r),
          templateName: r.template?.name ?? null,
          templatePrefix: r.template?.prefix ?? null,
          bestillerFaggruppeNavn: r.bestillerFaggruppe?.name ?? null,
          sistOppdatert: naa,
        })
        .run();
      antall++;
    }
  }

  return { hms: antall };
}

/** Delt scope-predikat: valgt byggeplass ELLER byggeplass-løs (= hele prosjektet). */
function byggeplassScope(projectId: string, byggeplassId?: string | null) {
  return byggeplassId
    ? and(
        eq(hmsLocal.projectId, projectId),
        or(eq(hmsLocal.byggeplassId, byggeplassId), isNull(hmsLocal.byggeplassId)),
      )
    : eq(hmsLocal.projectId, projectId);
}

function tilRad(r: typeof hmsLocal.$inferSelect): HmsLokalRad {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    number: r.number,
    updatedAt: r.updatedAt,
    template: r.templateName != null ? { name: r.templateName, prefix: r.templatePrefix } : null,
    bestillerFaggruppe:
      r.bestillerFaggruppeNavn != null ? { name: r.bestillerFaggruppeNavn } : null,
  };
}

/**
 * Synkron lese-funksjon: hent prosjektets HMS-dokumenter fra lokal cache,
 * byggeplass-scopet likt serveren, gruppert på kategori. Sortert nyeste først
 * innen hver kategori (server-paritet: orderBy updatedAt desc).
 */
export function hentHmsLokalt(
  projectId: string,
  byggeplassId?: string | null,
): HmsLokalDokumenter {
  const db = hentDatabase();
  if (!db) return { avvik: [], sja: [], ruh: [] };

  const rader = db
    .select()
    .from(hmsLocal)
    .where(byggeplassScope(projectId, byggeplassId))
    .orderBy(desc(hmsLocal.updatedAt))
    .all();

  const ut: HmsLokalDokumenter = { avvik: [], sja: [], ruh: [] };
  for (const r of rader) {
    const bøtte = ut[r.kategori as HmsKategori];
    if (bøtte) bøtte.push(tilRad(r));
  }
  return ut;
}

/** Totalt antall lokale HMS-rader i scope (alle kategorier) — for kildevalget. */
export function tellHmsLokalt(projectId: string, byggeplassId?: string | null): number {
  const db = hentDatabase();
  if (!db) return 0;
  return db.select().from(hmsLocal).where(byggeplassScope(projectId, byggeplassId)).all().length;
}

/** Nyeste sistOppdatert-stempel (Unix ms) for PROSJEKTET. null hvis ikke cachet. */
export function hentSistOppdatertHmsLokalt(projectId: string): number | null {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select({ sistOppdatert: hmsLocal.sistOppdatert })
    .from(hmsLocal)
    .where(eq(hmsLocal.projectId, projectId))
    .orderBy(desc(hmsLocal.sistOppdatert))
    .limit(1)
    .all();
  return rader[0]?.sistOppdatert ?? null;
}
