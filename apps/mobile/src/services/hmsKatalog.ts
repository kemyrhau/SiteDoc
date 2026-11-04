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

/** DokumentRad-kompatibel form (index.tsx caster til HmsRad). Mangler id-ene for
 *  «ballen hos meg» — den gjelder bare serverrader (ballenBrukerForKilde). */
export interface HmsLokalRad {
  id: string;
  title: string;
  status: string;
  number: number | null;
  createdAt: string;
  updatedAt: string;
  template: { name: string; prefix: string | null } | null;
  bestillerFaggruppe: { name: string } | null;
  // Filter-hms (2026-11-03): filterarkets felt.
  subject: string | null;
  priority: string | null;
  dueDate: string | null;
  bestiller: { name: string } | null;
  recipientUser: { name: string } | null;
  recipientGroup: { name: string } | null;
  drawing: { name: string } | null;
  dokumentflyt: { name: string } | null;
  utforerFaggruppe: { name: string } | null;
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
  // Filter-hms: begge har tegningsnavn. Feltene er valgfrie — gammelt API mangler dem.
  drawing?: { byggeplassId?: string | null; name?: string | null } | null;
  byggeplassId?: string | null;
  subject?: string | null;
  priority?: string | null; // kun Task
  dueDate?: Date | string | null;
  bestiller?: { name: string | null } | null;
  recipientUser?: { name: string | null } | null;
  recipientGroup?: { name: string | null } | null;
  dokumentflyt?: { name: string } | null;
  utforerFaggruppe?: { name: string } | null;
}

function tilIso(v: Date | string | null | undefined): string {
  if (v == null) return new Date(0).toISOString();
  return typeof v === "string" ? new Date(v).toISOString() : v.toISOString();
}

/**
 * Utledet effektiv byggeplass: Task → drawing.byggeplassId, Checklist → byggeplassId.
 * Skiller på `byggeplassId`-nøkkelen (bare Checklist har den), ikke på `drawing` — fra
 * filter-hms har også SJA `drawing` (kun navn).
 */
function effektivByggeplass(r: ServerHmsRad): string | null {
  return "byggeplassId" in r ? r.byggeplassId ?? null : r.drawing?.byggeplassId ?? null;
}

/**
 * Last ned hele prosjektets HMS-dokumenter fra server og overskriv lokal cache
 * for DETTE prosjektet (alle tre kategorier). Idempotent. Rører aldri andre
 * prosjekters rader.
 */
export async function refreshHmsKatalog(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
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

  // Full overskriving for DETTE prosjektet (alle kategorier, ALLE brukere) — en ny
  // brukers sync fjerner forrige brukers rader aktivt. Rør ikke andre prosjekter.
  db.delete(hmsLocal).where(eq(hmsLocal.projectId, projectId)).run();
  let antall = 0;
  for (const [kategori, rader] of kategorier) {
    for (const r of rader) {
      db.insert(hmsLocal)
        .values({
          id: r.id,
          projectId,
          userId,
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
          subject: r.subject ?? null,
          priority: r.priority ?? null,
          dueDate: r.dueDate ? tilIso(r.dueDate) : null,
          bestillerNavn: r.bestiller?.name ?? null,
          recipientUserNavn: r.recipientUser?.name ?? null,
          recipientGroupNavn: r.recipientGroup?.name ?? null,
          drawingNavn: r.drawing?.name ?? null,
          dokumentflytNavn: r.dokumentflyt?.name ?? null,
          utforerFaggruppeNavn: r.utforerFaggruppe?.name ?? null,
          sistOppdatert: naa,
        })
        .run();
      antall++;
    }
  }

  return { hms: antall };
}

/**
 * Delt scope-predikat: eier-bruker + prosjekt + (valgt byggeplass ELLER
 * byggeplass-løs). userId-leddet er synlighetsvakten — HMS er særlig sensitivt
 * (private utkast + synlighetsfilter), så en annen bruker leser ALDRI cachen.
 */
function scope(projectId: string, userId: string, byggeplassId?: string | null) {
  const base = and(eq(hmsLocal.projectId, projectId), eq(hmsLocal.userId, userId));
  return byggeplassId
    ? and(
        base,
        or(eq(hmsLocal.byggeplassId, byggeplassId), isNull(hmsLocal.byggeplassId)),
      )
    : base;
}

function tilRad(r: typeof hmsLocal.$inferSelect): HmsLokalRad {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    number: r.number,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    template: r.templateName != null ? { name: r.templateName, prefix: r.templatePrefix } : null,
    bestillerFaggruppe:
      r.bestillerFaggruppeNavn != null ? { name: r.bestillerFaggruppeNavn } : null,
    subject: r.subject,
    priority: r.priority,
    dueDate: r.dueDate,
    bestiller: r.bestillerNavn != null ? { name: r.bestillerNavn } : null,
    recipientUser: r.recipientUserNavn != null ? { name: r.recipientUserNavn } : null,
    recipientGroup: r.recipientGroupNavn != null ? { name: r.recipientGroupNavn } : null,
    drawing: r.drawingNavn != null ? { name: r.drawingNavn } : null,
    dokumentflyt: r.dokumentflytNavn != null ? { name: r.dokumentflytNavn } : null,
    utforerFaggruppe:
      r.utforerFaggruppeNavn != null ? { name: r.utforerFaggruppeNavn } : null,
  };
}

/**
 * Synkron lese-funksjon: hent prosjektets HMS-dokumenter fra lokal cache,
 * byggeplass-scopet likt serveren, gruppert på kategori. Sortert nyeste først
 * innen hver kategori (server-paritet: orderBy updatedAt desc).
 */
export function hentHmsLokalt(
  projectId: string,
  userId: string,
  byggeplassId?: string | null,
): HmsLokalDokumenter {
  const db = hentDatabase();
  if (!db) return { avvik: [], sja: [], ruh: [] };

  const rader = db
    .select()
    .from(hmsLocal)
    .where(scope(projectId, userId, byggeplassId))
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
export function tellHmsLokalt(
  projectId: string,
  userId: string,
  byggeplassId?: string | null,
): number {
  const db = hentDatabase();
  if (!db) return 0;
  return db.select().from(hmsLocal).where(scope(projectId, userId, byggeplassId)).all().length;
}

/** Nyeste sistOppdatert-stempel (Unix ms) for brukerens prosjekt-cache. null hvis ikke cachet. */
export function hentSistOppdatertHmsLokalt(projectId: string, userId: string): number | null {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select({ sistOppdatert: hmsLocal.sistOppdatert })
    .from(hmsLocal)
    .where(and(eq(hmsLocal.projectId, projectId), eq(hmsLocal.userId, userId)))
    .orderBy(desc(hmsLocal.sistOppdatert))
    .limit(1)
    .all();
  return rader[0]?.sistOppdatert ?? null;
}
