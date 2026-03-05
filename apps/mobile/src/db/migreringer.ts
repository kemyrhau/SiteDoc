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
}
