import { eq, inArray, or, and, isNotNull } from "drizzle-orm";
import { hentDatabase } from "./database";
import { sjekklisteFeltdata, oppgaveFeltdata, opplastingsKo } from "./schema";
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
 * Sletter feltdata og køoppføringer for de gitte sjekklistene og oppgavene.
 */
export async function ryddOppForProsjekt(
  sjekklisteIder: string[],
  oppgaveIder: string[] = [],
) {
  if (sjekklisteIder.length === 0 && oppgaveIder.length === 0) return;

  try {
    const db = hentDatabase();
    if (!db) return;

    // Hent lokale stier fra køoppføringer som ikke er fullført
    const sjekklisteFilter = sjekklisteIder.length > 0
      ? inArray(opplastingsKo.sjekklisteId, sjekklisteIder)
      : undefined;
    const oppgaveFilter = oppgaveIder.length > 0
      ? and(isNotNull(opplastingsKo.oppgaveId), inArray(opplastingsKo.oppgaveId, oppgaveIder))
      : undefined;
    const koFilter = sjekklisteFilter && oppgaveFilter
      ? or(sjekklisteFilter, oppgaveFilter)
      : sjekklisteFilter ?? oppgaveFilter;

    if (koFilter) {
      const ufullforte = db
        .select({ lokalSti: opplastingsKo.lokalSti })
        .from(opplastingsKo)
        .where(koFilter)
        .all();

      // Slett lokale filer
      for (const rad of ufullforte) {
        await slettLokaltBilde(rad.lokalSti);
      }

      // Slett køoppføringer
      db.delete(opplastingsKo).where(koFilter).run();
    }

    // Slett sjekkliste-feltdata
    if (sjekklisteIder.length > 0) {
      db.delete(sjekklisteFeltdata)
        .where(inArray(sjekklisteFeltdata.sjekklisteId, sjekklisteIder))
        .run();
    }

    // Slett oppgave-feltdata
    if (oppgaveIder.length > 0) {
      db.delete(oppgaveFeltdata)
        .where(inArray(oppgaveFeltdata.oppgaveId, oppgaveIder))
        .run();
    }
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
