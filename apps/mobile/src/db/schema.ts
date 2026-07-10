import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";

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
  // Funn #2: kvittering-vedlegg på tillegg-rad. Nullable, additivt — eksisterende
  // sjekkliste/oppgave-køoppføringer lar feltet stå null. Tilføyes idempotent.
  sheetTilleggId: text("sheet_tillegg_id"),
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
 *  Skrive-tabeller (mobil → server, syncStatus pending/synced/conflict/avvist):
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
  // Slice 3 (2026-06-20): markerer at draften ble auto-generert av «Slutt dag»
  // (genererForslag). KUN lokal — synces ALDRI til server. Gater auto-fyll-
  // banneret på review-skjermen. Manuelle ny.tsx-drafts lar feltet stå null.
  autoGenerert: integer("auto_generert", { mode: "boolean" }),
  // Slice 4a (2026-06-20): true når sedelen er ett av flere segmenter fra et
  // skift som krysset midnatt (genererForslag → splittVedMidnatt). KUN lokal.
  // Gir en «delt ved midnatt»-merking på review-skjermen så lave per-dag-timer
  // (f.eks. 5 t av et 12t-nattskift) leses som legitim splitt, ikke feil.
  deltVedMidnatt: integer("delt_ved_midnatt", { mode: "boolean" }),
  // Slice 4b-2 (2026-06-21): kilde for slutt-tiden — "bruker" | "midnatt" |
  // "system". Speiler server DailySheet.sluttTidKilde. Settes i genererForslag
  // (midnatt/bruker/system), nullstilles til "bruker" ved manuell tid-redigering.
  sluttTidKilde: text("slutt_tid_kilde").notNull().default("bruker"),
  beskrivelse: text("beskrivelse"),
  lederKommentar: text("leder_kommentar"),
  attestertVed: text("attestert_ved"), // ISO timestamp fra server
  syncStatus: text("sync_status", {
    // "avvist" (SYNC-1): permanent avvist av server — terminal, retry stopper.
    // Ren TS-enum-utvidelse; SQLite-kolonnen er TEXT → ingen migrering nødvendig.
    enum: ["pending", "synced", "conflict", "avvist"],
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
  // T.4 (T4-d 2026-05-16) — per-rad fra/til-tid (HH:MM). Nullable inntil UI
  // setter dem i T4-e. Server-skjemaet har feltene fra T.1 (2026-05-11).
  fraTid: text("fra_tid"),
  tilTid: text("til_tid"),
  // T.12 — fritekst per rad («hva jeg gjorde»). Tilføyes idempotent via ALTER
  // i migreringer.ts. Nullable, speil av server-skjema (SheetTimer.beskrivelse).
  beskrivelse: text("beskrivelse"),
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
  // T7-4a (2026-05-16) — ECO på maskin-rad. Speil av server-schema; tilføyes
  // idempotent via ALTER i migreringer.ts. Maskin følger samme prosjekt+ECO-
  // gruppe som arbeidstimer (T.7 låst 2026-05-16).
  externalCostObjectId: text("external_cost_object_id"),
  timer: real("timer").notNull(),
  mengde: real("mengde"),
  enhet: text("enhet"),
  // T.4 (T4-d 2026-05-16) — per-rad fra/til-tid (HH:MM). Nullable inntil UI
  // setter dem i T4-e.
  fraTid: text("fra_tid"),
  tilTid: text("til_tid"),
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

/**
 * sheet_tillegg_vedlegg_local — kvittering-/bilde-vedlegg på en tillegg-rad
 * (Funn #2). Offline-først: `lokalSti` peker på lokal fil til opplasting,
 * `serverUrl` settes når opplastings-køen har lastet opp (null = «venter»).
 * Speil av server-tabell `SheetTilleggVedlegg`.
 */
export const sheetTilleggVedleggLocal = sqliteTable(
  "sheet_tillegg_vedlegg_local",
  {
    id: text("id").primaryKey(),
    sheetTilleggId: text("sheet_tillegg_id").notNull(),
    lokalSti: text("lokal_sti"), // file://-URI til opplasting; null etter opprydding
    serverUrl: text("server_url"), // /uploads/...; null = venter på opplasting
    filnavn: text("filnavn").notNull(),
    mimeType: text("mime_type").notNull(),
    filstorrelse: integer("filstorrelse"),
    sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
  },
);

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
  // Variant B: firma-default auto-valgt lønnsart på ny timer-rad. ALTER i
  // migreringer.ts for eksisterende klienter; refreshKatalog skriver feltet.
  erStandardvalg: integer("er_standardvalg", { mode: "boolean" })
    .notNull()
    .default(false),
  // ③a: strukturert overtid-nivå (50/100). null = ikke overtid. ALTER i
  // migreringer.ts for eksisterende klienter; refreshKatalog skriver feltet.
  overtidsnivaa: integer("overtidsnivaa"),
  seedNivaa: integer("seed_nivaa"),
  sistOppdatert: integer("sist_oppdatert").notNull(), // Unix ms — siste pull fra server
});

/**
 * arbeidsdag_local — «Start dag / Slutt dag»-økt (worker-drevet, 2026-06-06).
 * Lokal arbeidsøkt-logg som produserer et dagsseddel-forslag. KUN lokal state —
 * synkes ALDRI til server (kun den genererte dagsseddelen synkes via timerSync).
 * Egen tabell, ikke kolonner på dagsseddel_local: økten er konseptuelt adskilt
 * fra den formelle dagsseddelen.
 */
export const arbeidsdagLocal = sqliteTable("arbeidsdag_local", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  dato: text("dato").notNull(), // ISO YYYY-MM-DD
  startAt: text("start_at").notNull(), // ISO timestamp
  startLat: real("start_lat"),
  startLng: real("start_lng"),
  endAt: text("end_at"), // ISO timestamp — null = pågår
  endLat: real("end_lat"),
  endLng: real("end_lng"),
  status: text("status").notNull().default("paagaar"), // 'paagaar' | 'avsluttet' | 'forkastet'
  generertDagsseddelId: text("generert_dagsseddel_id"), // FK → dagsseddel_local.id (svak)
  // Fase 1 (2026-06-08): GPS-identifisert oppmøtested ved «Start dag» —
  // dokumentasjon, aldri lønnsgrunnlag. null = ikke innenfor noe geofence.
  oppmotestedId: text("oppmotested_id"),
  oppmotestedNavn: text("oppmotested_navn"),
  // L1 (2026-06-20): GPS-identifisert byggeplass ved «Start dag» — speil av
  // oppmøtested. Dokumentasjon, aldri lønn/reise/prosjektvalg. null = utenfor
  // alle byggeplass-geofence.
  byggeplassId: text("byggeplass_id"),
  byggeplassNavn: text("byggeplass_navn"),
  sistEndretLokalt: integer("sist_endret_lokalt").notNull(),
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

/**
 * oppmotested_local — offline-cache av firmaets oppmøtesteder (kontorer) for
 * GPS-identifikasjon ved «Start dag» (Fase 1, 2026-06-08). KUN lokal, synkes
 * aldri opp. Refresh via oppmotestedKatalog.refreshOppmotestedKatalog.
 */
export const oppmotestedLocal = sqliteTable("oppmotested_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  navn: text("navn").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radiusM: integer("radius_m").notNull().default(150),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * byggeplass_local — offline-cache av firmaets byggeplasser (R4, 2026-06-11).
 * Lette felt for prosjekt→primær-byggeplass-resolusjon i reisetid-oppslaget.
 * L1 (2026-06-20): utvidet med navn + geofence (lat/lng/radiusM, alle nullable
 * — geofence er valgfri på server) for GPS-identifikasjon av byggeplass ved
 * «Start dag». Refresh via byggeplassKatalog.refreshByggeplassKatalog. KUN lokal.
 */
export const byggeplassLocal = sqliteTable("byggeplass_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  projectId: text("project_id").notNull(),
  number: integer("number"),
  status: text("status"),
  navn: text("navn"),
  lat: real("lat"),
  lng: real("lng"),
  radiusM: integer("radius_m"),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * reisetid_matrise_local — offline-cache av firmaets reisetid-matrise (R4,
 * 2026-06-11). Speiler server ReisetidMatrise: kjøretid (min) per
 * [kontor × byggeplass]. kjoretidMin < 0 = uoppnåelig. Refresh via
 * reisetidMatriseKatalog.refreshReisetidMatriseKatalog. KUN lokal.
 */
export const reisetidMatriseLocal = sqliteTable(
  "reisetid_matrise_local",
  {
    organizationId: text("organization_id").notNull(),
    oppmotestedId: text("oppmotested_id").notNull(),
    byggeplassId: text("byggeplass_id").notNull(),
    kjoretidMin: integer("kjoretid_min").notNull(),
    sistOppdatert: integer("sist_oppdatert").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.oppmotestedId, t.byggeplassId] }),
  }),
);

/**
 * arbeidstidskalender_local — offline-cache av firma-kalender (T4-d / T9d
 * 2026-05-16). Brukes av hentEffektivArbeidstidLokal til å beregne start/
 * slutt/pauseMin for en gitt dato uten nett. Refresh ved login + nett-
 * gjenkomst via kalenderKatalog.refreshKalenderKatalog (periode = currentYear
 * ± 1). Alle rader skrives (også aktiv=false) — `hentLokalt` filtrerer.
 *
 * type-verdier (Zod-validert på server, ikke Prisma-enum):
 *   helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt
 *   | halvdag | firma_fri
 *
 * timerOverstyr er kun satt for halvdag.
 * standardStartTid/standardSluttTid/pauseMin er kun satt for
 * sommertid_start/sommertid_slutt/halvdag.
 */
export const arbeidstidskalenderLocal = sqliteTable("arbeidstidskalender_local", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  aar: integer("aar").notNull(),
  dato: text("dato").notNull(), // ISO YYYY-MM-DD
  type: text("type").notNull(),
  navn: text("navn").notNull(),
  timerOverstyr: real("timer_overstyr"),
  standardStartTid: text("standard_start_tid"),
  standardSluttTid: text("standard_slutt_tid"),
  pauseMin: integer("pause_min"),
  aktiv: integer("aktiv", { mode: "boolean" }).notNull().default(true),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});

/**
 * organization_setting_local — offline-cache av OrganizationSetting (T4-d
 * 2026-05-16). Én rad per firma (organization_id som PK). Brukes som fall-
 * back i hentEffektivArbeidstidLokal når kalenderen ikke har overstyringer
 * for datoen. Refresh ved login + nett-gjenkomst via
 * organizationSettingKatalog.refreshOrganizationSettingKatalog.
 *
 * Vi cacher kun de feltene mobil trenger i Timer-modulen — ikke hele rad-
 * settet fra server (timezone, tilgang-policies osv. håndteres ved behov).
 */
export const organizationSettingLocal = sqliteTable("organization_setting_local", {
  organizationId: text("organization_id").primaryKey(),
  standardStartTid: text("standard_start_tid").notNull().default("07:00"),
  standardSluttTid: text("standard_slutt_tid").notNull().default("15:00"),
  standardPauseMin: integer("standard_pause_min").notNull().default(30),
  tillattRedigerVedAttestering: integer("tillatt_rediger_ved_attestering", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  // T.5 (2026-05-16) — null = ingen avrunding. Verdier 15/30/60.
  // Tilføyes idempotent via ALTER. Brukes av FraTilTidFelt + rad-modaler.
  tidsrundingMinutter: integer("tidsrunding_minutter"),
  // 2026-07-08 — pausevindu = skiftstart + standardPauseEtterTimer (t). Default 4,0.
  // Tilføyes idempotent via ALTER. Brukes av TimerRadModal + genererForslag (1b).
  standardPauseEtterTimer: real("standard_pause_etter_timer").notNull().default(4.0),
  // DEPRECATED 2026-07-08 (to-stegs migrering) — erstattet av standardPauseEtterTimer.
  // Beholdes til data er migrert; leses ikke lenger.
  standardPauseFra: text("standard_pause_fra"),
  // Fase 3 (§ B) — reise-regelsett for offline reise-forslag i «Slutt dag».
  // Tilføyes idempotent via ALTER. null på reiseLonnsartId = navne-match-fallback.
  reiseTerskelMin: integer("reise_terskel_min").notNull().default(30),
  reiseUnderTerskelType: text("reise_under_terskel_type").notNull().default("arbeidstid"),
  reiseOverTerskelType: text("reise_over_terskel_type").notNull().default("reisetid"),
  reisetidTellerOvertid: integer("reisetid_teller_overtid", { mode: "boolean" })
    .notNull()
    .default(false),
  reiseLonnsartId: text("reise_lonnsart_id"),
  sistOppdatert: integer("sist_oppdatert").notNull(),
});
