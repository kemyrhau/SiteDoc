import { eq } from "drizzle-orm";
import type { hentDatabase } from "../../../db/database";
import { sheetTimerLocal } from "../../../db/schema";
import { erDagLaast, finnDagForDato } from "../../../services/nyTimerRad";
import { erReiseRadVisning } from "../../../utils/reiseRad";
import type { NormtakDagRad } from "../../../utils/fravaerNormtakMobil";
import type { FravaerKortRad } from "./FravaerKortModal";

/**
 * ORDRE (33) c2 / TILLEGG (33) pkt 4.1 — fraværskortet i Bekreft dag (kort-id-spec § 11.5 U1
 * inngang 2, U8, TF9, TF27). Samme kort som på dagskortet (`FravaerKortModal` +
 * `lagreFravaerKort`): det lagres for datoen når arbeideren trykker «Bekreft» i kortet, uavhengig
 * av Bekreft dag-utkastet (fraværskortet har ikke prosjekt eller klokkeslett, F2/F3).
 *
 * `hentFravaerKortDag` leser datoens lagrede rader: fraværskortets egne (`uten_prosjekt`) og de
 * øvrige (grunnlaget for U3-resten og B10-taket). `fravaerVedBekreft` er regelen for «Bekreft og
 * lagre» når datoen har fraværskort.
 */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export interface FravaerKortDag {
  sheetId: string | null;
  /** Sendt/akseptert dag tar ikke nytt fravær (Q7). */
  laast: boolean;
  fravaerRader: FravaerKortRad[];
  /** Datoens lagrede rader UTEN fraværskortets egne. */
  andreRader: NormtakDagRad[];
}

export function hentFravaerKortDag(
  db: LokalDb,
  args: { userId: string; dato: string; reiseLonnsartId?: string | null },
): FravaerKortDag {
  const dag = finnDagForDato(db, args.userId, args.dato);
  if (!dag) return { sheetId: null, laast: false, fravaerRader: [], andreRader: [] };
  const rader = db
    .select({
      id: sheetTimerLocal.id,
      lonnsartId: sheetTimerLocal.lonnsartId,
      timer: sheetTimerLocal.timer,
      beskrivelse: sheetTimerLocal.beskrivelse,
      erReise: sheetTimerLocal.erReise,
      utenProsjekt: sheetTimerLocal.utenProsjekt,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, dag.id))
    .all();
  return {
    sheetId: dag.id,
    laast: erDagLaast(dag),
    fravaerRader: rader
      .filter((r) => r.utenProsjekt)
      .map((r) => ({ id: r.id, lonnsartId: r.lonnsartId, timer: r.timer, beskrivelse: r.beskrivelse })),
    andreRader: rader
      .filter((r) => !r.utenProsjekt)
      .map((r) => ({
        id: r.id,
        lonnsartId: r.lonnsartId,
        timer: r.timer,
        erReise: erReiseRadVisning(r.erReise, r.lonnsartId, args.reiseLonnsartId ?? null),
      })),
  };
}

/**
 * Bekreft dag-forslagets rader for datoen som grunnlag for fraværskortets rest (U3): arbeidet
 * arbeideren er i ferd med å bekrefte, teller som arbeid før det er lagret. Reise teller ikke (N8).
 */
export function forslagSomDagRader(
  rader: readonly { lonnsartId: string; timer: number; erReise: boolean }[],
): NormtakDagRad[] {
  return rader.map((r, i) => ({ id: `forslag-${i}`, lonnsartId: r.lonnsartId, timer: r.timer, erReise: r.erReise }));
}

/**
 * «Bekreft og lagre» når datoen har fraværskort.
 * - `manglerBeskrivelse`: fraværskortet har rader uten beskrivelse → sperret (F4, TF9), før noe skrives.
 * - `tilDagen`: intet prosjekt valgt, men fraværskortet er lagret → arbeidskortet er ikke påbegynt,
 *   så `manglerProsjekt` sperrer ikke (U8: sperren gjelder bare arbeidskort); skjermen går til dagen.
 * - `null`: vanlig Bekreft (arbeidskortet lagres; `manglerProsjekt` gjelder som før).
 */
export function fravaerVedBekreft(a: {
  manglerProsjekt: boolean;
  fravaerRader: readonly { beskrivelse: string | null }[];
}): "manglerBeskrivelse" | "tilDagen" | null {
  if (a.fravaerRader.some((r) => !(r.beskrivelse ?? "").trim())) return "manglerBeskrivelse";
  if (a.manglerProsjekt && a.fravaerRader.length > 0) return "tilDagen";
  return null;
}
