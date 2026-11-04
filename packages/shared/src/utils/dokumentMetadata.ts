/**
 * Metadata M-pakke (spec-metadata-filter.md § 1.1, 1.2, 1.4) — rene reduksjoner som
 * liste-API-et (`hentForProsjekt`) bruker for «hvem og når», «sist utfylt av» og
 * signaturstatus. Ingen DB-felt: alt utledes av transferloggen, endringsloggen og
 * malens objekter. Samme kode kan senere brukes til backfill hvis feltene
 * denormaliseres (alternativ D), så ingenting kastes.
 */

import { erObjektSynlig, type SynlighetsObjekt } from "./betingelse";
import { lesSignaturVerdi } from "./signaturVerdi";
import { beregnSignaturStatus, type SisteRundeSammendrag } from "./signaturliste";

/** Hvem og når for ett statussteg. */
export interface Statushendelse {
  av: { id: string; navn: string | null };
  /** ISO-8601 (UTC). */
  ved: string;
}

export interface Statushendelser {
  sendt: Statushendelse | null;
  godkjent: Statushendelse | null;
  lukket: Statushendelse | null;
}

/** Transfer-raden slik liste-API-et henter den. */
export interface StatusTransferRad {
  fromStatus: string;
  toStatus: string;
  createdAt: Date | string;
  sender: { id: string; name: string | null };
}

function tilHendelse(rad: StatusTransferRad): Statushendelse {
  const ved = rad.createdAt instanceof Date ? rad.createdAt.toISOString() : rad.createdAt;
  return { av: { id: rad.sender.id, navn: rad.sender.name }, ved };
}

function tid(rad: StatusTransferRad): number {
  return new Date(rad.createdAt).getTime();
}

/**
 * Reduser ett dokuments transfers til sendt/godkjent/lukket.
 * - Sendt = ELDSTE rad `draft → sent|received`.
 * - Godkjent = NYESTE rad `→ approved`. Lukket = NYESTE rad `→ closed`.
 * - Gjenåpningsregelen: et steg har verdi bare når dokumentets NÅVÆRENDE `terminal`
 *   er i steget eller forbi (godkjent for terminal ∈ {godkjent, lukket}; lukket for
 *   terminal = lukket). Et gjenåpnet dokument «var» godkjent, men ER det ikke —
 *   filteret «godkjent av X» skal ikke treffe det.
 * Rekkefølgen på `rader` spiller ingen rolle.
 */
export function reduserStatushendelser(
  rader: readonly StatusTransferRad[],
  terminal: string | null | undefined,
): Statushendelser {
  let sendt: StatusTransferRad | null = null;
  let godkjent: StatusTransferRad | null = null;
  let lukket: StatusTransferRad | null = null;
  for (const r of rader) {
    if (r.fromStatus === "draft" && (r.toStatus === "sent" || r.toStatus === "received")) {
      if (!sendt || tid(r) < tid(sendt)) sendt = r;
    } else if (r.toStatus === "approved") {
      if (!godkjent || tid(r) >= tid(godkjent)) godkjent = r;
    } else if (r.toStatus === "closed") {
      if (!lukket || tid(r) >= tid(lukket)) lukket = r;
    }
  }
  const visGodkjent = terminal === "godkjent" || terminal === "lukket";
  const visLukket = terminal === "lukket";
  return {
    sendt: sendt ? tilHendelse(sendt) : null,
    godkjent: visGodkjent && godkjent ? tilHendelse(godkjent) : null,
    lukket: visLukket && lukket ? tilHendelse(lukket) : null,
  };
}

/** Én gruppe fra `changeLog.groupBy({ by: [dokId, userId], _max: createdAt })`. */
export interface UtfyltGruppe {
  userId: string;
  sist: Date | string;
}

export interface Utfylling {
  /** Nyeste person i endringsloggen — kolonne + sortering. */
  sist: Statushendelse | null;
  /** Alle som står i loggen — filteret «Utfylt av» treffer hvis X er med. */
  alle: { id: string; navn: string | null }[];
}

/**
 * Reduser endringslogg-gruppene for ett dokument. `null` betyr at malen har
 * endringsloggen slått av (`enableChangeLog=false`) — da vet vi ingenting, og
 * klienten viser «—» med forklaring. Tom logg med loggen på gir `{ sist: null, alle: [] }`.
 */
export function reduserUtfylling(
  grupper: readonly UtfyltGruppe[],
  navn: ReadonlyMap<string, string | null>,
  loggPaa: boolean,
): Utfylling | null {
  if (!loggPaa) return null;
  let sist: UtfyltGruppe | null = null;
  for (const g of grupper) {
    if (!sist || new Date(g.sist).getTime() > new Date(sist.sist).getTime()) sist = g;
  }
  const alle = [...new Set(grupper.map((g) => g.userId))].map((id) => ({ id, navn: navn.get(id) ?? null }));
  return {
    sist: sist
      ? {
          av: { id: sist.userId, navn: navn.get(sist.userId) ?? null },
          ved: sist.sist instanceof Date ? sist.sist.toISOString() : sist.sist,
        }
      : null,
    alle,
  };
}

/** Malfeltene `signature`: hvem som skal signere er kjent på forhånd. */
export interface MalfeltSignatur {
  kreves: number;
  signert: number;
  komplett: boolean;
}

/**
 * Signaturstatus for ett dokument. Kildene holdes ADSKILT (Kenneth 04.11, ORDRE 6):
 * - `felt`: malfeltene `signature` — «m/n» eller «✓». `null` når malen ikke har slike felt.
 * - `sja`: antall signerte i siste SJA-runde (`signature_list`), uten «av N» — en SJA sier
 *   ikke på forhånd hvem som skal signere; folk signerer fortløpende. `null` uten signaturliste.
 */
export interface DokumentSignaturstatus {
  felt: MalfeltSignatur | null;
  sja: number | null;
}

/**
 * Signaturstatus for ett dokument, eller `null` når malen verken har signaturfelt eller
 * signaturliste.
 * - Malfelt `signature`: kreves = synlige signaturfelt (betinget skjulte felt teller
 *   ikke — samme `erObjektSynlig` som skjerm og arkiv); signert = de med verdi i `data`.
 *   Signaturfelt inne i en repeater telles ikke (verdien bor i repeater-radene).
 * - `signature_list` (SJA): signert + bekreftet i siste runde, samme telleregel som
 *   `beregnSignaturStatus` (krevd-ny teller ikke). Ingen runde → 0. Ingen «kreves».
 */
export function beregnDokumentSignatur(
  objekter: readonly SynlighetsObjekt[],
  data: unknown,
  sjaRunde: SisteRundeSammendrag | null,
  aktiveDeltakere: number,
): DokumentSignaturstatus | null {
  const felt = (data && typeof data === "object" ? data : {}) as Record<string, { verdi?: unknown } | undefined>;
  const hentVerdi = (id: string) => felt[id]?.verdi;
  const alle = objekter as SynlighetsObjekt[];
  const forelderType = new Map(objekter.map((o) => [o.id, o.type]));

  let malfelt: MalfeltSignatur | null = null;
  let kreves = 0;
  let signert = 0;
  for (const o of objekter) {
    if (o.type !== "signature") continue;
    malfelt = { kreves: 0, signert: 0, komplett: false };
    if (o.parentId && forelderType.get(o.parentId) === "repeater") continue;
    if (!erObjektSynlig(o, alle, hentVerdi)) continue;
    kreves += 1;
    if (lesSignaturVerdi(hentVerdi(o.id))) signert += 1;
  }
  if (malfelt) malfelt = { kreves, signert, komplett: kreves > 0 && signert >= kreves };

  let sja: number | null = null;
  if (objekter.some((o) => o.type === "signature_list")) {
    const s = beregnSignaturStatus(sjaRunde, aktiveDeltakere);
    sja = s.signert + s.bekreftet;
  }
  if (!malfelt && sja === null) return null;
  return { felt: malfelt, sja };
}
