export interface FaggruppeFarge {
  bg: string;
  border: string;
  tekst: string;
  lyseBg: string;
  lyseBorder: string;
  lyseTekst: string;
}

export const FARGE_MAP: Record<string, FaggruppeFarge> = {
  blue: { bg: "bg-blue-600", border: "border-blue-700", tekst: "text-white", lyseBg: "bg-blue-50", lyseBorder: "border-blue-200", lyseTekst: "text-blue-700" },
  emerald: { bg: "bg-emerald-600", border: "border-emerald-700", tekst: "text-white", lyseBg: "bg-emerald-50", lyseBorder: "border-emerald-200", lyseTekst: "text-emerald-700" },
  purple: { bg: "bg-purple-600", border: "border-purple-700", tekst: "text-white", lyseBg: "bg-purple-50", lyseBorder: "border-purple-200", lyseTekst: "text-purple-700" },
  amber: { bg: "bg-amber-500", border: "border-amber-600", tekst: "text-white", lyseBg: "bg-amber-50", lyseBorder: "border-amber-200", lyseTekst: "text-amber-700" },
  rose: { bg: "bg-rose-600", border: "border-rose-700", tekst: "text-white", lyseBg: "bg-rose-50", lyseBorder: "border-rose-200", lyseTekst: "text-rose-700" },
  teal: { bg: "bg-teal-600", border: "border-teal-700", tekst: "text-white", lyseBg: "bg-teal-50", lyseBorder: "border-teal-200", lyseTekst: "text-teal-700" },
  indigo: { bg: "bg-indigo-600", border: "border-indigo-700", tekst: "text-white", lyseBg: "bg-indigo-50", lyseBorder: "border-indigo-200", lyseTekst: "text-indigo-700" },
  orange: { bg: "bg-orange-600", border: "border-orange-700", tekst: "text-white", lyseBg: "bg-orange-50", lyseBorder: "border-orange-200", lyseTekst: "text-orange-700" },
  cyan: { bg: "bg-cyan-600", border: "border-cyan-700", tekst: "text-white", lyseBg: "bg-cyan-50", lyseBorder: "border-cyan-200", lyseTekst: "text-cyan-700" },
  lime: { bg: "bg-lime-600", border: "border-lime-700", tekst: "text-white", lyseBg: "bg-lime-50", lyseBorder: "border-lime-200", lyseTekst: "text-lime-700" },
  fuchsia: { bg: "bg-fuchsia-600", border: "border-fuchsia-700", tekst: "text-white", lyseBg: "bg-fuchsia-50", lyseBorder: "border-fuchsia-200", lyseTekst: "text-fuchsia-700" },
  sky: { bg: "bg-sky-600", border: "border-sky-700", tekst: "text-white", lyseBg: "bg-sky-50", lyseBorder: "border-sky-200", lyseTekst: "text-sky-700" },
  violet: { bg: "bg-violet-600", border: "border-violet-700", tekst: "text-white", lyseBg: "bg-violet-50", lyseBorder: "border-violet-200", lyseTekst: "text-violet-700" },
  red: { bg: "bg-red-600", border: "border-red-700", tekst: "text-white", lyseBg: "bg-red-50", lyseBorder: "border-red-200", lyseTekst: "text-red-700" },
  green: { bg: "bg-green-600", border: "border-green-700", tekst: "text-white", lyseBg: "bg-green-50", lyseBorder: "border-green-200", lyseTekst: "text-green-700" },
  yellow: { bg: "bg-yellow-500", border: "border-yellow-600", tekst: "text-white", lyseBg: "bg-yellow-50", lyseBorder: "border-yellow-200", lyseTekst: "text-yellow-700" },
  pink: { bg: "bg-pink-600", border: "border-pink-700", tekst: "text-white", lyseBg: "bg-pink-50", lyseBorder: "border-pink-200", lyseTekst: "text-pink-700" },
  slate: { bg: "bg-slate-600", border: "border-slate-700", tekst: "text-white", lyseBg: "bg-slate-50", lyseBorder: "border-slate-200", lyseTekst: "text-slate-700" },
  zinc: { bg: "bg-zinc-600", border: "border-zinc-700", tekst: "text-white", lyseBg: "bg-zinc-50", lyseBorder: "border-zinc-200", lyseTekst: "text-zinc-700" },
  stone: { bg: "bg-stone-600", border: "border-stone-700", tekst: "text-white", lyseBg: "bg-stone-50", lyseBorder: "border-stone-200", lyseTekst: "text-stone-700" },
  "blue-800": { bg: "bg-blue-800", border: "border-blue-900", tekst: "text-white", lyseBg: "bg-blue-100", lyseBorder: "border-blue-300", lyseTekst: "text-blue-800" },
  "emerald-800": { bg: "bg-emerald-800", border: "border-emerald-900", tekst: "text-white", lyseBg: "bg-emerald-100", lyseBorder: "border-emerald-300", lyseTekst: "text-emerald-800" },
  "purple-800": { bg: "bg-purple-800", border: "border-purple-900", tekst: "text-white", lyseBg: "bg-purple-100", lyseBorder: "border-purple-300", lyseTekst: "text-purple-800" },
  "amber-700": { bg: "bg-amber-700", border: "border-amber-800", tekst: "text-white", lyseBg: "bg-amber-100", lyseBorder: "border-amber-300", lyseTekst: "text-amber-800" },
  "rose-800": { bg: "bg-rose-800", border: "border-rose-900", tekst: "text-white", lyseBg: "bg-rose-100", lyseBorder: "border-rose-300", lyseTekst: "text-rose-800" },
  "teal-800": { bg: "bg-teal-800", border: "border-teal-900", tekst: "text-white", lyseBg: "bg-teal-100", lyseBorder: "border-teal-300", lyseTekst: "text-teal-800" },
  "indigo-800": { bg: "bg-indigo-800", border: "border-indigo-900", tekst: "text-white", lyseBg: "bg-indigo-100", lyseBorder: "border-indigo-300", lyseTekst: "text-indigo-800" },
  "orange-700": { bg: "bg-orange-700", border: "border-orange-800", tekst: "text-white", lyseBg: "bg-orange-100", lyseBorder: "border-orange-300", lyseTekst: "text-orange-800" },
  "cyan-800": { bg: "bg-cyan-800", border: "border-cyan-900", tekst: "text-white", lyseBg: "bg-cyan-100", lyseBorder: "border-cyan-300", lyseTekst: "text-cyan-800" },
  "lime-700": { bg: "bg-lime-700", border: "border-lime-800", tekst: "text-white", lyseBg: "bg-lime-100", lyseBorder: "border-lime-300", lyseTekst: "text-lime-800" },
  "fuchsia-800": { bg: "bg-fuchsia-800", border: "border-fuchsia-900", tekst: "text-white", lyseBg: "bg-fuchsia-100", lyseBorder: "border-fuchsia-300", lyseTekst: "text-fuchsia-800" },
  "sky-800": { bg: "bg-sky-800", border: "border-sky-900", tekst: "text-white", lyseBg: "bg-sky-100", lyseBorder: "border-sky-300", lyseTekst: "text-sky-800" },
};

const FALLBACK_FARGE: FaggruppeFarge = FARGE_MAP["blue"]!;
const FARGE_NOKLER = Object.keys(FARGE_MAP);

export function hentFarge(indeks: number): FaggruppeFarge {
  return FARGE_MAP[FARGE_NOKLER[indeks % FARGE_NOKLER.length]!] ?? FALLBACK_FARGE;
}

export function hentFargeForFaggruppe(color: string | null | undefined, fallbackIndeks: number): FaggruppeFarge {
  if (color && FARGE_MAP[color]) return FARGE_MAP[color];
  // Fallback: bruk indeks for å plukke en farge fra rekkefølgen
  const fargeNokler = Object.keys(FARGE_MAP);
  return FARGE_MAP[fargeNokler[fallbackIndeks % fargeNokler.length]!] ?? FALLBACK_FARGE;
}

/** Velg neste ledige farge basert på eksisterende faggrupper */
export function nesteAutoFarge(eksisterendeFarger: (string | null | undefined)[]): string {
  const brukteFarger = new Set(eksisterendeFarger.filter(Boolean));
  const fargeNokler = Object.keys(FARGE_MAP);
  for (const farge of fargeNokler) {
    if (!brukteFarger.has(farge)) return farge;
  }
  // Alle farger brukt — start fra begynnelsen
  return fargeNokler[0]!;
}
