import { byggVaerSnapshot, type VaerHourly } from "@sitedoc/shared";

/**
 * Vær-resolve ved finalisering (funn d, Kenneth-vedtak 2026-08-16,
 * `docs/redesign/vaerdata-snapshot-vedtak-fabel-2026-08-16.md` punkt 2–3).
 *
 * Et befaringstidspunkt satt uten nett markerer værfeltet `status:"venter"`
 * (mobil `useAutoVaer` / `VaerKoProvider`). Kommer enheten aldri online mens
 * dokumentet er åpent, står markøren igjen. Når dokumentet finaliseres/signeres
 * (terminal-transisjon), fryser vi snapshotet server-side her: hent archive-vær
 * for det LAGREDE tidspunktet, ikke for finaliseringstidspunktet.
 *
 * Feiler hentingen → `status:"ikke_registrert"` PERMANENT. Aldri mutér i ettertid:
 * markøren er ikke lenger `"venter"`, så vær-køen (`erVenterMarkor`) rører den ikke,
 * og `oppdaterData`-guarden hindrer enhver skriving til det finaliserte dokumentet.
 */

interface FeltVerdi {
  verdi?: unknown;
  kommentar?: string;
  vedlegg?: unknown[];
}

interface VenterMarkor {
  kilde?: "manuell" | "automatisk";
  status?: string;
  venterTidspunkt?: string;
  lat?: number;
  lng?: number;
}

/** Er feltverdien en ventende vær-markør (satt offline, ikke hentet ennå)? */
function erVenterMarkor(verdi: unknown): verdi is Required<Pick<VenterMarkor, "venterTidspunkt" | "lat" | "lng">> & VenterMarkor {
  const v = verdi as VenterMarkor | undefined;
  return (
    !!v &&
    typeof v === "object" &&
    v.status === "venter" &&
    v.kilde !== "manuell" &&
    typeof v.venterTidspunkt === "string" &&
    typeof v.lat === "number" &&
    typeof v.lng === "number"
  );
}

export type HentVaerHourly = (
  latitude: number,
  longitude: number,
  dato: string,
) => Promise<VaerHourly | null>;

/**
 * Løs alle ventende vær-markører i dokumentets `data` ved finalisering.
 * Rent (ingen DB): henting injiseres via `hentHourly` (testbart, som persons-resolveren).
 * Returnerer NY, sammenslått `data` når minst ett felt ble løst — ellers `null`
 * (ingen ventende vær, ingen skriving nødvendig).
 */
export async function resolverVentendeVaer(
  data: Record<string, FeltVerdi>,
  objects: { id: string; type: string }[],
  hentHourly: HentVaerHourly,
): Promise<Record<string, FeltVerdi> | null> {
  const vaerIder = objects.filter((o) => o.type === "weather").map((o) => o.id);
  if (vaerIder.length === 0) return null;

  let endret = false;
  const ut: Record<string, FeltVerdi> = { ...data };

  for (const id of vaerIder) {
    const felt = data[id];
    if (!erVenterMarkor(felt?.verdi)) continue;

    const markor = felt.verdi;
    const hourly = await hentHourly(markor.lat, markor.lng, markor.venterTidspunkt.slice(0, 10));

    const nyVerdi = hourly
      ? { ...byggVaerSnapshot(hourly, markor.venterTidspunkt), hentetIEttertid: true }
      : { kilde: "automatisk" as const, status: "ikke_registrert" as const };

    // Behold kommentar/vedlegg; erstatt kun verdien (markøren droppes med resultatet).
    ut[id] = { ...felt, verdi: nyVerdi };
    endret = true;
  }

  return endret ? ut : null;
}

/** Feltnøkler for weather-typede objekter — brukt av `oppdaterData`-guarden. */
export function vaerFeltIder(objects: { id: string; type: string }[]): Set<string> {
  return new Set(objects.filter((o) => o.type === "weather").map((o) => o.id));
}
