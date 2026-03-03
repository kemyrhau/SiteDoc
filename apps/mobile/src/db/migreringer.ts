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

  const db = openDatabaseSync("siteflow.db");

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

  // Resett krasj-tilstander: opplasting som ble avbrutt → prøv på nytt
  db.runSync(
    `UPDATE opplastings_ko SET status = 'venter' WHERE status = 'laster_opp'`,
  );
}
