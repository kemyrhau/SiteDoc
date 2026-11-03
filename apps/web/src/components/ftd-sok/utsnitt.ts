/**
 * Utsnitt til venstre i dokumentsøket (SØK-1 S2/S5). Logikken bor i `@sitedoc/shared` (sok/utsnitt.ts) så
 * mobilsøket viser samme utsnitt; her ligger kun webs Tailwind-stil for semantisk markering.
 */
export {
  HL_START,
  HL_STOP,
  ELLIPSE,
  søkeTermer,
  markerTermer,
  fjernOverskrift,
  byggUtsnitt,
  posisjonsEtikett,
  type UtsnittDelType,
  type UtsnittDel,
  type UtsnittInput,
} from "@sitedoc/shared";

/** Felles stil for semantisk markering (S5) — skal ikke forveksles med gult ordtreff. */
export const SEMANTISK_KLASSE =
  "rounded bg-purple-50 underline decoration-purple-500 decoration-dotted decoration-2 underline-offset-2";
