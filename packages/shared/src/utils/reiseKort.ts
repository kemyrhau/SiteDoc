/**
 * Hvilket kort en reiserad står i (web-timeforing-plan.md § 4.15 del E, versjon 17; Kenneth
 * 2026-11-20/21: B43 B, B44, B47 A, B48 A og § 8.20). Erstatter § 4.11 del A punkt 3 (w12).
 *
 * ÉN regel for server (`sikreKortId`), dagssiden (`reiseHavnerI`) og SQL-utfyllingen i
 * `packages/db-timer/prisma/migrations/20261121120000_w15c_reise_kort/migration.sql`.
 * Paritetstesten (`reise-kortid-migrering.integration.test.ts`) holder SQL og denne like.
 *
 * Kandidatene er jobbene (kort med arbeid) på samme dagsseddel og samme prosjekt (punkt 2).
 *  Reise uten prosjekt → `null`, aldri fraværskortet (plan FA16: en reise bærer alltid prosjekt;
 *  databasen sperrer den med `sheet_timer_uten_prosjekt_chk`). `sikreKortId` og SQL-utfyllingen
 *  lar en slik rad stå urørt.
 *  3. Byggeplassen er et krav: reisens EFFEKTIVE byggeplass mot jobbens effektive; «uten» er en
 *     egen verdi. Ingen treff → `null`.
 *  4. Underprosjekt: har reisen et, er det et krav (ingen treff → `null`). Har den ikke, går
 *     jobbene «Uten» foran, ellers står alle (B48 A).
 *  5. Retningen, i visningsrekkefølgen (`jobbRekkefolge`): utreise → første, retur → siste.
 *     Uten retning: før første arbeid blant kandidatene → første, ellers siste; uten
 *     klokkeslett → første.
 * `null` → kalleren gir reisen eget kort (`egetReiseKort`).
 *
 * Regelen kjøres bare for en reise uten kort-id: når den opprettes, og når prosjekt, byggeplass
 * eller underprosjekt er rettet (da nulles id-en). En reise med kort-id flyttes aldri av at andre
 * registreringer føres eller slettes (§ 8.22 punkt 3, Kenneth 2026-11-21). Reise til annet kontor
 * har ingen egen regel (§ 8.22 punkt 2).
 *
 * Regelen endrer aldri prosjekt, underprosjekt eller byggeplass på reiseraden — den velger
 * bare kort-id.
 */
import { utledKortId, utledReiseKortId, type KortNokkelFelt } from "./kortId";

/** En jobb slik regelen ser den: ett kort med arbeid. */
export type ReiseKortJobb = {
  kortId: string;
  projectId: string | null;
  ecoId: string | null;
  /** Effektiv byggeplass (FA69): radens egen, ellers sedelens når den hører til prosjektet. */
  byggeplassId: string | null;
  /** Første arbeidsrads fra-tid (`HH:MM`), `null` når ingen arbeidsrad har klokkeslett. */
  forsteTid: string | null;
  /** Eldste arbeidsrad (ms). */
  eldste: number;
};

export type ReiseKortReise = {
  projectId: string | null;
  ecoId: string | null;
  /** Reiseradens EFFEKTIVE byggeplass (som nøkkelen, FA69): egen, ellers sedelens når den hører til prosjektet. */
  byggeplassId: string | null;
  /** `"ut"` | `"retur"`; alt annet (også `null`) er «uten retning». */
  retning: string | null;
  fraTid: string | null;
};

/** Kode-enhets-sammenlikning, samme som `COLLATE "C"` i SQL. */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Kortenes visningsrekkefølge (FA50, G7): første arbeidsrads fra-tid, jobber uten klokkeslett
 * sist, så eldste arbeidsrad, så kort-id. Brukt av regelen og av `grupperPaaKort`.
 */
export function jobbRekkefolge(
  a: { forsteTid: string | null; eldste: number; kortId: string },
  b: { forsteTid: string | null; eldste: number; kortId: string },
): number {
  if (a.forsteTid !== null && b.forsteTid === null) return -1;
  if (a.forsteTid === null && b.forsteTid !== null) return 1;
  if (a.forsteTid !== null && b.forsteTid !== null && a.forsteTid !== b.forsteTid)
    return cmp(a.forsteTid, b.forsteTid);
  return a.eldste - b.eldste || cmp(a.kortId, b.kortId);
}

export type ReiseKortArbeidsrad = {
  kortId: string | null;
  projectId: string | null;
  ecoId: string | null;
  /** Effektiv byggeplass. */
  byggeplassId: string | null;
  fraTid: string | null;
  /** ms */
  opprettet: number;
  attestertStatus?: string | null;
};

/**
 * Jobbene på en sedel fra arbeidsradene (ikke reise). Erstattede rader teller ikke; rader uten
 * kort-id hører ikke til en jobb. Underprosjekt og byggeplass er like i et kort (K3, K4).
 */
export function jobberFraArbeidsrader(rader: readonly ReiseKortArbeidsrad[]): ReiseKortJobb[] {
  const pr = new Map<string, ReiseKortJobb>();
  for (const r of rader) {
    if (!r.kortId || r.attestertStatus === "erstattet") continue;
    const j = pr.get(r.kortId);
    if (!j) {
      pr.set(r.kortId, {
        kortId: r.kortId,
        projectId: r.projectId,
        ecoId: r.ecoId,
        byggeplassId: r.byggeplassId,
        forsteTid: r.fraTid ?? null,
        eldste: r.opprettet,
      });
      continue;
    }
    if (r.fraTid != null && (j.forsteTid === null || cmp(r.fraTid, j.forsteTid) < 0)) j.forsteTid = r.fraTid;
    if (r.opprettet < j.eldste) j.eldste = r.opprettet;
  }
  return [...pr.values()];
}

/** Kort-id-en reisen skal stå i, eller `null` når den skal ha eget kort. */
export function velgReiseKort(reise: ReiseKortReise, jobber: readonly ReiseKortJobb[]): string | null {
  if (reise.projectId === null) return null;
  const paaProsjekt = jobber.filter((j) => j.projectId === reise.projectId);
  if (paaProsjekt.length === 0) return null;

  let utvalg = paaProsjekt.filter((j) => j.byggeplassId === reise.byggeplassId);
  if (utvalg.length === 0) return null;
  if (reise.ecoId !== null) {
    utvalg = utvalg.filter((j) => j.ecoId === reise.ecoId);
    if (utvalg.length === 0) return null;
  } else {
    const uten = utvalg.filter((j) => j.ecoId === null);
    if (uten.length > 0) utvalg = uten;
  }

  const forsteTid = (l: readonly ReiseKortJobb[]) =>
    l.reduce<string | null>(
      (min, j) => (j.forsteTid !== null && (min === null || cmp(j.forsteTid, min) < 0) ? j.forsteTid : min),
      null,
    );
  const ordnet = [...utvalg].sort(jobbRekkefolge);
  const forste = ordnet[0]!;
  const siste = ordnet[ordnet.length - 1]!;
  if (reise.retning === "ut") return forste.kortId;
  if (reise.retning === "retur") return siste.kortId;
  if (reise.fraTid == null) return forste.kortId;
  const forsteArbeid = forsteTid(ordnet);
  if (forsteArbeid === null) return forste.kortId;
  return cmp(reise.fraTid, forsteArbeid) < 0 ? forste.kortId : siste.kortId;
}

/**
 * Kort-id for en reise i eget kort (F24, F25). Normalt `utledKortId` av reisens nøkkel, så den
 * deler kort med tillegg og utlegg på samme sted. Treffer den id-en kortet til en jobb på sedelen
 * (en jobb som har byttet underprosjekt og beholdt id-en, `flyttHeleJobben`), får reisen
 * `utledReiseKortId`.
 */
export function egetReiseKort(args: {
  userId: string;
  dato: string;
  nokkel: KortNokkelFelt;
  jobbKortIder: Iterable<string>;
}): string {
  const { userId, dato, nokkel } = args;
  const utledet = utledKortId({ userId, dato, nokkel });
  for (const k of args.jobbKortIder) if (k === utledet) return utledReiseKortId({ userId, dato, nokkel });
  return utledet;
}
