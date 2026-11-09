import type { hentDatabase } from "../db/database";
import { slettedeRaderLocal } from "../db/schema";

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/**
 * ORDRE 36e (pkt. 2): sedel slettet i prosjektkortet. Tombstonen (radType
 * "sedel", radId = dagsseddelId = sedel-id) får synken til å sende
 * `dagsseddel.slett` før pull, og pull gjenoppliver ikke sedelen.
 * Idempotent: en ny sletting av samme sedel lager ingen dublett.
 */
export function leggSedelTombstone(db: LokalDb, sheetId: string, naa: number = Date.now()): void {
  db.insert(slettedeRaderLocal)
    .values({ radId: sheetId, dagsseddelId: sheetId, radType: "sedel", slettetVed: naa })
    .onConflictDoNothing()
    .run();
}
