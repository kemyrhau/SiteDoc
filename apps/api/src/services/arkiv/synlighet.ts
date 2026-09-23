/**
 * Arkiv — synlighetsfilter for rapportobjekter.
 *
 * Rapporten skal vise de valgene og kravene som FAKTISK gjaldt arbeidet som ble utført
 * (Kenneth-vedtak 2026-09-21). Et betinget felt som aldri ble vist (vilkåret slo ikke til)
 * skal utelates HELT — ikke stå som «Ikke utfylt», som ville vært en usann påstand om at
 * noen glemte det.
 *
 * 🔴 Synligheten avgjøres av den DELTE `erObjektSynlig` (@sitedoc/shared) — samme kilde som
 * de fire utfyllings-hookene (web+mobil × sjekkliste+oppgave). Rapport og skjerm kan da per
 * definisjon ikke være uenige om hva som var synlig. Rapporten bygger INGEN egen vurdering.
 *
 * Et felt der «Ikke aktuelt» er et SVAR (fagpersonen så på forholdet og konkluderte) er
 * SYNLIG og BLIR STÅENDE — det er dokumentasjon av en vurdering, og byggherren skal se at
 * den ble gjort. Kun ALDRI-VISTE felt utelates. Skillet ligger helt i `erObjektSynlig`:
 * svar-verdien påvirker ikke synligheten, kun forelderens vilkår gjør det.
 */

import { erObjektSynlig, type SynlighetsObjekt } from "@sitedoc/shared";
import type { RapportObjekt } from "@sitedoc/pdf";

/** Rene overskrifter (ingen egen verdi) — kan bli stående tomme når felt under utelates. */
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

/** Samme sone-prioritet som `byggObjektTre`: topptekst-felter først, så sortOrder. */
function zonePrioritet(o: RapportObjekt): number {
  return (o.config as { zone?: string }).zone === "topptekst" ? 0 : 1;
}

/**
 * Antall ekte (ikke-display) felt under hver overskrift, per forelder-gruppe, i
 * visningsrekkefølge (matcher `byggObjektTre`-sorteringen). En overskrift som ikke
 * etterfølges av noe felt før neste overskrift på samme nivå får 0. Brukes til å skille
 * «overskrift som mistet innholdet sitt til filtreringen» (skal bort) fra «overskrift som
 * alltid var tom» (dekorativ/avsluttende — står som før, byte-likt).
 */
function seksjonsInnhold(objekter: RapportObjekt[]): Map<string, number> {
  const perForelder = new Map<string | null, RapportObjekt[]>();
  for (const o of objekter) {
    const p = o.parentId ?? null;
    const liste = perForelder.get(p) ?? [];
    liste.push(o);
    perForelder.set(p, liste);
  }

  const resultat = new Map<string, number>();
  for (const gruppe of perForelder.values()) {
    const sortert = [...gruppe].sort((a, b) => {
      const z = zonePrioritet(a) - zonePrioritet(b);
      return z !== 0 ? z : a.sortOrder - b.sortOrder;
    });
    let aktiv: string | null = null;
    for (const o of sortert) {
      if (DISPLAY_TYPER.has(o.type)) {
        aktiv = o.id;
        if (!resultat.has(o.id)) resultat.set(o.id, 0);
      } else if (aktiv) {
        resultat.set(aktiv, (resultat.get(aktiv) ?? 0) + 1);
      }
    }
  }
  return resultat;
}

export interface SynligeObjekterResultat {
  /** Objektene som skal rendres (aldri-viste felt + tomme overskrifter fjernet). */
  objekter: RapportObjekt[];
  /** Ble minst ett objekt utelatt? Styrer om utelatelse-notisen vises. */
  noeUtelatt: boolean;
}

/**
 * Filtrerer bort (1) aldri-viste betingede objekter via den delte `erObjektSynlig`, og
 * (2) overskrifter som HADDE felt under seg men mistet alt til filtreringen. En overskrift
 * som alltid var tom står uendret.
 *
 * `hentSvar(feltId)` gir det lagrede svaret for et felt (verdien direkte). Byte-likt for
 * maler uten betingede felt: `erObjektSynlig` er da true for alt, før==etter, ingenting
 * fjernes.
 */
export function filtrerSynligeArkivObjekter(
  alleObjekter: RapportObjekt[],
  hentSvar: (feltId: string) => unknown,
): SynligeObjekterResultat {
  // 1) Betinget synlighet — delt kilde (foreldrekjede, conditionActive, utenfor_krav,
  //    repeater-unntak og verdimatch ligger alt i erObjektSynlig).
  const synlige = alleObjekter.filter((o) =>
    erObjektSynlig(o as SynlighetsObjekt, alleObjekter as SynlighetsObjekt[], hentSvar),
  );

  // 2) Tomme overskrifter: fjern en display-node kun når seksjonen HADDE innhold men
  //    mistet alt. Bevarer byte-likhet (før==etter ⇒ ingen fjernes).
  const før = seksjonsInnhold(alleObjekter);
  const etter = seksjonsInnhold(synlige);
  const objekter = synlige.filter((o) => {
    if (!DISPLAY_TYPER.has(o.type)) return true;
    const hadde = (før.get(o.id) ?? 0) > 0;
    const harNå = (etter.get(o.id) ?? 0) > 0;
    return !(hadde && !harNå);
  });

  return { objekter, noeUtelatt: objekter.length < alleObjekter.length };
}
