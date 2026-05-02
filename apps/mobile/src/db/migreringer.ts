import { openDatabaseSync } from "expo-sqlite";
import { erDatabaseTilgjengelig } from "./database";

/**
 * Kjør SQLite-migreringer.
 * Idempotent — trygt å kjøre flere ganger (CREATE TABLE IF NOT EXISTS).
 * Resetter krasj-tilstander (laster_opp → venter).
 * Hopper over på web (SQLite ikke tilgjengelig).
 */
export function kjorMigreringer() {
  if (!erDatabaseTilgjengelig()) return;

  const db = openDatabaseSync("sitedoc.db");

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sjekkliste_feltdata (
      id TEXT PRIMARY KEY NOT NULL,
      sjekkliste_id TEXT NOT NULL,
      felt_verdier TEXT NOT NULL,
      er_synkronisert INTEGER NOT NULL DEFAULT 0,
      sist_endret_lokalt INTEGER NOT NULL,
      sist_synkronisert INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_feltdata_sjekkliste
      ON sjekkliste_feltdata(sjekkliste_id);

    CREATE TABLE IF NOT EXISTS opplastings_ko (
      id TEXT PRIMARY KEY NOT NULL,
      sjekkliste_id TEXT NOT NULL,
      objekt_id TEXT NOT NULL,
      vedlegg_id TEXT NOT NULL,
      lokal_sti TEXT NOT NULL,
      filnavn TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filstorrelse INTEGER,
      gps_lat REAL,
      gps_lng REAL,
      gps_aktivert INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'venter',
      forsok INTEGER NOT NULL DEFAULT 0,
      server_url TEXT,
      feilmelding TEXT,
      opprettet INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ko_status
      ON opplastings_ko(status);

    CREATE TABLE IF NOT EXISTS oppgave_feltdata (
      id TEXT PRIMARY KEY NOT NULL,
      oppgave_id TEXT NOT NULL,
      felt_verdier TEXT NOT NULL,
      er_synkronisert INTEGER NOT NULL DEFAULT 0,
      sist_endret_lokalt INTEGER NOT NULL,
      sist_synkronisert INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_feltdata_oppgave
      ON oppgave_feltdata(oppgave_id);
  `);

  // Legg til oppgave_id-kolonne på opplastings_ko (idempotent)
  try {
    db.execSync(`ALTER TABLE opplastings_ko ADD COLUMN oppgave_id TEXT`);
  } catch {
    // Kolonnen finnes allerede — ignorer
  }

  // Migrering: gjør sjekkliste_id nullable (nødvendig for oppgave-opplastinger)
  try {
    const tableInfo = db.getAllSync("PRAGMA table_info(opplastings_ko)") as Array<{name: string; notnull: number}>;
    const sjekklisteKol = tableInfo.find((k) => k.name === "sjekkliste_id");
    if (sjekklisteKol && sjekklisteKol.notnull === 1) {
      console.log("[MIG] Migrerer opplastings_ko: sjekkliste_id NOT NULL → nullable");
      db.execSync(`
        CREATE TABLE opplastings_ko_v2 (
          id TEXT PRIMARY KEY NOT NULL,
          sjekkliste_id TEXT,
          objekt_id TEXT NOT NULL,
          vedlegg_id TEXT NOT NULL,
          lokal_sti TEXT NOT NULL,
          filnavn TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          filstorrelse INTEGER,
          gps_lat REAL,
          gps_lng REAL,
          gps_aktivert INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'venter',
          forsok INTEGER NOT NULL DEFAULT 0,
          server_url TEXT,
          feilmelding TEXT,
          opprettet INTEGER NOT NULL,
          oppgave_id TEXT
        );
        INSERT INTO opplastings_ko_v2 SELECT id, sjekkliste_id, objekt_id, vedlegg_id, lokal_sti, filnavn, mime_type, filstorrelse, gps_lat, gps_lng, gps_aktivert, status, forsok, server_url, feilmelding, opprettet, oppgave_id FROM opplastings_ko;
        DROP TABLE opplastings_ko;
        ALTER TABLE opplastings_ko_v2 RENAME TO opplastings_ko;
        CREATE INDEX IF NOT EXISTS idx_ko_status ON opplastings_ko(status);
      `);
      console.log("[MIG] Migrering fullført");
    }
  } catch (feil) {
    console.warn("[MIG] Migrering av opplastings_ko feilet:", feil);
  }

  // Resett krasj-tilstander: opplasting som ble avbrutt → prøv på nytt
  const resatt = db.runSync(
    `UPDATE opplastings_ko SET status = 'venter' WHERE status = 'laster_opp'`,
  );
  if (resatt.changes > 0) {
    console.log("[MIG] Resatt", resatt.changes, "krasj-tilstander");
  }

  // Slett køoppføringer som har nådd maks forsøk (permanent feilet)
  const slettet = db.runSync(
    `DELETE FROM opplastings_ko WHERE status = 'feilet' AND forsok >= 5`,
  );
  if (slettet.changes > 0) {
    console.log("[MIG] Slettet", slettet.changes, "permanent feilede oppføringer");
  }

  // Logg gjenværende køstatus
  const koStatus = db.getAllSync(`SELECT status, COUNT(*) as antall FROM opplastings_ko GROUP BY status`) as Array<{status: string; antall: number}>;
  if (koStatus.length > 0) {
    console.log("[MIG] Kø-status ved oppstart:", koStatus.map((r) => `${r.status}: ${r.antall}`).join(", "));
  } else {
    console.log("[MIG] Kø er tom ved oppstart");
  }

  // Timer-modul Runde 2 — offline-first dagsseddel + katalog-cache
  db.execSync(`
    CREATE TABLE IF NOT EXISTS dagsseddel_local (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      aktivitet_id TEXT NOT NULL,
      avdeling_id TEXT,
      byggeplass_id TEXT,
      dato TEXT NOT NULL,
      start_at TEXT,
      end_at TEXT,
      pause_min INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      beskrivelse TEXT,
      leder_kommentar TEXT,
      attestert_ved TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      feilmelding TEXT,
      sist_endret_lokalt INTEGER NOT NULL,
      sist_synkronisert INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_dagsseddel_local_user_dato
      ON dagsseddel_local(user_id, dato);
    CREATE INDEX IF NOT EXISTS idx_dagsseddel_local_sync_status
      ON dagsseddel_local(sync_status);
    CREATE INDEX IF NOT EXISTS idx_dagsseddel_local_project
      ON dagsseddel_local(project_id, dato);

    CREATE TABLE IF NOT EXISTS sheet_timer_local (
      id TEXT PRIMARY KEY NOT NULL,
      dagsseddel_id TEXT NOT NULL,
      lonnsart_id TEXT NOT NULL,
      external_cost_object_id TEXT,
      timer REAL NOT NULL,
      sist_endret_lokalt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sheet_timer_local_sheet
      ON sheet_timer_local(dagsseddel_id);

    CREATE TABLE IF NOT EXISTS sheet_tillegg_local (
      id TEXT PRIMARY KEY NOT NULL,
      dagsseddel_id TEXT NOT NULL,
      tillegg_id TEXT NOT NULL,
      antall REAL NOT NULL,
      kommentar TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sheet_tillegg_local_sheet
      ON sheet_tillegg_local(dagsseddel_id);

    CREATE TABLE IF NOT EXISTS lonnsart_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL,
      kode TEXT,
      navn TEXT NOT NULL,
      pris_mot_kunde TEXT,
      internkostnad TEXT,
      sats TEXT,
      sats_enhet TEXT,
      rekkefolge INTEGER NOT NULL DEFAULT 0,
      aktiv INTEGER NOT NULL DEFAULT 1,
      seed_nivaa INTEGER,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lonnsart_local_org_aktiv
      ON lonnsart_local(organization_id, aktiv);

    CREATE TABLE IF NOT EXISTS aktivitet_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      kode TEXT,
      navn TEXT NOT NULL,
      aktiv INTEGER NOT NULL DEFAULT 1,
      seed_nivaa INTEGER,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_aktivitet_local_org_aktiv
      ON aktivitet_local(organization_id, aktiv);

    CREATE TABLE IF NOT EXISTS tillegg_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      kode TEXT,
      navn TEXT NOT NULL,
      type TEXT NOT NULL,
      pris_mot_kunde TEXT,
      internkostnad TEXT,
      rekkefolge INTEGER NOT NULL DEFAULT 0,
      aktiv INTEGER NOT NULL DEFAULT 1,
      seed_nivaa INTEGER,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tillegg_local_org_aktiv
      ON tillegg_local(organization_id, aktiv);

    CREATE TABLE IF NOT EXISTS external_cost_object_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      proadm_id TEXT NOT NULL,
      kort_navn TEXT NOT NULL,
      kilde TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aktiv',
      timerregistrering_apen INTEGER NOT NULL DEFAULT 1,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_eco_local_project
      ON external_cost_object_local(project_id, status);
  `);

  // Timer-modul Runde 2.5 / C9 — aktivitet per rad + sheet_machines
  // Idempotent ALTER: legg til aktivitet_id på sheet_timer_local hvis mangler.
  // Backfill: kopier fra parent dagsseddel_local.aktivitet_id.
  try {
    const tableInfo = db.getAllSync(
      "PRAGMA table_info(sheet_timer_local)",
    ) as Array<{ name: string }>;
    if (!tableInfo.find((k) => k.name === "aktivitet_id")) {
      console.log("[MIG] Legger til aktivitet_id på sheet_timer_local (C9)");
      db.execSync(`ALTER TABLE sheet_timer_local ADD COLUMN aktivitet_id TEXT`);
      db.execSync(`
        UPDATE sheet_timer_local
        SET aktivitet_id = (
          SELECT aktivitet_id FROM dagsseddel_local
          WHERE dagsseddel_local.id = sheet_timer_local.dagsseddel_id
        )
        WHERE aktivitet_id IS NULL
      `);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide sheet_timer_local med aktivitet_id:", e);
  }

  // Ny tabell: sheet_machine_local (maskinbruk per dagsseddel)
  // vehicleId er svak FK til db-maskin Equipment (ingen lokal cache i C9
  // — Maskin-modul på mobil utsatt til Runde 2.6).
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sheet_machine_local (
      id TEXT PRIMARY KEY NOT NULL,
      dagsseddel_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      timer REAL NOT NULL,
      mengde REAL,
      enhet TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sheet_machine_local_sheet
      ON sheet_machine_local(dagsseddel_id);
  `);
}
