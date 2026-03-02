import { eq, inArray } from "drizzle-orm";
import { hentDatabase } from "./database";
import { sjekklisteFeltdata, opplastingsKo } from "./schema";
import { slettLokaltBilde, listLokalebilder } from "../services/lokalBilde";

/**
 * Slett fullførte køoppføringer ved oppstart.
 * Lokale filer er allerede slettet etter vellykket opplasting.
 */
export function ryddFullforteOpplastinger() {
  try {
    const db = hentDatabase();
    if (!db) return;
    db.delete(opplastingsKo)
      .where(eq(opplastingsKo.status, "fullfort"))
      .run();
  } catch (feil) {
    console.warn("Opprydding av fullførte opplastinger feilet:", feil);
  }
}

/**
 * Rydd opp data for et avsluttet prosjekt.
 * Sletter feltdata og køoppføringer for de gitte sjekklistene.
 */
export async function ryddOppForProsjekt(sjekklisteIder: string[]) {
  if (sjekklisteIder.length === 0) return;

  try {
    const db = hentDatabase();
    if (!db) return;

    // Hent lokale stier fra køoppføringer som ikke er fullført
    const ufullforte = db
      .select({ lokalSti: opplastingsKo.lokalSti })
      .from(opplastingsKo)
      .where(inArray(opplastingsKo.sjekklisteId, sjekklisteIder))
      .all();

    // Slett lokale filer
    for (const rad of ufullforte) {
      await slettLokaltBilde(rad.lokalSti);
    }

    // Slett køoppføringer
    db.delete(opplastingsKo)
      .where(inArray(opplastingsKo.sjekklisteId, sjekklisteIder))
      .run();

    // Slett feltdata
    db.delete(sjekklisteFeltdata)
      .where(inArray(sjekklisteFeltdata.sjekklisteId, sjekklisteIder))
      .run();
  } catch (feil) {
    console.warn("Opprydding for prosjekt feilet:", feil);
  }
}

/**
 * Slett foreldreløse lokale bilder — filer i siteflow-bilder/
 * uten tilhørende køoppføring.
 */
export async function ryddForeldreloseBilder() {
  try {
    const db = hentDatabase();
    if (!db) return;
    const alleKoStier = db
      .select({ lokalSti: opplastingsKo.lokalSti })
      .from(opplastingsKo)
      .all()
      .map((r) => r.lokalSti);

    const koStiSett = new Set(alleKoStier);
    const lokalebilder = await listLokalebilder();

    for (const bildeSti of lokalebilder) {
      if (!koStiSett.has(bildeSti)) {
        await slettLokaltBilde(bildeSti);
      }
    }
  } catch (feil) {
    console.warn("Opprydding av foreldreløse bilder feilet:", feil);
  }
}
