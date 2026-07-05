"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { SearchInput } from "@sitedoc/ui";
import { Users, AlertTriangle, Printer, HardHat } from "lucide-react";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";

/**
 * Mannskap — §15-vy (byggherreforskriften): hvem er på plassen nå.
 * Vy i PSI-modulen. Byggeplass-scoped → bruker toppbar-byggeplassvelger
 * (kaller IKKE useToppbarFiltre, default aktiv). Klokkeslett kan være skjult
 * (tidSkjult) når innlogget bruker er byggherre-org — feltnivå-isolasjon i API.
 */

type MannskapRad = {
  id: string;
  byggeplassId: string | null;
  byggeplassNavn: string | null;
  userId: string | null;
  navn: string | null;
  arbeidsgiver: string | null;
  hmsKortNr: string | null;
  harIkkeHmsKort: boolean;
  kilde: string;
  autoUtlogget: boolean;
  innsjekkTid: string | Date | null;
  utsjekkTid: string | Date | null;
  tidSkjult: boolean;
};

function klokke(v: string | Date | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleTimeString("no-NB", { hour: "2-digit", minute: "2-digit" });
}

export default function MannskapSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;
  const { aktivByggeplass } = useByggeplass();

  const [sok, setSok] = useState("");
  const [firmaFilter, setFirmaFilter] = useState<string>("alle");

  const { data, isLoading } = trpc.mannskap.hentPaaPlassen.useQuery(
    {
      projectId: prosjektId,
      ...(aktivByggeplass?.id ? { byggeplassId: aktivByggeplass.id } : {}),
    },
    { enabled: !!prosjektId },
  );

  const rader = (data as unknown as MannskapRad[] | undefined) ?? [];

  const firmaer = useMemo(() => {
    const s = new Set<string>();
    for (const r of rader) if (r.arbeidsgiver) s.add(r.arbeidsgiver);
    return Array.from(s).sort();
  }, [rader]);

  const filtrert = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return rader.filter((r) => {
      if (firmaFilter !== "alle" && r.arbeidsgiver !== firmaFilter) return false;
      if (!q) return true;
      return (
        (r.navn ?? "").toLowerCase().includes(q) ||
        (r.hmsKortNr ?? "").toLowerCase().includes(q)
      );
    });
  }, [rader, sok, firmaFilter]);

  const antallUtenHms = filtrert.filter((r) => !r.hmsKortNr).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <HardHat className="h-6 w-6 text-sitedoc-primary" />
            {t("mannskap.tittel")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">{t("mannskap.beskrivelse")}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" />
          {t("mannskap.eksporter15")}
        </button>
      </div>

      {/* På plass nå + filtre */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
          <Users className="h-4 w-4 text-sitedoc-primary" />
          {t("mannskap.paaPlassNaa", { antall: filtrert.length })}
          {aktivByggeplass?.name ? (
            <span className="text-gray-400">· {aktivByggeplass.name}</span>
          ) : (
            <span className="text-gray-400">· {t("mannskap.heleProsjektet")}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <SearchInput
              verdi={sok}
              onChange={setSok}
              placeholder={t("mannskap.sokPlaceholder")}
            />
          </div>
          <select
            value={firmaFilter}
            onChange={(e) => setFirmaFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="alle">{t("mannskap.alleFirmaer")}</option>
            {firmaer.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {antallUtenHms > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          {t("mannskap.utenHmsVarsel", { antall: antallUtenHms })}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : filtrert.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("mannskap.ingenPaaPlass")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("mannskap.kol.navn")}</th>
                <th className="px-3 py-3">{t("mannskap.kol.arbeidsgiver")}</th>
                <th className="px-3 py-3">{t("mannskap.kol.hmsKort")}</th>
                <th className="px-3 py-3">{t("mannskap.kol.byggeplass")}</th>
                <th className="px-3 py-3 text-right">{t("mannskap.kol.inn")}</th>
                <th className="px-3 py-3 text-right">{t("mannskap.kol.ut")}</th>
              </tr>
            </thead>
            <tbody>
              {filtrert.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{r.navn ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.arbeidsgiver ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.hmsKortNr ? (
                      <span className="font-mono text-xs text-gray-700">{r.hmsKortNr}</span>
                    ) : (
                      <span className="text-xs text-amber-600">
                        {t("mannskap.hmsMangler")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.byggeplassNavn ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">
                    {r.tidSkjult ? (
                      <span className="text-gray-300" title={t("mannskap.tidSkjult")}>
                        ••:••
                      </span>
                    ) : (
                      klokke(r.innsjekkTid)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">
                    {r.tidSkjult ? (
                      <span className="text-gray-300">••:••</span>
                    ) : (
                      klokke(r.utsjekkTid)
                    )}
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
