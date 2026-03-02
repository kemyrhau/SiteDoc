import { Platform } from "react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

let dbInstans: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initForsok = false;

/**
 * Sjekk om SQLite er tilgjengelig (kun iOS/Android med SharedArrayBuffer).
 */
export function erDatabaseTilgjengelig(): boolean {
  return Platform.OS !== "web" && typeof SharedArrayBuffer !== "undefined";
}

/**
 * Hent singleton Drizzle-instans.
 * Returnerer null på web eller miljøer uten SharedArrayBuffer.
 */
export function hentDatabase() {
  if (!initForsok) {
    initForsok = true;
    if (erDatabaseTilgjengelig()) {
      try {
        const sqliteDb = openDatabaseSync("siteflow.db");
        dbInstans = drizzle(sqliteDb, { schema });
      } catch (feil) {
        console.warn("Kunne ikke åpne SQLite-database:", feil);
      }
    }
  }
  return dbInstans;
}
