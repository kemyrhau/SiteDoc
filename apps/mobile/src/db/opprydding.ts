import { eq, inArray, or, and, isNotNull } from "drizzle-orm";
import { hentDatabase } from "./database";
import { sjekklisteFeltdata, oppgaveFeltdata, opplastingsKo } from "./schema";
import { slettLokaltBilde, listLokalebilder } from "../services/lokalBilde";

/**
 * Patch feltdata med server-URL-er fra fullførte køoppføringer, deretter slett dem.
 * Fikser tilfeller der oppdaterFeltdataVedlegg feilet (f.eks. repeater-barn før bugfix).
 */
export function ryddFullforteOpplastinger() {
  try {
    const db = hentDatabase();
    if (!db) return;

    // Hent fullførte oppføringer som har serverUrl
    const fullforte = db
      .select()
      .from(opplastingsKo)
      .where(eq(opplastingsKo.status, "fullfort"))
      .all();

    // Patch feltdata for å sikre at server-URL-er er oppdatert
    for (const oppforing of fullforte) {
      if (!oppforing.serverUrl) continue;
      const dokumentType = oppforing.oppgaveId ? "oppgave" as const : "sjekkliste" as const;
      const dokumentId = oppforing.oppgaveId ?? oppforing.sjekklisteId ?? "";
      if (!dokumentId) continue;

      try {
        const rader = dokumentType === "sjekkliste"
          ? db.select().from(sjekklisteFeltdata).where(eq(sjekklisteFeltdata.sjekklisteId, dokumentId)).all()
          : db.select().from(oppgaveFeltdata).where(eq(oppgaveFeltdata.oppgaveId, dokumentId)).all();

        if (rader.length === 0) continue;
        const rad = rader[0]!;
        const feltVerdier = JSON.parse(rad.feltVerdier) as Record<string, Record<string, unknown>>;

        let endret = false;
        for (const feltId of Object.keys(feltVerdier)) {
          const felt = feltVerdier[feltId] as { vedlegg?: Array<{ id: string; url: string }>; verdi?: unknown } | undefined;
          if (!felt) continue;

          // Toppnivå-vedlegg
          if (felt.vedlegg) {
            for (const v of felt.vedlegg) {
              if (v.id === oppforing.vedleggId && v.url !== oppforing.serverUrl) {
                v.url = oppforing.serverUrl;
                endret = true;
              }
            }
          }

          // Repeater-barn (nestet i verdi-arrayen)
          if (Array.isArray(felt.verdi)) {
            for (const rad of felt.verdi as Record<string, { vedlegg?: Array<{ id: string; url: string }> }>[]) {
              for (const barnId of Object.keys(rad)) {
                const barn = rad[barnId];
                if (!barn?.vedlegg) continue;
                for (const v of barn.vedlegg) {
                  if (v.id === oppforing.vedleggId && v.url !== oppforing.serverUrl) {
                    v.url = oppforing.serverUrl;
                    endret = true;
                  }
                }
              }
            }
          }
        }

        if (endret) {
          if (dokumentType === "sjekkliste") {
            db.update(sjekklisteFeltdata)
              .set({ feltVerdier: JSON.stringify(feltVerdier), erSynkronisert: false })
              .where(eq(sjekklisteFeltdata.id, rad.id))
              .run();
          } else {
            db.update(oppgaveFeltdata)
              .set({ feltVerdier: JSON.stringify(feltVerdier), erSynkronisert: false })
              .where(eq(oppgaveFeltdata.id, rad.id))
              .run();
          }
        }
      } catch {
        // Ignorer enkeltfeil — fortsett med neste oppføring
      }
    }

    // Slett fullførte køoppføringer
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

    // Hvis køen er helt tom men det finnes lokale bilder, hopp over opprydding.
    // Dette skjer ved første oppstart etter at databasen ble aktivert —
    // bildene har aldri hatt køoppføringer og er ikke reelle foreldreløse.
    const lokalebilder = await listLokalebilder();
    if (alleKoStier.length === 0 && lokalebilder.length > 0) {
      console.log("[RYDD] Hopper over opprydding — kø tom men", lokalebilder.length, "lokale bilder finnes (migreringsfase)");
      return;
    }

    const koStiSett = new Set(alleKoStier);

    for (const bildeSti of lokalebilder) {
      if (!koStiSett.has(bildeSti)) {
        await slettLokaltBilde(bildeSti);
      }
    }
  } catch (feil) {
    console.warn("Opprydding av foreldreløse bilder feilet:", feil);
  }
}
