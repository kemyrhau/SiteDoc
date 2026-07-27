"use client";

import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";

type Modul = { moduleSlug: string; status: string; aktivertVed: string | Date; deaktivertVed: string | Date | null };

export function FaktureringFane({
  invoiceAddress,
  invoiceEmail,
  ehfEnabled,
  moduler,
}: {
  invoiceAddress: string | null;
  invoiceEmail: string | null;
  ehfEnabled: boolean;
  moduler: Modul[];
}) {
  const { t, i18n } = useTranslation();
  const aktive = moduler.filter((m) => m.status === "aktiv");

  function dato(d: string | Date) {
    return new Date(d).toLocaleDateString(i18n.language || "nb", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="space-y-6">
      {/* Fakturadetaljer (read-only visning av eksisterende felt) */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("admin.firmaDetalj.faktura.tittel")}</h3>
        <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
          <Rad label={t("admin.firmaDetalj.faktura.epost")} verdi={invoiceEmail ?? t("admin.firmaDetalj.faktura.ikkeSatt")} />
          <Rad label={t("admin.firmaDetalj.faktura.adresse")} verdi={invoiceAddress ?? t("admin.firmaDetalj.faktura.ikkeSatt")} />
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <dt className="text-gray-500">{t("admin.firmaDetalj.faktura.ehf")}</dt>
            <dd className={`inline-flex items-center gap-1 font-medium ${ehfEnabled ? "text-emerald-700" : "text-gray-400"}`}>
              {ehfEnabled ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {ehfEnabled ? t("admin.firmaDetalj.faktura.aktivert") : t("admin.firmaDetalj.faktura.deaktivert")}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-gray-400">{t("admin.firmaDetalj.faktura.redigerHint")}</p>
      </section>

      {/* Fakturagrunnlag: aktive firmamoduler m/aktivertVed */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("admin.firmaDetalj.faktura.grunnlagTittel")}</h3>
        {aktive.length === 0 ? (
          <p className="text-sm text-gray-400">{t("admin.firmaDetalj.faktura.ingenAktive")}</p>
        ) : (
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
            {aktive.map((m) => (
              <div key={m.moduleSlug} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <dt className="font-medium capitalize text-gray-900">{m.moduleSlug}</dt>
                <dd className="text-gray-500">{t("admin.firmaDetalj.faktura.aktivertFra", { dato: dato(m.aktivertVed) })}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}

function Rad({ label, verdi }: { label: string; verdi: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{verdi}</dd>
    </div>
  );
}
