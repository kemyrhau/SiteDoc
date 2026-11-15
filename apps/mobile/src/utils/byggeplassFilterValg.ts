import { rensLagretByggeplassValg } from "@sitedoc/shared";

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

/** Sist manuelle valg for prosjektet, eller null. Utgått streng-verdi fra før (22) og GPS-autovalg
 *  er ikke manuelle valg. Eldre valg uten tidsstempel teller med tid 0 (eldst). */
export function manueltValg(
  bygningMap: Record<string, string>,
  valgtTidMap: Record<string, ValgtTid>,
  prosjektId: string,
): { id: string; tid: number; gpsVedValg: string | null } | null {
  const id = rensLagretByggeplassValg(bygningMap[prosjektId]);
  if (!id) return null;
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

/** GATE (49) V1: PSI-modulen er aktiv på prosjektet. `ProjectModule` har `status`
 *  (`aktiv|arkivert|slettet`), ikke `active` — samme regel som web `byggeplass-kontekst.tsx`. */
export function psiModulAktiv(
  moduler: ReadonlyArray<{ moduleSlug: string; status?: string | null }> | null | undefined,
): boolean {
  return !!moduler?.some((m) => m.moduleSlug === "psi" && m.status === "aktiv");
}

/**
 * GATE (49) V2: server-raden `sistBruktByggeplass` flettes inn ved kaldstart.
 * Returnerer metadata som skal lagres for prosjektet, eller null når det lokale valget står.
 * Er serverens id den samme som det lokale valget, er det samme valg speilet opp — da beholdes
 * de lokale metadataene (`tid`, `gps` ved valget). Ellers ville `gps` forsvinne, og et bevisst
 * valg av B mens GPS viste A ble overstyrt av A etter neste omstart.
 */
export function flettServerValg(
  lokalId: string | undefined,
  lokal: ValgtTid | undefined,
  serverId: string,
  serverTid: number,
): ValgtTid | null {
  if (!serverVinner(lokal, serverTid)) return null;
  if (lokal && !lokal.auto && rensLagretByggeplassValg(lokalId) === serverId) return lokal;
  return { tid: serverTid };
}
