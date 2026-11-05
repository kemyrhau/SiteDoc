"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Spinner } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";

/**
 * Bekreftelse før firma-rollen `hms_ansvarlig` fjernes fra HMS-flytkortet (ordre 2026-11-05 (9)).
 * Rollen er firmaets, ikke prosjektets — fjerningen gjelder alle firmaets prosjekter.
 * Serveren avgjør tilgangen (firma-admin i firmaet som ga rollen) både her og ved fjerning.
 */
export function FjernHmsAnsvarligModal({
  ansvarlig,
  onClose,
  onFjernet,
}: {
  /** Raden som fjernes; `null` = lukket. */
  ansvarlig: { userId: string; navn: string; organizationId: string; organisasjonNavn: string } | null;
  onClose: () => void;
  onFjernet: () => void;
}) {
  const { t } = useTranslation();
  const [feil, setFeil] = useState<string | null>(null);

  const { data, isLoading, isError } = trpc.organisasjon.forhandsvisFjernHmsAnsvarlig.useQuery(
    { userId: ansvarlig?.userId ?? "", organizationId: ansvarlig?.organizationId ?? "" },
    { enabled: !!ansvarlig },
  );
  const fjern = trpc.organisasjon.settFirmaHmsAnsvarlig.useMutation({
    onSuccess: () => {
      onFjernet();
      onClose();
    },
    onError: (e) => setFeil(e.message),
  });

  if (!ansvarlig) return null;
  const antall = data?.antallApne ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("hms.fjernAnsvarlig.tittel", { navn: ansvarlig.navn })}
      className="max-w-md"
    >
      {isError ? (
        // M2 (dom 32): feilet forhåndsvisning skal ikke gi evig spinner — si fra og la brukeren lukke.
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-red-600">{t("hms.fjernAnsvarlig.feil")}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("handling.lukk")}
            </button>
          </div>
        </div>
      ) : isLoading || !data ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          <p className="leading-relaxed">
            {t("hms.fjernAnsvarlig.omfang", { firma: ansvarlig.organisasjonNavn })}
          </p>

          {antall > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 leading-relaxed text-amber-900">
              {t("hms.fjernAnsvarlig.saker", { antall, navn: ansvarlig.navn })}
            </div>
          )}

          {feil && <div className="text-xs text-red-600">{feil}</div>}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              onClick={() => fjern.mutate({ userId: ansvarlig.userId, organizationId: ansvarlig.organizationId, harTilgang: false })}
              disabled={fjern.isPending}
              className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t("handling.fjern")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
