import i18next from "i18next";

/**
 * Tallvisning for timer, antall og mengde (ORDRE 2026-11-21, timeformat på dagssiden).
 *
 * Én form overalt: minst 1, høyst 2 desimaler, desimaltegn etter språket — «4,0 t», «4,5 t»,
 * «4,25 t» på norsk. Beløp vises med nøyaktig 2 desimaler. Kun visning: verdier i skjemafelt
 * og det som sendes til serveren formateres aldri med disse.
 *
 * `sprak` utelatt → aktivt i18next-språk (samme som `i18n.language` i `useTranslation`);
 * komponentene re-rendres ved språkbytte, så verdien følger med. Mangler språket eller er
 * koden ugyldig for Intl, brukes `nb`.
 */
function lokale(sprak: string | undefined): string {
  const kode = sprak ?? i18next.language;
  if (!kode) return "nb";
  try {
    Intl.NumberFormat.supportedLocalesOf([kode]);
    return kode;
  } catch {
    return "nb";
  }
}

export function formaterTimer(n: number, sprak?: string): string {
  return n.toLocaleString(lokale(sprak), { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formaterBelop(n: number, sprak?: string): string {
  return n.toLocaleString(lokale(sprak), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
