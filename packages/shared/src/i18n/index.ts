import nb from "./nb.json";

export { nb };

export const STOETTEDE_SPRAAK = [
  { kode: "nb", navn: "Norsk bokmål", flagg: "🇳🇴" },
  { kode: "en", navn: "English", flagg: "🇬🇧" },
  { kode: "sv", navn: "Svenska", flagg: "🇸🇪" },
  { kode: "lt", navn: "Lietuvių", flagg: "🇱🇹" },
  { kode: "pl", navn: "Polski", flagg: "🇵🇱" },
  { kode: "uk", navn: "Українська", flagg: "🇺🇦" },
  { kode: "ro", navn: "Română", flagg: "🇷🇴" },
  { kode: "et", navn: "Eesti", flagg: "🇪🇪" },
  { kode: "fi", navn: "Suomi", flagg: "🇫🇮" },
  { kode: "cs", navn: "Čeština", flagg: "🇨🇿" },
  { kode: "de", navn: "Deutsch", flagg: "🇩🇪" },
  { kode: "ru", navn: "Русский", flagg: "🇷🇺" },
  { kode: "lv", navn: "Latviešu", flagg: "🇱🇻" },
] as const;

export type SpraakKode = (typeof STOETTEDE_SPRAAK)[number]["kode"];

export const STANDARD_SPRAAK: SpraakKode = "nb";

export const SPRAAK_KODER: SpraakKode[] = STOETTEDE_SPRAAK.map((s) => s.kode);
