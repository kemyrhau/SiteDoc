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
