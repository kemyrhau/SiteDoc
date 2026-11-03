/**
 * Ren statuslogikk for OTA-varselet (ota-varsel 2026-11-03). Ingen expo-import —
 * testes med vitest. `OtaProvider` mater inn flaggene fra `Updates.useUpdates()`.
 */

export type OtaStatus = "av" | "frakoblet" | "sjekker" | "laster" | "klar" | "oppdatert";

export interface OtaFlagg {
  /** `Updates.isEnabled` — false i dev / Expo Go. */
  aktivert: boolean;
  påNett: boolean;
  sjekker: boolean;
  lasterNed: boolean;
  /** Ny versjon er lastet ned og venter på `reloadAsync()`. */
  klar: boolean;
}

/** Prioritet: av > klar > laster > sjekker > frakoblet > oppdatert. En nedlastet versjon er klar også offline. */
export function utledOtaStatus(f: OtaFlagg): OtaStatus {
  if (!f.aktivert) return "av";
  if (f.klar) return "klar";
  if (f.lasterNed) return "laster";
  if (f.sjekker) return "sjekker";
  if (!f.påNett) return "frakoblet";
  return "oppdatert";
}

export const OTA_STATUS_NOEKKEL: Record<Exclude<OtaStatus, "av">, string> = {
  frakoblet: "ota.frakoblet",
  sjekker: "ota.sjekker",
  laster: "ota.lasterNed",
  klar: "ota.klarTrykk",
  oppdatert: "ota.oppdatert",
};

/** Automatisk sjekk høyst én gang per 5 min. */
export const OTA_STRUPING_MS = 5 * 60 * 1000;
/** «Se etter oppdatering» går forbi strupingen, men ikke dobbelttrykk. */
export const OTA_TVUNGET_SPERRE_MS = 10 * 1000;

export function skalSjekke(sistSjekketMs: number | null, nåMs: number, tvunget = false): boolean {
  if (sistSjekketMs === null) return true;
  const gått = nåMs - sistSjekketMs;
  return gått >= (tvunget ? OTA_TVUNGET_SPERRE_MS : OTA_STRUPING_MS);
}

export interface Innsetter {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Bunnmarg mens linja vises: linja tar home-indikator-marginen selv, og
 * navigatoren over (fanelinja, skjermer) får `bottom: 0` — ellers dobbel marg.
 * Uten linje er navigatorens innsetter urørt.
 */
export function fordelBunnInnsetter(innsetter: Innsetter, linjeSynlig: boolean) {
  if (!linjeSynlig) return { navigator: innsetter, linjeBunn: 0 };
  return { navigator: { ...innsetter, bottom: 0 }, linjeBunn: innsetter.bottom };
}
