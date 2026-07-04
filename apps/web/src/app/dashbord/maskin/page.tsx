"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Truck, Wrench, Hammer, Search, X, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import type { MaskinKategori } from "@/lib/maskin-typer";
import { useFirma } from "@/kontekst/firma-kontekst";

const KATEGORIER: ReadonlyArray<MaskinKategori> = ["kjoretoy", "anleggsmaskin", "smautstyr"];
const STATUS_FILTER: ReadonlyArray<string> = ["tilgjengelig", "utlaant", "paa_service"];

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
  internNavn: string | null;
  internNummer: string | null;
  registreringsnummer: string | null;
  status: string;
  ansvarligUserId: string | null;
}

interface Bruker {
  id: string;
  name: string | null;
  email: string;
}

export default function MaskinPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { valgtFirma, kanAdministrereFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [valgtKategori, setValgtKategori] = useState<MaskinKategori | null>(null);
  const [valgtStatus, setValgtStatus] = useState<string | null>(null);
  const [valgtAnsvarlig, setValgtAnsvarlig] = useState<string | "">("");
  const [sok, setSok] = useState("");
  const [visUtgaatte, setVisUtgaatte] = useState(false);

  const { data, isLoading } = trpc.maskin.equipment.list.useQuery(
    {
      organizationId: orgId,
      kategori: valgtKategori ?? undefined,
      status: (valgtStatus as "tilgjengelig" | "utlaant" | "paa_service" | undefined) ?? undefined,
      ansvarligUserId: valgtAnsvarlig || undefined,
      sok: sok.trim() || undefined,
      inkluderUtgaatt: visUtgaatte,
    },
    { enabled: !!orgId },
  );

  const { data: brukereData } = trpc.maskin.equipment.hentMuligeAnsvarlige.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );
  const { data: antallPerKat } = trpc.maskin.equipment.antallPerKategori.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId },
  );

  const utstyr = (data ?? []) as UtstyrRad[];
  const brukere = (brukereData ?? []) as Bruker[];

  const brukerNavnMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of brukere) m.set(b.id, b.name ?? b.email);
    return m;
  }, [brukere]);

  const kategoriCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of (antallPerKat ?? []) as Array<{ kategori: string; antall: number }>) {
      m.set(r.kategori, r.antall);
    }
    return m;
  }, [antallPerKat]);

  const harAktivtFilter =
    valgtKategori !== null ||
    valgtStatus !== null ||
    valgtAnsvarlig !== "" ||
    sok.trim() !== "" ||
    visUtgaatte;

  const totalt = (antallPerKat ?? []).reduce(
    (s: number, r: { antall: number }) => s + r.antall,
    0,
  );

  function tilbakestillFilter() {
    setValgtKategori(null);
    setValgtStatus(null);
    setValgtAnsvarlig("");
    setSok("");
    setVisUtgaatte(false);
  }

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
        <h1 className="text-xl font-semibold text-gray-900">{t("maskin.tittel")}</h1>
        {/* Sak #5: opprett/import gates på admin-kapabilitet. Ansatte beholder
            maskin-lista (de logger maskinbruk), men når ikke skjemaene. */}
        {kanAdministrereFirma && (
          <div className="flex items-center gap-2">
            <Link
              href="/dashbord/maskin/import"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t("maskin.importerFraSmartDok")}
            </Link>
            <Link
              href="/dashbord/maskin/nytt"
              className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("maskin.leggTilUtstyr")}
            </Link>
          </div>
        )}
      </div>

      {/* Filter-bar */}
      <div className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{t("maskin.filter.kategori")}:</span>
          <FilterChip
            label={t("maskin.filter.alle")}
            aktiv={valgtKategori === null}
            onClick={() => setValgtKategori(null)}
          />
          {KATEGORIER.map((k) => (
            <FilterChip
              key={k}
              label={`${t(`maskin.kategori${k.charAt(0).toUpperCase() + k.slice(1)}`)} (${kategoriCount.get(k) ?? 0})`}
              aktiv={valgtKategori === k}
              onClick={() => setValgtKategori(valgtKategori === k ? null : k)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{t("maskin.filter.status")}:</span>
          <FilterChip
            label={t("maskin.filter.alle")}
            aktiv={valgtStatus === null}
            onClick={() => setValgtStatus(null)}
          />
          {STATUS_FILTER.map((s) => {
            const noekkel =
              s === "paa_service"
                ? "maskin.statusPaaService"
                : `maskin.status${s.charAt(0).toUpperCase() + s.slice(1)}`;
            return (
              <FilterChip
                key={s}
                label={t(noekkel)}
                aktiv={valgtStatus === s}
                onClick={() => setValgtStatus(valgtStatus === s ? null : s)}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">
              {t("maskin.filter.ansvarlig")}:
            </span>
            <select
              value={valgtAnsvarlig}
              onChange={(e) => setValgtAnsvarlig(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="">{t("maskin.filter.alle")}</option>
              {brukere.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name ?? b.email}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={visUtgaatte}
              onChange={(e) => setVisUtgaatte(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
            />
            {t("maskin.filter.visUtgaatte")}
          </label>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={sok}
                onChange={(e) => setSok(e.target.value)}
                placeholder={t("maskin.filter.sokPlaceholder")}
                className="w-64 rounded-md border border-gray-300 pl-7 pr-3 py-1 text-xs"
              />
            </div>
            {harAktivtFilter && (
              <button
                onClick={tilbakestillFilter}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
              >
                <X className="h-3 w-3" />
                {t("maskin.filter.tilbakestill")}
              </button>
            )}
          </div>
        </div>

        {harAktivtFilter && (
          <p className="text-xs text-gray-500">
            {t("maskin.filter.viserAvTotalt", { vist: utstyr.length, totalt })}
          </p>
        )}
      </div>

      {/* Liste */}
      {utstyr.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <h2 className="text-sm font-medium text-gray-900">
            {harAktivtFilter
              ? t("maskin.filter.ingenTreff")
              : t("maskin.ingenUtstyrTittel")}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {harAktivtFilter
              ? t("maskin.filter.justerFilter")
              : t("maskin.ingenUtstyrBeskrivelse")}
          </p>
          {!harAktivtFilter && kanAdministrereFirma && (
            <Link
              href="/dashbord/maskin/nytt"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("maskin.leggTilUtstyr")}
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.kategori")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.type")}</th>
                <th className="px-4 py-2 text-left font-medium">
                  {t("maskin.merke")} / {t("maskin.modell")}
                </th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.regnr")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.internNummer")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.ansvarlig")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("maskin.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utstyr.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/dashbord/maskin/${u.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="flex items-center gap-2 px-4 py-2">
                    {KATEGORI_IKON[u.kategori as MaskinKategori]}
                    <span className="text-gray-700">
                      {t(`maskin.kategori${u.kategori.charAt(0).toUpperCase() + u.kategori.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">{u.type}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {[u.merke, u.modell].filter(Boolean).join(" ") ||
                      u.internNavn ||
                      "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {u.registreringsnummer ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{u.internNummer ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {u.ansvarligUserId
                      ? brukerNavnMap.get(u.ansvarligUserId) ?? "—"
                      : "—"}
                  </td>
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

function FilterChip({
  label,
  aktiv,
  onClick,
}: {
  label: string;
  aktiv: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
        aktiv
          ? "border-sitedoc-primary bg-sitedoc-primary text-white"
          : "border-gray-300 bg-white text-gray-700 hover:border-sitedoc-primary"
      }`}
    >
      {label}
    </button>
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
          : status === "utgaatt"
            ? "bg-gray-100 text-gray-600"
            : "bg-gray-100 text-gray-800";
  const noekkel =
    status === "paa_service"
      ? "maskin.statusPaaService"
      : `maskin.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${farge}`}>
      {t(noekkel)}
    </span>
  );
}
