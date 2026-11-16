import { arbeidsraderPerKort, type BeskrivelseRad } from "./beskrivelseKort";
import type { BekreftDagTillegg, TilleggMaskin, TilleggPerRad } from "./bekreftDagTillegg";
import type { Dagsforslag } from "./dagsforslag";

/**
 * ORDRE 24 (Kenneth 2026-11-16): «jeg trenger kun en av disse per
 * prosjektkort» — ETT sett «+ Maskin / + Varer» pr. prosjektkort i Bekreft
 * dag, også når overtid deler kortet i flere arbeidsrader.
 *
 * Skjermen holder kortets sett under kortets første arbeidsrads
 * `tilleggNokkel` (samme `TilleggPerRad` som før, så utkast og
 * `tilleggUtenRad`-stoppen virker uendret). Ved lagring fordeler
 * `fordelTilleggPaaKort` linjene på radene:
 *  - varer → første arbeidsrad (`sheetTimerId`);
 *  - maskin → første arbeidsrad opp til radens timer, resten på neste rad
 *    (fyll i radrekkefølge, kapasitet pr. kjøretøy og rad), så regelen
 *    maskin ≤ radens timer (`maskinerOverRaden`) holder på hver rad.
 */

const EPS = 1e-6;
const TOM: BekreftDagTillegg = { maskiner: [], varer: [] };

type KortRad = Pick<BeskrivelseRad, "tilleggNokkel" | "timer">;

/** Radene på kortet som kan bære maskin/varer (har tilleggsnøkkel). */
function raderMedNokkel<T extends KortRad>(rader: readonly T[]): (T & { tilleggNokkel: string })[] {
  return rader.filter((r): r is T & { tilleggNokkel: string } => r.tilleggNokkel != null);
}

/** Kortets sett: linjene fra alle kortets radnøkler (et gammelt utkast kan ha linjer på flere rader). */
export function tilleggPaaKort(perRad: TilleggPerRad, rader: readonly KortRad[]): BekreftDagTillegg {
  const nokler = raderMedNokkel(rader).map((r) => r.tilleggNokkel);
  if (nokler.length === 0) return TOM;
  return {
    maskiner: nokler.flatMap((n) => perRad[n]?.maskiner ?? []),
    varer: nokler.flatMap((n) => perRad[n]?.varer ?? []),
  };
}

/** Skriver kortets sett på første rads nøkkel og fjerner kortets øvrige radnøkler. */
export function settTilleggPaaKort(
  perRad: TilleggPerRad,
  rader: readonly KortRad[],
  neste: BekreftDagTillegg,
): TilleggPerRad {
  const nokler = raderMedNokkel(rader).map((r) => r.tilleggNokkel);
  const forste = nokler[0];
  if (!forste) return perRad;
  const ny = { ...perRad };
  for (const n of nokler) delete ny[n];
  if (neste.maskiner.length > 0 || neste.varer.length > 0) ny[forste] = neste;
  return ny;
}

/** Sum arbeidstimer på kortet — UI-vakten: maskin ≤ kortets timer. */
export function kortArbeidstimer(rader: readonly KortRad[]): number {
  return rader.reduce((s, r) => s + r.timer, 0);
}

const rund = (t: number) => Math.round(t * 100) / 100;

/**
 * Én maskin fordelt på radene: fyll første rad, resten videre. Siste rad tar
 * resten. `brukt` er timene samme kjøretøy (vehicleId) allerede har fått pr.
 * rad på kortet — V1 (GATE 50): to linjer med samme maskin fyller ikke begge
 * første rad fra null.
 */
function fordelMaskin(
  m: TilleggMaskin,
  rader: readonly { tilleggNokkel: string; timer: number }[],
  brukt: Map<string, number>,
): Array<{ nokkel: string; maskin: TilleggMaskin }> {
  if (!(m.timer > EPS)) return [{ nokkel: rader[0]!.tilleggNokkel, maskin: m }];
  const ut: Array<{ nokkel: string; maskin: TilleggMaskin }> = [];
  let rest = m.timer;
  for (let i = 0; i < rader.length && rest > EPS; i++) {
    const r = rader[i]!;
    const siste = i === rader.length - 1;
    const bruktNokkel = `${m.vehicleId}|${r.tilleggNokkel}`;
    const ledig = Math.max(0, r.timer - (brukt.get(bruktNokkel) ?? 0));
    const del = siste ? rest : Math.min(rest, ledig);
    if (!(del > EPS)) continue;
    brukt.set(bruktNokkel, (brukt.get(bruktNokkel) ?? 0) + del);
    ut.push({
      nokkel: r.tilleggNokkel,
      maskin: { ...m, lokalId: ut.length === 0 ? m.lokalId : `${m.lokalId}#${ut.length + 1}`, timer: rund(del) },
    });
    rest -= del;
  }
  return ut;
}

/**
 * Lagring: kortets sett (uansett hvilken av kortets radnøkler linjene står
 * under) fordeles på kortets arbeidsrader. Kortet er dato-bundet (RETUR 24,
 * `arbeidsraderPerKort`), så fordelingen krysser aldri midnatt — ingen
 * automatisk flytting mellom kort. Nøkler som ikke hører til noe kort
 * røres ikke — `tilleggUtenRad` stopper fortsatt på dem.
 */
export function fordelTilleggPaaKort(forslag: Dagsforslag, perRad: TilleggPerRad): TilleggPerRad {
  const ut: TilleggPerRad = { ...perRad };
  for (const rader of arbeidsraderPerKort(forslag).values()) {
    const medNokkel = raderMedNokkel(rader);
    if (medNokkel.length === 0) continue;
    const samlet = tilleggPaaKort(perRad, medNokkel);
    for (const r of medNokkel) delete ut[r.tilleggNokkel];
    if (samlet.maskiner.length === 0 && samlet.varer.length === 0) continue;
    const hent = (n: string) => (ut[n] ??= { maskiner: [], varer: [] });
    if (samlet.varer.length > 0) hent(medNokkel[0]!.tilleggNokkel).varer.push(...samlet.varer);
    const brukt = new Map<string, number>();
    for (const m of samlet.maskiner) {
      for (const d of fordelMaskin(m, medNokkel, brukt)) hent(d.nokkel).maskiner.push(d.maskin);
    }
  }
  return ut;
}
