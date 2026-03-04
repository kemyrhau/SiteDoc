"use client";

import { trpc } from "@/lib/trpc";
import { MapPin } from "lucide-react";
import type { RapportObjektProps } from "./typer";

export function LokasjonObjekt({ prosjektId }: RapportObjektProps) {
  const { data: prosjekt } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  if (!prosjektId || !prosjekt) {
    return null;
  }

  const harKoordinater =
    prosjekt.latitude != null && prosjekt.longitude != null;

  if (!harKoordinater) {
    return (
      <p className="text-sm italic text-gray-400">
        Prosjektet har ikke satt lokasjon
      </p>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-700">
      <MapPin className="h-4 w-4 text-gray-400" />
      {prosjekt.address && <span>{prosjekt.address} &middot; </span>}
      <span className="text-xs text-gray-400">
        {prosjekt.latitude!.toFixed(6)}, {prosjekt.longitude!.toFixed(6)}
      </span>
    </div>
  );
}
