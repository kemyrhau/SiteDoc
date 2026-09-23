import { eq, and, or, isNull, desc } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { sjekklisteLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Sjekkliste-katalog-cache (Offline-sjekklister fase 1, 2026-09-11)
 *
 *  Speiler sjekklistelista lokalt for offline lesing. Kopi av
 *  prosjektKatalog.ts-mønsteret: full overskriving PER PROSJEKT, refresh ved
 *  login + nett-gjenkomst (TimerSyncProvider) + eksplisitt via «Forbered
 *  offline» (mer.tsx) + når list-skjermen er online.
 *
 *  Henter HELE prosjektet (uten byggeplassId) slik at lokal lesing selv kan
 *  gjøre byggeplass-scopingen serveren gjør med byggeplassFilterDirekte
 *  (valgt byggeplass ELLER byggeplass-løs). Serverens tilgangsfilter +
 *  HMS-eksklusjon er allerede anvendt ved henting → radene er en tro kopi av
 *  det denne brukeren ville sett online.
 *
 *  Bærer KUN det lista viser/filtrerer på (målt mot app/sjekkliste/index.tsx +
 *  dokumentliste/dokumentlisteFilter.ts). Utfylling bor i sjekkliste_feltdata;
 *  denne tabellen synkes aldri opp.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/** DokumentRad-kompatibel form (index.tsx caster til DokumentRad). */
export interface SjekklisteLokalRad {
  id: string;
  title: string;
  status: string;
  number: number | null;
  createdAt: string;
  updatedAt: string;
  subject: string | null;
  dueDate: string | null;
  template: { name: string; prefix: string | null } | null;
  byggeplass: { name: string } | null;
  drawing: { name: string | null } | null;
  dokumentflyt: { name: string } | null;
  recipientUser: { name: string | null } | null;
  recipientGroup: { name: string | null } | null;
  bestiller: { name: string | null } | null;
  utforerFaggruppe: { name: string } | null;
}

/** Normaliser Date | string | null → ISO-streng (Prisma-datoer over tRPC). */
function tilIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return typeof v === "string" ? new Date(v).toISOString() : v.toISOString();
}

/**
 * Last ned hele prosjektets sjekklister fra server og overskriv lokal cache
 * for DETTE prosjektet. Idempotent — trygt å kjøre flere ganger. Rører aldri
 * andre prosjekters rader.
 */
export async function refreshSjekklisteKatalog(
  klient: TrpcKlient,
  projectId: string,
): Promise<{ sjekklister: number }> {
  const db = hentDatabase();
  if (!db) return { sjekklister: 0 };

  // Cache-bevaring (samme mønster som prosjektKatalog): pullen fanges IKKE.
  // Feiler den (utløpt token / nett-glitch) kaster den FØR den destruktive
  // scope-delete under → kalleren (triggerKatalogRefresh / startOffline) fanger
  // og beholder eksisterende cache i stedet for å tømme den. Et vellykket tomt
  // svar (prosjekt uten sjekklister) er gyldig → slett + refyll tomt.
  // Uten byggeplassId: hele prosjektet, så lokal lesing selv scoper.
  const rader = await klient.sjekkliste.hentForProsjekt.query({ projectId });

  const naa = Date.now();

  // Full overskriving for DETTE prosjektet — rør ikke andre prosjekter.
  db.delete(sjekklisteLocal).where(eq(sjekklisteLocal.projectId, projectId)).run();
  for (const r of rader) {
    db.insert(sjekklisteLocal)
      .values({
        id: r.id,
        projectId,
        title: r.title,
        status: r.status,
        number: r.number ?? null,
        createdAt: tilIso(r.createdAt) ?? new Date(naa).toISOString(),
        updatedAt: tilIso(r.updatedAt) ?? new Date(naa).toISOString(),
        subject: r.subject ?? null,
        dueDate: tilIso(r.dueDate),
        byggeplassId: r.byggeplass?.id ?? null,
        byggeplassNavn: r.byggeplass?.name ?? null,
        templateName: r.template?.name ?? null,
        templatePrefix: r.template?.prefix ?? null,
        utforerFaggruppeNavn: r.utforerFaggruppe?.name ?? null,
        drawingNavn: r.drawing?.name ?? null,
        dokumentflytNavn: r.dokumentflyt?.name ?? null,
        recipientUserNavn: r.recipientUser?.name ?? null,
        recipientGroupNavn: r.recipientGroup?.name ?? null,
        bestillerNavn: r.bestiller?.name ?? null,
        sistOppdatert: naa,
      })
      .run();
  }

  return { sjekklister: rader.length };
}

/**
 * Synkron lese-funksjon for lista: hent prosjektets sjekklister fra lokal
 * cache, byggeplass-scopet likt serveren (byggeplassFilterDirekte: valgt
 * byggeplass ELLER byggeplass-løs). Utelates byggeplassId → hele prosjektet
 * (speiler søke-modus, der serveren også henter hele prosjektet).
 * Sortert nyeste først (server-paritet: orderBy updatedAt desc).
 */
export function hentSjekklisterLokalt(
  projectId: string,
  byggeplassId?: string | null,
): SjekklisteLokalRad[] {
  const db = hentDatabase();
  if (!db) return [];

  const scope = byggeplassId
    ? and(
        eq(sjekklisteLocal.projectId, projectId),
        or(
          eq(sjekklisteLocal.byggeplassId, byggeplassId),
          isNull(sjekklisteLocal.byggeplassId),
        ),
      )
    : eq(sjekklisteLocal.projectId, projectId);

  const rader = db
    .select()
    .from(sjekklisteLocal)
    .where(scope)
    .orderBy(desc(sjekklisteLocal.updatedAt))
    .all();

  return rader.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    number: r.number,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    subject: r.subject,
    dueDate: r.dueDate,
    template:
      r.templateName != null
        ? { name: r.templateName, prefix: r.templatePrefix }
        : null,
    byggeplass: r.byggeplassId != null ? { name: r.byggeplassNavn ?? "" } : null,
    drawing: r.drawingNavn != null ? { name: r.drawingNavn } : null,
    dokumentflyt: r.dokumentflytNavn != null ? { name: r.dokumentflytNavn } : null,
    recipientUser:
      r.recipientUserNavn != null ? { name: r.recipientUserNavn } : null,
    recipientGroup:
      r.recipientGroupNavn != null ? { name: r.recipientGroupNavn } : null,
    bestiller: r.bestillerNavn != null ? { name: r.bestillerNavn } : null,
    utforerFaggruppe:
      r.utforerFaggruppeNavn != null ? { name: r.utforerFaggruppeNavn } : null,
  }));
}

/**
 * Antall lokale rader for prosjektet i gjeldende scope — for kildevalget
 * (velgOfflineListeKilde) uten å materialisere hele lista.
 */
export function tellSjekklisterLokalt(
  projectId: string,
  byggeplassId?: string | null,
): number {
  const db = hentDatabase();
  if (!db) return 0;
  const scope = byggeplassId
    ? and(
        eq(sjekklisteLocal.projectId, projectId),
        or(
          eq(sjekklisteLocal.byggeplassId, byggeplassId),
          isNull(sjekklisteLocal.byggeplassId),
        ),
      )
    : eq(sjekklisteLocal.projectId, projectId);
  return db.select().from(sjekklisteLocal).where(scope).all().length;
}

/**
 * Nyeste sistOppdatert-stempel (Unix ms) for PROSJEKTET — «sist hentet»-tid
 * lista viser (krav 7). Prosjektets eget stempel, ikke et globalt fei-tidspunkt,
 * så et prosjekt som feilet i en fei ikke viser stale data med ferskt stempel.
 * null hvis prosjektet ikke er cachet ennå.
 */
export function hentSistOppdatertLokalt(projectId: string): number | null {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select({ sistOppdatert: sjekklisteLocal.sistOppdatert })
    .from(sjekklisteLocal)
    .where(eq(sjekklisteLocal.projectId, projectId))
    .orderBy(desc(sjekklisteLocal.sistOppdatert))
    .limit(1)
    .all();
  return rader[0]?.sistOppdatert ?? null;
}
