"use client";

import Link from "next/link";
import { Plus, Truck, Wrench, Hammer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import type { MaskinKategori } from "@/lib/maskin-typer";

const KATEGORI_IKON: Record<MaskinKategori, React.ReactNode> = {
  kjoretoy: <Truck className="h-4 w-4 text-gray-400" />,
  anleggsmaskin: <Wrench className="h-4 w-4 text-gray-400" />,
  smautstyr: <Hammer className="h-4 w-4 text-gray-400" />,
};

interface UtstyrRad {
  id: string;
  kategori: string;
  type: string;
  merke: string | null;
  modell: string | null;
  internNummer: string | null;
  status: string;
}

export default function MaskinPage() {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.maskin.equipment.list.useQuery();
  const utstyr = (data ?? []) as UtstyrRad[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("maskin.tittel")}
        </h1>
        <Link
          href="/dashbord/maskin/nytt"
          className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("maskin.leggTilUtstyr")}
        </Link>
      </div>

      {utstyr.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <h2 className="text-sm font-medium text-gray-900">
            {t("maskin.ingenUtstyrTittel")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {t("maskin.ingenUtstyrBeskrivelse")}
          </p>
          <Link
            href="/dashbord/maskin/nytt"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("maskin.leggTilUtstyr")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.kategori")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.type")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.merke")} / {t("maskin.modell")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.internNummer")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utstyr.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="flex items-center gap-2 px-4 py-2">
                    {KATEGORI_IKON[u.kategori as MaskinKategori]}
                    <span className="text-gray-700">
                      {t(`maskin.kategori${u.kategori.charAt(0).toUpperCase() + u.kategori.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{u.type}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {[u.merke, u.modell].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{u.internNummer ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={u.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const farge =
    status === "tilgjengelig"
      ? "bg-green-100 text-green-800"
      : status === "utlaant"
        ? "bg-blue-100 text-blue-800"
        : status === "paa_service"
          ? "bg-amber-100 text-amber-800"
          : status === "pensjonert"
            ? "bg-gray-100 text-gray-600"
            : "bg-gray-100 text-gray-800";
  const nøkkel =
    status === "paa_service"
      ? "maskin.statusPaaService"
      : `maskin.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${farge}`}>
      {t(nøkkel)}
    </span>
  );
}
