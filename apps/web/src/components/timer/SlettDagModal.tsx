"use client";

import { useTranslation } from "react-i18next";
import { Modal, Button, Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";

/**
 * Bekreftelsen før «Slett dagsseddel» (S1, plan § 8.22): lister alt som slettes, med antall.
 * Vinduet er vernet mot uhell — slettingen tar alt som er ført på dagen (timer, maskin, varer,
 * tillegg, utlegg og reise). Antallene kommer fra `slettOversikt`, som teller det samme som
 * `slett` sletter. Kan dagen ikke slettes (f.eks. endret i en annen fane), vises grunnen og
 * knappen skjules.
 */
const LINJER = ["timer", "maskin", "varer", "tillegg", "utlegg", "reise"] as const;

export function SlettDagModal({
  sheetId,
  overskrift,
  onClose,
  onBekreft,
  sletter,
  feil,
}: {
  sheetId: string;
  /** Linja over lista, f.eks. med dato. */
  overskrift: string;
  onClose: () => void;
  onBekreft: () => void;
  sletter: boolean;
  feil: string | null;
}) {
  const { t } = useTranslation();
  const oversikt = trpc.timer.dagsseddel.slettOversikt.useQuery({ id: sheetId }, { staleTime: 0 });
  const innhold = oversikt.data?.innhold;
  const linjer = innhold ? LINJER.filter((k) => innhold[k] > 0) : [];
  const grunn = oversikt.data && !oversikt.data.kanSlettes ? oversikt.data.grunn : null;

  return (
    <Modal open onClose={onClose} title={t("timer.slettDag.tittel")}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{overskrift}</p>
        {oversikt.isLoading ? (
          <Spinner />
        ) : innhold ? (
          linjer.length > 0 ? (
            <ul className="space-y-1 text-sm text-gray-900" data-testid="slett-dag-innhold">
              {linjer.map((k) => (
                <li key={k} className="flex justify-between gap-4">
                  <span>{t(`timer.slettDag.${k}`)}</span>
                  <span className="tabular-nums">{innhold[k]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">{t("timer.slettDag.tom")}</p>
          )
        ) : null}
        {(grunn ?? feil ?? oversikt.error?.message) && (
          <p className="text-sm text-red-700">{grunn ?? feil ?? oversikt.error?.message}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("handling.avbryt")}
          </Button>
          {oversikt.data?.kanSlettes && (
            <Button variant="danger" onClick={onBekreft} loading={sletter}>
              {t("timer.slettDag.knapp")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
