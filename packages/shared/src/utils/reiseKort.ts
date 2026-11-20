/**
 * Hvilken jobb en reiserad står i (web-timeforing-plan.md § 4.11 del A punkt 3; Kenneth
 * 2026-11-20: B32 B, B34 B).
 *
 * ÉN regel for server (`sikreKortId`), telefon (w12m) og SQL-utfyllingen i
 * `packages/db-timer/prisma/migrations/20261120120000_w12_reise_kortid/migration.sql`.
 * Paritetstesten (`reise-kortid-migrering.integration.test.ts`) holder SQL og denne like.
 *
 * Kandidatene er jobbene (kort med arbeid) på samme dagsseddel og samme prosjekt. Utvalget
 * snevres inn i tre steg:
 *  1. Samme underprosjekt som reisen (null = «Uten» er en egen verdi). Ingen treff → alle.
 *  2. Samme byggeplass: reisens EGEN mot jobbens EFFEKTIVE (som nøkkelen leser den). Ingen
 *     treff → står. Reise uten byggeplass (annet kontor) hopper over steget.
 *  3. Retningen, i visningsrekkefølgen (`jobbRekkefolge`): utreise → første, retur → siste.
 *     Uten retning: starter reisen før første arbeid blant kandidatene → første, ellers siste;
 *     uten klokkeslett på reisen eller kandidatene → første.
 * Ingen jobb på prosjektet → `null`; kalleren gir reisen et eget kort (`utledKortId`).
 *
 * Regelen endrer aldri prosjekt, underprosjekt eller byggeplass på reiseraden — den velger
 * bare kort-id.
 */

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
  /** Reiseradens EGEN byggeplass (stedet det ble reist til eller fra), ikke den effektive. */
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

/** Kort-id-en reisen skal stå i, eller `null` når prosjektet ikke har noen jobb på sedelen. */
export function velgReiseKort(reise: ReiseKortReise, jobber: readonly ReiseKortJobb[]): string | null {
  const paaProsjekt = jobber.filter((j) => j.projectId === reise.projectId);
  if (paaProsjekt.length === 0) return null;

  const likEco = paaProsjekt.filter((j) => j.ecoId === reise.ecoId);
  let utvalg = likEco.length > 0 ? likEco : paaProsjekt;
  if (reise.byggeplassId) {
    const likBp = utvalg.filter((j) => j.byggeplassId === reise.byggeplassId);
    if (likBp.length > 0) utvalg = likBp;
  }

  const ordnet = [...utvalg].sort(jobbRekkefolge);
  const forste = ordnet[0]!;
  const siste = ordnet[ordnet.length - 1]!;
  if (reise.retning === "ut") return forste.kortId;
  if (reise.retning === "retur") return siste.kortId;
  if (reise.fraTid == null) return forste.kortId;
  const forsteArbeid = ordnet.reduce<string | null>(
    (min, j) => (j.forsteTid !== null && (min === null || cmp(j.forsteTid, min) < 0) ? j.forsteTid : min),
    null,
  );
  if (forsteArbeid === null) return forste.kortId;
  return cmp(reise.fraTid, forsteArbeid) < 0 ? forste.kortId : siste.kortId;
}
