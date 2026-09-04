/**
 * KANONISK TVILLING av `@sitedoc/shared/utils/repeaterRad.ts` (`feltKartFraRad`).
 *
 * `@sitedoc/pdf` er en NULL-runtime-avhengighet-pakke (se packages/pdf/CLAUDE.md) —
 * den lastes inn i pdf-render-containeren og av `expo-print` uten avhengighetsgraf,
 * og kan derfor ikke importere `@sitedoc/shared`. Denne tvillingen er avgrenset av
 * dep-regelen — tilsiktet, IKKE «en fjerde lokal utpakking». Rører du den ene, hold
 * dem like (samme mønster som `tegningsfelt.ts` ↔ `tegningsmarkor.ts`).
 *
 * En repeater-rad lagres som `{ _radId, felter: { feltId: FeltVerdi } }` (rad-id-
 * vedtak 2026-08-22). Eldre/rå rader er flate `{ feltId: FeltVerdi }`. Kode som
 * itererer `Object.keys(rad)` på produksjonsformen ser bare `_radId` (en streng) +
 * `felter` (en wrapper uten felt-innhold) → finner ingen felt, og feiler stille på
 * nettopp repeater-rader. I endringsloggen var symptomet «Rad N — Kolonne 2 til
 * «Ikke utfylt»»: `felter`-nøkkelen matchet ingen kolonne (→ posisjon) og hele
 * `felter`-objektet ble sendt til celle-diffen som ikke forsto det (→ tom verdi).
 */

/**
 * Felt-kartet i en repeater-rad: `felter`-objektet når raden har det (produksjons-
 * formen `{ _radId, felter }`), ellers raden selv (eldre/rå flat form). `_radId`
 * (streng) blir aldri behandlet som et felt, fordi vi kun leser `felter` når den finnes.
 */
export function feltKartFraRad(rad: unknown): Record<string, unknown> {
  const r = rad as Record<string, unknown> | null | undefined;
  const felter = r?.felter;
  return felter && typeof felter === "object"
    ? (felter as Record<string, unknown>)
    : ((r ?? {}) as Record<string, unknown>);
}
