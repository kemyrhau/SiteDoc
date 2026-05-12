"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";

const STATUSER = ["draft", "sent", "returned", "accepted"] as const;
type StatusFilter = (typeof STATUSER)[number] | "alle";

type ListeRad = {
  id: string;
  dato: Date | string;
  status: string;
  totaltimer: number;
  antallRader: number;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
};

function formatDato(d: Date | string): string {
  const dato = typeof d === "string" ? new Date(d) : d;
  return dato.toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
  });
}

function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay(); // 0 = Sun
  const offset = dag === 0 ? -6 : 1 - dag; // mandag som ukestart
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tilIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function TimerListSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [ukeStart, setUkeStart] = useState<Date>(() => ukestart(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");

  const ukeSlutt = useMemo(() => {
    const d = new Date(ukeStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [ukeStart]);

  const { data: rader, isLoading } = trpc.timer.dagsseddel.list.useQuery({
    projectId: prosjektId,
    fra: tilIso(ukeStart),
    til: tilIso(ukeSlutt),
    ...(statusFilter !== "alle" ? { status: statusFilter } : {}),
  });

  function endreUke(retning: -1 | 1) {
    const d = new Date(ukeStart);
    d.setDate(d.getDate() + 7 * retning);
    setUkeStart(d);
  }

  const ukenummer = (() => {
    // ISO-uke-nummerering
    const d = new Date(ukeStart);
    const torsdag = new Date(d);
    torsdag.setDate(d.getDate() + 3);
    const aar = torsdag.getFullYear();
    const start = new Date(aar, 0, 1);
    const dager = Math.floor(
      (torsdag.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.ceil((dager + start.getDay() + 1) / 7);
  })();

  const ukeSum = useMemo(() => {
    const liste = (rader as unknown as ListeRad[] | undefined) ?? [];
    return liste.reduce((s, r) => s + (r.totaltimer ?? 0), 0);
  }, [rader]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t("timer.tittel")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("timer.beskrivelse")}
          </p>
        </div>
        <Link href={`/dashbord/${prosjektId}/timer/ny`}>
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("timer.nyDagsseddel")}
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <button
          onClick={() => endreUke(-1)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={t("timer.forrigeUke")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {t("timer.ukeNr", { nr: ukenummer })} —{" "}
          {formatDato(ukeStart)} – {formatDato(ukeSlutt)}
          <span className="ml-2 text-gray-500">
            · {t("timer.ukeSum", { timer: ukeSum.toFixed(2) })}
          </span>
        </span>
        <button
          onClick={() => endreUke(1)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={t("timer.nesteUke")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => setUkeStart(ukestart(new Date()))}
          className="rounded px-3 py-1 text-xs font-medium text-sitedoc-primary hover:bg-sitedoc-primary/10"
        >
          {t("timer.idag")}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">{t("timer.status")}:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="alle">{t("timer.alleStatuser")}</option>
            {STATUSER.map((s) => (
              <option key={s} value={s}>
                {t(`timer.statusType.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rader || rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("timer.ingenSedler")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("timer.kol.dato")}</th>
                <th className="px-3 py-3">{t("timer.kol.aktivitet")}</th>
                <th className="px-3 py-3 text-right">{t("timer.kol.timer")}</th>
                <th className="px-3 py-3 text-right">{t("timer.kol.rader")}</th>
                <th className="px-3 py-3">{t("timer.kol.status")}</th>
                <th className="px-3 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {(rader as unknown as ListeRad[]).map((rad) => (
                <tr
                  key={rad.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {formatDato(rad.dato)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {rad.aktivitet?.navn ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">
                    {rad.totaltimer.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {rad.antallRader}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={rad.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashbord/timer/${rad.id}`}
                      className="text-sm font-medium text-sitedoc-primary hover:underline"
                    >
                      {t("timer.aapne")}
                    </Link>
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

