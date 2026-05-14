import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * Lokal kopi av sjekkliste-utfylling.
 * Lagres i SQLite for offline-støtte og krasj-sikkerhet.
 */
export const sjekklisteFeltdata = sqliteTable("sjekkliste_feltdata", {
  id: text("id").primaryKey(),
  sjekklisteId: text("sjekkliste_id").notNull(),
  feltVerdier: text("felt_verdier").notNull(), // JSON-streng av Record<string, FeltVerdi>
  erSynkronisert: integer("er_synkronisert", { mode: "boolean" }).notNull().default(false),
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(), // Unix timestamp ms
  sistSynkronisert: integer("sist_synkronisert"), // Unix timestamp ms, null hvis aldri synkronisert
});

/**
 * Bakgrunnskø for filopplasting.
 * Bilder og filer lagres lokalt og lastes opp i bakgrunnen.
 */
/**
 * Lokal kopi av oppgave-utfylling.
 * Lagres i SQLite for offline-støtte og krasj-sikkerhet.
 */
export const oppgaveFeltdata = sqliteTable("oppgave_feltdata", {
  id: text("id").primaryKey(),
  oppgaveId: text("oppgave_id").notNull(),
  feltVerdier: text("felt_verdier").notNull(), // JSON-streng av Record<string, FeltVerdi>
  erSynkronisert: integer("er_synkronisert", { mode: "boolean" }).notNull().default(false),
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(), // Unix timestamp ms
  sistSynkronisert: integer("sist_synkronisert"), // Unix timestamp ms, null hvis aldri synkronisert
});

export const opplastingsKo = sqliteTable("opplastings_ko", {
  id: text("id").primaryKey(),
  sjekklisteId: text("sjekkliste_id"),
  oppgaveId: text("oppgave_id"),
  objektId: text("objekt_id").notNull(),
  vedleggId: text("vedlegg_id").notNull(),
  lokalSti: text("lokal_sti").notNull(),
  filnavn: text("filnavn").notNull(),
  mimeType: text("mime_type").notNull(),
  filstorrelse: integer("filstorrelse"),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  gpsAktivert: integer("gps_aktivert", { mode: "boolean" }).default(false),
  status: text("status", { enum: ["venter", "laster_opp", "fullfort", "feilet"] }).notNull().default("venter"),
  forsok: integer("forsok").notNull().default(0),
  serverUrl: text("server_url"),
  feilmelding: text("feilmelding"),
  opprettet: integer("opprettet").notNull(), // Unix timestamp ms
});

/* ============================================================================
 *  Timer-modul Runde 2 — offline-first dagsseddel
 *
 *  Skrive-tabeller (mobil → server, syncStatus pending/synced/conflict):
 *    - dagsseddel_local      (id = clientUuid, sync-atom for hele sedlen)
 *    - sheet_timer_local     (rader, slettes/opprettes som del av sedel-sync)
 *    - sheet_tillegg_local   (rader)
 *
 *  Read-only katalog-cache (server → mobil, refresh ved login + delta):
 *    - lonnsart_local
 *    - aktivitet_local
 *    - tillegg_local
 *
 *  Konvensjoner:
 *    - id på alle tabeller speiler server-id (clientUuid for dagsseddel_local).
 *    - Decimal-felt fra Postgres serialiseres som text (sats, prisMotKunde) for
 *      å bevare presisjon — beregninger gjøres på server eller med streng-math.
 *    - dato er ISO-streng YYYY-MM-DD (samme format som server.dato).
 *    - timestamp-felt er Unix ms for konsistens med eksisterende tabeller.
 * ============================================================================ */

export const dagsseddelLocal = sqliteTable("dagsseddel_local", {
  id: text("id").primaryKey(), // = clientUuid (samme som server.id ved synced)
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  projectId: text("project_id").notNull(),
  aktivitetId: text("aktivitet_id").notNull(),
  avdelingId: text("avdeling_id"),
  byggeplassId: text("byggeplass_id"),
  dato: text("dato").notNull(), // ISO YYYY-MM-DD
  startAt: text("start_at"), // ISO timestamp eller null
  endAt: text("end_at"),
  pauseMin: integer("pause_min").notNull().default(0),
  status: text("status", {
    enum: ["draft", "sent", "returned", "accepted"],
  })
    .notNull()
    .default("draft"),
  beskrivelse: text("beskrivelse"),
  lederKommentar: text("leder_kommentar"),
  attestertVed: text("attestert_ved"), // ISO timestamp fra server
  syncStatus: text("sync_status", {
    enum: ["pending", "synced", "conflict"],
  })
    .notNull()
    .default("pending"),
  feilmelding: text("feilmelding"), // Server-feilmelding ved siste sync-forsøk
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
  sistSynkronisert: integer("sist_synkronisert"),
});

export const sheetTimerLocal = sqliteTable("sheet_timer_local", {
  id: text("id").primaryKey(),
  dagsseddelId: text("dagsseddel_id").notNull(), // FK → dagsseddel_local.id
  // Per-rad prosjekt (T7-3b1 2026-05-14). Tilføyes idempotent via ALTER;
  // backfill fra parent dagsseddel_local.project_id. Nullable for legacy-
  // rader inntil to-stegs-policy fjerner dagsseddel_local.project_id.
  projectId: text("project_id"),
  lonnsartId: text("lonnsart_id").notNull(),
  // Per-rad aktivitet (C9 2026-05-02). Kolonnen tilføyes idempotent via
  // ALTER i migreringer.ts; eksisterende rader backfilles fra parent.
  aktivitetId: text("aktivitet_id").notNull(),
  externalCostObjectId: text("external_cost_object_id"),
  timer: real("timer").notNull(), // Decimal lagres som real — tap av presisjon < 0.01 OK for timer-felt
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
});

/**
 * sheet_machine_local — maskinbruk-rader per dagsseddel (C9 2026-05-02).
 * vehicleId er svak FK til db-maskin Equipment. Equipment-cache lokalt
 * på mobil er utsatt til Runde 2.6 — UI vises kun når Maskin-modul er
 * aktivert via web-flyten.
 */
export const sheetMachineLocal = sqliteTable("sheet_machine_local", {
  id: text("id").primaryKey(),
  dagsseddelId: text("dagsseddel_id").notNull(),
  // Per-rad prosjekt (T7-3b1). Se kommentar på sheetTimerLocal.projectId.
  projectId: text("project_id"),
  vehicleId: text("vehicle_id").notNull(),
  timer: real("timer").notNull(),
  mengde: real("mengde"),
  enhet: text("enhet"),
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
});

export const sheetTilleggLocal = sqliteTable("sheet_tillegg_local", {
  id: text("id").primaryKey(),
  dagsseddelId: text("dagsseddel_id").notNull(),
  // Per-rad prosjekt (T7-3b1). Se kommentar på sheetTimerLocal.projectId.
  projectId: text("project_id"),
  tilleggId: text("tillegg_id").notNull(),
  antall: real("antall").notNull(),
  kommentar: text("kommentar"),
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
});

export const lonnsartLocal = sqliteTable("lonnsart_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  type: text("type").notNull(), // "ordinaer" | "fravaer" | "feriepenger" | "diett"
  kode: text("kode"),
  navn: text("navn").notNull(),
  prisMotKunde: text("pris_mot_kunde"), // Decimal som tekst
  internkostnad: text("internkostnad"),
  sats: text("sats"),
  satsEnhet: text("sats_enhet"),
  rekkefolge: integer("rekkefolge").notNull().default(0),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  seedNivaa: integer("seed_nivaa"),
  sistOppdatert: integer("sist_oppdatert").notNull(), // Unix ms — siste pull fra server
});

export const aktivitetLocal = sqliteTable("aktivitet_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  kode: text("kode"),
  navn: text("navn").notNull(),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  seedNivaa: integer("seed_nivaa"),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

export const tilleggLocal = sqliteTable("tillegg_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  kode: text("kode"),
  navn: text("navn").notNull(),
  type: text("type").notNull(), // "avhuking" | "antall"
  prisMotKunde: text("pris_mot_kunde"),
  internkostnad: text("internkostnad"),
  rekkefolge: integer("rekkefolge").notNull().default(0),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  seedNivaa: integer("seed_nivaa"),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * equipment_local — speil av firmaets aktive Equipment (Runde 2.6 2026-05-02).
 * Cache for offline-velger ved sheet_machines-registrering. Refresh ved login
 * + nett-gjenkomst. Soft-skjul-mønster: tom liste = Maskin-modul ikke aktivert
 * eller firmaet har ingen utstyr — UI skjuler maskin-seksjonen.
 *
 * Minimum felt-sett: tilstrekkelig for velger og rad-visning. ansvarligUserId,
 * EU-kontroll, telematikk osv. cachet ikke — hentes ved behov via
 * trpc.maskin.equipment.hentMedId.
 */
export const equipmentLocal = sqliteTable("equipment_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  kategori: text("kategori").notNull(), // kjoretoy | anleggsmaskin | smautstyr
  type: text("type"),
  merke: text("merke"),
  modell: text("modell"),
  internNavn: text("intern_navn"),
  internNummer: text("intern_nummer"),
  registreringsnummer: text("registreringsnummer"),
  status: text("status").notNull().default("tilgjengelig"),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * external_cost_object_local — speil av aktive Underprosjekter (ECO) for
 * firmaet. Refresh ved login + manuell trigger. Brukes som velger på
 * timer-rader (sheet_timer_local.externalCostObjectId).
 */
export const externalCostObjectLocal = sqliteTable("external_cost_object_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  projectId: text("project_id").notNull(),
  proAdmId: text("proadm_id").notNull(),
  kortNavn: text("kort_navn").notNull(),
  kilde: text("kilde").notNull(),
  status: text("status").notNull().default("aktiv"),
  timerregistreringApen: integer("timerregistrering_apen", { mode: "boolean" })
    .notNull()
    .default(true),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * prosjekt_local — offline-cache av brukerens prosjekter (T7-3b1).
 * Brukes som velger for per-rad prosjekt-attribusjon på dagsseddel.
 * lat/lng er valgfritt og brukes av T7-3c for geo-forslag.
 * Refresh ved login + nett-gjenkomst via prosjektKatalog.refreshProsjektKatalog.
 */
export const prosjektLocal = sqliteTable("prosjekt_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  projectNumber: text("project_number"),
  lat: real("lat"),
  lng: real("lng"),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});
