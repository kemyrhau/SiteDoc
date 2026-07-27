"use client";

import { EmptyState } from "@sitedoc/ui";
import { Clock, Truck, Package, Boxes } from "lucide-react";
import { useTranslation } from "react-i18next";

type Modul = { moduleSlug: string; status: string; aktivertVed: string | Date; deaktivertVed: string | Date | null };

const IKON: Record<string, typeof Clock> = {
  timer: Clock,
  maskin: Truck,
  varelager: Package,
};

export function ModulerFane({ moduler }: { moduler: Modul[] }) {
  const { t, i18n } = useTranslation();

  if (moduler.length === 0) {
    return (
      <div>
        <EmptyState title={t("admin.firmaDetalj.ingenModulerTittel")} description={t("admin.firmaDetalj.ingenModulerBeskrivelse")} />
        <p className="mt-3 text-xs text-gray-400">{t("admin.firmaDetalj.modulerHint")}</p>
      </div>
    );
  }

  function dato(d: string | Date) {
    return new Date(d).toLocaleDateString(i18n.language || "nb", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div>
      <div className="space-y-1.5">
        {moduler.map((m) => {
          const Ikon = IKON[m.moduleSlug] ?? Boxes;
          const aktiv = m.status === "aktiv";
          return (
            <div key={m.moduleSlug} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 text-sm">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${aktiv ? "bg-green-50" : "bg-gray-50"}`}>
                  <Ikon className={`h-4 w-4 ${aktiv ? "text-green-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <div className="font-medium capitalize text-gray-900">{m.moduleSlug}</div>
                  <div className="text-xs text-gray-500">
                    {aktiv ? t("admin.firmaDetalj.aktivertDato", { dato: dato(m.aktivertVed) }) : t("admin.firmaDetalj.arkivert")}
                  </div>
                </div>
              </div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  aktiv ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {aktiv ? t("status.aktiv") : t("status.arkivert")}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">{t("admin.firmaDetalj.modulerHint")}</p>
    </div>
  );
}
