import { eq, and, or, isNull, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { oppgaveLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Oppgave-katalog-cache (Offline-liste fase 1 for oppgaver/HMS, 2026-10-03)
 *
 *  Speiler oppgavelista lokalt for offline lesing. Kopi av
 *  sjekklisteKatalog.ts-mønsteret: full overskriving PER PROSJEKT, refresh ved
 *  login + nett-gjenkomst (TimerSyncProvider) + eksplisitt via «Forbered
 *  offline» (mer.tsx) + når list-skjermen er online.
 *
 *  Henter HELE prosjektet (uten byggeplassId) slik at lokal lesing selv kan
 *  gjøre byggeplass-scopingen serveren gjør med byggeplassFilterViaTegning.
 *  Task har INGEN egen byggeplassId — tilhørighet finnes kun via tegningen
 *  (drawing.byggeplassId). Serverens TRE-ledds tegningsfilter (valgt byggeplass'
 *  tegning · prosjekt-tegning · ingen tegning) kollapser til den samme to-ledds
 *  «valgt ELLER byggeplass-løs»-regelen som Checklist bruker, når vi utleder
 *  byggeplassId = drawing.byggeplass.id (ingen/prosjekt-tegning → null → hele
 *  prosjektet). Serverens tilgangsfilter + HMS-eksklusjon (domain ≠ hms) er
 *  allerede anvendt → radene er en tro kopi av det brukeren ville sett online.
 *
 *  Bærer KUN det lista viser/filtrerer på (målt mot app/oppgave/index.tsx) —
 *  ALDRI `data`/vedlegg (ingen URL-er). Synkes aldri opp.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/** OppgaveRad-kompatibel form (index.tsx caster til OppgaveRad). */
export interface OppgaveLokalRad {
  id: string;
  title: string;
  status: string;
  priority: string;
  number: number | null;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  template: { name: string; prefix: string | null; subdomain: string | null } | null;
  utforerFaggruppe: { name: string } | null;
}

/** Normaliser Date | string | null → ISO-streng (Prisma-datoer over tRPC). */
function tilIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return typeof v === "string" ? new Date(v).toISOString() : v.toISOString();
}

/**
 * Last ned hele prosjektets oppgaver fra server og overskriv lokal cache for
 * DETTE prosjektet. Idempotent. Rører aldri andre prosjekters rader.
 */
export async function refreshOppgaveKatalog(
  klient: TrpcKlient,
  projectId: string,
  userId: string,
): Promise<{ oppgaver: number }> {
  const db = hentDatabase();
  if (!db) return { oppgaver: 0 };

  // Cache-bevaring (samme mønster som sjekklisteKatalog): pullen fanges IKKE.
  // Feiler den (utløpt token / nett-glitch) kaster den FØR den destruktive
  // scope-delete under → kalleren beholder eksisterende cache. Et vellykket
  // tomt svar (prosjekt uten oppgaver) er gyldig → slett + refyll tomt.
  // Uten byggeplassId: hele prosjektet; uten domain: HMS ekskludert (egen liste).
  const rader = (await klient.oppgave.hentForProsjekt.query({
    projectId,
  })) as Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    number: number | null;
    description?: string | null;
    dueDate: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    template: { name: string; prefix: string | null; subdomain: string | null } | null;
    utforerFaggruppe: { name: string } | null;
    drawing: { byggeplass: { id: string } | null } | null;
  }>;

  const naa = Date.now();

  // Full overskriving for DETTE prosjektet — ALLE brukeres rader slettes, så en
  // ny brukers sync aktivt fjerner forrige brukers cachede rader (ikke bare skjuler
  // dem). Rør aldri andre prosjekter.
  db.delete(oppgaveLocal).where(eq(oppgaveLocal.projectId, projectId)).run();
  for (const r of rader) {
    db.insert(oppgaveLocal)
      .values({
        id: r.id,
        projectId,
        userId,
        title: r.title,
        status: r.status,
        priority: r.priority,
        number: r.number ?? null,
        createdAt: tilIso(r.createdAt) ?? new Date(naa).toISOString(),
        updatedAt: tilIso(r.updatedAt) ?? new Date(naa).toISOString(),
        dueDate: tilIso(r.dueDate),
        // UTLEDET effektiv byggeplass (se filhode): drawing.byggeplass.id, ellers null.
        byggeplassId: r.drawing?.byggeplass?.id ?? null,
        templateName: r.template?.name ?? null,
        templatePrefix: r.template?.prefix ?? null,
        templateSubdomain: r.template?.subdomain ?? null,
        utforerFaggruppeNavn: r.utforerFaggruppe?.name ?? null,
        sistOppdatert: naa,
      })
      .run();
  }

  return { oppgaver: rader.length };
}

/**
 * Delt scope-predikat: eier-bruker + prosjekt + (valgt byggeplass ELLER
 * byggeplass-løs). userId-leddet er synlighetsvakten: en annen bruker på samme
 * telefon leser ALDRI denne cachen (jf. filhode / sjekkliste_local-hullet).
 */
function scope(projectId: string, userId: string, byggeplassId?: string | null) {
  const base = and(
    eq(oppgaveLocal.projectId, projectId),
    eq(oppgaveLocal.userId, userId),
  );
  return byggeplassId
    ? and(
        base,
        or(eq(oppgaveLocal.byggeplassId, byggeplassId), isNull(oppgaveLocal.byggeplassId)),
      )
    : base;
}

/**
 * Synkron lese-funksjon for lista: hent brukerens oppgaver for prosjektet fra
 * lokal cache, byggeplass-scopet likt serveren. Sortert nyeste først
 * (server-paritet: orderBy updatedAt desc).
 */
export function hentOppgaverLokalt(
  projectId: string,
  userId: string,
  byggeplassId?: string | null,
): OppgaveLokalRad[] {
  const db = hentDatabase();
  if (!db) return [];

  const rader = db
    .select()
    .from(oppgaveLocal)
    .where(scope(projectId, userId, byggeplassId))
    .orderBy(desc(oppgaveLocal.updatedAt))
    .all();

  return rader.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    number: r.number,
    description: null,
    dueDate: r.dueDate,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    template:
      r.templateName != null
        ? { name: r.templateName, prefix: r.templatePrefix, subdomain: r.templateSubdomain }
        : null,
    utforerFaggruppe:
      r.utforerFaggruppeNavn != null ? { name: r.utforerFaggruppeNavn } : null,
  }));
}

/** Antall lokale rader i gjeldende scope — for kildevalget (velgOfflineListeKilde). */
export function tellOppgaverLokalt(
  projectId: string,
  userId: string,
  byggeplassId?: string | null,
): number {
  const db = hentDatabase();
  if (!db) return 0;
  return db.select().from(oppgaveLocal).where(scope(projectId, userId, byggeplassId)).all().length;
}

/**
 * Nyeste sistOppdatert-stempel (Unix ms) for brukerens prosjekt-cache — «sist
 * hentet»-tid lista viser. null hvis ikke cachet ennå.
 */
export function hentSistOppdatertOppgaveLokalt(projectId: string, userId: string): number | null {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select({ sistOppdatert: oppgaveLocal.sistOppdatert })
    .from(oppgaveLocal)
    .where(and(eq(oppgaveLocal.projectId, projectId), eq(oppgaveLocal.userId, userId)))
    .orderBy(desc(oppgaveLocal.sistOppdatert))
    .limit(1)
    .all();
  return rader[0]?.sistOppdatert ?? null;
}
