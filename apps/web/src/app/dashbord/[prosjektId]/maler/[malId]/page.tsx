"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Spinner, Badge } from "@sitedoc/ui";
import { Settings2 } from "lucide-react";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { useTranslation } from "react-i18next";

/**
 * Lesevisning av en prosjektmal (funn 4, fabel 2026-09-12). Ruten åpnet tidligere
 * MalBygger — en ANDRE inngang til byggeren på prosjektnivå, i strid med vedtaket
 * «ingen ny malbygger på prosjektnivå». Redigering skjer i malbyggeren (Oppsett ›
 * Produksjon), nådd via «Administrer i malbygger»-lenken. Ruten beholdes som
 * lesevisning fordi den fortsatt har innganger (legacy-redirect + MalerPanel-panelet).
 */
export default function MalDetaljSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string; malId: string }>();
  const router = useRouter();

  const { data: mal, isLoading } = trpc.mal.hentMedId.useQuery({ id: params.malId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!mal) {
    return <p className="py-12 text-center text-gray-500">{t("maler.ikkeFunnet")}</p>;
  }

  // Malbygger-ruten per kategori (som MalListe): HMS via domain, ellers category.
  const rute =
    mal.domain === "hms"
      ? "hmsmaler"
      : mal.category === "oppgave"
        ? "oppgavemaler"
        : "sjekklistemaler";

  // Eksplisitt form bryter den dype tRPC-unionen (TS2589 på kald bygg) FØR .map
  // treffer JSX — se feedback_kald_bygg_ts2589.
  type MalObjekt = { id: string; type: string; label: string; required: boolean };
  const objekter = (mal.objects ?? []) as MalObjekt[];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{mal.name}</h1>
            {mal.prefix && <Badge variant="default">{mal.prefix}</Badge>}
          </div>
          {mal.description && (
            <p className="mt-1 text-sm text-gray-600">{mal.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push(`/dashbord/oppsett/produksjon/${rute}/${mal.id}`)}
          className="inline-flex items-center gap-1.5 rounded-md border border-sitedoc-primary px-3 py-2 text-sm font-medium text-sitedoc-primary hover:bg-blue-50 transition-colors"
        >
          <Settings2 className="h-4 w-4" />
          {t("maler.administrerIMalbygger")}
        </button>
      </div>

      {/* Lesevisning av malens felter — redigering skjer i malbyggeren */}
      <div className="rounded-lg border border-gray-200">
        {objekter.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            {t("maler.ingenFelter")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {objekter.map((obj) =>
              obj.type === "heading" ? (
                <li
                  key={obj.id}
                  className="bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500"
                >
                  {obj.label}
                </li>
              ) : (
                <li key={obj.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="flex-1 text-sm text-gray-800">
                    {obj.label || <span className="text-gray-400">—</span>}
                  </span>
                  {obj.required && (
                    <Badge variant="warning">{t("maler.pakrevd")}</Badge>
                  )}
                  <span className="text-xs text-gray-400">{obj.type}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
