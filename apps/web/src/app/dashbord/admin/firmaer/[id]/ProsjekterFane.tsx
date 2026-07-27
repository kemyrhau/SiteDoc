"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Spinner, EmptyState, Button, Input, Modal, SearchInput } from "@sitedoc/ui";
import { FolderKanban, Trash2, Clock, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formaterSistAktivitet } from "../delte-komponenter";

type StatusFilter = "aktive" | "arkiverte" | "alle";
type Sortering = "sistAktivitet" | "navn" | "opprettet";

type ProsjektRad = {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  trialExpiresAt: string | Date | null;
  antallMedlemmer: number;
  antallSjekklister: number;
  antallOppgaver: number;
  sistAktivitet: string | Date | null;
};

type Side = { total: number; page: number; take: number; items: ProsjektRad[] };

const TAKE = 25;

export function ProsjekterFane({
  organizationId,
  tellekort,
}: {
  organizationId: string;
  tellekort: { aktive: number; fullfortArkivert: number; deaktivert: number };
}) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const [sokInput, setSokInput] = useState("");
  const [sok, setSok] = useState("");
  const [status, setStatus] = useState<StatusFilter>("aktive");
  const [sortering, setSortering] = useState<Sortering>("sistAktivitet");
  const [page, setPage] = useState(1);

  // Debounce søk (server-side query)
  useEffect(() => {
    const id = setTimeout(() => {
      setSok(sokInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [sokInput]);

  const query = trpc.admin.hentProsjekterForFirma.useQuery({
    organizationId,
    søk: sok || undefined,
    status,
    sortering,
    page,
    take: TAKE,
  });
  const data = query.data as Side | undefined;

  // Slett
  const [slettId, setSlettId] = useState<string | null>(null);
  const [slettNavn, setSlettNavn] = useState("");
  const [bekreftNavn, setBekreftNavn] = useState("");

  const { data: statistikk, isLoading: statLaster } =
    trpc.admin.hentProsjektStatistikk.useQuery(
      { projectId: slettId! },
      { enabled: !!slettId },
    );

  const slettMutasjon = trpc.admin.slettProsjekt.useMutation({
    onSuccess: () => {
      utils.admin.hentProsjekterForFirma.invalidate({ organizationId });
      utils.admin.hentFirmaDetalj.invalidate({ organizationId });
      utils.admin.hentAlleOrganisasjoner.invalidate();
      setSlettId(null);
      setSlettNavn("");
      setBekreftNavn("");
    },
  });

  function statusLabel(s: string) {
    switch (s) {
      case "active":
        return t("status.aktiv");
      case "archived":
        return t("status.arkivert");
      case "completed":
        return t("admin.prosjektStatus.fullfort");
      case "deactivated":
        return t("admin.prosjektStatus.deaktivert");
      default:
        return s;
    }
  }
  function statusStil(s: string) {
    if (s === "active") return "bg-emerald-100 text-emerald-700";
    if (s === "deactivated") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-600";
  }

  function dagerIgjen(trial: string | Date) {
    const utloper = new Date(trial);
    return Math.ceil((utloper.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  const items = data?.items ?? [];
  const totalSider = data ? Math.max(1, Math.ceil(data.total / data.take)) : 1;
  const harTrial = items.some((i) => i.trialExpiresAt);
  const harData =
    statistikk &&
    (statistikk.sjekklister > 0 ||
      statistikk.oppgaver > 0 ||
      statistikk.maler > 0 ||
      statistikk.tegninger > 0 ||
      statistikk.mapper > 0);

  return (
    <div>
      {/* Tellekort */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Tellekort label={t("admin.firmaDetalj.tellekort.aktive")} verdi={tellekort.aktive} stil="emerald" />
        <Tellekort label={t("admin.firmaDetalj.tellekort.fullfortArkivert")} verdi={tellekort.fullfortArkivert} stil="gray" />
        <Tellekort label={t("admin.firmaDetalj.tellekort.deaktivert")} verdi={tellekort.deaktivert} stil="red" />
      </div>

      {/* Filterrad */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="max-w-xs flex-1">
          <SearchInput verdi={sokInput} onChange={setSokInput} placeholder={t("admin.firmaDetalj.sokProsjekt")} />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="aktive">{t("admin.firmaDetalj.filter.aktive")}</option>
          <option value="arkiverte">{t("admin.firmaDetalj.filter.arkiverte")}</option>
          <option value="alle">{t("status.alle")}</option>
        </select>
        <select
          value={sortering}
          onChange={(e) => {
            setSortering(e.target.value as Sortering);
            setPage(1);
          }}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="sistAktivitet">{t("admin.firmaDetalj.sort.sistAktivitet")}</option>
          <option value="navn">{t("admin.firmaDetalj.sort.navn")}</option>
          <option value="opprettet">{t("admin.firmaDetalj.sort.opprettet")}</option>
        </select>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("admin.firmaDetalj.ingenProsjekterTittel")} description={t("admin.firmaDetalj.ingenProsjekterBeskrivelse")} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t("admin.firmaDetalj.kol.prosjekt")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tabell.nr")}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">{t("admin.firmaDetalj.kol.medl")}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">{t("admin.firmaDetalj.kol.sjekk")}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">{t("admin.firmaDetalj.kol.oppg")}</th>
                  {harTrial && <th className="px-4 py-3 text-left font-medium text-gray-600">{t("admin.firmaDetalj.kol.proveperiode")}</th>}
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t("admin.firmaer.kolSistAktivitet")}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tabell.status")}</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const dager = p.trialExpiresAt ? dagerIgjen(p.trialExpiresAt) : null;
                  return (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashbord/${p.id}`} className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600">
                          <FolderKanban className="h-4 w-4 text-gray-400" />
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.projectNumber}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.antallMedlemmer}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.antallSjekklister}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.antallOppgaver}</td>
                      {harTrial && (
                        <td className="px-4 py-3">
                          {dager === null ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : dager <= 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              {t("admin.firmaDetalj.utlopt")}
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                dager <= 7 ? "bg-red-100 text-red-700" : dager <= 14 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {t("admin.firmaDetalj.dagerIgjen", { dager })}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-500">{formaterSistAktivitet(p.sistAktivitet, i18n.language, "—")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStil(p.status)}`}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSlettId(p.id);
                            setSlettNavn(p.name);
                            setBekreftNavn("");
                          }}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title={t("admin.firmaDetalj.slettProsjekt")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginering */}
          {data && data.total > data.take && (
            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <span>{t("admin.firmaDetalj.antallProsjekter", { antall: data.total })}</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((p) => p - 1)}>
                  {t("handling.tilbake")}
                </Button>
                <span>{t("admin.firmaDetalj.sideAvTotalt", { side: page, totalt: totalSider })}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalSider || query.isFetching} onClick={() => setPage((p) => p + 1)}>
                  {t("handling.neste")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Slett-modal */}
      <Modal open={!!slettId} onClose={() => setSlettId(null)} title={t("admin.firmaDetalj.slettProsjekt")}>
        <div className="space-y-4">
          {statLaster ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <>
              {harData && statistikk && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-medium text-red-800">{t("admin.firmaDetalj.slettAdvarsel")}</p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {statistikk.sjekklister > 0 && <li>{t("admin.firmaDetalj.slettSjekklister", { antall: statistikk.sjekklister })}</li>}
                    {statistikk.oppgaver > 0 && <li>{t("admin.firmaDetalj.slettOppgaver", { antall: statistikk.oppgaver })}</li>}
                    {statistikk.maler > 0 && <li>{t("admin.firmaDetalj.slettMaler", { antall: statistikk.maler })}</li>}
                    {statistikk.tegninger > 0 && <li>{t("admin.firmaDetalj.slettTegninger", { antall: statistikk.tegninger })}</li>}
                    {statistikk.mapper > 0 && <li>{t("admin.firmaDetalj.slettMapper", { antall: statistikk.mapper })}</li>}
                    {statistikk.faggrupper > 0 && <li>{t("admin.firmaDetalj.slettFaggrupper", { antall: statistikk.faggrupper })}</li>}
                    {statistikk.medlemmer > 0 && <li>{t("admin.firmaDetalj.slettMedlemmer", { antall: statistikk.medlemmer })}</li>}
                  </ul>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {t("admin.firmaDetalj.slettBekreftTekst")} <span className="font-semibold text-gray-900">{slettNavn}</span>
              </p>
              <Input label={t("admin.firmaDetalj.prosjektnavn")} value={bekreftNavn} onChange={(e) => setBekreftNavn(e.target.value)} placeholder={slettNavn} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setSlettId(null)}>
                  {t("handling.avbryt")}
                </Button>
                <Button
                  variant="danger"
                  disabled={bekreftNavn !== slettNavn || slettMutasjon.isPending}
                  onClick={() => slettMutasjon.mutate({ projectId: slettId! })}
                >
                  {t("admin.firmaDetalj.slettPermanent")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Tellekort({ label, verdi, stil }: { label: string; verdi: number; stil: "emerald" | "gray" | "red" }) {
  // Farge (rød/grønn) kun når verdi > 0 — et rødt «0» signaliserer problem der
  // intet finnes. Nøytral grå ved 0 (fabel-gate 2026-07-27).
  const aktivFarge =
    stil === "emerald" ? "text-emerald-700" : stil === "red" ? "text-red-700" : "text-gray-700";
  const farge = verdi > 0 ? aktivFarge : "text-gray-300";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className={`text-2xl font-semibold ${farge}`}>{verdi}</p>
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
}
