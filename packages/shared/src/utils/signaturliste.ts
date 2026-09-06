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
   * EKTE signaturer som teller — deltakeren signerte SIN EGEN rad (`bekreftetAvUserId`
   * er null). Signaturer der «Krev ny signatur» er satt er flyttet til manko og
   * teller ikke. 🔴 «signert» og «bekreftet» blandes ALDRI (fabel-designvakt): en
   * bekreftelse fra ansvarlig på vegne av en gjest er IKKE en signatur.
   */
  antallSignert: number;
  /**
   * Bekreftelser som teller — ansvarlig bekreftet en gjests deltakelse
   * (`bekreftetAvUserId` satt). Egen teller, aldri slått sammen med `antallSignert`
   * i dokumentet. Dekningsgrad (chip i lista) = signert + bekreftet.
   */
  antallBekreftet?: number;
  /**
   * Delmengde av (signert + bekreftet) som ble attestert på en ELDRE innholdsversjon
   * enn dokumentets nåværende. Teller fortsatt i dekningen (invalidering er menneskets
   * kall), men gir chip amber-tilstand.
   */
  antallSignertFørEndring?: number;
  /** Frosset ved «Avslutt runde». `null` for åpen runde. */
  antallDeltakere: number | null;
}

export interface SignaturStatus {
  /** Gjeldende rundenummer, eller `null` når objektet ikke er tatt i bruk. */
  rundeNr: number | null;
  /** EKTE signaturer (egen rad). */
  signert: number;
  /** Bekreftelser (gjest bekreftet av ansvarlig). Aldri slått sammen med `signert` i dokumentet. */
  bekreftet: number;
  av: number;
  /**
   * Antall av (signert + bekreftet) som ble attestert før en senere innholdsendring.
   * > 0 → chip amber selv om dekningen er full («… — N før endring»).
   */
  signertFørEndring: number;
  /** komplett = FULL DEKNING (signert + bekreftet ≥ av). Chip-fargen skiller amber ut separat. */
  status: SignaturChipStatus;
}

/**
 * Beregn dekning + chip-status fra siste runde og live antall aktive deltakere.
 * `aktiveDeltakere` brukes kun for åpen runde; for avsluttet runde leses det frosne
 * tallet fra runden slik at historikk ikke drifter. `status = komplett` betyr FULL
 * DEKNING (signert + bekreftet ≥ av) — men signert og bekreftet returneres hver for
 * seg, og dokumentet (PDF) skal alltid vise dem fra hverandre.
 */
export function beregnSignaturStatus(
  sisteRunde: SisteRundeSammendrag | null | undefined,
  aktiveDeltakere: number,
): SignaturStatus {
  if (!sisteRunde) {
    return { rundeNr: null, signert: 0, bekreftet: 0, av: 0, signertFørEndring: 0, status: "ingen_runde" };
  }
  const av = sisteRunde.avsluttet
    ? sisteRunde.antallDeltakere ?? aktiveDeltakere
    : aktiveDeltakere;
  const signert = sisteRunde.antallSignert;
  const bekreftet = sisteRunde.antallBekreftet ?? 0;
  const signertFørEndring = sisteRunde.antallSignertFørEndring ?? 0;
  const dekket = signert + bekreftet;
  const status: SignaturChipStatus =
    av > 0 && dekket >= av ? "komplett" : "mangler";
  return { rundeNr: sisteRunde.rundeNr, signert, bekreftet, av, signertFørEndring, status };
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
