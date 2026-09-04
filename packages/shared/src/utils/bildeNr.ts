/**
 * Løpende bildenummer per dokument (sjekkliste / oppgave / HMS) — Kenneth-vedtak
 * 2026-08-16 (`docs/redesign/arkivpdf-seks-funn-vedtak-fabel-2026-08-16.md`, funn 1).
 *
 * Nummeret tildeles i appen NÅR bildet tas, løpende stigende per dokument på tvers av
 * alle felt OG repeater-rader — slik at feltarbeideren kan referere «se bilde 07» i
 * teksten mens hen står der. Dokgen (`packages/pdf`) leser `Vedlegg.bildeNr` og faller
 * tilbake til dokumentrekkefølge kun når feltet mangler (arkiverte dokumenter).
 *
 * Delt av alle fire skjema-hooks (mobil + web × sjekkliste + oppgave) — samme kilde,
 * ikke kopiert per hook (hooks/CLAUDE.md § «Deler logikk skal ligge i @sitedoc/shared»).
 */

// Repeater-rad-traversering: kanonisk kilde i `repeaterRad.ts` (feltKartFraRad).
// Ikke lag en lokal kopi — det var nettopp den duplikasjonen som ga tre bugs.
import { feltKartFraRad } from "./repeaterRad";

interface VedleggLite {
  type?: string;
  bildeNr?: number;
}

interface FeltVerdiLite {
  verdi?: unknown;
  vedlegg?: VedleggLite[];
}

/** Besøk alle bilde-vedlegg i ett dokument (topp-nivå-felt + repeater-rader). */
function forHvertBilde(
  feltVerdier: Record<string, FeltVerdiLite | undefined>,
  besok: (v: VedleggLite) => void,
): void {
  const tellListe = (vedlegg?: VedleggLite[]) => {
    if (!Array.isArray(vedlegg)) return;
    for (const v of vedlegg) {
      if (v && v.type === "bilde") besok(v);
    }
  };
  for (const felt of Object.values(feltVerdier)) {
    if (!felt) continue;
    tellListe(felt.vedlegg);
    // Repeater: verdi er en array av rader. Produksjonsformen er
    // `{ _radId, felter: { barnId -> { vedlegg } } }` (RepeaterObjekt.normaliserRad);
    // eldre/rå rader er flate `{ barnId -> { vedlegg } }`. Pakk ut `felter` når den
    // finnes, ellers behandle raden selv som felt-kartet.
    if (Array.isArray(felt.verdi)) {
      for (const rad of felt.verdi) {
        if (!rad || typeof rad !== "object") continue;
        for (const barn of Object.values(feltKartFraRad(rad))) {
          if (barn && typeof barn === "object") {
            tellListe((barn as FeltVerdiLite).vedlegg);
          }
        }
      }
    }
  }
}

/**
 * Neste ledige bildenummer for dokumentet. `max(høyeste tildelte nr, antall bilder) + 1`
 * — monotont stigende og kollisjonsfritt selv om noen eldre bilder mangler nummer.
 */
export function nesteBildeNr(
  feltVerdier: Record<string, FeltVerdiLite | undefined>,
): number {
  let maks = 0;
  let antall = 0;
  forHvertBilde(feltVerdier, (v) => {
    antall += 1;
    if (typeof v.bildeNr === "number" && v.bildeNr > maks) maks = v.bildeNr;
  });
  return Math.max(maks, antall) + 1;
}

/**
 * Tildel løpende bildeNr til bilde-vedlegg i repeater-rader som mangler det, med start
 * på `startNr`. Immutabel: returnerer SAMME referanse hvis ingenting mangler nummer
 * (unngår unødvendig state-churn ved f.eks. tekstredigering i en rad), ellers nye
 * rad-/felt-/vedlegg-objekter kun der et nummer ble satt.
 */
export function nummererRepeaterBilder<T>(rader: T, startNr: number): T {
  if (!Array.isArray(rader)) return rader;

  let neste = startNr;
  let noeEndret = false;

  const nyeRader = rader.map((rad) => {
    if (!rad || typeof rad !== "object") return rad;
    const raaRad = rad as Record<string, unknown>;
    // Produksjon: felt-kartet ligger under `felter`; eldre/rå rader er flate.
    // Skriv tilbake i samme form (bevar `_radId` + `felter`-wrapperen).
    const harFelter = raaRad.felter != null && typeof raaRad.felter === "object";
    let radEndret = false;
    const nyttKart: Record<string, unknown> = { ...feltKartFraRad(raaRad) };

    for (const feltId of Object.keys(nyttKart)) {
      const felt = nyttKart[feltId] as FeltVerdiLite | undefined;
      if (!felt || !Array.isArray(felt.vedlegg)) continue;
      const manglerNr = felt.vedlegg.some(
        (v) => v && v.type === "bilde" && v.bildeNr == null,
      );
      if (!manglerNr) continue;

      radEndret = true;
      noeEndret = true;
      nyttKart[feltId] = {
        ...felt,
        vedlegg: felt.vedlegg.map((v) =>
          v && v.type === "bilde" && v.bildeNr == null
            ? { ...v, bildeNr: neste++ }
            : v,
        ),
      };
    }

    if (!radEndret) return rad;
    return harFelter ? { ...raaRad, felter: nyttKart } : nyttKart;
  });

  return (noeEndret ? nyeRader : rader) as T;
}

/**
 * Append ETT vedlegg til `rader[radIndeks].felter[feltId].vedlegg`, immutabelt.
 * Ren transform — INGEN nummerering (kall `nummererRepeaterBilder` etterpå), ingen
 * side-effekt. Håndterer produksjonsformen `{ _radId, felter }` og eldre/flat rad,
 * og skriver tilbake i samme form.
 *
 * Skilt ut fra `RepeaterObjekt.leggTilVedlegg` (mobil) NETTOPP fordi batch-veien
 * ikke kunne testes der den lå — transformen hører hjemme her, ved siden av
 * nummereringen som forbruker den. Race-friheten ligger i KALLEREN: bruk denne
 * inne i en funksjonell state-oppdatering (mot forrige, nummererte rader), ikke
 * mot et render-snapshot — ellers taper sekvensiell batch alt utenom siste.
 */
export function leggTilVedleggIRad<T>(
  rader: T,
  radIndeks: number,
  feltId: string,
  vedlegg: unknown,
): T {
  if (!Array.isArray(rader)) return rader;
  return rader.map((rad, i) => {
    if (i !== radIndeks || !rad || typeof rad !== "object") return rad;
    const raaRad = rad as Record<string, unknown>;
    const harFelter = raaRad.felter != null && typeof raaRad.felter === "object";
    const kilde = feltKartFraRad(raaRad);
    const eks = (kilde[feltId] as { vedlegg?: unknown[] } | undefined) ?? {};
    const nyttKart = {
      ...kilde,
      [feltId]: { ...eks, vedlegg: [...(eks.vedlegg ?? []), vedlegg] },
    };
    return (harFelter ? { ...raaRad, felter: nyttKart } : nyttKart) as unknown;
  }) as T;
}
