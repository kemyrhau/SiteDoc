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

  // Variant B (2026-06-05) — firma-default lønnsart. Idempotent ALTER: legg til
  // er_standardvalg på lonnsart_local hvis mangler. Backfill ikke nødvendig —
  // refreshKatalog full-overskriver lonnsart_local fra server ved neste pull.
  try {
    const lonnsartInfo = db.getAllSync(
      "PRAGMA table_info(lonnsart_local)",
    ) as Array<{ name: string }>;
    if (!lonnsartInfo.find((k) => k.name === "er_standardvalg")) {
      console.log("[MIG] Legger til er_standardvalg på lonnsart_local (Variant B)");
      db.execSync(
        `ALTER TABLE lonnsart_local ADD COLUMN er_standardvalg INTEGER NOT NULL DEFAULT 0`,
      );
    }
    // ③a (2026-07-05) — strukturert overtid-nivå. Nullable INTEGER; backfill
    // ikke nødvendig (refreshKatalog full-overskriver fra server ved pull).
    if (!lonnsartInfo.find((k) => k.name === "overtidsnivaa")) {
      console.log("[MIG] Legger til overtidsnivaa på lonnsart_local (③a)");
      db.execSync(
        `ALTER TABLE lonnsart_local ADD COLUMN overtidsnivaa INTEGER`,
      );
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide lonnsart_local med er_standardvalg:", e);
  }

  // «Start dag / Slutt dag»-økt (2026-06-06) — lokal arbeidsøkt-logg som
  // genererer dagsseddel-forslag. KUN lokal, synkes aldri.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS arbeidsdag_local (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      dato TEXT NOT NULL,
      start_at TEXT NOT NULL,
      start_lat REAL,
      start_lng REAL,
      end_at TEXT,
      end_lat REAL,
      end_lng REAL,
      status TEXT NOT NULL DEFAULT 'paagaar',
      generert_dagsseddel_id TEXT,
      sist_endret_lokalt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arbeidsdag_local_user_status
      ON arbeidsdag_local(user_id, status);
  `);

  // Fase 1 (2026-06-08): GPS-identifisert oppmøtested på arbeidsdag (dokumentasjon,
  // aldri lønnsgrunnlag). Idempotent ALTER — eksisterende rader får NULL.
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(arbeidsdag_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "oppmotested_id")) {
      console.log("[MIG] Legger til oppmotested_id/navn på arbeidsdag_local (Fase 1)");
      db.execSync(`ALTER TABLE arbeidsdag_local ADD COLUMN oppmotested_id TEXT`);
      db.execSync(`ALTER TABLE arbeidsdag_local ADD COLUMN oppmotested_navn TEXT`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide arbeidsdag_local med oppmøtested:", e);
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

  // Runde 2.6 — equipment_local cache for sheet_machine-velger på mobil.
  // Speiler trpc.maskin.equipment.list-resultatet med minimum felter for UI.
  // Refresh ved login + nett-gjenkomst via maskinKatalog.refreshMaskinKatalog.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS equipment_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      kategori TEXT NOT NULL,
      type TEXT,
      merke TEXT,
      modell TEXT,
      intern_navn TEXT,
      intern_nummer TEXT,
      registreringsnummer TEXT,
      status TEXT NOT NULL DEFAULT 'tilgjengelig',
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_local_org
      ON equipment_local(organization_id);
  `);

  // R4 (2026-06-11) — byggeplass_local + reisetid_matrise_local for
  // reisetid-oppslag (kontor→primær-byggeplass → kjøretid). Refresh via
  // byggeplassKatalog + reisetidMatriseKatalog.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS byggeplass_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      number INTEGER,
      status TEXT,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_byggeplass_local_prosjekt
      ON byggeplass_local(project_id);

    CREATE TABLE IF NOT EXISTS reisetid_matrise_local (
      organization_id TEXT NOT NULL,
      oppmotested_id TEXT NOT NULL,
      byggeplass_id TEXT NOT NULL,
      kjoretid_min INTEGER NOT NULL,
      sist_oppdatert INTEGER NOT NULL,
      PRIMARY KEY (oppmotested_id, byggeplass_id)
    );

    CREATE INDEX IF NOT EXISTS idx_reisetid_matrise_local_org
      ON reisetid_matrise_local(organization_id);
  `);

  // L1 (2026-06-20): GPS-identifikasjon av byggeplass ved «Start dag».
  // Idempotent ALTER — byggeplass_local får navn + geofence (lat/lng/radius_m),
  // arbeidsdag_local får byggeplass_id/navn (speil av oppmøtested). Alle nullable.
  try {
    const bk = db.getAllSync(
      "PRAGMA table_info(byggeplass_local)",
    ) as Array<{ name: string }>;
    if (!bk.find((k) => k.name === "navn")) {
      console.log("[MIG] Legger til navn/lat/lng/radius_m på byggeplass_local (L1)");
      db.execSync(`ALTER TABLE byggeplass_local ADD COLUMN navn TEXT`);
      db.execSync(`ALTER TABLE byggeplass_local ADD COLUMN lat REAL`);
      db.execSync(`ALTER TABLE byggeplass_local ADD COLUMN lng REAL`);
      db.execSync(`ALTER TABLE byggeplass_local ADD COLUMN radius_m INTEGER`);
    }
    const ad = db.getAllSync(
      "PRAGMA table_info(arbeidsdag_local)",
    ) as Array<{ name: string }>;
    if (!ad.find((k) => k.name === "byggeplass_id")) {
      console.log("[MIG] Legger til byggeplass_id/navn på arbeidsdag_local (L1)");
      db.execSync(`ALTER TABLE arbeidsdag_local ADD COLUMN byggeplass_id TEXT`);
      db.execSync(`ALTER TABLE arbeidsdag_local ADD COLUMN byggeplass_navn TEXT`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide byggeplass/arbeidsdag med byggeplass-geofence (L1):", e);
  }

  // T7-3b1 (2026-05-14) — per-rad project_id på alle tre rad-tabeller.
  // Server-skjemaet flyttet projectId til rad-nivå 2026-05-11 (T.1/PR 1B);
  // mobil-sync sendte fortsatt sedel-nivå med kompat-shim på server.
  // Denne migrasjonen + tilhørende sync-endring fjerner shimmen fra klient-
  // siden. Nullable i Steg 1 (to-stegs-policy); NOT NULL kommer i T7-4+.
  for (const tabell of [
    "sheet_timer_local",
    "sheet_tillegg_local",
    "sheet_machine_local",
  ]) {
    try {
      const kolonner = db.getAllSync(
        `PRAGMA table_info(${tabell})`,
      ) as Array<{ name: string }>;
      if (!kolonner.find((k) => k.name === "project_id")) {
        console.log(`[MIG] Legger til project_id på ${tabell} (T7-3b1)`);
        db.execSync(`ALTER TABLE ${tabell} ADD COLUMN project_id TEXT`);
        db.execSync(`
          UPDATE ${tabell}
          SET project_id = (
            SELECT project_id FROM dagsseddel_local
            WHERE dagsseddel_local.id = ${tabell}.dagsseddel_id
          )
          WHERE project_id IS NULL
        `);
      }
    } catch (e) {
      console.warn(`[MIG] Kunne ikke utvide ${tabell} med project_id:`, e);
    }
  }
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_sheet_timer_local_project
      ON sheet_timer_local(project_id);
    CREATE INDEX IF NOT EXISTS idx_sheet_tillegg_local_project
      ON sheet_tillegg_local(project_id);
    CREATE INDEX IF NOT EXISTS idx_sheet_machine_local_project
      ON sheet_machine_local(project_id);
  `);

  // T7-3b1 — offline-cache av brukerens prosjekter for rad-velger.
  // Refresh ved login + nett-gjenkomst via prosjektKatalog.refreshProsjektKatalog.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS prosjekt_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      project_number TEXT,
      lat REAL,
      lng REAL,
      aktiv INTEGER NOT NULL DEFAULT 1,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prosjekt_local_org_aktiv
      ON prosjekt_local(organization_id, aktiv);
  `);

  // Fase 1 (2026-06-08) — oppmotested_local: offline-cache av firmaets
  // oppmøtesteder (kontorer) for GPS-identifikasjon ved «Start dag». KUN lokal,
  // synkes aldri opp. Refresh via oppmotestedKatalog.refreshOppmotestedKatalog
  // (login + nett-gjenkomst), speiler prosjekt_local.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS oppmotested_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      navn TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m INTEGER NOT NULL DEFAULT 150,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_oppmotested_local_org
      ON oppmotested_local(organization_id);
  `);

  // T4-d (2026-05-16) — per-rad fra/til-tid på sheet_timer_local +
  // sheet_machine_local. Nullable, ingen backfill — UI (T4-e) skriver verdier
  // når bruker setter dem. Server-skjemaet har feltene fra T.1 (2026-05-11).
  for (const tabell of ["sheet_timer_local", "sheet_machine_local"]) {
    try {
      const kolonner = db.getAllSync(
        `PRAGMA table_info(${tabell})`,
      ) as Array<{ name: string }>;
      if (!kolonner.find((k) => k.name === "fra_tid")) {
        console.log(`[MIG] Legger til fra_tid/til_tid på ${tabell} (T4-d)`);
        db.execSync(`ALTER TABLE ${tabell} ADD COLUMN fra_tid TEXT`);
        db.execSync(`ALTER TABLE ${tabell} ADD COLUMN til_tid TEXT`);
      }
    } catch (e) {
      console.warn(`[MIG] Kunne ikke utvide ${tabell} med fra_tid/til_tid:`, e);
    }
  }

  // T7-4a (2026-05-16) — external_cost_object_id på sheet_machine_local.
  // Speil av server-skjema (T7-4a migrasjon). Maskin følger samme prosjekt+ECO-
  // gruppe som arbeidstimer per T.7 (låst 2026-05-16). Nullable, ingen backfill
  // — eksisterende maskin-rader regnes som «hovedprosjekt» (NULL ECO).
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(sheet_machine_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "external_cost_object_id")) {
      console.log(
        "[MIG] Legger til external_cost_object_id på sheet_machine_local (T7-4a)",
      );
      db.execSync(
        "ALTER TABLE sheet_machine_local ADD COLUMN external_cost_object_id TEXT",
      );
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_sheet_machine_local_eco ON sheet_machine_local(external_cost_object_id)",
      );
    }
  } catch (e) {
    console.warn(
      "[MIG] Kunne ikke utvide sheet_machine_local med external_cost_object_id:",
      e,
    );
  }

  // T4-d — kalender-cache. Speiler ArbeidstidsKalender (T9a) for periode
  // currentYear ± 1. Brukes av hentEffektivArbeidstidLokal til offline-
  // beregning av start/slutt/pause for en dato. Soft-deleted rader skrives
  // også (filtreres i hentLokalt) per locked design 2026-05-16.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS arbeidstidskalender_local (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      aar INTEGER NOT NULL,
      dato TEXT NOT NULL,
      type TEXT NOT NULL,
      navn TEXT NOT NULL,
      timer_overstyr REAL,
      standard_start_tid TEXT,
      standard_slutt_tid TEXT,
      pause_min INTEGER,
      aktiv INTEGER NOT NULL DEFAULT 1,
      sist_oppdatert INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_arbeidstidskalender_local_org_aar
      ON arbeidstidskalender_local(organization_id, aar);
    CREATE INDEX IF NOT EXISTS idx_arbeidstidskalender_local_org_type_aar
      ON arbeidstidskalender_local(organization_id, type, aar);
    CREATE INDEX IF NOT EXISTS idx_arbeidstidskalender_local_org_dato
      ON arbeidstidskalender_local(organization_id, dato);
  `);

  // T4-d — OrganizationSetting-cache. Én rad per firma (organization_id PK).
  // Brukes som fallback for firma-default start/slutt/pause i
  // hentEffektivArbeidstidLokal når kalenderen ikke har overstyringer.
  // Refresh via organizationSettingKatalog.refreshOrganizationSettingKatalog.
  db.execSync(`
    CREATE TABLE IF NOT EXISTS organization_setting_local (
      organization_id TEXT PRIMARY KEY NOT NULL,
      standard_start_tid TEXT NOT NULL DEFAULT '07:00',
      standard_slutt_tid TEXT NOT NULL DEFAULT '15:00',
      standard_pause_min INTEGER NOT NULL DEFAULT 30,
      tillatt_rediger_ved_attestering INTEGER NOT NULL DEFAULT 0,
      sist_oppdatert INTEGER NOT NULL
    );
  `);

  // T.5 (2026-05-16) — tidsrunding for picker-input. null = ingen avrunding.
  // Idempotent ALTER for klienter som allerede har T4-d-tabellen uten kolonnen.
  try {
    const kolonner = db.getAllSync(
      `PRAGMA table_info(organization_setting_local)`,
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "tidsrunding_minutter")) {
      console.log("[MIG] Legger til tidsrunding_minutter på organization_setting_local (T.5)");
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN tidsrunding_minutter INTEGER`,
      );
    }
    // 2026-05-28 — firma-default for pause-start (HH:MM, nullable). DEPRECATED
    // 2026-07-08 (erstattet av standard_pause_etter_timer) — beholdes til data migrert.
    if (!kolonner.find((k) => k.name === "standard_pause_fra")) {
      console.log(
        "[MIG] Legger til standard_pause_fra på organization_setting_local",
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN standard_pause_fra TEXT`,
      );
    }
    // 2026-07-08 — pausevindu = skiftstart + standard_pause_etter_timer (t). Default 4,0.
    if (!kolonner.find((k) => k.name === "standard_pause_etter_timer")) {
      console.log(
        "[MIG] Legger til standard_pause_etter_timer på organization_setting_local",
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN standard_pause_etter_timer REAL NOT NULL DEFAULT 4.0`,
      );
    }
    // Fase 3 (§ B) — reise-regelsett-felt for offline reise-forslag i «Slutt dag».
    if (!kolonner.find((k) => k.name === "reise_terskel_min")) {
      console.log(
        "[MIG] Legger til reise-regelsett-kolonner på organization_setting_local (Fase 3)",
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN reise_terskel_min INTEGER NOT NULL DEFAULT 30`,
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN reise_under_terskel_type TEXT NOT NULL DEFAULT 'arbeidstid'`,
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN reise_over_terskel_type TEXT NOT NULL DEFAULT 'reisetid'`,
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN reisetid_teller_overtid INTEGER NOT NULL DEFAULT 0`,
      );
      db.execSync(
        `ALTER TABLE organization_setting_local ADD COLUMN reise_lonnsart_id TEXT`,
      );
    }
  } catch (e) {
    console.warn(
      "[MIG] Kunne ikke utvide organization_setting_local:",
      e,
    );
  }

  // T.12 (2026-06-20) — beskrivelse (fritekst per rad) på sheet_timer_local.
  // Nullable, ingen backfill. Idempotent ALTER. Speil av server-skjema
  // (SheetTimer.beskrivelse).
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(sheet_timer_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "beskrivelse")) {
      console.log("[MIG] Legger til beskrivelse på sheet_timer_local (T.12)");
      db.execSync(`ALTER TABLE sheet_timer_local ADD COLUMN beskrivelse TEXT`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide sheet_timer_local med beskrivelse:", e);
  }

  // Slice 3 (2026-06-20) — auto_generert på dagsseddel_local. Nullable, KUN
  // lokal (synces aldri). Markerer auto-genererte drafts fra «Slutt dag» så
  // auto-fyll-banneret kan gates. Idempotent ALTER.
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(dagsseddel_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "auto_generert")) {
      console.log("[MIG] Legger til auto_generert på dagsseddel_local (Slice 3)");
      db.execSync(`ALTER TABLE dagsseddel_local ADD COLUMN auto_generert INTEGER`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide dagsseddel_local med auto_generert:", e);
  }

  // Slice 4a (2026-06-20) — delt_ved_midnatt på dagsseddel_local. Nullable, KUN
  // lokal (synces aldri). Markerer sedler som er segmenter av et midnatt-splittet
  // skift, for «delt ved midnatt»-merking. Idempotent ALTER.
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(dagsseddel_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "delt_ved_midnatt")) {
      console.log("[MIG] Legger til delt_ved_midnatt på dagsseddel_local (Slice 4a)");
      db.execSync(`ALTER TABLE dagsseddel_local ADD COLUMN delt_ved_midnatt INTEGER`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide dagsseddel_local med delt_ved_midnatt:", e);
  }

  // Slice 4b-2 (2026-06-21) — slutt_tid_kilde på dagsseddel_local. NOT NULL
  // DEFAULT 'bruker' (speiler server). Markerer system-bestemt slutt-tid for
  // kontroll-badge i attestering. Idempotent ALTER.
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(dagsseddel_local)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "slutt_tid_kilde")) {
      console.log("[MIG] Legger til slutt_tid_kilde på dagsseddel_local (Slice 4b-2)");
      db.execSync(
        `ALTER TABLE dagsseddel_local ADD COLUMN slutt_tid_kilde TEXT NOT NULL DEFAULT 'bruker'`,
      );
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide dagsseddel_local med slutt_tid_kilde:", e);
  }

  // Funn #2 (2026-06-21) — kvittering-vedlegg på tillegg-rad. Ny lokal tabell
  // sheet_tillegg_vedlegg_local (idempotent CREATE) + opplastings_ko utvidet med
  // sheet_tillegg_id (idempotent ALTER, additivt — eksisterende køoppføringer
  // urørt). Speil av server SheetTilleggVedlegg + sheet_tillegg_id på kø-raden.
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS sheet_tillegg_vedlegg_local (
        id TEXT PRIMARY KEY NOT NULL,
        sheet_tillegg_id TEXT NOT NULL,
        lokal_sti TEXT,
        server_url TEXT,
        filnavn TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        filstorrelse INTEGER,
        sist_endret_lokalt INTEGER NOT NULL
      )
    `);
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_sheet_tillegg_vedlegg_rad
        ON sheet_tillegg_vedlegg_local(sheet_tillegg_id)
    `);
  } catch (e) {
    console.warn("[MIG] Kunne ikke opprette sheet_tillegg_vedlegg_local:", e);
  }
  try {
    const kolonner = db.getAllSync(
      "PRAGMA table_info(opplastings_ko)",
    ) as Array<{ name: string }>;
    if (!kolonner.find((k) => k.name === "sheet_tillegg_id")) {
      console.log("[MIG] Legger til sheet_tillegg_id på opplastings_ko (Funn #2)");
      db.execSync(`ALTER TABLE opplastings_ko ADD COLUMN sheet_tillegg_id TEXT`);
    }
  } catch (e) {
    console.warn("[MIG] Kunne ikke utvide opplastings_ko med sheet_tillegg_id:", e);
  }
}
