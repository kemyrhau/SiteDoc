import { OVERTID_NIVAA_50, bruktAvNorm, velgOvertidLonnsart, type DognRad } from "@sitedoc/shared";
import type {
  ArbeidLinje,
  DagsforslagDag,
  DagsforslagLonnsart,
  DagsforslagRettingDato,
} from "./dagsforslag";

/**
 * ORDRE 2026-11-16 (28), spec `prosjektkort-kortid-spec.md` § 6.1 (ordre a3):
 * lønnsart pr. linje i Bekreft dag og forhåndsvalg i prosjektkortets rad-vindu.
 * Rene funksjoner — skjermen (`bekreft-dag.tsx`) og velgeren
 * (`LonnsartVelgerModal`) kaller dem.
 */

/** V3: chips når firmaet har inntil så mange aktuelle arter, ellers søkbar liste. */
export const MAKS_LINJE_CHIPS = 6;

/**
 * V4-⚠️ (Kenneth B6): artene en linje kan få — aktive, ordinær (med og uten
 * overtidsnivå) og fravær. Reise-arter (valgt reiseart, båndarter, navne-match)
 * tilbys ikke — reise føres med «+ Reise». Feriepenger og diett tilbys ikke.
 * `alle` er firmaets katalog (firmafiltrert av kalleren). Katalogorden.
 */
export function lonnsarterForLinje<T extends DagsforslagLonnsart>(
  alle: readonly T[],
  erReise: (l: T) => boolean,
): T[] {
  return alle
    .filter((l) => l.aktiv && (l.type === "ordinaer" || l.type === "fravaer") && !erReise(l))
    .sort((a, b) => a.rekkefolge - b.rekkefolge);
}

export type LinjeLonnsartGruppe = "ordinaer" | "overtid" | "fravaer";

/** V3: grupperingen i velgeren — Ordinær · Overtid · Fravær (tomme grupper utelates). */
export function grupperLinjeLonnsarter<
  T extends { type: string; overtidsnivaa: number | null },
>(arter: readonly T[]): Array<{ gruppe: LinjeLonnsartGruppe; arter: T[] }> {
  const gruppeFor = (l: T): LinjeLonnsartGruppe =>
    l.type === "fravaer" ? "fravaer" : l.overtidsnivaa != null ? "overtid" : "ordinaer";
  const rekkefolge: LinjeLonnsartGruppe[] = ["ordinaer", "overtid", "fravaer"];
  return rekkefolge
    .map((gruppe) => ({ gruppe, arter: arter.filter((l) => gruppeFor(l) === gruppe) }))
    .filter((g) => g.arter.length > 0);
}

/**
 * F-L2: velgerens kandidater — bare innlogget firmas aktive arter. Uten
 * `organizationId` (eldre kallere) som før: alle aktive i lokal cache.
 */
export function filtrerVelgerLonnsarter<T extends { organizationId: string; aktiv: boolean }>(
  alle: readonly T[],
  organizationId: string | null | undefined,
): T[] {
  return alle.filter((l) => l.aktiv && (organizationId ? l.organizationId === organizationId : true));
}

/** Linjevalget uten `linje`; tomt sett → `undefined` (tomt utkast forblir tomt). */
export function utenLinje(
  perLinje: Partial<Record<ArbeidLinje, string>> | undefined,
  linje: ArbeidLinje,
): Partial<Record<ArbeidLinje, string>> | undefined {
  if (!perLinje) return undefined;
  const { [linje]: _fjern, ...rest } = perLinje;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * V1/V5/V6: rettingen et valg av lønnsart på en linje gir.
 *
 *  - Samme art som naboen (den andre linja) → linjene blir én: overtiden
 *    slås av (som V5a), «Overtid fra» huskes. Lagrede rader slås aldri sammen —
 *    det er forslaget som regnes på nytt.
 *  - Overtidsart på overtidslinja → `overtidLonnsartId` (samme valg som
 *    nivå-chipsene, V5); linjevalget fjernes.
 *  - Ellers (ordinær/fravær, eller hva som helst på normallinja) → huskes i
 *    `lonnsartPerLinje` (V7). Ordinær art etter normen = overstyring (V6).
 *  - RETUR (28) B9: fravær på normallinja husker linjas slutt i `fravaerTil`
 *    (står det alt et fravær der, beholdes punktet); annen art på normallinja
 *    fjerner punktet. Naboregelen gjelder ikke mens fraværet deler kortet —
 *    kalleren sender da `naboArtId: null`.
 */
export function velgLinjeLonnsart(args: {
  linje: ArbeidLinje;
  art: DagsforslagLonnsart;
  rettDato: DagsforslagRettingDato | undefined;
  /** Lønnsarten den andre linja står på; null = ingen annen linje. */
  naboArtId: string | null;
  /** Overtidslinjas fra-tid (forslaget), til minnet ved sammenslåing. */
  overtidFra: string | null;
  arbeidFra: string;
  /** Linjas slutt-tid (forslaget) — fraværets slutt når fravær velges (B9). */
  linjeTil?: string | null;
}): DagsforslagRettingDato {
  const { linje, art, rettDato } = args;
  const perLinje = rettDato?.lonnsartPerLinje;
  if (args.naboArtId != null && art.id === args.naboArtId) {
    const huskFra = args.overtidFra ?? rettDato?.overtidFra ?? args.arbeidFra;
    return {
      overtidAv: true,
      overtidFra: huskFra,
      // Én linje — ingen fraværsdeling å huske.
      fravaerTil: undefined,
      // Normallinja bærer valget videre; overtidslinjas valg er brukt opp.
      lonnsartPerLinje:
        linje === "normal"
          ? { ...utenLinje(perLinje, "overtid"), normal: art.id }
          : utenLinje(perLinje, "overtid"),
    };
  }
  if (linje === "overtid" && art.overtidsnivaa != null) {
    return { overtidLonnsartId: art.id, lonnsartPerLinje: utenLinje(perLinje, "overtid") };
  }
  const valg: DagsforslagRettingDato = { lonnsartPerLinje: { ...perLinje, [linje]: art.id } };
  if (linje !== "normal") return valg;
  return {
    ...valg,
    fravaerTil:
      art.type === "fravaer" ? (rettDato?.fravaerTil ?? args.linjeTil ?? undefined) : undefined,
  };
}

/** Linjene datoen har nå — rader og linjer uten lønnsart. */
export function linjerIDag(dag: Pick<DagsforslagDag, "rader" | "linjerUtenLonnsart">): Set<ArbeidLinje> {
  const ut = new Set<ArbeidLinje>();
  for (const r of dag.rader) if (r.linje) ut.add(r.linje);
  for (const l of dag.linjerUtenLonnsart ?? []) ut.add(l.linje);
  return ut;
}

/**
 * V7: endres tidene så linja forsvinner, faller valget bort med den — aldri
 * over på en annen linje. Returnerer `null` når ingenting skal endres.
 */
export function ryddLonnsartPerLinje(
  perLinje: Partial<Record<ArbeidLinje, string>> | undefined,
  linjer: ReadonlySet<ArbeidLinje>,
): { lonnsartPerLinje: Partial<Record<ArbeidLinje, string>> | undefined } | null {
  if (!perLinje) return null;
  const borte = (Object.keys(perLinje) as ArbeidLinje[]).filter((l) => !linjer.has(l));
  if (borte.length === 0) return null;
  let ny: Partial<Record<ArbeidLinje, string>> | undefined = perLinje;
  for (const l of borte) ny = utenLinje(ny, l);
  return { lonnsartPerLinje: ny };
}

/**
 * V8 (T20): ny rad i prosjektkortets rad-vindu — er normen alt brukt av
 * datoens arbeid (L1: ikke reise, ikke fravær — B8), forhåndsvelges
 * overtidsarten; ellers `standardId` (som før). Ukjent norm (L3) eller ingen
 * overtidsart → `standardId`.
 */
export function forhaandsvalgNyRad<
  T extends Parameters<typeof velgOvertidLonnsart>[0][number] & { id: string },
>(args: {
  dagsnorm: number | null | undefined;
  rader: readonly DognRad[];
  katalog: T[];
  standardId: string;
}): string {
  const norm = args.dagsnorm ?? 0;
  if (!(norm > 0)) return args.standardId;
  if (bruktAvNorm(args.rader) < norm) return args.standardId;
  return velgOvertidLonnsart(args.katalog, OVERTID_NIVAA_50)?.id ?? args.standardId;
}
