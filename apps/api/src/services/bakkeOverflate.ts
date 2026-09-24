/**
 * Bakkeoverflate fra punktsky — rutenett-desimering, IKKE «hvert n-te punkt»
 *
 * 🔴 Dette er punktet som avgjør om volumtallet kan forsvares.
 *
 * Den gamle `subsample` (apps/web/src/lib/punktsky-triangulering.ts) tar hvert
 * n-te punkt. På et terrengskann beholder den vegetasjon, gjerder og
 * gravemaskiner — en gravemaskin midt i feltet blir da til fyllmasse.
 *
 * Her desimerer vi til et RUTENETT i XY og velger laveste Z pr. rute:
 *   - Er skya klassifisert (ASPRS): bruk KUN klasse 2 «Bakke».   → bakkeMetode="klasse2"
 *   - Ellers: laveste Z pr. rute (grov, dokumentert bakketilnærming). → bakkeMetode="minZ"
 *
 * `bakkeMetode` skrives i retur-metadata: leseren skal kunne se om overflaten
 * er klassifisert bakke eller min-Z — de er ikke like mye verdt som dokumentasjon.
 */

export type BakkeMetode = "klasse2" | "minZ";

/** ASPRS klassifiseringskode for bakke */
const KLASSE_BAKKE = 2;

/** Kenneths ønskede oppløsning: 10–20 cm. Default midt i intervallet. */
export const DEFAULT_MALAVSTAND_M = 0.15;

export interface Rutepunkt {
  x: number;
  y: number;
  z: number;
}

export interface BakkerutenettResultat {
  /** Ett punkt pr. rute (laveste Z), i faktiske koordinater */
  rutepunkter: Rutepunkt[];
  /** Hvilken bakketilnærming som ble brukt — dokumentasjonsverdi */
  bakkeMetode: BakkeMetode;
  /** Rutestørrelsen desimeringen ble kjørt med (m) */
  malavstandM: number;
  /** Antall punkter etter desimering (= antall ruter med data) */
  punktAntall: number;
}

interface Celle {
  x: number;
  y: number;
  z: number;
}

export interface ByggBakkerutenettOpts {
  malavstandM?: number;
  /** Fra lasInfo.harKlassifisering — styrer klasse2 vs minZ */
  harKlassifisering: boolean;
}

/**
 * Bygg bakkerutenett fra en strøm av dekodede punkter.
 *
 * Tar `Iterable` slik at kalleren kan mate inn både en materialisert liste
 * (test) og en streaming-kilde. For streaming fra fil: samle inn via
 * `forHverLasPunkt` til en akkumulator, eller bruk `nyBakkeAkkumulator`.
 */
export function byggBakkerutenett(
  punkter: Iterable<{ x: number; y: number; z: number; klasse: number }>,
  opts: ByggBakkerutenettOpts,
): BakkerutenettResultat {
  const akk = nyBakkeAkkumulator(opts);
  for (const p of punkter) akk.leggTil(p);
  return akk.ferdig();
}

/**
 * Streaming-akkumulator: hold kun ett punkt pr. rute i minnet uansett hvor
 * mange millioner punkter skya har. Brukes med `forHverLasPunkt`.
 */
export function nyBakkeAkkumulator(opts: ByggBakkerutenettOpts) {
  const malavstandM = opts.malavstandM ?? DEFAULT_MALAVSTAND_M;
  if (!(malavstandM > 0)) {
    throw new Error(`malavstandM må være > 0 (fikk ${malavstandM})`);
  }
  const bakkeMetode: BakkeMetode = opts.harKlassifisering ? "klasse2" : "minZ";
  const brukKunKlasse2 = opts.harKlassifisering;

  const ruter = new Map<string, Celle>();

  function leggTil(p: { x: number; y: number; z: number; klasse: number }) {
    if (brukKunKlasse2 && p.klasse !== KLASSE_BAKKE) return;

    const gx = Math.floor(p.x / malavstandM);
    const gy = Math.floor(p.y / malavstandM);
    const nøkkel = `${gx}:${gy}`;

    const eksisterende = ruter.get(nøkkel);
    // Laveste Z pr. rute — behold det faktiske punktet, ikke rutesenteret
    if (eksisterende === undefined || p.z < eksisterende.z) {
      ruter.set(nøkkel, { x: p.x, y: p.y, z: p.z });
    }
  }

  function ferdig(): BakkerutenettResultat {
    const rutepunkter: Rutepunkt[] = Array.from(ruter.values());
    return {
      rutepunkter,
      bakkeMetode,
      malavstandM,
      punktAntall: rutepunkter.length,
    };
  }

  return { leggTil, ferdig };
}
