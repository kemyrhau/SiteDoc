/**
 * Overflate-orkestrator: rå LAS-punktsky → lagbar TIN.
 *
 * Binder sammen steg 1 A→B→C:
 *   A lasPunkter      — les X/Y/Z metrisk (scale+offset)
 *   B bakkeOverflate  — desimér til rutenett, klasse2/minZ bakketilnærming
 *   C triangulering   — Delaunay på server
 * og setter ramme (§ F) fra coordinateSystem (provisorisk las-utm i steg 1).
 *
 * Selve lagringen (binærfil + Overflate-rad) gjøres av overflate-routeren.
 */

import { lesLasPunktHeaderFraFil, forHverLasPunkt } from "./lasPunkter";
import { nyBakkeAkkumulator, type BakkeMetode } from "./bakkeOverflate";
import { triangulerRutepunkter } from "./triangulering";
import { utledRammeForPunktsky } from "./overflateRamme";
import type { TinData } from "./tinFil";

export interface PunktskyOverflateResultat {
  tin: TinData;
  bakkeMetode: BakkeMetode;
  malavstandM: number;
  punktAntall: number;
  ramme: string;
}

export interface ByggOverflateOpts {
  harKlassifisering: boolean;
  coordinateSystem: string | null | undefined;
  malavstandM?: number;
}

export async function byggOverflateFraLas(
  lasSti: string,
  opts: ByggOverflateOpts,
): Promise<PunktskyOverflateResultat> {
  const header = await lesLasPunktHeaderFraFil(lasSti);

  const akk = nyBakkeAkkumulator({
    harKlassifisering: opts.harKlassifisering,
    malavstandM: opts.malavstandM,
  });
  await forHverLasPunkt(lasSti, header, (p) => akk.leggTil(p));
  const bakke = akk.ferdig();

  if (bakke.rutepunkter.length < 3) {
    throw new Error(
      "For få bakkepunkter til å lage en overflate (trenger minst 3 ruter). " +
        "Sjekk klassifisering eller øk malavstanden.",
    );
  }

  const tin = triangulerRutepunkter(bakke.rutepunkter);

  return {
    tin,
    bakkeMetode: bakke.bakkeMetode,
    malavstandM: bakke.malavstandM,
    punktAntall: bakke.punktAntall,
    ramme: utledRammeForPunktsky(opts.coordinateSystem),
  };
}
