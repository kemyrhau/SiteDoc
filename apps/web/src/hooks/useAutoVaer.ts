import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { byggVaerSnapshot } from "@sitedoc/shared";
import type { RapportObjekt } from "@/components/rapportobjekter/typer";
import type { FeltVerdi } from "@/components/rapportobjekter/typer";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
}

interface UseAutoVaerParams {
  prosjektId: string;
  alleObjekter: RapportObjekt[];
  hentFeltVerdi: (objektId: string) => FeltVerdi;
  settVerdi: (objektId: string, verdi: unknown) => void;
}

/**
 * Hook som henter et VÆRSNAPSHOT forankret i befaringstidspunktet (Kenneth-vedtak
 * 2026-08-16, `docs/redesign/vaerdata-snapshot-vedtak-fabel-2026-08-16.md`):
 *
 * 1. Vær hentes når brukeren SETTER befaringstidspunktet (dato/tid-feltet) — umiddelbart.
 * 2. Rettet tidspunkt (også bare klokkeslett) → nytt snapshot for det nye tidspunktet.
 * 3. Endring i bilde/tekst henter aldri nytt vær (styres av `kilde`-vernet + tidspunkt-guard).
 * 4. Værfeltet står tomt til tidspunktet er satt. Web prefyller ikke dato, så «feltet har
 *    en verdi» betyr her at brukeren satte den — ingen ekstra vern trengs (mobil dropper
 *    prefyll av vær-ankeret, se useSjekklisteSkjema/useOppgaveSkjema).
 *
 * Vær-felttypen kobles implisitt til første date/date_time-felt i malen. Setter kilde:
 * "automatisk"; manuell overstyring (kilde: "manuell") røres aldri.
 */
export function useAutoVaer({
  prosjektId,
  alleObjekter,
  hentFeltVerdi,
  settVerdi,
}: UseAutoVaerParams) {
  // Siste tidspunkt vi faktisk auto-fylte vær for — hindrer refyll-loop, gir refyll ved endret tid.
  const sisteFyltTidspunktRef = useRef<string | null>(null);

  const vaerObjekt = alleObjekter.find((o) => o.type === "weather");
  const datoObjekt = alleObjekter.find(
    (o) => o.type === "date" || o.type === "date_time",
  );

  const datoVerdiRaw = datoObjekt ? hentFeltVerdi(datoObjekt.id)?.verdi : null;
  const datoVerdi = typeof datoVerdiRaw === "string" ? datoVerdiRaw : null;
  const vaerVerdi = vaerObjekt
    ? (hentFeltVerdi(vaerObjekt.id)?.verdi as VaerVerdi | null)
    : null;

  const datoStreng =
    datoVerdi && datoVerdi.length >= 10 ? datoVerdi.slice(0, 10) : null;

  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId },
    { enabled: !!prosjektId },
  );

  const latitude = prosjekt?.latitude;
  const longitude = prosjekt?.longitude;

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

  // Auto-fyll vær-feltet for det satte befaringstidspunktet.
  useEffect(() => {
    if (!vaerdata || !vaerObjekt || !datoVerdi) return;

    // Ikke overskriv manuell data
    if (vaerVerdi?.kilde === "manuell") return;

    // Allerede fylt for akkurat dette tidspunktet → ikke gjør noe (bryter refyll-loop)
    if (sisteFyltTidspunktRef.current === datoVerdi) return;

    const nyVerdi: VaerVerdi = byggVaerSnapshot(vaerdata.hourly, datoVerdi);

    settVerdi(vaerObjekt.id, nyVerdi);
    sisteFyltTidspunktRef.current = datoVerdi;
  }, [vaerdata, vaerObjekt, vaerVerdi?.kilde, datoVerdi, settVerdi]);
}
