export interface EntrepriseFarge {
  bg: string;
  border: string;
  tekst: string;
  lyseBg: string;
  lyseBorder: string;
  lyseTekst: string;
}

export const entrepriseFarger: EntrepriseFarge[] = [
  { bg: "bg-blue-600", border: "border-blue-700", tekst: "text-white", lyseBg: "bg-blue-50", lyseBorder: "border-blue-200", lyseTekst: "text-blue-700" },
  { bg: "bg-emerald-600", border: "border-emerald-700", tekst: "text-white", lyseBg: "bg-emerald-50", lyseBorder: "border-emerald-200", lyseTekst: "text-emerald-700" },
  { bg: "bg-purple-600", border: "border-purple-700", tekst: "text-white", lyseBg: "bg-purple-50", lyseBorder: "border-purple-200", lyseTekst: "text-purple-700" },
  { bg: "bg-amber-500", border: "border-amber-600", tekst: "text-white", lyseBg: "bg-amber-50", lyseBorder: "border-amber-200", lyseTekst: "text-amber-700" },
  { bg: "bg-rose-600", border: "border-rose-700", tekst: "text-white", lyseBg: "bg-rose-50", lyseBorder: "border-rose-200", lyseTekst: "text-rose-700" },
  { bg: "bg-teal-600", border: "border-teal-700", tekst: "text-white", lyseBg: "bg-teal-50", lyseBorder: "border-teal-200", lyseTekst: "text-teal-700" },
  { bg: "bg-indigo-600", border: "border-indigo-700", tekst: "text-white", lyseBg: "bg-indigo-50", lyseBorder: "border-indigo-200", lyseTekst: "text-indigo-700" },
  { bg: "bg-orange-600", border: "border-orange-700", tekst: "text-white", lyseBg: "bg-orange-50", lyseBorder: "border-orange-200", lyseTekst: "text-orange-700" },
];

export const FARGE_MAP: Record<string, EntrepriseFarge> = {
  blue: entrepriseFarger[0]!,
  emerald: entrepriseFarger[1]!,
  purple: entrepriseFarger[2]!,
  amber: entrepriseFarger[3]!,
  rose: entrepriseFarger[4]!,
  teal: entrepriseFarger[5]!,
  indigo: entrepriseFarger[6]!,
  orange: entrepriseFarger[7]!,
};

export function hentFarge(indeks: number): EntrepriseFarge {
  return entrepriseFarger[indeks % entrepriseFarger.length]!;
}

export function hentFargeForEntreprise(color: string | null | undefined, fallbackIndeks: number): EntrepriseFarge {
  if (color && FARGE_MAP[color]) return FARGE_MAP[color];
  return entrepriseFarger[fallbackIndeks % entrepriseFarger.length]!;
}
