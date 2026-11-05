import type { TFunction } from "i18next";

/** Lagret vær-verdi (VaerObjekt, useAutoVaer, vaer-finalisering). */
export interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
  status?: "venter" | "ikke_registrert";
}

export function formaterVaerTekst(v: VaerVerdi, t: TFunction): string {
  const deler: string[] = [];
  if (v.temp) deler.push(v.temp);
  if (v.conditions) deler.push(v.conditions.toLowerCase());
  if (v.wind) deler.push(t("felt.vaerVindVerdi", { verdi: v.wind }));
  if (v.precipitation && v.precipitation !== "0 mm") deler.push(t("felt.vaerNedborVerdi", { verdi: v.precipitation }));
  return deler.join(", ");
}

/** Vær-formet objekt — brukt av TilfoyelseNotat for å vise en tapt vær-verdi som feltet selv. */
export function erVaerVerdi(o: object): o is VaerVerdi {
  return ["temp", "conditions", "wind", "precipitation", "kilde", "status"].some((k) => k in o);
}
