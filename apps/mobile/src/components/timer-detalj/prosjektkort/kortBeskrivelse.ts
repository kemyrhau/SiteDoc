import { and, eq } from "drizzle-orm";
import type { hentDatabase } from "../../../db/database";
import { sheetTimerLocal } from "../../../db/schema";

/**
 * K5 (ORDRE (33) c1, kort-id-spec § 5.5 «Én beskrivelse pr. kort»): tekst endret på én
 * arbeidsrad skrives på kortets øvrige arbeidsrader. Kortet er radens `kortId` (satt av
 * `sikreLokalKortId` i lagringen før dette kallet). Bare prosjektkort-modus — dagskort-modus
 * røres ikke (orkestrator-avgjørelse 2026-11-16). Reise og fraværsrader er ikke arbeidsrader
 * og verken gir eller får teksten (fraværskortet har sin egen, U11). Returnerer antall rader
 * som fikk ny tekst.
 */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export function skrivKortBeskrivelse(
  db: LokalDb,
  args: { sheetId: string; radId: string; beskrivelse: string | null },
): number {
  const rad = db
    .select({ kortId: sheetTimerLocal.kortId, erReise: sheetTimerLocal.erReise, utenProsjekt: sheetTimerLocal.utenProsjekt })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, args.radId))
    .all()[0];
  if (!rad || !rad.kortId || rad.erReise || rad.utenProsjekt) return 0;
  const tekst = args.beskrivelse ?? null;
  const andre = db
    .select({ id: sheetTimerLocal.id, beskrivelse: sheetTimerLocal.beskrivelse, erReise: sheetTimerLocal.erReise, utenProsjekt: sheetTimerLocal.utenProsjekt })
    .from(sheetTimerLocal)
    .where(and(eq(sheetTimerLocal.dagsseddelId, args.sheetId), eq(sheetTimerLocal.kortId, rad.kortId)))
    .all()
    .filter((r) => r.id !== args.radId && !r.erReise && !r.utenProsjekt && (r.beskrivelse ?? null) !== tekst);
  for (const r of andre) {
    db.update(sheetTimerLocal)
      .set({ beskrivelse: tekst, sistEndretLokalt: Date.now() })
      .where(eq(sheetTimerLocal.id, r.id))
      .run();
  }
  return andre.length;
}
