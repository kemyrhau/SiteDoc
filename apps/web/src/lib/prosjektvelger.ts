/**
 * Prosjektvelgeren i toppbaren (KontekstChip). Rene funksjoner — testet uten React.
 */

/**
 * Er prosjektraden den valgte? (POST 2026-11-15 (16), punkt 1)
 *
 * Raden for prosjektet knappen viser (`valgtProsjekt`) er markert uansett side og i begge
 * grupper (hovedlista og «Prosjekter i andre firma»). Tidligere krevde markeringen
 * `prosjektScope === "enkelt"`, som bare gjelder når URL-en har prosjekt-ID — på firmasider
 * var ingen rad markert selv om knappen viste prosjektnavnet.
 */
export function erProsjektRadValgt(
  radId: string,
  valgtProsjektId: string | null | undefined,
): boolean {
  return !!valgtProsjektId && radId === valgtProsjektId;
}
