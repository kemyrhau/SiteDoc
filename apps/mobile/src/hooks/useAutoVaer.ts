import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";
import { vaerkodeTilTekst } from "@sitedoc/shared";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
}

interface RapportObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
}

interface FeltVerdi {
  verdi: unknown;
  kommentar: string;
  vedlegg: unknown[];
}

interface UseAutoVaerParams {
  prosjektId: string | null;
  alleObjekter: RapportObjekt[];
  hentFeltVerdi: (objektId: string) => FeltVerdi;
  settVerdi: (objektId: string, verdi: unknown) => void;
}

/**
 * Hook som automatisk henter værdata fra Open-Meteo når:
 * 1. Malen har et vær-felt (type: "weather")
 * 2. Malen har et dato- eller dato/tid-felt med en verdi
 * 3. Prosjektet har satt koordinater (latitude/longitude)
 */
export function useAutoVaer({
  prosjektId,
  alleObjekter,
  hentFeltVerdi,
  settVerdi,
}: UseAutoVaerParams) {
  const harAutoFylt = useRef(false);

  // Finn vær-felt
  const vaerObjekt = alleObjekter.find((o) => o.type === "weather");

  // Finn første dato/dato_time-felt med verdi
  const datoObjekt = alleObjekter.find(
    (o) => o.type === "date" || o.type === "date_time",
  );

  const datoVerdi = datoObjekt ? hentFeltVerdi(datoObjekt.id)?.verdi : null;
  const vaerVerdi = vaerObjekt
    ? (hentFeltVerdi(vaerObjekt.id)?.verdi as VaerVerdi | null)
    : null;

  // Ekstraher dato-streng (YYYY-MM-DD)
  const datoStreng =
    typeof datoVerdi === "string" && datoVerdi.length >= 10
      ? datoVerdi.slice(0, 10)
      : null;

  // Hent prosjektkoordinater
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const latitude = prosjekt?.latitude;
  const longitude = prosjekt?.longitude;

  // Hent værdata når vi har dato + koordinater
  const kanHente =
    !!vaerObjekt &&
    !!datoStreng &&
    latitude != null &&
    longitude != null;

  const { data: vaerdata } = trpc.vaer.hentVaerdata.useQuery(
    {
      latitude: latitude!,
      longitude: longitude!,
      dato: datoStreng!,
    },
    { enabled: kanHente },
  );

  // Auto-fyll vær-feltet
  useEffect(() => {
    if (!vaerdata || !vaerObjekt) return;

    // Ikke overskriv manuell data
    if (vaerVerdi?.kilde === "manuell") return;

    // Ikke fyll på nytt hvis allerede gjort
    if (harAutoFylt.current && vaerVerdi?.kilde === "automatisk") return;

    // Finn kl. 12:00-indeksen (middag)
    const klokke12Indeks = vaerdata.hourly.time.findIndex((t: string) =>
      t.endsWith("T12:00"),
    );
    const indeks = klokke12Indeks >= 0 ? klokke12Indeks : 0;

    const temp = vaerdata.hourly.temperature_2m[indeks];
    const vaerkode = vaerdata.hourly.weather_code[indeks];
    const vind = vaerdata.hourly.wind_speed_10m[indeks];

    // Summer opp nedbør for hele dagen
    const dagNedbor = vaerdata.hourly.precipitation.reduce(
      (sum: number, v: number | null) => sum + (v ?? 0),
      0,
    );

    const nyVerdi: VaerVerdi = {
      temp: temp != null ? `${temp}°C` : undefined,
      conditions: vaerkode != null ? vaerkodeTilTekst(vaerkode) : undefined,
      wind: vind != null ? `${vind} m/s` : undefined,
      precipitation: `${Math.round(dagNedbor * 10) / 10} mm`,
      kilde: "automatisk",
    };

    settVerdi(vaerObjekt.id, nyVerdi);
    harAutoFylt.current = true;
  }, [vaerdata, vaerObjekt, vaerVerdi?.kilde, settVerdi]);

  // Reset flag når dato endres
  useEffect(() => {
    harAutoFylt.current = false;
  }, [datoStreng]);
}
