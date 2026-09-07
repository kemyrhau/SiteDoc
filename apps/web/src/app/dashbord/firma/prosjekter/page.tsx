"use client";

import { Fragment, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { FolderKanban, Plus, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { IngenFirmaValgt } from "@/components/firma/IngenFirmaValgt";

// Status → chip-farger (speiler mockup: aktiv=grønn, avsluttet=indigo, arkivert=grå,
// deaktivert=rød) + i18n-nøkkel. Ukjent status faller til grå + rå verdi.
const STATUS_STIL: Record<string, { klasse: string; noekkel: string }> = {
  active: { klasse: "bg-emerald-100 text-emerald-700", noekkel: "prosjektStatus.aktivt" },
  completed: { klasse: "bg-indigo-100 text-indigo-700", noekkel: "prosjektStatus.avsluttet" },
  archived: { klasse: "bg-gray-100 text-gray-600", noekkel: "prosjektStatus.arkivert" },
  deactivated: { klasse: "bg-red-100 text-red-700", noekkel: "prosjektStatus.deaktivert" },
};

// Livssyklus-handlinger firma-admin kan velge, per gjeldende status. deactivated har
// ingen (leverandør-sperre — kun sitedoc-admin). Speiler mockupens ⋮-meny.
const HANDLINGER: Record<string, Array<{ noekkel: string; nyStatus: "active" | "completed" | "archived" }>> = {
  active: [
    { noekkel: "livssyklus.avslutt", nyStatus: "completed" },
    { noekkel: "livssyklus.arkiver", nyStatus: "archived" },
  ],
  completed: [
    { noekkel: "livssyklus.gjenapne", nyStatus: "active" },
    { noekkel: "livssyklus.arkiver", nyStatus: "archived" },
  ],
  archived: [
    { noekkel: "livssyklus.gjenapne", nyStatus: "active" },
    { noekkel: "livssyklus.avslutt", nyStatus: "completed" },
  ],
  deactivated: [],
};

export default function FirmaProsjekter() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { valgtFirma, kanAdministrereFirma, isLoading: firmaLaster } = useFirma();
  const orgId = valgtFirma?.id;

  const [visArkiverte, setVisArkiverte] = useState(false);
  const [apenMeny, setApenMeny] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: prosjekter, isLoading } =
    trpc.organisasjon.hentProsjekter.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );

  const settLivssyklus = trpc.prosjekt.settLivssyklus.useMutation({
    onSuccess: () => {
      setApenMeny(null);
      void utils.organisasjon.hentProsjekter.invalidate();
    },
  });

  const nyttProsjektKnapp = kanAdministrereFirma ? (
    <Link
      href="/dashbord/nytt-prosjekt"
      className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
    >
      <Plus className="h-4 w-4" />
      {t("dashbord.nyttProsjekt")}
    </Link>
  ) : null;

  if (firmaLaster) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!orgId) {
    return <IngenFirmaValgt tekst={t("firma.prosjekter.ingenFirma")} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!prosjekter || prosjekter.length === 0) {
    return (
      <div>
        <SonetonetSidehode sone="firma" className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">{t("dashbord.prosjekter")}</h1>
            {nyttProsjektKnapp}
          </div>
        </SonetonetSidehode>
        <EmptyState
          title={t("firma.prosjekter.ingen")}
          description={t("firma.prosjekter.ingenBeskrivelse")}
          action={nyttProsjektKnapp ?? undefined}
        />
      </div>
    );
  }

  const arkiverteFinnes = prosjekter.some((p) => p.status === "archived");
  const synlige = visArkiverte ? prosjekter : prosjekter.filter((p) => p.status !== "archived");

  function statusChip(status: string) {
    const stil = STATUS_STIL[status];
    return (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${stil?.klasse ?? "bg-gray-100 text-gray-600"}`}
      >
        {stil ? t(stil.noekkel) : status}
      </span>
    );
  }

  function sporLinje(endring: { tilStatus: string; dato: string | Date; av: string | null } | null) {
    if (!endring) return null;
    const statusLabel = STATUS_STIL[endring.tilStatus]
      ? t(STATUS_STIL[endring.tilStatus]!.noekkel)
      : endring.tilStatus;
    const dato = new Date(endring.dato).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit" });
    return endring.av
      ? t("livssyklus.sporMal", { status: statusLabel, dato, navn: endring.av })
      : t("livssyklus.sporMalUtenNavn", { status: statusLabel, dato });
  }

  return (
    <div>
      <SonetonetSidehode sone="firma" className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">{t("dashbord.prosjekter")}</h1>
          {nyttProsjektKnapp}
        </div>
      </SonetonetSidehode>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left font-medium text-gray-600">
              <th className="px-4 py-3">{t("tabell.prosjekt")}</th>
              <th className="px-4 py-3">{t("tabell.nr")}</th>
              <th className="px-4 py-3 text-center">{t("dashbord.medlemmer")}</th>
              <th className="px-4 py-3 text-center">{t("dashbord.faggrupper")}</th>
              <th className="px-4 py-3">{t("tabell.status")}</th>
              <th className="w-8 px-2 py-3" aria-label={t("handling.mer")}></th>
            </tr>
          </thead>
          <tbody>
            {synlige.map((p) => {
              const handlinger = HANDLINGER[p.status] ?? [];
              const erSperret = p.status === "deactivated";
              const menyApen = apenMeny === p.id;
              const spor = sporLinje(p.sisteStatusEndring);
              return (
                <Fragment key={p.id}>
                  <tr
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      router.push(`/dashbord/${p.id}`);
                    }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashbord/${p.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-gray-400" />
                          {p.name}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.internalProjectNumber ?? ""}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{p.antallMedlemmer}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{p.antallFaggrupper}</td>
                    <td className="px-4 py-3">{statusChip(p.status)}</td>
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setApenMeny(menyApen ? null : p.id)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                        aria-label={t("handling.mer")}
                        aria-expanded={menyApen}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {/* Meny i flyten UNDER raden (ikke overlay) — egen rad, mockup-tro. */}
                  {menyApen && (
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <td colSpan={6} className="px-4 pb-3">
                        <div className="ml-auto w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
                          {handlinger.map((h) => (
                            <button
                              key={h.noekkel}
                              type="button"
                              disabled={settLivssyklus.isPending}
                              onClick={() => settLivssyklus.mutate({ id: p.id, status: h.nyStatus })}
                              className="block w-full px-3 py-2 text-left text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {t(h.noekkel)}
                            </button>
                          ))}
                          {erSperret && (
                            <div className="px-3 py-2 text-xs text-red-700">
                              {t("livssyklus.sperretAvSitedoc")}
                            </div>
                          )}
                          {spor && (
                            <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                              {spor}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {arkiverteFinnes && (
          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            {t("livssyklus.viserAvTotalt", { vist: synlige.length, totalt: prosjekter.length })}
            {" — "}
            <button
              type="button"
              onClick={() => setVisArkiverte((v) => !v)}
              className="font-semibold text-sitedoc-primary hover:underline"
            >
              {visArkiverte ? t("livssyklus.skjulArkiverte") : t("livssyklus.visArkiverte")}
            </button>
          </div>
        )}
      </div>

      {settLivssyklus.error && (
        <p className="mt-3 text-sm text-red-600">{settLivssyklus.error.message}</p>
      )}
    </div>
  );
}
