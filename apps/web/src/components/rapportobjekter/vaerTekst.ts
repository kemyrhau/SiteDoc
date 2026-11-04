/** Lagret vær-verdi (VaerObjekt, useAutoVaer, vaer-finalisering). */
export interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
  status?: "venter" | "ikke_registrert";
}

/** Kompakt vær-oppsummering slik VaerObjekt viser den i utfylling: «4 °C · Lettskyet · 3 m/s». */
export function vaerOppsummering(v: VaerVerdi): string {
  return [v.temp, v.conditions, v.wind].filter(Boolean).join(" · ");
}

/** Vær-formet objekt — brukt av TilfoyelseNotat for å vise en tapt vær-verdi som feltet selv. */
export function erVaerVerdi(o: object): o is VaerVerdi {
  return ["temp", "conditions", "wind", "precipitation", "kilde", "status"].some((k) => k in o);
}
