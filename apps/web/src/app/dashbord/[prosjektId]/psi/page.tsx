"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner, Card } from "@sitedoc/ui";
import { ShieldCheck, CheckCircle, Clock, AlertTriangle, Users, Building2, Globe } from "lucide-react";

type Filter = "alle" | "fullfort" | "paagaar" | "utdatert";

export default function PsiDashboardSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const [filter, setFilter] = useState<Filter>("alle");
  const [valgtPsiId, setValgtPsiId] = useState<string | null>(null);

  // Hent alle PSI-er for prosjektet
  const { data: psiListe, isLoading: psiLaster } = trpc.psi.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );

  type PsiRad = NonNullable<typeof psiListe>[number];

  // Velg første PSI som default
  const aktivPsiId = valgtPsiId ?? (psiListe as PsiRad[] | undefined)?.[0]?.id ?? null;

  // Hent signaturer for valgt PSI
  const { data, isLoading: sigLaster } = trpc.psi.hentSignaturer.useQuery(
    { psiId: aktivPsiId! },
    { enabled: !!aktivPsiId },
  );

  const isLoading = psiLaster || (sigLaster && !!aktivPsiId);

  if (psiLaster) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!psiListe || (psiListe as PsiRad[]).length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
        <ShieldCheck className="h-12 w-12 text-gray-300" />
        <p className="text-sm text-gray-500">{t("psi.ingenPsi")}</p>
        <a
          href="/dashbord/oppsett/field/psi"
          className="text-sm text-sitedoc-primary hover:underline"
        >
          {t("psi.gaaTilOppsett")}
        </a>
      </div>
    );
  }

  const harFlerePsi = (psiListe as PsiRad[]).length > 1;
  const signaturer = data?.signaturer ?? [];
  const versjon = data?.versjon ?? 0;

  const fullforte = signaturer.filter((s) => s.fullfort && s.gjeldende);
  const paagaar = signaturer.filter((s) => !s.fullfort);
  const utdaterte = signaturer.filter((s) => s.fullfort && !s.gjeldende);

  const filtrert = filter === "alle"
    ? signaturer
    : filter === "fullfort"
      ? fullforte
      : filter === "paagaar"
        ? paagaar
        : utdaterte;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-sitedoc-primary" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t("psi.signaturoversikt")}</h1>
              {aktivPsiId && <p className="text-sm text-gray-500">{t("psi.versjon")} {versjon}</p>}
            </div>
          </div>
          <a
            href="/dashbord/oppsett/field/psi"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t("nav.oppsett")}
          </a>
        </div>

        {/* Bygnings-tabs (kun hvis flere PSI) */}
        {harFlerePsi && (
          <div className="mb-6 flex gap-2 overflow-x-auto">
            {(psiListe as PsiRad[]).map((psi) => {
              const erValgt = psi.id === aktivPsiId;
              return (
                <button
                  key={psi.id}
                  onClick={() => { setValgtPsiId(psi.id); setFilter("alle"); }}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm transition-colors ${
                    erValgt
                      ? "border-sitedoc-primary bg-blue-50 font-medium text-sitedoc-primary"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {psi.building ? (
                    <><Building2 className="h-3.5 w-3.5" /> {psi.building.name}</>
                  ) : (
                    <><Globe className="h-3.5 w-3.5" /> {t("psi.heleProsjektet")}</>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Statistikk */}
        {sigLaster ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-4 gap-3">
              <StatKort
                ikon={<Users className="h-5 w-5 text-gray-500" />}
                tall={signaturer.length}
                label={t("psi.totalt")}
                aktiv={filter === "alle"}
                onClick={() => setFilter("alle")}
              />
              <StatKort
                ikon={<CheckCircle className="h-5 w-5 text-green-500" />}
                tall={fullforte.length}
                label={t("psi.fullfort")}
                aktiv={filter === "fullfort"}
                onClick={() => setFilter("fullfort")}
              />
              <StatKort
                ikon={<Clock className="h-5 w-5 text-amber-500" />}
                tall={paagaar.length}
                label={t("psi.paagaar")}
                aktiv={filter === "paagaar"}
                onClick={() => setFilter("paagaar")}
              />
              <StatKort
                ikon={<AlertTriangle className="h-5 w-5 text-red-400" />}
                tall={utdaterte.length}
                label={t("psi.utdatert")}
                aktiv={filter === "utdatert"}
                onClick={() => setFilter("utdatert")}
              />
            </div>

            {/* Tabell */}
            {filtrert.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
                Ingen signaturer å vise
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Navn</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Firma</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("psi.hmsKort")}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("psi.versjon")}</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Dato</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">{t("toppbar.spraak")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtrert.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.brukerNavn}</td>
                        <td className="px-4 py-2.5 text-gray-600">{s.firma ?? s.brukerEpost ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {s.hmsKortNr ? (
                            <span className="font-mono text-xs">{s.hmsKortNr}</span>
                          ) : s.harIkkeHmsKort ? (
                            <span className="text-xs text-amber-600">Mangler</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">v{s.signertVersjon}</td>
                        <td className="px-4 py-2.5">
                          {s.fullfort && s.gjeldende && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" /> {t("psi.signert")}
                            </span>
                          )}
                          {s.fullfort && !s.gjeldende && (
                            <span className="flex items-center gap-1 text-red-500">
                              <AlertTriangle className="h-3.5 w-3.5" /> {t("psi.utdatert")}
                            </span>
                          )}
                          {!s.fullfort && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Clock className="h-3.5 w-3.5" /> {t("psi.paagaar")} ({s.progresjon})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {s.fullfortDato
                            ? new Date(s.fullfortDato).toLocaleDateString("nb-NO")
                            : new Date(s.startetDato).toLocaleDateString("nb-NO")}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{s.spraak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatKort({
  ikon,
  tall,
  label,
  aktiv,
  onClick,
}: {
  ikon: React.ReactNode;
  tall: number;
  label: string;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${
        aktiv ? "border-sitedoc-primary bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2">
        {ikon}
        <span className="text-2xl font-bold text-gray-900">{tall}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </button>
  );
}
