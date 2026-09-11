"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Trash2, RotateCcw, Trash } from "lucide-react";
import { Spinner, Button, Modal, StatusBadge } from "@sitedoc/ui";
import { formaterNummer } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

/**
 * F0 Papirkurv — soft-slettede sjekklister + oppgaver med «dager igjen» før
 * 90-dagers auto-hardslett. Tilgang: prosjektadmin (prosjekt-bredt) + oppretter
 * (egne). Gjenopprett (oppretter + prosjektadmin) og Slett endelig (kun
 * prosjektadmin) — server håndhever; UI speiler.
 *
 * Kenneth-vedtak 2026-08-18 (del 1+2): «Tøm papirkurv» + flervalg med avkryssing
 * for både sletting OG gjenoppretting (gjenoppretting er undervurdert: slettet
 * mange ved uhell → tilbake i én operasjon). Per-rad-handlingene er uendret.
 */

interface PapirkurvDok {
  id: string;
  type: "checklist" | "task";
  title: string;
  number: number | null;
  status: string;
  prefix: string | null;
  malNavn: string | null;
  deletedAt: string | null;
  dagerIgjen: number;
  slettetAvNavn: string | null;
  erOppretter: boolean;
}

/** Sammensatt nøkkel — id er ikke garantert unik på tvers av checklist/task. */
function dokNøkkel(d: { id: string; type: "checklist" | "task" }): string {
  return `${d.type}:${d.id}`;
}

export default function PapirkurvSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;
  const utils = trpc.useUtils();

  const [slettEndeligMål, setSlettEndeligMål] = useState<PapirkurvDok | null>(null);
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [visSlettValgte, setVisSlettValgte] = useState(false);
  const [visTøm, setVisTøm] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  const { data, isLoading } = trpc.papirkurv.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const nullstillValg = () => setValgte(new Set());
  const invaliderListe = () =>
    utils.papirkurv.hentForProsjekt.invalidate({ projectId: prosjektId! });

  const gjenopprett = trpc.papirkurv.gjenopprett.useMutation({
    onSuccess: () => {
      setResultat(null);
      invaliderListe();
    },
  });
  const slettEndelig = trpc.papirkurv.slettEndelig.useMutation({
    onSuccess: () => {
      setSlettEndeligMål(null);
      setResultat(null);
      invaliderListe();
    },
  });
  const gjenopprettFlere = trpc.papirkurv.gjenopprettFlere.useMutation({
    onSuccess: (r) => {
      setResultat(
        t("papirkurv.resultatGjenopprettet", { sjekklister: r.sjekklister, oppgaver: r.oppgaver }),
      );
      nullstillValg();
      invaliderListe();
    },
  });
  const slettEndeligFlere = trpc.papirkurv.slettEndeligFlere.useMutation({
    onSuccess: (r) => {
      setVisSlettValgte(false);
      setResultat(
        t("papirkurv.resultatSlettet", { sjekklister: r.sjekklister, oppgaver: r.oppgaver }),
      );
      nullstillValg();
      invaliderListe();
    },
  });
  const tomPapirkurv = trpc.papirkurv.tomPapirkurv.useMutation({
    onSuccess: (r) => {
      setVisTøm(false);
      setResultat(
        t("papirkurv.resultatSlettet", { sjekklister: r.sjekklister, oppgaver: r.oppgaver }),
      );
      nullstillValg();
      invaliderListe();
    },
  });

  const erProsjektadmin = data?.erProsjektadmin ?? false;
  const dokumenter = (data?.dokumenter ?? []) as PapirkurvDok[];

  const valgteDok = useMemo(
    () => dokumenter.filter((d) => valgte.has(dokNøkkel(d))),
    [dokumenter, valgte],
  );
  const antallValgt = valgteDok.length;
  const alleValgt = dokumenter.length > 0 && antallValgt === dokumenter.length;
  // Gjenopprett bulk krever at brukeren eier hver valgt rad (eller er admin).
  const kanGjenoppretteValgte =
    antallValgt > 0 && (erProsjektadmin || valgteDok.every((d) => d.erOppretter));
  const valgteItems = valgteDok.map((d) => ({ id: d.id, type: d.type }));
  const bulkKjører =
    gjenopprettFlere.isPending || slettEndeligFlere.isPending || tomPapirkurv.isPending;

  function toggleRad(d: PapirkurvDok) {
    setResultat(null);
    setValgte((forrige) => {
      const neste = new Set(forrige);
      const n = dokNøkkel(d);
      if (neste.has(n)) neste.delete(n);
      else neste.add(n);
      return neste;
    });
  }

  function toggleAlle() {
    setResultat(null);
    setValgte(alleValgt ? new Set() : new Set(dokumenter.map(dokNøkkel)));
  }

  function typeLabel(type: "checklist" | "task"): string {
    return type === "checklist" ? t("papirkurv.typeSjekkliste") : t("papirkurv.typeOppgave");
  }

  function dokNummer(d: PapirkurvDok): string {
    // Full form «SJA-012» — padda til 3 som alle andre visninger (drift-fiks: sto
    // før upadda «SJA-12», eneste full-form uten pad).
    return (
      formaterNummer(d.prefix, d.number, { separator: "-", pad: 3, manglerPrefiks: "nummer" }) ?? "—"
    );
  }

  if (!prosjektId) {
    return <p className="p-6 text-sm text-gray-400">{t("papirkurv.velgProsjekt")}</p>;
  }

  return (
    <div className="max-w-5xl p-6">
      <SonetonetSidehode sone="prosjekt" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
              <Trash2 className="h-6 w-6 text-sitedoc-primary" />
              {t("papirkurv.tittel")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{t("papirkurv.beskrivelse")}</p>
          </div>
          <div className="flex items-center gap-2">
            {erProsjektadmin && dokumenter.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setResultat(null);
                  setVisTøm(true);
                }}
              >
                <Trash className="mr-1 h-4 w-4" />
                {t("papirkurv.tomKnapp")}
              </Button>
            )}
            <HjelpKnapp>
              <HjelpFane tittel={t("papirkurv.tittel")}>
                <p>{t("hjelp.papirkurv.tekst")}</p>
              </HjelpFane>
            </HjelpKnapp>
          </div>
        </div>
      </SonetonetSidehode>

      {resultat && (
        <p className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">{resultat}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : dokumenter.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">{t("papirkurv.tom")}</p>
      ) : (
        <>
          {/* Handlingslinje for flervalg — vises når minst én rad er valgt. */}
          {antallValgt > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-sitedoc-primary/30 bg-sitedoc-primary/5 px-4 py-2">
              <span className="text-sm font-medium text-gray-700">
                {t("papirkurv.antallValgt", { antall: antallValgt })}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => gjenopprettFlere.mutate({ projectId: prosjektId, items: valgteItems })}
                  disabled={!kanGjenoppretteValgte || bulkKjører}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  {t("papirkurv.gjenopprettValgte")}
                </Button>
                {erProsjektadmin && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setResultat(null);
                      setVisSlettValgte(true);
                    }}
                    disabled={bulkKjører}
                  >
                    <Trash className="mr-1 h-4 w-4" />
                    {t("papirkurv.slettValgte")}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-gray-300"
                      aria-label={t("papirkurv.velgAlle")}
                      checked={alleValgt}
                      ref={(el) => {
                        if (el) el.indeterminate = antallValgt > 0 && !alleValgt;
                      }}
                      onChange={toggleAlle}
                    />
                  </th>
                  <th className="px-4 py-2">{t("papirkurv.kolonne.dokument")}</th>
                  <th className="px-4 py-2">{t("papirkurv.kolonne.type")}</th>
                  <th className="px-4 py-2">{t("papirkurv.kolonne.status")}</th>
                  <th className="px-4 py-2">{t("papirkurv.kolonne.slettetAv")}</th>
                  <th className="px-4 py-2">{t("papirkurv.kolonne.dagerIgjen")}</th>
                  <th className="px-4 py-2 text-right">{t("papirkurv.kolonne.handlinger")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dokumenter.map((d) => {
                  const valgt = valgte.has(dokNøkkel(d));
                  return (
                    <tr key={dokNøkkel(d)} className={valgt ? "bg-sitedoc-primary/5" : "hover:bg-gray-50"}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer rounded border-gray-300"
                          aria-label={t("papirkurv.velgRad", { tittel: d.title })}
                          checked={valgt}
                          onChange={() => toggleRad(d)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{d.title}</div>
                        <div className="text-xs text-gray-400">{dokNummer(d)}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{typeLabel(d.type)}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-2 text-gray-600">{d.slettetAvNavn ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            d.dagerIgjen <= 7
                              ? "font-medium text-sitedoc-error"
                              : "text-gray-700"
                          }
                        >
                          {t("papirkurv.dagerIgjen", { dager: d.dagerIgjen })}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          {(d.erOppretter || erProsjektadmin) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => gjenopprett.mutate({ id: d.id, type: d.type })}
                              disabled={gjenopprett.isPending}
                            >
                              <RotateCcw className="mr-1 h-4 w-4" />
                              {t("statushandling.gjenopprett")}
                            </Button>
                          )}
                          {erProsjektadmin && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setSlettEndeligMål(d)}
                            >
                              <Trash className="mr-1 h-4 w-4" />
                              {t("statushandling.slettEndelig")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Per-rad slett endelig */}
      <Modal
        open={slettEndeligMål !== null}
        onClose={() => setSlettEndeligMål(null)}
        title={t("papirkurv.slettEndeligTittel")}
      >
        <p className="text-sm text-gray-600">
          {t("papirkurv.slettEndeligBekreft", { tittel: slettEndeligMål?.title ?? "" })}
        </p>
        <p className="mt-2 text-sm text-gray-500">{t("flythjelp.handling.slettEndelig")}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSlettEndeligMål(null)}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              slettEndeligMål &&
              slettEndelig.mutate({ id: slettEndeligMål.id, type: slettEndeligMål.type })
            }
            disabled={slettEndelig.isPending}
          >
            {t("statushandling.slettEndelig")}
          </Button>
        </div>
      </Modal>

      {/* Slett valgte endelig (bulk) */}
      <Modal
        open={visSlettValgte}
        onClose={() => setVisSlettValgte(false)}
        title={t("papirkurv.slettValgteTittel")}
      >
        <p className="text-sm text-gray-600">
          {t("papirkurv.slettValgteBekreft", { antall: antallValgt })}
        </p>
        <p className="mt-2 text-sm text-gray-500">{t("flythjelp.handling.slettEndelig")}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVisSlettValgte(false)}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            onClick={() => slettEndeligFlere.mutate({ projectId: prosjektId, items: valgteItems })}
            disabled={slettEndeligFlere.isPending}
          >
            {t("papirkurv.slettValgte")}
          </Button>
        </div>
      </Modal>

      {/* Tøm papirkurv */}
      <Modal open={visTøm} onClose={() => setVisTøm(false)} title={t("papirkurv.tomTittel")}>
        <p className="text-sm text-gray-600">
          {t("papirkurv.tomBekreft", { antall: dokumenter.length })}
        </p>
        <p className="mt-2 text-sm text-gray-500">{t("flythjelp.handling.slettEndelig")}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVisTøm(false)}>
            {t("handling.avbryt")}
          </Button>
          <Button
            variant="danger"
            onClick={() => tomPapirkurv.mutate({ projectId: prosjektId })}
            disabled={tomPapirkurv.isPending}
          >
            {t("papirkurv.tomKnapp")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
