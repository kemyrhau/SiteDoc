/**
 * Signaturliste (SJA/HMS-runder) — delt manko-/statuslogikk.
 *
 * Fabel-ordre 2026-09-06. Én sannhet for «X av Y signert» og chip-fargen på
 * tvers av API (chip-select), web-objekt, mobil-objekt og PDF. Regelen er
 * frys-bevisst: for en AVSLUTTET runde er Y det frosne `antallDeltakere` fra
 * runden (snapshot ved «Avslutt runde»), for en ÅPEN runde er Y antall aktive
 * deltakere nå (`fjernetAt = null`). Se ORDRE § manko.
 */

/** Chip-/leder-status. `ingen_runde` = objektet er ikke tatt i bruk ennå. */
export type SignaturChipStatus = "ingen_runde" | "mangler" | "komplett";

/** Minimalt sammendrag av siste runde — det chip-spørringen henter (take:1). */
export interface SisteRundeSammendrag {
  rundeNr: number;
  /** `avsluttetAt` fra runden — `null`/undefined = åpen runde. */
  avsluttet: boolean;
  /**
   * Signaturer som TELLER i denne runden. Signaturer der «Krev ny signatur» er
   * satt (`nySignaturKrevdAt != null`) er allerede flyttet til manko og skal IKKE
   * med i dette tallet — de teller heller ikke i «X av Y».
   */
  antallSignert: number;
  /**
   * Delmengde av `antallSignert` som ble signert på en ELDRE innholdsversjon enn
   * dokumentets nåværende (SJA varig arbeid, fabel 2026-09-06). Teller fortsatt i
   * «X av Y» (invalidering er menneskets kall), men gir chip amber-tilstand.
   */
  antallSignertFørEndring?: number;
  /** Frosset ved «Avslutt runde». `null` for åpen runde. */
  antallDeltakere: number | null;
}

export interface SignaturStatus {
  /** Gjeldende rundenummer, eller `null` når objektet ikke er tatt i bruk. */
  rundeNr: number | null;
  signert: number;
  av: number;
  /**
   * Antall av `signert` som signerte før en senere innholdsendring. > 0 → chip
   * skal vises amber selv om alle har signert («X av Y — N signert før endring»).
   */
  signertFørEndring: number;
  status: SignaturChipStatus;
}

/**
 * Beregn «X av Y signert» + chip-status fra siste runde og live antall aktive
 * deltakere. `aktiveDeltakere` brukes kun for åpen runde; for avsluttet runde
 * leses det frosne tallet fra runden slik at historikk ikke drifter.
 */
export function beregnSignaturStatus(
  sisteRunde: SisteRundeSammendrag | null | undefined,
  aktiveDeltakere: number,
): SignaturStatus {
  if (!sisteRunde) {
    return { rundeNr: null, signert: 0, av: 0, signertFørEndring: 0, status: "ingen_runde" };
  }
  const av = sisteRunde.avsluttet
    ? sisteRunde.antallDeltakere ?? aktiveDeltakere
    : aktiveDeltakere;
  const signert = sisteRunde.antallSignert;
  const signertFørEndring = sisteRunde.antallSignertFørEndring ?? 0;
  const status: SignaturChipStatus =
    av > 0 && signert >= av ? "komplett" : "mangler";
  return { rundeNr: sisteRunde.rundeNr, signert, av, signertFørEndring, status };
}

/**
 * Del aktive deltakere i signert/manko for gjeldende runde. Generisk over
 * deltaker-formen — kalles fra web/mobil/PDF med hver sin rad-type.
 * Manko FØRST er en UI-regel; her bevares innkommende rekkefølge i hver bøtte.
 */
export function delSignertManko<T extends { id: string }>(
  aktiveDeltakere: readonly T[],
  signerteDeltakerIds: ReadonlySet<string>,
): { signert: T[]; manko: T[] } {
  const signert: T[] = [];
  const manko: T[] = [];
  for (const d of aktiveDeltakere) {
    if (signerteDeltakerIds.has(d.id)) signert.push(d);
    else manko.push(d);
  }
  return { signert, manko };
}
