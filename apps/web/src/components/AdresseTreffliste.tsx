import { MapPin } from "lucide-react";

/** Adressesøk-treff (speiler `sokAdresser`-retur i api `rute-service`). */
export type AdresseTreff = { lat: number; lng: number; label: string };

/**
 * Klikkbar treffliste for adressesøk (Geonorge via `bygning.geokod` /
 * `oppmotested.geokod`). Delt av byggeplass-geofence og oppmøtested
 * (TILLEGG 2026-11-15 (13) L2 del C). Tom liste → ingenting rendres.
 */
export function AdresseTreffliste({
  treff,
  onVelg,
}: {
  treff: readonly AdresseTreff[];
  onVelg: (treff: AdresseTreff) => void;
}) {
  if (treff.length === 0) return null;
  return (
    <ul className="mt-1 overflow-hidden rounded-md border border-gray-200">
      {treff.map((t, i) => (
        <li key={`${t.label}-${i}`}>
          <button
            type="button"
            onClick={() => onVelg(t)}
            className="flex w-full items-center gap-2 border-b border-gray-100 px-2.5 py-1.5 text-left text-xs text-gray-700 last:border-b-0 hover:bg-blue-50 hover:text-blue-700"
          >
            <MapPin className="h-3 w-3 flex-shrink-0 text-gray-400" />
            <span className="truncate">{t.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
