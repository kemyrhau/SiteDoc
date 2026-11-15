import { HELE_PROSJEKTET_VALG } from "@sitedoc/shared";

/**
 * ORDRE (22) 2026-11-15 — mobilens kilder til byggeplassfilteret (rene funksjoner, testet).
 *
 * `bygningMap` (SecureStore `sitedoc_bygning_per_prosjekt`) deles med timer (`kontekstByggeplassId`)
 * og røres ikke i format. Ved siden av ligger `valgtTidMap` (`sitedoc_byggeplass_valgt_tid`):
 * når valget ble gjort og hva GPS viste da — eller `auto` når D1-GPS skrev verdien (GPS lagres
 * aldri som manuelt valg).
 */
export interface ValgtTid {
  tid: number;
  gps?: string | null;
  auto?: boolean;
}

/** Sist manuelle valg for prosjektet, eller null. «Hele prosjektet»-sentinel og GPS-autovalg
 *  er ikke manuelle valg. Eldre valg uten tidsstempel teller med tid 0 (eldst). */
export function manueltValg(
  bygningMap: Record<string, string>,
  valgtTidMap: Record<string, ValgtTid>,
  prosjektId: string,
): { id: string; tid: number; gpsVedValg: string | null } | null {
  const id = bygningMap[prosjektId];
  if (!id || id === HELE_PROSJEKTET_VALG) return null;
  const meta = valgtTidMap[prosjektId];
  if (meta?.auto) return null;
  return { id, tid: meta?.tid ?? 0, gpsVedValg: meta?.gps ?? null };
}

/** Nyeste innsjekk av PSI (`minStatus`) og dagens siste timer-besøk på prosjektet. */
export function nyesteInnsjekk(
  kilder: ReadonlyArray<{ id: string | null; tid: number } | null | undefined>,
): { id: string | null; tid: number } | null {
  let best: { id: string | null; tid: number } | null = null;
  for (const k of kilder) {
    if (!k || !Number.isFinite(k.tid)) continue;
    if (!best || k.tid > best.tid) best = k;
  }
  return best;
}

/** Server-rad mot lokalt valg: nyeste vinner. Lokal uten tid (eldre) taper alltid mot server. */
export function serverVinner(lokal: ValgtTid | undefined, serverTid: number): boolean {
  if (!lokal || lokal.auto) return true;
  return serverTid >= lokal.tid;
}
