import { isoTidspunktTilHHMM, lokalIsoDato } from "./dato";

/* ============================================================================
 *  Ordre 2026-11-15 (17) punkt 3: målt ankomst/avreise på byggeplassen.
 *
 *  Kilde: dagens bekreftede besøk (`arbeidsdag_besok_local`, L4-A). Ankomst =
 *  første besøk på en kjent byggeplass etter Start dag. Bekreft dag viser målt
 *  ved siden av beregnet, og arbeideren velger med ett trykk (default beregnet).
 *
 *  Ingen målt avreise: `avreiseAt` settes når NESTE stopp registreres (også
 *  Slutt dag på kontoret), så den er neste stopps ankomst — ikke tidspunktet
 *  arbeideren forlot byggeplassen.
 *
 *  `kilde` er besøkets kilde rått (`gps_forslag` = «Ankommet» i S1-banneret,
 *  `manuell` = valgt i «Bytt byggeplass»). Senere kan bakgrunns-geofence
 *  levere egen kilde uten at formen endres. PSI er aldri kilde (vakt i
 *  `arbeidsdagBesok.ts`). Ren funksjon.
 * ============================================================================ */

export type MaaltTidspunkt = { tid: string; kilde: string };

export type MaaltBesok = {
  byggeplassId: string | null;
  ankomstAt: string;
  avreiseAt: string | null;
  kilde: string;
};

export function maaltAnkomst(
  besok: ReadonlyArray<MaaltBesok>,
  dato: string,
): MaaltTidspunkt | null {
  const forste = besok.find(
    (b) =>
      b.byggeplassId != null &&
      b.kilde !== "start_dag" &&
      lokalIsoDato(new Date(b.ankomstAt)) === dato,
  );
  return forste ? { tid: isoTidspunktTilHHMM(forste.ankomstAt), kilde: forste.kilde } : null;
}
