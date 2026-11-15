/**
 * «Rett avstand» for kontor ↔ kontor (POST 2026-11-15 (16), punkt 3). Ren funksjon — testet
 * uten React. Dialogen viser alltid både km og kjøretid, og begge sendes til
 * `oppmotested.oppdaterKontorAvstand` (som lagrer dem med kilde «manuell»).
 */

export interface KontorAvstandInput {
  avstandKm: number;
  kjoretidMin: number;
}

/** Forhåndsutfylling fra eksisterende rad (negativ/ukjent verdi → tomt felt). */
export function kontorAvstandStartverdier(celle: {
  kjoretidMin: number;
  avstandM: number | null;
} | null): { km: string; min: string } {
  const km = celle && celle.avstandM != null && celle.avstandM >= 0 ? String(celle.avstandM / 1000) : "";
  const min = celle && celle.kjoretidMin >= 0 ? String(celle.kjoretidMin) : "";
  return { km, min };
}

/** Tolker feltene. `null` = ugyldig (begge må være > 0; kjøretid hele minutter). */
export function tolkKontorAvstand(kmTekst: string, minTekst: string): KontorAvstandInput | null {
  const km = Number(kmTekst.trim().replace(",", "."));
  const min = Number(minTekst.trim().replace(",", "."));
  if (!kmTekst.trim() || !minTekst.trim()) return null;
  if (!Number.isFinite(km) || km <= 0) return null;
  if (!Number.isInteger(min) || min <= 0) return null;
  return { avstandKm: km, kjoretidMin: min };
}
