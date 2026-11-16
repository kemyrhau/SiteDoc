import { hhmmTilMin, minTilHhmm, utledKortId } from "@sitedoc/shared";
import type {
  DagsforslagDag,
  DagsforslagEksisterendeSedel,
  DagsforslagKortDeling,
  DagsforslagRad,
  DagsforslagRetting,
} from "./dagsforslag";

/* ============================================================================
 *  Ordre c — kort-id i Bekreft dag (prosjektkort-kortid-spec § 5.1, § 9 T10).
 *
 *  `tildelKortIder` (ren) gir hver arbeidsrad i forslaget sitt kort:
 *   1. Grunnkortet: kortet som alt finnes på sedelen med samme prosjekt og
 *      effektive byggeplass (eldste først) — ellers utledet id (`utledKortId`,
 *      underprosjekt «ingen»). Samme id ved hver omregning, så utkastet og
 *      skjermen holder kortene stabile. Reise får aldri kort (§ 2.2).
 *      «+ Nytt prosjektkort» (`nyttKort`): alltid ny id, aldri et eksisterende kort.
 *   2. «Del til eget kort» (`retting.kortDeling`), i rekkefølge: radene i
 *      `fraKortId` fra og med klokkeslettet går til det nye kortet. En rad som
 *      krysser klokkeslettet deles i to. Normaltid/overtid er alt regnet over
 *      dagen i tidsrekkefølge, så overtidslinja havner i kortet der normen
 *      passeres uten ny utregning — delingen flytter bare tid mellom kort.
 *
 *  Nye deler får `radIndeks` = 10 000 × (delingens nr + 1) + radens indeks, så
 *  maskin/varer (nøklet på `radIndeks`, `radTilleggNokkel`) blir i kortet de
 *  ble ført på. Forsvinner delingen, gir linjene `tilleggUtenRad`-stopp som før.
 * ============================================================================ */

const RADINDEKS_STEG = 10_000;

type TildelArgs = {
  userId: string | undefined;
  eksisterendeSedelPerDato: Record<string, DagsforslagEksisterendeSedel>;
  kortDeling: readonly DagsforslagKortDeling[];
  /** «+ Nytt prosjektkort» (`retting.nyttKort`): frø for kortets nye id. Utelatt = grunnkort som før. */
  nyttKort?: string;
};

function grunnKortId(
  rad: DagsforslagRad,
  d: DagsforslagDag,
  userId: string,
  eksisterende: DagsforslagEksisterendeSedel | undefined,
  nyttKort: string | undefined,
): string {
  const byggeplassId = rad.byggeplassId ?? d.byggeplassId ?? null;
  // T12 (spec § 5.2, § 7 rad «+ Nytt prosjektkort»): et nytt kort slås aldri
  // sammen med et kort som alt står på sedelen — også med lik nøkkel. Id-en er
  // utledet fra frøet, så den er stabil ved omregning og ny for sedelen.
  if (nyttKort) {
    return utledKortId({ userId: `${userId}|nytt|${nyttKort}`, dato: d.dato, nokkel: { projectId: rad.projectId, byggeplassId, ecoId: null } });
  }
  const finnes = eksisterende?.kort?.find((k) => k.projectId === rad.projectId && k.byggeplassId === byggeplassId);
  if (finnes) return finnes.kortId;
  return utledKortId({ userId, dato: d.dato, nokkel: { projectId: rad.projectId, byggeplassId, ecoId: null } });
}

/** Minutter fra midnatt; slutt ≤ start = over midnatt. null = raden har ikke tider. */
function spenn(rad: DagsforslagRad): { fra: number; til: number } | null {
  if (!rad.fraTid || !rad.tilTid) return null;
  const fra = hhmmTilMin(rad.fraTid);
  let til = hhmmTilMin(rad.tilTid);
  if (til <= fra) til += 24 * 60;
  return { fra, til };
}

/** Deler én rad ved `kl` (minutter). Timene summerer som før; pausen står i delen som rommer den. */
function delRad(rad: DagsforslagRad, kl: number, s: { fra: number; til: number }): [DagsforslagRad, DagsforslagRad] {
  const min1 = kl - s.fra;
  const min2 = s.til - kl;
  const pause = rad.pauseMin ?? 0;
  const pauseIForste = min1 > pause || min2 <= pause;
  const t1 = Math.round(((min1 - (pauseIForste ? pause : 0)) / 60) * 100) / 100;
  const klokke = minTilHhmm(kl % (24 * 60));
  return [
    { ...rad, tilTid: klokke, pauseMin: pauseIForste ? pause : 0, timer: Math.max(0, t1) },
    { ...rad, fraTid: klokke, pauseMin: pauseIForste ? 0 : pause, timer: Math.max(0, Math.round((rad.timer - t1) * 100) / 100) },
  ];
}

function anvendDeling(rader: DagsforslagRad[], deling: DagsforslagKortDeling, nr: number): DagsforslagRad[] {
  const kl = hhmmTilMin(deling.fra);
  const ut: DagsforslagRad[] = [];
  const nyIndeks = (r: DagsforslagRad) =>
    r.radIndeks == null ? undefined : RADINDEKS_STEG * (nr + 1) + (r.radIndeks % RADINDEKS_STEG);
  const tilNytt = (r: DagsforslagRad): DagsforslagRad => ({ ...r, kortId: deling.kortId, egetKort: true });
  for (const r of rader) {
    const s = r.erReise || r.kortId !== deling.fraKortId ? null : spenn(r);
    if (!s) {
      ut.push(r);
      continue;
    }
    // Klokkeslett før midnatt på en rad som krysser midnatt: regn det på døgn 2.
    const k = kl < s.fra && kl + 24 * 60 < s.til ? kl + 24 * 60 : kl;
    if (k <= s.fra) {
      // Hele raden ligger etter delingen. Beholder radIndeks: maskin/varer følger raden.
      ut.push(tilNytt(r));
    } else if (k < s.til) {
      const [foer, etter] = delRad(r, k, s);
      ut.push(foer, { ...tilNytt(etter), radIndeks: nyIndeks(r) });
    } else {
      ut.push(r);
    }
  }
  return ut;
}

export function tildelKortIder(datoer: DagsforslagDag[], args: TildelArgs): DagsforslagDag[] {
  const userId = args.userId;
  if (!userId) return datoer;
  return datoer.map((d) => {
    const eksisterende = args.eksisterendeSedelPerDato[d.dato];
    let rader = d.rader.map((r) =>
      r.erReise ? r : { ...r, kortId: grunnKortId(r, d, userId, eksisterende, args.nyttKort) },
    );
    args.kortDeling.forEach((deling, nr) => {
      if (deling.dato === d.dato) rader = anvendDeling(rader, deling, nr);
    });
    return { ...d, rader };
  });
}

/** Ordre c: «Del til eget kort» — legger delingen til i rettingen med ny kort-id. */
export function delTilEgetKort(
  retting: DagsforslagRetting,
  deling: Omit<DagsforslagKortDeling, "kortId">,
  nyId: () => string,
): DagsforslagRetting {
  return { ...retting, kortDeling: [...(retting.kortDeling ?? []), { ...deling, kortId: nyId() }] };
}

/** Ordre c: angrer en deling — kortet og delinger av det slås sammen med kortet det kom fra. */
export function angreKortDeling(retting: DagsforslagRetting, kortId: string): DagsforslagRetting {
  const fjern = new Set<string>([kortId]);
  let endret = true;
  while (endret) {
    endret = false;
    for (const d of retting.kortDeling ?? []) {
      if (fjern.has(d.fraKortId) && !fjern.has(d.kortId)) {
        fjern.add(d.kortId);
        endret = true;
      }
    }
  }
  return { ...retting, kortDeling: (retting.kortDeling ?? []).filter((d) => !fjern.has(d.kortId)) };
}

/**
 * Ordre c: tidsrommet et kort kan deles i — første fra-tid til siste til-tid
 * blant kortets rader med tider, innskrenket ett steg i hver ende (ingen tom
 * del). `null` = kortet er for kort til å deles, eller har ikke tider.
 */
export function delingsVindu(
  rader: ReadonlyArray<Pick<DagsforslagRad, "fraTid" | "tilTid" | "erReise">>,
  tidsrundingMinutter: number | null,
): { fra: string; til: string; forslag: string } | null {
  const steg = tidsrundingMinutter && tidsrundingMinutter > 0 ? tidsrundingMinutter : 15;
  let fra = Infinity;
  let til = -Infinity;
  for (const r of rader) {
    if (r.erReise) continue;
    const s = spenn(r as DagsforslagRad);
    if (!s) continue;
    fra = Math.min(fra, s.fra);
    til = Math.max(til, s.til);
  }
  if (!Number.isFinite(fra) || til - fra < 2 * steg) return null;
  // Over midnatt: delingen gjelder datoens kort, som slutter ved midnatt.
  const tilKap = Math.min(til, 24 * 60);
  const lav = fra + steg;
  const hoy = tilKap - steg;
  if (hoy < lav) return null;
  const midt = Math.round((fra + tilKap) / 2 / steg) * steg;
  const forslag = Math.min(hoy, Math.max(lav, midt));
  return { fra: minTilHhmm(lav), til: minTilHhmm(hoy), forslag: minTilHhmm(forslag) };
}
