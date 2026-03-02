"use client";

import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";
import type { RapportObjektProps } from "./typer";

const KartVelgerDynamic = dynamic(
  () => import("@/components/KartVelger").then((m) => m.KartVelger),
  { ssr: false, loading: () => <div className="h-[200px] animate-pulse rounded-lg bg-gray-100" /> },
);

export function LokasjonObjekt({ prosjektId }: RapportObjektProps) {
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const harKoordinater =
    prosjekt?.latitude != null && prosjekt?.longitude != null;

  if (!prosjektId) {
    return (
      <p className="text-sm text-gray-400 italic">Prosjekt-ID mangler</p>
    );
  }

  if (!prosjekt) {
    return <div className="h-[200px] animate-pulse rounded-lg bg-gray-100" />;
  }

  if (!harKoordinater) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3">
        <MapPin className="h-4 w-4 text-gray-400" />
        <p className="text-sm text-gray-500">
          Prosjektet har ikke satt lokasjon
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <KartVelgerDynamic
        latitude={prosjekt.latitude}
        longitude={prosjekt.longitude}
        onVelgPosisjon={() => {}}
        disabled
        hoyde="200px"
      />
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <MapPin className="h-3 w-3" />
        {prosjekt.address && <span>{prosjekt.address} &middot; </span>}
        <span>
          {prosjekt.latitude!.toFixed(6)}, {prosjekt.longitude!.toFixed(6)}
        </span>
      </div>
    </div>
  );
}
