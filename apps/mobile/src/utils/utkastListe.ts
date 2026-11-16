import { and, eq } from "drizzle-orm";
import { arbeidsdagLocal } from "../db/schema";
import type { LokalDb } from "../services/dagsforslagInput";
import {
  listUtkast,
  ryddAvsluttedeGpsUtkast,
  type UtkastEier,
  type UtkastOversikt,
} from "./prosjektkortUtkast";

/**
 * Utkast i Timer-lista (C3, Redesign 2026-11-13). Lista viser et ikke bekreftet
 * prosjektkort slik:
 * - dato med sedel → merket «Ikke bekreftet» ved siden av statusen (sedelen
 *   åpnes som før);
 * - dato uten sedel → egen rad med 0 t og merket; trykk åpner Bekreft dag.
 * Utkast er ikke sedler og teller derfor aldri i `usendteKladder`.
 */

/** Hvor et trykk på en utkast-rad uten sedel skal føre. */
export type UtkastMaal =
  | { opprinnelse: "manuell"; dato: string }
  | { opprinnelse: "gps"; arbeidsdagId: string };

export type ListeRad<R> =
  | { type: "sedel"; rad: R; ikkeBekreftet: boolean }
  | { type: "utkast"; dato: string; maal: UtkastMaal };

/**
 * Fletter utkastene inn i sedel-lista (dato synkende). Én rad pr. dato: finnes
 * en sedel på datoen, merkes sedelen; ellers lages én utkast-rad. Har datoen et
 * GPS-utkast for en pågående arbeidsdag, går trykket til GPS-stien; ellers til
 * manuelt kort på datoen.
 */
export function flettUtkastIListe<R extends { dato: string }>(
  rader: R[],
  utkast: UtkastOversikt[],
  paagaarIder: ReadonlySet<string>,
): ListeRad<R>[] {
  const utkastPrDato = new Map<string, UtkastOversikt[]>();
  for (const u of utkast) {
    const liste = utkastPrDato.get(u.dato);
    if (liste) liste.push(u);
    else utkastPrDato.set(u.dato, [u]);
  }
  const sedelDatoer = new Set(rader.map((r) => r.dato));

  const ut: ListeRad<R>[] = rader.map((rad) => ({
    type: "sedel",
    rad,
    ikkeBekreftet: utkastPrDato.has(rad.dato),
  }));
  for (const [dato, liste] of utkastPrDato) {
    if (sedelDatoer.has(dato)) continue;
    const gps = liste.find((u) => u.arbeidsdagId && paagaarIder.has(u.arbeidsdagId));
    ut.push({
      type: "utkast",
      dato,
      maal: gps
        ? { opprinnelse: "gps", arbeidsdagId: gps.arbeidsdagId! }
        : { opprinnelse: "manuell", dato },
    });
  }
  // Stabil sortering: dato synkende; på samme dato beholdes rekkefølgen.
  return ut
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const da = a.r.type === "sedel" ? a.r.rad.dato : a.r.dato;
      const dbb = b.r.type === "sedel" ? b.r.rad.dato : b.r.dato;
      if (da !== dbb) return da < dbb ? 1 : -1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

/**
 * Leser lista sine utkast: rydder først GPS-utkast for avsluttede dager
 * (`ryddAvsluttedeGpsUtkast`) og returnerer filene som skal slettes, utkastene
 * og hvilke arbeidsdager som pågår.
 */
export function lesUtkastForListe(
  db: LokalDb,
  args: UtkastEier & { naa: string; nyId: () => string },
): { filer: string[]; utkast: UtkastOversikt[]; paagaarIder: Set<string> } {
  const filer = ryddAvsluttedeGpsUtkast(db, args);
  const utkast = listUtkast(db, args);
  const paagaarIder = new Set(
    db
      .select({ id: arbeidsdagLocal.id })
      .from(arbeidsdagLocal)
      .where(and(eq(arbeidsdagLocal.userId, args.userId), eq(arbeidsdagLocal.status, "paagaar")))
      .all()
      .map((r) => r.id),
  );
  return { filer, utkast, paagaarIder };
}
