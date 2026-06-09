"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner, Input } from "@sitedoc/ui";
import { Clock, FileText, Briefcase, Activity } from "lucide-react";

/**
 * «Mine timer» — personlig rapport-visning på tvers av prosjekter
 * (Runde 2.7 2026-05-02).
 *
 * Bruker eksisterende timer.dagsseddel.list med userId default = ctx.userId.
 * Aggregeringer beregnes klient-side. Hvis datasett vokser over ~500 sedler
 * for en periode, vurderes egen aggregert query (utsatt).
 */

type Periode = "denne_uken" | "forrige_uken" | "denne_maaneden" | "forrige_maaneden" | "egendefinert";

type ListeRad = {
  id: string;
  dato: Date | string;
  status: string;
  totaltimer: number;
  antallRader: number;
  projectId: string;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
};

function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay();
  const offset = dag === 0 ? -6 : 1 - dag;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tilIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function periodeRange(periode: Periode, fraEgen: string, tilEgen: string): { fra: string; til: string } {
  const naa = new Date();
  if (periode === "denne_uken") {
    const start = ukestart(naa);
    const slutt = new Date(start);
    slutt.setDate(slutt.getDate() + 6);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  if (periode === "forrige_uken") {
    const start = ukestart(naa);
    start.setDate(start.getDate() - 7);
    const slutt = new Date(start);
    slutt.setDate(slutt.getDate() + 6);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  if (periode === "denne_maaneden") {
    const start = new Date(naa.getFullYear(), naa.getMonth(), 1);
    const slutt = new Date(naa.getFullYear(), naa.getMonth() + 1, 0);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  if (periode === "forrige_maaneden") {
    const start = new Date(naa.getFullYear(), naa.getMonth() - 1, 1);
    const slutt = new Date(naa.getFullYear(), naa.getMonth(), 0);
    return { fra: tilIso(start), til: tilIso(slutt) };
  }
  return { fra: fraEgen, til: tilEgen };
}

export default function MineTimerSide() {
  const { t } = useTranslation();
  const [periode, setPeriode] = useState<Periode>("denne_uken");
  const [fraEgen, setFraEgen] = useState<string>(tilIso(ukestart(new Date())));
  const [tilEgen, setTilEgen] = useState<string>(tilIso(new Date()));

  const { fra, til } = useMemo(
    () => periodeRange(periode, fraEgen, tilEgen),
    [periode, fraEgen, tilEgen],
  );

  // hentForTimer (Fase 2 / T.10): inkluderer interne prosjekter så navn på
  // ikke-prosjekt-tid-rader resolver i lista (hentMine ville utelatt dem).
  const { data: prosjekter } = trpc.prosjekt.hentForTimer.useQuery();
  const prosjektNavnMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of (prosjekter ?? []) as Array<{ id: string; name: string }>) {
      m.set(p.id, p.name);
    }
    return m;
  }, [prosjekter]);

  const { data: rader, isLoading } = trpc.timer.dagsseddel.list.useQuery({
    fra,
    til,
  });

  const liste = (rader as unknown as ListeRad[] | undefined) ?? [];

  const oppsummering = useMemo(() => {
    const totalt = liste.reduce((s, r) => s + r.totaltimer, 0);
    const antallSedler = liste.length;
    const prosjektIder = new Set(liste.map((r) => r.projectId));
    const aktivitetIder = new Set(
      liste.map((r) => r.aktivitet?.id).filter((x): x is string => !!x),
    );
    return {
      totalt,
      antallSedler,
      antallProsjekter: prosjektIder.size,
      antallAktiviteter: aktivitetIder.size,
    };
  }, [liste]);

  const perAktivitet = useMemo(() => {
    const m = new Map<string, { navn: string; timer: number }>();
    for (const r of liste) {
      const navn = r.aktivitet?.navn ?? "—";
      const id = r.aktivitet?.id ?? "_ukjent";
      const eks = m.get(id);
      if (eks) eks.timer += r.totaltimer;
      else m.set(id, { navn, timer: r.totaltimer });
    }
    const arr = Array.from(m.values()).sort((a, b) => b.timer - a.timer);
    return arr;
  }, [liste]);

  const perStatus = useMemo(() => {
    const m = new Map<string, { antall: number; timer: number }>();
    for (const r of liste) {
      const eks = m.get(r.status);
      if (eks) {
        eks.antall += 1;
        eks.timer += r.totaltimer;
      } else {
        m.set(r.status, { antall: 1, timer: r.totaltimer });
      }
    }
    return Array.from(m.entries()).map(([status, v]) => ({
      status,
      antall: v.antall,
      timer: v.timer,
    }));
  }, [liste]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t("timer.mine.tittel")}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t("timer.mine.beskrivelse")}
        </p>
      </div>

      {/* Periode-velger */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
        {(["denne_uken", "forrige_uken", "denne_maaneden", "forrige_maaneden", "egendefinert"] as Periode[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriode(p)}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              periode === p
                ? "bg-sitedoc-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t(`timer.mine.periode.${p}`)}
          </button>
        ))}
        {periode === "egendefinert" && (
          <div className="ml-2 flex items-center gap-2">
            <Input
              type="date"
              value={fraEgen}
              onChange={(e) => setFraEgen(e.target.value)}
              className="w-40"
            />
            <span className="text-sm text-gray-500">–</span>
            <Input
              type="date"
              value={tilEgen}
              onChange={(e) => setTilEgen(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      {/* Oppsummerings-kort */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OppsummeringKort
          ikon={<Clock className="h-4 w-4 text-blue-600" />}
          label={t("timer.mine.totaltTimer")}
          verdi={`${oppsummering.totalt.toFixed(2)}t`}
        />
        <OppsummeringKort
          ikon={<FileText className="h-4 w-4 text-purple-600" />}
          label={t("timer.mine.antallSedler")}
          verdi={String(oppsummering.antallSedler)}
        />
        <OppsummeringKort
          ikon={<Briefcase className="h-4 w-4 text-amber-600" />}
          label={t("timer.mine.antallProsjekter")}
          verdi={String(oppsummering.antallProsjekter)}
        />
        <OppsummeringKort
          ikon={<Activity className="h-4 w-4 text-green-600" />}
          label={t("timer.mine.antallAktiviteter")}
          verdi={String(oppsummering.antallAktiviteter)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">{t("timer.mine.ingenSedler")}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Per aktivitet */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.perAktivitet")}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {perAktivitet.map((a) => (
                  <tr key={a.navn} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1.5 text-gray-700">{a.navn}</td>
                    <td className="py-1.5 text-right font-mono text-gray-900">
                      {a.timer.toFixed(2)}t
                    </td>
                    <td className="py-1.5 pl-2 text-right text-xs text-gray-500">
                      {oppsummering.totalt > 0
                        ? `${((a.timer / oppsummering.totalt) * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Per status */}
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.perStatus")}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {perStatus.map((s) => (
                  <tr key={s.status} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-1.5 text-gray-700">
                      {t(`timer.statusType.${s.status}`)}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">{s.antall}</td>
                    <td className="py-1.5 pl-2 text-right font-mono text-gray-900">
                      {s.timer.toFixed(2)}t
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Detaljliste */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">
              {t("timer.mine.alleSedler")}
            </h2>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left">{t("timer.kol.dato")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.mine.kol.prosjekt")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.kol.aktivitet")}</th>
                  <th className="px-2 py-2 text-right">{t("timer.kol.timer")}</th>
                  <th className="px-2 py-2 text-left">{t("timer.kol.status")}</th>
                  <th className="px-2 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {liste.map((rad) => (
                  <tr
                    key={rad.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="px-2 py-1.5 font-medium text-gray-900">
                      {formatDato(rad.dato)}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">
                      {prosjektNavnMap.get(rad.projectId) ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">
                      {rad.aktivitet?.navn ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-900">
                      {rad.totaltimer.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-500">
                      {t(`timer.statusType.${rad.status}`)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
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
          </section>
        </div>
      )}
    </div>
  );
}

function OppsummeringKort({
  ikon,
  label,
  verdi,
}: {
  ikon: React.ReactNode;
  label: string;
  verdi: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {ikon}
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{verdi}</p>
    </div>
  );
}
