"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Trash2, RotateCcw, Trash } from "lucide-react";
import { Spinner, Button, Modal, StatusBadge } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";
import { useToppbarFiltre } from "@/hooks/useToppbarFiltre";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

/**
 * F0 Papirkurv — soft-slettede sjekklister + oppgaver med «dager igjen» før
 * 90-dagers auto-hardslett. Tilgang: prosjektadmin (prosjekt-bredt) + oppretter
 * (egne). Gjenopprett (oppretter + prosjektadmin) og Slett endelig (kun
 * prosjektadmin) — server håndhever; UI speiler.
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

export default function PapirkurvSide() {
  useToppbarFiltre({ byggeplass: false });
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;
  const utils = trpc.useUtils();

  const [slettEndeligMål, setSlettEndeligMål] = useState<PapirkurvDok | null>(null);

  const { data, isLoading } = trpc.papirkurv.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const invaliderListe = () =>
    utils.papirkurv.hentForProsjekt.invalidate({ projectId: prosjektId! });

  const gjenopprett = trpc.papirkurv.gjenopprett.useMutation({
    onSuccess: invaliderListe,
  });
  const slettEndelig = trpc.papirkurv.slettEndelig.useMutation({
    onSuccess: () => {
      setSlettEndeligMål(null);
      invaliderListe();
    },
  });

  const erProsjektadmin = data?.erProsjektadmin ?? false;
  const dokumenter = (data?.dokumenter ?? []) as PapirkurvDok[];

  function typeLabel(type: "checklist" | "task"): string {
    return type === "checklist" ? t("papirkurv.typeSjekkliste") : t("papirkurv.typeOppgave");
  }

  function dokNummer(d: PapirkurvDok): string {
    if (d.number == null) return "—";
    return d.prefix ? `${d.prefix}-${d.number}` : String(d.number);
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
          <HjelpKnapp>
            <HjelpFane tittel={t("papirkurv.tittel")}>
              <p>{t("hjelp.papirkurv.tekst")}</p>
            </HjelpFane>
          </HjelpKnapp>
        </div>
      </SonetonetSidehode>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : dokumenter.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">{t("papirkurv.tom")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">{t("papirkurv.kolonne.dokument")}</th>
                <th className="px-4 py-2">{t("papirkurv.kolonne.type")}</th>
                <th className="px-4 py-2">{t("papirkurv.kolonne.status")}</th>
                <th className="px-4 py-2">{t("papirkurv.kolonne.slettetAv")}</th>
                <th className="px-4 py-2">{t("papirkurv.kolonne.dagerIgjen")}</th>
                <th className="px-4 py-2 text-right">{t("papirkurv.kolonne.handlinger")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dokumenter.map((d) => (
                <tr key={`${d.type}-${d.id}`} className="hover:bg-gray-50">
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
                          onClick={() =>
                            gjenopprett.mutate({ id: d.id, type: d.type })
                          }
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
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}
