import { and, eq, asc } from "drizzle-orm";
import { kortDagsseddelId, kortVareforbrukInput, type KortVareforbrukInput } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal, sheetTimerLocal, vareforbrukLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Vareforbruk fra prosjektkortet — offline-kø (Prosjektkort L3, 2026-11-06)
 *
 *  Linjen skrives lokalt med klient-uuid og sendes via `vareforbruk.opprett`
 *  med samme id → idempotent (tapt svar + ny sending gir én rad på server).
 *
 *  Koblingen til sedelen (`dagsseddelId`) krever at sedelen finnes på server
 *  med en timerrad for prosjektet. Linjen venter derfor til sedelen er
 *  `synced`. Ved `dato_kollisjon` nøkler `forsonSedelIdentitet` om
 *  `sheet_id`, så linjen kobles til server-sedelen.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

type VareLinjeLokal = typeof vareforbrukLocal.$inferSelect;
type SedelLokal = { id: string; projectId: string; syncStatus: string };

export type Varesending = { handling: "vent" } | { handling: "send"; input: KortVareforbrukInput };

/**
 * Ren beslutning: send nå eller vent på sedelen.
 *  - sedel synket → send, koblet når kortet har en timerrad for prosjektet;
 *  - sedel pending/conflict → vent (koblingen ville blitt avvist på server);
 *  - sedel mangler lokalt eller er avvist → send uten kobling (som på web).
 */
export function planleggVaresending(
  linje: Pick<VareLinjeLokal, "id" | "sheetId" | "projectId" | "dato" | "vareId" | "antall" | "byggeplassId">,
  sedel: SedelLokal | null,
  timerRader: readonly { projectId: string | null }[],
): Varesending {
  const basis = {
    id: linje.id,
    kortProsjektId: linje.projectId,
    dato: linje.dato,
    vareId: linje.vareId,
    antall: linje.antall,
    byggeplassId: linje.byggeplassId,
  };
  if (!sedel || sedel.syncStatus === "avvist") {
    return { handling: "send", input: kortVareforbrukInput(basis) };
  }
  if (sedel.syncStatus !== "synced") return { handling: "vent" };
  const timer = timerRader.map((r) => ({ projectId: r.projectId ?? sedel.projectId }));
  return {
    handling: "send",
    input: kortVareforbrukInput({
      ...basis,
      dagsseddelId: kortDagsseddelId(sedel.id, timer, linje.projectId),
    }),
  };
}

/** Server-avvisning som ikke løses ved å prøve igjen (vs. nett-/tokenfeil). */
export function erPermanentAvvisning(e: unknown): boolean {
  const kode = (e as { data?: { code?: string } })?.data?.code;
  // PRECONDITION_FAILED: Varelager slått av for prosjektet (`krevVarelagerForProsjekt`).
  return (
    kode === "BAD_REQUEST" ||
    kode === "FORBIDDEN" ||
    kode === "NOT_FOUND" ||
    kode === "CONFLICT" ||
    kode === "PRECONDITION_FAILED"
  );
}

/** Send brukerens ventende varelinjer. Nettfeil lar linjen stå pending. */
export async function syncVareforbruk(
  klient: TrpcKlient,
  userId: string,
): Promise<{ sendt: number; avvist: number; venter: number }> {
  const db = hentDatabase();
  const res = { sendt: 0, avvist: 0, venter: 0 };
  if (!db) return res;

  const ventende = db
    .select()
    .from(vareforbrukLocal)
    .where(and(eq(vareforbrukLocal.userId, userId), eq(vareforbrukLocal.syncStatus, "pending")))
    .orderBy(asc(vareforbrukLocal.sistEndretLokalt))
    .all();

  for (const linje of ventende) {
    const sedel =
      db
        .select({
          id: dagsseddelLocal.id,
          projectId: dagsseddelLocal.projectId,
          syncStatus: dagsseddelLocal.syncStatus,
        })
        .from(dagsseddelLocal)
        .where(eq(dagsseddelLocal.id, linje.sheetId))
        .get() ?? null;
    const timerRader = sedel
      ? db
          .select({ projectId: sheetTimerLocal.projectId })
          .from(sheetTimerLocal)
          .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
          .all()
      : [];

    const plan = planleggVaresending(linje, sedel, timerRader);
    if (plan.handling === "vent") {
      res.venter++;
      continue;
    }
    try {
      await klient.vareforbruk.opprett.mutate(plan.input);
      db.update(vareforbrukLocal)
        .set({ syncStatus: "synced", feilmelding: null })
        .where(eq(vareforbrukLocal.id, linje.id))
        .run();
      res.sendt++;
    } catch (e) {
      const melding = e instanceof Error ? e.message : String(e);
      if (erPermanentAvvisning(e)) {
        db.update(vareforbrukLocal)
          .set({ syncStatus: "avvist", feilmelding: melding })
          .where(eq(vareforbrukLocal.id, linje.id))
          .run();
        res.avvist++;
      } else {
        db.update(vareforbrukLocal)
          .set({ feilmelding: melding })
          .where(eq(vareforbrukLocal.id, linje.id))
          .run();
        res.venter++;
      }
    }
  }
  return res;
}

export type LokalVarelinje = {
  id: string;
  projectId: string;
  antall: number;
  vare: { navn: string; enhet: string };
  syncStatus: "pending" | "synced" | "avvist";
  feilmelding: string | null;
};

/** Kortets lokale varelinjer (alle statuser) for sammenslåing med server-svaret. */
export function hentLokaleVarelinjer(sheetId: string, projectId?: string): LokalVarelinje[] {
  const db = hentDatabase();
  if (!db) return [];
  const vilkaar = projectId
    ? and(eq(vareforbrukLocal.sheetId, sheetId), eq(vareforbrukLocal.projectId, projectId))
    : eq(vareforbrukLocal.sheetId, sheetId);
  return db
    .select()
    .from(vareforbrukLocal)
    .where(vilkaar)
    .orderBy(asc(vareforbrukLocal.sistEndretLokalt))
    .all()
    .map((l) => ({
      id: l.id,
      projectId: l.projectId,
      antall: l.antall,
      vare: { navn: l.vareNavn, enhet: l.enhet },
      syncStatus: l.syncStatus,
      feilmelding: l.feilmelding,
    }));
}

/** Skriv en ny linje fra kortet (offline-trygt). Sendes ved neste synk. */
export function lagreLokalVarelinje(args: {
  id: string;
  userId: string;
  organizationId: string;
  sheetId: string;
  projectId: string;
  dato: string;
  vareId: string;
  vareNavn: string;
  enhet: string;
  antall: number;
  byggeplassId: string | null;
}): void {
  const db = hentDatabase();
  if (!db) throw new Error("Database ikke tilgjengelig");
  db.insert(vareforbrukLocal)
    .values({ ...args, syncStatus: "pending", feilmelding: null, sistEndretLokalt: Date.now() })
    .run();
}
