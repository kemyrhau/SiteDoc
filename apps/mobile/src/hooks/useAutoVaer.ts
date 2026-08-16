import { useEffect, useRef } from "react";
import { trpc } from "../lib/trpc";
import { byggVaerSnapshot } from "@sitedoc/shared";
import { useNettverk } from "../providers/NettverkProvider";

interface VaerVerdi {
  temp?: string;
  conditions?: string;
  wind?: string;
  precipitation?: string;
  kilde?: "manuell" | "automatisk";
  // Offline: satt tidspunkt, men vær ikke hentet ennå. Vær-køen henter når enheten
  // er online — for `venterTidspunkt`, ikke for tidspunktet nettet kom tilbake.
  status?: "venter";
  venterTidspunkt?: string;
  lat?: number;
  lng?: number;
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
 * Hook som henter et VÆRSNAPSHOT forankret i befaringstidspunktet (Kenneth-vedtak
 * 2026-08-16, `docs/redesign/vaerdata-snapshot-vedtak-fabel-2026-08-16.md`):
 *
 * 1. Vær hentes UMIDDELBART når brukeren setter befaringstidspunktet (dato/tid-feltet)
 *    — «Nå», manuell innskriving eller retting virker likt. Ikke ved lagring/render.
 * 2. Rettet tidspunkt (også bare klokkeslett) → nytt snapshot for det nye tidspunktet.
 * 3. Endring i bilde/tekst henter aldri nytt vær (kilde-vern + tidspunkt-guard).
 * 4. Værfeltet står tomt til tidspunktet er satt. Mobil dropper prefyll av vær-ankeret
 *    (useSjekklisteSkjema/useOppgaveSkjema), så «feltet har verdi» = brukeren satte det.
 *
 * Offline: kan ikke hente. Da skrives en «venter»-markør på værfeltet (med tidspunkt +
 * koordinat) — VaerKøProvider henter for det LAGREDE tidspunktet når enheten er online.
 * Mens dokumentet er montert og nettet kommer tilbake, refetcher React Query selv
 * (refetchOnReconnect) → online-grenen fyller og fjerner markøren.
 */
export function useAutoVaer({
  prosjektId,
  alleObjekter,
  hentFeltVerdi,
  settVerdi,
}: UseAutoVaerParams) {
  const { erPaaNettet } = useNettverk();
  const sisteFyltTidspunktRef = useRef<string | null>(null);
  const sisteVenterTidspunktRef = useRef<string | null>(null);

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
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const latitude = prosjekt?.latitude;
  const longitude = prosjekt?.longitude;

  const kanHente =
    !!vaerObjekt &&
    !!datoStreng &&
    latitude != null &&
    longitude != null &&
    erPaaNettet;

  const { data: vaerdata } = trpc.vaer.hentVaerdata.useQuery(
    {
      latitude: latitude!,
      longitude: longitude!,
      dato: datoStreng!,
    },
    { enabled: kanHente },
  );

  // ONLINE: fyll snapshot for det satte befaringstidspunktet (umiddelbart når data er der).
  useEffect(() => {
    if (!vaerdata || !vaerObjekt || !datoVerdi) return;
    if (vaerVerdi?.kilde === "manuell") return;
    // Allerede fylt for dette tidspunktet (og ikke i venter-tilstand) → ikke gjør noe.
    if (
      sisteFyltTidspunktRef.current === datoVerdi &&
      vaerVerdi?.status !== "venter"
    )
      return;

    settVerdi(vaerObjekt.id, byggVaerSnapshot(vaerdata.hourly, datoVerdi));
    sisteFyltTidspunktRef.current = datoVerdi;
    sisteVenterTidspunktRef.current = null;
  }, [
    vaerdata,
    vaerObjekt,
    vaerVerdi?.kilde,
    vaerVerdi?.status,
    datoVerdi,
    settVerdi,
  ]);

  // OFFLINE: marker værfeltet som «venter» så UI og vær-kø vet at det skal hentes.
  useEffect(() => {
    if (erPaaNettet) return; // online-grenen henter direkte
    if (!vaerObjekt || !datoVerdi || !datoStreng) return;
    if (vaerVerdi?.kilde === "manuell") return;
    if (latitude == null || longitude == null) return; // uten koordinat kan køen ikke hente
    // Allerede markert venter for akkurat dette tidspunktet → ikke skriv på nytt.
    if (
      vaerVerdi?.status === "venter" &&
      vaerVerdi?.venterTidspunkt === datoVerdi
    )
      return;
    if (sisteVenterTidspunktRef.current === datoVerdi) return;

    settVerdi(vaerObjekt.id, {
      kilde: "automatisk",
      status: "venter",
      venterTidspunkt: datoVerdi,
      lat: latitude,
      lng: longitude,
    });
    sisteVenterTidspunktRef.current = datoVerdi;
    sisteFyltTidspunktRef.current = null;
  }, [
    erPaaNettet,
    vaerObjekt,
    datoVerdi,
    datoStreng,
    latitude,
    longitude,
    vaerVerdi?.kilde,
    vaerVerdi?.status,
    vaerVerdi?.venterTidspunkt,
    settVerdi,
  ]);
}
