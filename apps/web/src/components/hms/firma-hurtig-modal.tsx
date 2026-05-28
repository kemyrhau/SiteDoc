"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { DOCUMENT_STATUSES, isValidStatusTransition } from "@sitedoc/shared";
import { StatusBadge } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import type { DokumentRad } from "./types";

const STATUS_I18N: Record<string, string> = {
  draft: "status.utkast",
  sent: "status.sendt",
  received: "status.mottatt",
  in_progress: "status.underArbeid",
  responded: "status.besvart",
  approved: "status.godkjent",
  rejected: "status.avvist",
  closed: "status.lukket",
  cancelled: "status.avbrutt",
};

type Props = {
  rad: DokumentRad;
  organizationId: string;
  onLukk: () => void;
  onSuksess: () => void;
};

export function FirmaHurtigModal({ rad, organizationId, onLukk, onSuksess }: Props) {
  const { t } = useTranslation();
  const [nyStatus, setNyStatus] = useState<string>("");
  const [kommentar, setKommentar] = useState("");
  const [feilmelding, setFeilmelding] = useState<string | null>(null);

  const mutation = trpc.hms.firmaBehandleAvvik.useMutation();

  const gyldigeStatuser = DOCUMENT_STATUSES.filter((s) =>
    isValidStatusTransition(rad.status, s),
  );

  const kanLagre =
    !mutation.isPending && (nyStatus !== "" || kommentar.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kanLagre) return;
    setFeilmelding(null);
    try {
      await mutation.mutateAsync({
        organizationId,
        taskId: rad.id,
        nyStatus: nyStatus !== "" ? (nyStatus as (typeof DOCUMENT_STATUSES)[number]) : undefined,
        kommentar: kommentar.trim() || undefined,
      });
      onSuksess();
    } catch (err) {
      setFeilmelding(err instanceof Error ? err.message : String(err));
    }
  }

  const nummer = rad.template.prefix && rad.number
    ? `${rad.template.prefix}-${String(rad.number).padStart(3, "0")}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">
            {t("firma.hms.hurtig.tittel")}
          </h2>
          <button
            type="button"
            onClick={onLukk}
            aria-label={t("handling.avbryt")}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {nummer && <span className="mr-2 text-gray-500">{nummer}</span>}
              {rad.title}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">{t("tabell.status")}:</span>
              <StatusBadge status={rad.status} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t("firma.hms.hurtig.beskrivelse")}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.hms.hurtig.statusLabel")}
            </label>
            <select
              value={nyStatus}
              onChange={(e) => setNyStatus(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            >
              <option value="">{t("firma.hms.hurtig.statusBehold")}</option>
              {gyldigeStatuser.map((s) => (
                <option key={s} value={s}>
                  {t(STATUS_I18N[s] ?? s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.hms.hurtig.kommentarLabel")}
            </label>
            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t("firma.hms.hurtig.kommentarPlaceholder")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-secondary focus:outline-none focus:ring-1 focus:ring-sitedoc-secondary"
            />
          </div>

          {feilmelding && (
            <p className="text-sm text-red-500">{feilmelding}</p>
          )}

          {!kanLagre && nyStatus === "" && kommentar.trim().length === 0 && !mutation.isPending && (
            <p className="text-xs text-gray-500">
              {t("firma.hms.hurtig.maaVelge")}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onLukk}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              type="submit"
              disabled={!kanLagre}
              className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending
                ? t("firma.hms.hurtig.lagrer")
                : t("firma.hms.hurtig.lagre")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
