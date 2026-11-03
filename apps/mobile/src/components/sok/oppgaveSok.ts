import { matchScore, normaliserSok, synonymerFor } from "@sitedoc/shared";

/**
 * Listesøk i oppgaver for mobilsøket (spec-sok-mobil rev. 2 § 9.1). Samme form som sjekklistenes `sokeNorm`
 * (dokumentlisteFilter.ts): prefiks+nummer · tittel · beskrivelse · malnavn · utfører-faggruppe + synonymer,
 * rangert med delt `matchScore`. `Task.data` søkes ikke (innholdssøk er egen sak, § 9.2).
 *
 * Offline-katalogen (`oppgave_local`) har ingen beskrivelseskolonne — lokale rader har `description: null`
 * og søkes på de øvrige feltene.
 */

export interface OppgaveSokRad {
  id: string;
  title: string;
  status: string;
  number?: number | null;
  description?: string | null;
  template?: { name: string; prefix?: string | null } | null;
  utforerFaggruppe?: { name: string } | null;
}

function sokeNorm(rad: OppgaveSokRad): string {
  const rå = [
    rad.template?.prefix && rad.number != null ? `${rad.template.prefix}${rad.number}` : null,
    rad.title,
    rad.description,
    rad.template?.name,
    rad.utforerFaggruppe?.name,
  ]
    .filter(Boolean)
    .join(" ");
  const norm = normaliserSok(rå);
  const syn = synonymerFor(norm);
  return syn ? `${norm} ${syn}` : norm;
}

/** Relevans-rangerte treff; tomt søk gir tom liste. */
export function sokIOppgaver<T extends OppgaveSokRad>(rader: T[], søketekst: string): T[] {
  const q = normaliserSok(søketekst.trim());
  if (!q) return [];
  return rader
    .map((rad) => ({ rad, score: matchScore(sokeNorm(rad), q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.rad);
}
