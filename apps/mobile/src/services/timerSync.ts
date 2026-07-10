import { eq, and, gt, inArray } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetTilleggVedleggLocal,
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
  push: { ok: number; conflict: number; avvist: number; feilet: number };
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
 * Antall avviste dagssedler (SYNC-1) — permanent avvist av server, terminal.
 * Eksponeres via TimerSyncProvider for rødt statusbar-varsel.
 */
export function tellAvvist(userId: string): number {
  const db = hentDatabase();
  if (!db) return 0;
  const rader = db
    .select({ id: dagsseddelLocal.id })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.syncStatus, "avvist"),
      ),
    )
    .all();
  return rader.length;
}

/**
 * Klassifiser en kastet syncBatch-feil for gift-isolering (fiks A).
 * `400` (BAD_REQUEST/Zod) = ugyldig data klienten ikke kan rette via retry →
 * **permanent** (isoler + quarantine kun den giftige sedelen). Alt annet
 * (`401`/`403`/`5xx`/nettverk/ingen status) → **transient** (behold ALLE pending,
 * retry hele neste tick — aldri tap av gyldige timer). tRPC-klientfeil bærer
 * HTTP-status i `e.data.httpStatus`. Auth (401) er transient: token-rotasjonen
 * er passiv (`lib/trpc`), så en hard 401 stopper push til re-login, men dataene
 * blir trygt stående pending — ikke quarantine.
 */
function erPermanentFeil(e: unknown): boolean {
  const status = (e as { data?: { httpStatus?: number } } | null)?.data
    ?.httpStatus;
  return status === 400;
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
    return { push: { ok: 0, conflict: 0, avvist: 0, feilet: 0 }, pull: { mottatt: 0 } };
  }

  const resultat: SyncResultat = {
    push: { ok: 0, conflict: 0, avvist: 0, feilet: 0 },
    pull: { mottatt: 0 },
  };

  // Forson lokal sedel-identitet mot server-identiteten (2026-07-11).
  // Synk-identitet er clientUuid = lokal `id`. Når en lokal sedel har en ANNEN
  // id enn den serveren bruker for samme (userId, dato) — offline-opprettet med
  // egen clientUuid, eller kollisjon — flyttes arbeiderens rader til `tilId`
  // (aldri mist data), og sedelhodet re-nøkles til `tilId`. Finnes `tilId`
  // allerede lokalt (server-sedelen er pullet fra før), merges radene inn og
  // dublett-hodet slettes. Brukes av M1 (conflict) og M2 (pull-guard).
  const forsonSedelIdentitet = (fraId: string, tilId: string): void => {
    if (fraId === tilId) return;
    // Flytt arbeiderens rader til mål-identiteten. Rad-id er globalt unike
    // (uuid) → ingen PK-kollisjon med målets egne rader.
    db.update(sheetTimerLocal)
      .set({ dagsseddelId: tilId })
      .where(eq(sheetTimerLocal.dagsseddelId, fraId))
      .run();
    db.update(sheetTilleggLocal)
      .set({ dagsseddelId: tilId })
      .where(eq(sheetTilleggLocal.dagsseddelId, fraId))
      .run();
    db.update(sheetMachineLocal)
      .set({ dagsseddelId: tilId })
      .where(eq(sheetMachineLocal.dagsseddelId, fraId))
      .run();
    const maalFinnes = db
      .select({ id: dagsseddelLocal.id })
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, tilId))
      .all()[0];
    if (maalFinnes) {
      // Mål-sedelen finnes: radene er flyttet over — fjern dublett-hodet.
      db.delete(dagsseddelLocal).where(eq(dagsseddelLocal.id, fraId)).run();
    } else {
      // Re-nøkle sedelhodet til mål-identiteten (behold alle felt).
      db.update(dagsseddelLocal)
        .set({ id: tilId })
        .where(eq(dagsseddelLocal.id, fraId))
        .run();
    }
  };

  // Anvend syncBatch-resultater på lokal DB + oppdater tellere. Delt mellom
  // normal batch-send og per-item-fallback (gift-isolering ved permanent feil).
  const anvendSvar = (
    svar: Awaited<ReturnType<typeof klient.timer.dagsseddel.syncBatch.mutate>>,
    naa: number,
  ) => {
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
        // M1 (2026-07-11): dato-kollisjon (S2) — server har allerede en sedel
        // for datoen under en ANNEN clientUuid. Merge i stedet for server-wins:
        // re-nøkle lokal sedel til server-identiteten, behold arbeiderens rader,
        // sett `pending` → additiv re-push mot server-sedelen (trygt pga. S3
        // bevarer web-rader). Uten datatap. Skilles fra vanlig server-wins-
        // conflict (låst/nyere server-sedel, samme identitet).
        const serverClientUuid = r.serverData.clientUuid;
        if (serverClientUuid && serverClientUuid !== r.clientUuid) {
          forsonSedelIdentitet(r.clientUuid, serverClientUuid);
          db.update(dagsseddelLocal)
            .set({
              // pending → radene sendes inn på server-sedelen neste tick.
              syncStatus: "pending",
              status: r.serverData.status,
              lederKommentar: r.serverData.lederKommentar,
              attestertVed: r.serverData.attestertVed,
              feilmelding:
                r.feilmelding ??
                "Slått sammen med eksisterende dagsseddel for datoen.",
              sistSynkronisert: naa,
            })
            .where(eq(dagsseddelLocal.id, serverClientUuid))
            .run();
          resultat.push.conflict++;
        } else {
          // Server-wins: låst (accepted) eller nyere server-versjon under samme
          // identitet. Overskriv metadata, marker conflict for bruker-avklaring.
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
        }
      } else if (r.resultat === "avvist") {
        // SYNC-1: permanent avvisning — terminal. Raden forlater pending
        // (stopper retry) og settes til "avvist" så [id].tsx + statusbar viser
        // rødt banner med feilmeldingen. Arbeideren må rette (redigering setter
        // syncStatus tilbake til "pending") eller slette sedelen.
        db.update(dagsseddelLocal)
          .set({
            syncStatus: "avvist",
            feilmelding: r.feilmelding ?? "Avvist av server",
            sistSynkronisert: naa,
          })
          .where(eq(dagsseddelLocal.id, r.clientUuid))
          .run();
        resultat.push.avvist++;
      } else {
        // "feilet" — transient, behold pending, lagre feilmelding, retry neste tick
        db.update(dagsseddelLocal)
          .set({ feilmelding: r.feilmelding ?? "Ukjent feil" })
          .where(eq(dagsseddelLocal.id, r.clientUuid))
          .run();
        resultat.push.feilet++;
      }
    }
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
          // Slice 4b-2: kilde for slutt-tiden (bruker/midnatt/system). Lokal
          // kolonne er text (string); tRPC-input er enum-union → cast.
          sluttTidKilde: (sedel.sluttTidKilde ?? "bruker") as
            | "bruker"
            | "midnatt"
            | "system",
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
            // T.12: fritekst per rad («hva jeg gjorde»).
            beskrivelse: t.beskrivelse ?? null,
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
        anvendSvar(svar, Date.now());
      } catch (e) {
        if (!erPermanentFeil(e)) {
          // Transient (nettverk/5xx/401): behold ALLE pending — ingen quarantine,
          // ingen tap av timer. Stopp denne ticken; retry hele batchen neste tick.
          const melding = e instanceof Error ? e.message : "Nettverksfeil";
          if (batch[0]) {
            db.update(dagsseddelLocal)
              .set({ feilmelding: melding })
              .where(eq(dagsseddelLocal.id, batch[0].id))
              .run();
          }
          resultat.feil = melding;
          resultat.push.feilet += batch.length;
          // Transient → stopp denne ticken (retry hele neste gang).
          return resultat;
        }

        // Permanent (400/Zod): batchen inneholder ≥1 «gift»-sedel som ble avvist,
        // og HELE batchen ble forkastet av Zod FØR noe ble skrevet på server.
        // Send hver sedel ALENE for å isolere giften: gode sedler synker, kun
        // giften quarantines (gjenbruker conflict-tilstand + -banner). Ingen
        // return-abort — vi fortsetter til neste batch etterpå.
        for (const item of sedlerMedRader) {
          try {
            const enkeltSvar = await klient.timer.dagsseddel.syncBatch.mutate({
              sedler: [item],
            });
            anvendSvar(enkeltSvar, Date.now());
          } catch (e2) {
            if (!erPermanentFeil(e2)) {
              // Transient midt i isolering — behold pending, prøv neste sedel.
              const melding = e2 instanceof Error ? e2.message : "Nettverksfeil";
              db.update(dagsseddelLocal)
                .set({ feilmelding: melding })
                .where(eq(dagsseddelLocal.id, item.clientUuid))
                .run();
              resultat.feil = melding;
              resultat.push.feilet++;
              continue;
            }
            // Giften isolert (permanent 400/Zod) → terminal `avvist` (SYNC-1) så
            // den slutter å blokkere køen og synliggjøres for arbeider med rødt
            // banner + feilmelding.
            const melding = e2 instanceof Error ? e2.message : "Ugyldig data";
            db.update(dagsseddelLocal)
              .set({
                syncStatus: "avvist",
                feilmelding: `Kan ikke sendes (ugyldig data): ${melding}`,
              })
              .where(eq(dagsseddelLocal.id, item.clientUuid))
              .run();
            resultat.push.avvist++;
          }
        }
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
      // Synk-identitet (2026-07-11): clientUuid er den ene identiteten. Match
      // primært på clientUuid (invariant), fallback server-id for lokal data
      // pullet før invarianten (der lokal id = server-id).
      let lokal =
        db
          .select()
          .from(dagsseddelLocal)
          .where(eq(dagsseddelLocal.id, serverSedel.clientUuid))
          .all()[0] ??
        db
          .select()
          .from(dagsseddelLocal)
          .where(eq(dagsseddelLocal.id, serverSedel.id))
          .all()[0];

      // M2 (pull-guard, 2026-07-11): ingen id-match, men finnes en lokal sedel
      // for samme (userId, dato) under en annen id → forson mot server-
      // identiteten i stedet for å lage duplikat. Pending/avvist offline-arbeid
      // røres IKKE her (push + M1 forsoner det ved neste kollisjon-conflict);
      // kun synced/conflict re-nøkles trygt.
      if (!lokal) {
        const kandidat = db
          .select()
          .from(dagsseddelLocal)
          .where(
            and(
              eq(dagsseddelLocal.userId, serverSedel.userId),
              eq(dagsseddelLocal.dato, serverSedel.dato),
            ),
          )
          .all()
          .find(
            (s) => s.id !== serverSedel.clientUuid && s.id !== serverSedel.id,
          );
        if (kandidat) {
          if (
            kandidat.syncStatus === "pending" ||
            kandidat.syncStatus === "avvist"
          ) {
            continue;
          }
          forsonSedelIdentitet(kandidat.id, serverSedel.clientUuid);
          lokal = db
            .select()
            .from(dagsseddelLocal)
            .where(eq(dagsseddelLocal.id, serverSedel.clientUuid))
            .all()[0];
        }
      }

      // Lokal identitet framover = clientUuid (invariant). Lokal data som
      // matchet på server-id-fallback beholder eksisterende id (ikke bryt
      // allerede synkede sedler der id != clientUuid).
      const maalId = lokal ? lokal.id : serverSedel.clientUuid;

      // Hvis lokal har "pending"-endringer: ikke overskriv — pending vinner
      // og syncBatch håndterer push neste gang. (Hvis pending ble pushet,
      // er sync-status nå "synced" eller "conflict" — i begge tilfeller OK
      // å oppdatere fra server.)
      // SYNC-1: "avvist" er en lokal terminal-tilstand arbeideren må rette eller
      // slette — pull skal ikke stille resette den til "synced".
      if (lokal && (lokal.syncStatus === "pending" || lokal.syncStatus === "avvist")) {
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
        // Ny seddel fra server (typisk en seddel registrert på en annen enhet).
        // Lokal id = clientUuid (invariant) så push/pull nøkler likt.
        db.insert(dagsseddelLocal)
          .values({
            id: maalId,
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
            sluttTidKilde: serverSedel.sluttTidKilde ?? "bruker",
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
            sluttTidKilde: serverSedel.sluttTidKilde ?? "bruker",
            status: serverSedel.status as "draft" | "sent" | "returned" | "accepted",
            beskrivelse: serverSedel.beskrivelse,
            lederKommentar: serverSedel.lederKommentar,
            attestertVed: serverSedel.attestertVed,
            syncStatus: "synced",
            feilmelding: null,
            sistSynkronisert: serverTidMs,
          })
          .where(eq(dagsseddelLocal.id, maalId))
          .run();
      }

      // Erstatt rader (samme atom-policy som server). Trygt her: pending/avvist-
      // sedler (upushet offline-arbeid) er allerede hoppet over via guarden over,
      // så vi sletter kun rader på synced/conflict-sedler som stemmer med server.
      db.delete(sheetTimerLocal)
        .where(eq(sheetTimerLocal.dagsseddelId, maalId))
        .run();
      db.delete(sheetTilleggLocal)
        .where(eq(sheetTilleggLocal.dagsseddelId, maalId))
        .run();
      db.delete(sheetMachineLocal)
        .where(eq(sheetMachineLocal.dagsseddelId, maalId))
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
            dagsseddelId: maalId,
            projectId: t.projectId ?? sedelProjectId,
            lonnsartId: t.lonnsartId,
            aktivitetId: t.aktivitetId,
            externalCostObjectId: t.externalCostObjectId,
            timer: t.timer,
            fraTid: t.fraTid ?? null,
            tilTid: t.tilTid ?? null,
            // T.12: fritekst per rad («hva jeg gjorde»).
            beskrivelse: t.beskrivelse ?? null,
            sistEndretLokalt: serverTidMs,
          })
          .run();
      }
      for (const tl of serverSedel.tillegg) {
        db.insert(sheetTilleggLocal)
          .values({
            id: tl.id,
            dagsseddelId: maalId,
            projectId: tl.projectId ?? sedelProjectId,
            tilleggId: tl.tilleggId,
            antall: tl.antall,
            kommentar: tl.kommentar,
            sistEndretLokalt: serverTidMs,
          })
          .run();
        // Funn #2: upsert kvittering-vedlegg per rad. Additivt — lokale vedlegg
        // som ennå ikke er lastet opp (ingen server-rad) RØRES IKKE (egen tabell,
        // ikke omfattet av sheetTilleggLocal-deleteMany over). Id-konsistens
        // (klient-id == server-id) hindrer duplikater.
        for (const v of (tl as { vedlegg?: Array<{
          id: string; fileUrl: string; fileName: string; mimeType: string; fileSize: number;
        }> }).vedlegg ?? []) {
          const finnes = db
            .select()
            .from(sheetTilleggVedleggLocal)
            .where(eq(sheetTilleggVedleggLocal.id, v.id))
            .all()[0];
          if (finnes) {
            db.update(sheetTilleggVedleggLocal)
              .set({ serverUrl: v.fileUrl, sistEndretLokalt: serverTidMs })
              .where(eq(sheetTilleggVedleggLocal.id, v.id))
              .run();
          } else {
            db.insert(sheetTilleggVedleggLocal)
              .values({
                id: v.id,
                sheetTilleggId: tl.id,
                lokalSti: null,
                serverUrl: v.fileUrl,
                filnavn: v.fileName,
                mimeType: v.mimeType,
                filstorrelse: v.fileSize,
                sistEndretLokalt: serverTidMs,
              })
              .run();
          }
        }
      }
      for (const m of serverSedel.maskiner ?? []) {
        db.insert(sheetMachineLocal)
          .values({
            id: m.id,
            dagsseddelId: maalId,
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
