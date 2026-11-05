"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";

/**
 * Bekreftelse før et medlem fjernes fra et flytledd (ordre 2026-11-05 (3), L1 —
 * spec-fjerning-deaktivering.md § 3). Fjerningen er myk: raden avsluttes, loggen står.
 *
 * A — andre i leddet, ingen åpne dokumenter: bare bekreft.
 * B — andre i leddet, åpne dokumenter: velg ny hovedansvarlig (ballen flyttes dit).
 * C — eneste i leddet: velg erstatter; uten dokumenter kan leddet stå tomt (B10).
 */
export function FjernMedlemModal({
  medlem,
  prosjektId,
  rolleNavn,
  kandidaterUtenfor,
  onClose,
  onFjernet,
}: {
  /** Flytmedlemmet som fjernes; `null` = lukket. */
  medlem: { id: string; navn: string } | null;
  prosjektId: string;
  rolleNavn: string;
  /** Prosjektmedlemmer som ikke står i leddet — erstattere når ingen person blir igjen. */
  kandidaterUtenfor: Array<{ id: string; navn: string }>;
  onClose: () => void;
  onFjernet: () => void;
}) {
  const { t } = useTranslation();
  const [valgt, setValgt] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const { data, isLoading } = trpc.dokumentflyt.forhandsvisFjerning.useQuery(
    { id: medlem?.id ?? "", projectId: prosjektId },
    { enabled: !!medlem },
  );
  const fjern = trpc.dokumentflyt.fjernMedlem.useMutation({
    onSuccess: () => {
      onFjernet();
      onClose();
    },
    onError: (e) => setFeil(e.message),
  });

  const antall = data?.antallApne ?? 0;
  const erEneste = data?.andreILeddet === 0;
  const gjenvarende = data?.gjenvarende ?? [];
  // Blir det igjen personer i leddet, velges ny hovedansvarlig blant dem; ellers en erstatter utenfor.
  const kandidater = gjenvarende.length > 0
    ? gjenvarende.map((g) => ({ id: g.projectMemberId, navn: g.navn }))
    : kandidaterUtenfor;
  const maaVelge = antall > 0 || (erEneste && gjenvarende.length === 0);
  // Uten dokumenter kan leddet stå tomt (B10); står en gruppe igjen, kan ballen ligge på leddet.
  const kanUtenErstatter = maaVelge && gjenvarende.length === 0 && (antall === 0 || !erEneste);

  useEffect(() => {
    setFeil(null);
    setValgt(gjenvarende.length > 0 && antall > 0
      ? (gjenvarende.find((g) => g.erHovedansvarlig) ?? gjenvarende[0])!.projectMemberId
      : "");
    // Forhåndsvalget settes én gang per åpnet forhåndsvisning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, medlem?.id]);

  if (!medlem) return null;

  const send = (nyHovedansvarligPmId: string | null | undefined) =>
    fjern.mutate({
      id: medlem.id,
      projectId: prosjektId,
      ...(nyHovedansvarligPmId !== undefined ? { nyHovedansvarligPmId } : {}),
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("dokumentflyt.fjernMedlem.tittel", { navn: medlem.navn, rolle: rolleNavn })}
      className="max-w-md"
    >
      {isLoading || !data ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          {(antall > 0 || erEneste) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 leading-relaxed text-amber-900">
              {antall > 0 && (
                <div>{t("dokumentflyt.fjernMedlem.dokumenter", { antall, navn: medlem.navn, rolle: rolleNavn })}</div>
              )}
              {erEneste && (
                <div className={antall > 0 ? "mt-1" : ""}>
                  {t("dokumentflyt.fjernMedlem.eneste", { navn: medlem.navn, rolle: rolleNavn })}
                </div>
              )}
            </div>
          )}

          {maaVelge && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">
                {gjenvarende.length > 0
                  ? t("dokumentflyt.fjernMedlem.nyHovedansvarlig")
                  : t("dokumentflyt.fjernMedlem.erstatter")}
              </span>
              <select
                value={valgt}
                onChange={(e) => setValgt(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                {gjenvarende.length === 0 && <option value="">—</option>}
                {kandidater.map((k) => (
                  <option key={k.id} value={k.id}>{k.navn}</option>
                ))}
              </select>
            </label>
          )}

          <div className="text-xs text-gray-500">
            {t("dokumentflyt.fjernMedlem.loggStaar", { navn: medlem.navn })}
          </div>

          {feil && <div className="text-xs text-red-600">{feil}</div>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            {kanUtenErstatter && (
              <button
                onClick={() => send(null)}
                disabled={fjern.isPending}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("dokumentflyt.fjernMedlem.utenErstatter")}
              </button>
            )}
            <button
              onClick={() => send(maaVelge ? valgt : undefined)}
              disabled={fjern.isPending || (maaVelge && !valgt)}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {antall > 0
                ? t("dokumentflyt.fjernMedlem.bekreftFlytt", { antall })
                : t("handling.fjern")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
