import { eq, and, gt, inArray } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
} from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Timer offline-sync — orkestrerer push (lokale pending → server) og pull
 *  (server-endringer → lokal) mot timer.dagsseddel.syncBatch og
 *  timer.dagsseddel.hentEndringerSiden.
 *
 *  Kalles fra TimerSyncProvider ved nett-gjenkomst, hver 30. sek aktiv-app
 *  og ved manuell pull-to-refresh.
 *
 *  Konflikthåndtering:
 *    - server-wins: hvis server returnerer "conflict", overskrives lokal
 *      med serverData og syncStatus settes til "conflict" så bruker varsles.
 *    - hvis "feilet": behold pending, increment fail-tellingen er ikke nødvendig
 *      siden vi ikke har eksponentiell backoff her — neste interval prøver igjen.
 * ============================================================================ */

type SyncResultat = {
  push: { ok: number; conflict: number; feilet: number };
  pull: { mottatt: number };
  feil?: string;
};

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

const STORAGE_KEY_SIST_SYNK = "timer_sist_synk";

/**
 * Hent sist-synkronisert ISO timestamp fra dagsseddel_local — brukes som
 * "siden"-parameter ved neste pull. Vi tar max(sistSynkronisert) som proxy
 * for "vi har sett opp til denne tidspunkten" (server returnerer serverTid
 * ved hver pull, men vi lagrer ikke en separat global state — bruk
 * dagsseddel-rader som kilde).
 */
function hentSistSynkronisert(userId: string): string | null {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select({ sistSynkronisert: dagsseddelLocal.sistSynkronisert })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.userId, userId))
    .all();
  let maks: number | null = null;
  for (const r of rader) {
    if (r.sistSynkronisert !== null && (maks === null || r.sistSynkronisert > maks)) {
      maks = r.sistSynkronisert;
    }
  }
  // Marker den lokal-globale storage hvis vi har en — for å unngå ny full-pull
  // ved fersk innlogging når lokal DB er tom
  // (For Runde 2 holder vi det enkelt: bruk maks-fra-rader)
  void STORAGE_KEY_SIST_SYNK;
  return maks ? new Date(maks).toISOString() : null;
}

/**
 * Antall pending dagssedler — eksponeres via TimerSyncProvider for badge.
 */
export function tellPending(userId: string): number {
  const db = hentDatabase();
  if (!db) return 0;
  const rader = db
    .select({ id: dagsseddelLocal.id })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "pending"),
      ),
    )
    .all();
  return rader.length;
}

/**
 * Antall conflict dagssedler — eksponeres via TimerSyncProvider for badge.
 */
export function tellConflict(userId: string): number {
  const db = hentDatabase();
  if (!db) return 0;
  const rader = db
    .select({ id: dagsseddelLocal.id })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "conflict"),
      ),
    )
    .all();
  return rader.length;
}

/**
 * Hovedinngang: push pending → pull server-endringer.
 * Returnerer telling som UI kan vise.
 */
export async function syncTimer(
  klient: TrpcKlient,
  userId: string,
): Promise<SyncResultat> {
  const db = hentDatabase();
  if (!db) {
    return { push: { ok: 0, conflict: 0, feilet: 0 }, pull: { mottatt: 0 } };
  }

  const resultat: SyncResultat = {
    push: { ok: 0, conflict: 0, feilet: 0 },
    pull: { mottatt: 0 },
  };

  /* ---------------- PUSH: lokale pending → server ----------------- */
  const pendingSedler = db
    .select()
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "pending"),
      ),
    )
    .all();

  if (pendingSedler.length > 0) {
    // Bygg batch — opp til 100 sedler per kall (matcher server-grense)
    const batches: typeof pendingSedler[] = [];
    for (let i = 0; i < pendingSedler.length; i += 100) {
      batches.push(pendingSedler.slice(i, i + 100));
    }

    for (const batch of batches) {
      const sedlerMedRader = batch.map((sedel) => {
        const timer = db
          .select()
          .from(sheetTimerLocal)
          .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
          .all();
        const tillegg = db
          .select()
          .from(sheetTilleggLocal)
          .where(eq(sheetTilleggLocal.dagsseddelId, sedel.id))
          .all();
        const maskiner = db
          .select()
          .from(sheetMachineLocal)
          .where(eq(sheetMachineLocal.dagsseddelId, sedel.id))
          .all();

        return {
          clientUuid: sedel.id,
          projectId: sedel.projectId,
          aktivitetId: sedel.aktivitetId,
          avdelingId: sedel.avdelingId ?? null,
          byggeplassId: sedel.byggeplassId ?? null,
          dato: sedel.dato,
          startAt: sedel.startAt ?? null,
          endAt: sedel.endAt ?? null,
          pauseMin: sedel.pauseMin,
          status: sedel.status,
          beskrivelse: sedel.beskrivelse ?? null,
          // T7-3b1: send projectId per rad. Faller tilbake til sedel-nivå
          // hvis rad-nivå ikke er satt (legacy-data + lokal backfill).
          // Server bruker rad-nivå hvis satt, ellers sedel-nivå (kompat-shim).
          // T4-d (2026-05-16): send fraTid/tilTid per timer/maskin-rad.
          timer: timer.map((t) => ({
            id: t.id,
            projectId: t.projectId ?? sedel.projectId,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId ?? null,
            timer: t.timer,
            fraTid: t.fraTid ?? null,
            tilTid: t.tilTid ?? null,
          })),
          tillegg: tillegg.map((tl) => ({
            id: tl.id,
            projectId: tl.projectId ?? sedel.projectId,
            tilleggId: tl.tilleggId,
            antall: tl.antall,
            kommentar: tl.kommentar ?? null,
          })),
          maskiner: maskiner.map((m) => ({
            id: m.id,
            projectId: m.projectId ?? sedel.projectId,
            // T7-4e (2026-05-16): send ECO per maskin-rad. Server (T7-4b
            // syncBatch) tar imot feltet og kjører sum(maskin) ≤ sum(timer)-
            // validering per (projectId, ECO). Drizzle-kolonnen ble lagt til
            // i T7-4a; sync-laget glemte å speile før T7-4e.
            externalCostObjectId: m.externalCostObjectId ?? null,
            vehicleId: m.vehicleId,
            timer: m.timer,
            mengde: m.mengde,
            enhet: m.enhet,
            fraTid: m.fraTid ?? null,
            tilTid: m.tilTid ?? null,
          })),
        };
      });

      try {
        const svar = await klient.timer.dagsseddel.syncBatch.mutate({
          sedler: sedlerMedRader,
        });

        const naa = Date.now();
        for (const r of svar.resultater) {
          if (r.resultat === "ok" && r.serverData) {
            db.update(dagsseddelLocal)
              .set({
                syncStatus: "synced",
                status: r.serverData.status,
                lederKommentar: r.serverData.lederKommentar,
                attestertVed: r.serverData.attestertVed,
                feilmelding: null,
                sistSynkronisert: naa,
              })
              .where(eq(dagsseddelLocal.id, r.clientUuid))
              .run();
            resultat.push.ok++;
          } else if (r.resultat === "conflict" && r.serverData) {
            db.update(dagsseddelLocal)
              .set({
                syncStatus: "conflict",
                status: r.serverData.status,
                lederKommentar: r.serverData.lederKommentar,
                attestertVed: r.serverData.attestertVed,
                feilmelding: r.feilmelding ?? "Server-versjonen vinner",
                sistSynkronisert: naa,
              })
              .where(eq(dagsseddelLocal.id, r.clientUuid))
              .run();
            resultat.push.conflict++;
          } else {
            // "feilet" — behold pending, lagre feilmelding
            db.update(dagsseddelLocal)
              .set({
                feilmelding: r.feilmelding ?? "Ukjent feil",
              })
              .where(eq(dagsseddelLocal.id, r.clientUuid))
              .run();
            resultat.push.feilet++;
          }
        }
      } catch (e) {
        // Hele batch feilet (nettverksfeil, server nede). Behold pending.
        // Marker første rad i batch med feilmeldingen som indikator,
        // men ikke spam alle rader.
        const melding = e instanceof Error ? e.message : "Nettverksfeil";
        if (batch[0]) {
          db.update(dagsseddelLocal)
            .set({ feilmelding: melding })
            .where(eq(dagsseddelLocal.id, batch[0].id))
            .run();
        }
        resultat.feil = melding;
        resultat.push.feilet += batch.length;
        // Avbryt videre batches — vi kommer tilbake ved neste sync-tick
        return resultat;
      }
    }
  }

  /* ---------------- PULL: server-endringer → lokal ---------------- */
  const sistSynk = hentSistSynkronisert(userId);
  try {
    const svar = await klient.timer.dagsseddel.hentEndringerSiden.query({
      sistSynkronisert: sistSynk ?? undefined,
      maksDagerTilbake: 90,
    });

    const naa = Date.now();
    const serverTidMs = new Date(svar.serverTid).getTime();
    void naa;

    for (const serverSedel of svar.sedler) {
      const lokal = db
        .select()
        .from(dagsseddelLocal)
        .where(eq(dagsseddelLocal.id, serverSedel.id))
        .all()[0];

      // Hvis lokal har "pending"-endringer: ikke overskriv — pending vinner
      // og syncBatch håndterer push neste gang. (Hvis pending ble pushet,
      // er sync-status nå "synced" eller "conflict" — i begge tilfeller OK
      // å oppdatere fra server.)
      if (lokal && lokal.syncStatus === "pending") {
        continue;
      }

      const timestamps = {
        sistEndretLokalt: serverTidMs,
        sistSynkronisert: serverTidMs,
      };

      // T.1 (2026-05-11): server returnerer projectId fra første rad.
      // null kan oppstå hvis sedelen er helt tom (ingen timer/maskin/tillegg)
      // — det er en forbigående tilstand som blir korrigert ved neste sync
      // når rader er lagt til. Lokal lagring tolererer "" som plassholder
      // (Drizzle-typen forventer string).
      const sedelProjectId = serverSedel.projectId ?? "";

      if (!lokal) {
        // Ny seddel fra server (typisk en seddel registrert på en annen enhet)
        db.insert(dagsseddelLocal)
          .values({
            id: serverSedel.id,
            userId: serverSedel.userId,
            organizationId: serverSedel.organizationId,
            projectId: sedelProjectId,
            aktivitetId: serverSedel.aktivitetId,
            avdelingId: serverSedel.avdelingId,
            byggeplassId: serverSedel.byggeplassId,
            dato: serverSedel.dato,
            startAt: serverSedel.startAt,
            endAt: serverSedel.endAt,
            pauseMin: serverSedel.pauseMin,
            status: serverSedel.status as "draft" | "sent" | "returned" | "accepted",
            beskrivelse: serverSedel.beskrivelse,
            lederKommentar: serverSedel.lederKommentar,
            attestertVed: serverSedel.attestertVed,
            syncStatus: "synced",
            feilmelding: null,
            ...timestamps,
          })
          .run();
      } else {
        // Eksisterende synced/conflict — overskriv med server-versjon
        db.update(dagsseddelLocal)
          .set({
            projectId: sedelProjectId,
            aktivitetId: serverSedel.aktivitetId,
            avdelingId: serverSedel.avdelingId,
            byggeplassId: serverSedel.byggeplassId,
            dato: serverSedel.dato,
            startAt: serverSedel.startAt,
            endAt: serverSedel.endAt,
            pauseMin: serverSedel.pauseMin,
            status: serverSedel.status as "draft" | "sent" | "returned" | "accepted",
            beskrivelse: serverSedel.beskrivelse,
            lederKommentar: serverSedel.lederKommentar,
            attestertVed: serverSedel.attestertVed,
            syncStatus: "synced",
            feilmelding: null,
            sistSynkronisert: serverTidMs,
          })
          .where(eq(dagsseddelLocal.id, serverSedel.id))
          .run();
      }

      // Erstatt rader (samme atom-policy som server)
      db.delete(sheetTimerLocal)
        .where(eq(sheetTimerLocal.dagsseddelId, serverSedel.id))
        .run();
      db.delete(sheetTilleggLocal)
        .where(eq(sheetTilleggLocal.dagsseddelId, serverSedel.id))
        .run();
      db.delete(sheetMachineLocal)
        .where(eq(sheetMachineLocal.dagsseddelId, serverSedel.id))
        .run();

      // T7-3b1: server returnerer projectId per rad. Vi lagrer dette på rad-
      // nivå lokalt. Faller tilbake til sedel-nivå for legacy server-respons
      // som mangler t.projectId (pre-T7-3b1 server).
      // T4-d (2026-05-16): server returnerer også fraTid/tilTid på timer-
      // og maskin-rader. Default null hvis ikke satt.
      for (const t of serverSedel.timer) {
        db.insert(sheetTimerLocal)
          .values({
            id: t.id,
            dagsseddelId: serverSedel.id,
            projectId: t.projectId ?? sedelProjectId,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId,
            timer: t.timer,
            fraTid: t.fraTid ?? null,
            tilTid: t.tilTid ?? null,
            sistEndretLokalt: serverTidMs,
          })
          .run();
      }
      for (const tl of serverSedel.tillegg) {
        db.insert(sheetTilleggLocal)
          .values({
            id: tl.id,
            dagsseddelId: serverSedel.id,
            projectId: tl.projectId ?? sedelProjectId,
            tilleggId: tl.tilleggId,
            antall: tl.antall,
            kommentar: tl.kommentar,
            sistEndretLokalt: serverTidMs,
          })
          .run();
      }
      for (const m of serverSedel.maskiner ?? []) {
        db.insert(sheetMachineLocal)
          .values({
            id: m.id,
            dagsseddelId: serverSedel.id,
            projectId: m.projectId ?? sedelProjectId,
            // T7-4e: skriv ECO på maskin lokalt. Server (T7-4b hentEndringerSiden)
            // returnerer feltet i maskiner-mappingen.
            externalCostObjectId: m.externalCostObjectId ?? null,
            vehicleId: m.vehicleId,
            timer: m.timer,
            mengde: m.mengde,
            enhet: m.enhet,
            fraTid: m.fraTid ?? null,
            tilTid: m.tilTid ?? null,
            sistEndretLokalt: serverTidMs,
          })
          .run();
      }
    }

    resultat.pull.mottatt = svar.sedler.length;
  } catch (e) {
    resultat.feil = e instanceof Error ? e.message : "Pull feilet";
  }

  return resultat;
}

/**
 * Marker lokal seddel som "synced" etter at conflict er bekreftet av bruker.
 * Brukes når UI viser conflict-banner og bruker velger "Bruk server-versjonen".
 */
export function bekreftConflict(sheetId: string): void {
  const db = hentDatabase();
  if (!db) return;
  db.update(dagsseddelLocal)
    .set({ syncStatus: "synced", feilmelding: null })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
}

/**
 * Hjelpere for UI: hent én seddel + dens rader fra lokal DB.
 */
export function hentSedelLokalt(sheetId: string) {
  const db = hentDatabase();
  if (!db) return null;
  const sedel = db
    .select()
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!sedel) return null;
  const timer = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const tillegg = db
    .select()
    .from(sheetTilleggLocal)
    .where(eq(sheetTilleggLocal.dagsseddelId, sheetId))
    .all();
  return { sedel, timer, tillegg };
}

/**
 * Bygg-hjelper: filterer ut pending-sedler eldre enn N dager fra UI.
 * Ikke i bruk for Runde 2 — bevart for fremtidig opprydning.
 */
export function pendingEldreEnn(userId: string, dagerTilbake: number): string[] {
  const db = hentDatabase();
  if (!db) return [];
  const grense = Date.now() - dagerTilbake * 24 * 60 * 60 * 1000;
  const rader = db
    .select({ id: dagsseddelLocal.id })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "pending"),
        gt(dagsseddelLocal.sistEndretLokalt, grense),
      ),
    )
    .all();
  return rader.map((r) => r.id);
}

void inArray;
