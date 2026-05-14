"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { Check, RotateCcw, ChevronRight, AlertCircle } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";

type AttesteringRad = {
  id: string;
  dato: Date | string;
  status: string;
  totaltimer: number;
  antallRader: number;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: {
    id: string;
    name: string | null;
    email: string;
    ansattnummer: string | null;
  } | null;
  prosjekt: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
};

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

export default function FirmaAttesteringSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();

  const [returnerId, setReturnerId] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const { data: tilgang, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestereFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );
  const kanAttestere = tilgang?.kanAttestere ?? false;

  const { data: rader, isLoading } =
    trpc.timer.dagsseddel.hentTilAttesteringFirma.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId && kanAttestere },
    );

  const attester = trpc.timer.dagsseddel.attester.useMutation({
    onSuccess: (_data: unknown) => {
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  if (tilgangLaster) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("firma.timer.attesteringIngenFirma")}
      </div>
    );
  }

  if (!kanAttestere) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mr-1 inline-block h-4 w-4" />
        {t("timer.attestering.ingenTilgang")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-600">
        {t("firma.timer.attesteringBeskrivelse")}
      </p>

      {feil && <p className="mb-4 text-sm text-red-600">{feil}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rader || rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {t("timer.attestering.ingenSedler")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("timer.attestering.kol.dato")}</th>
                <th className="px-3 py-3">{t("timer.attestering.kol.ansatt")}</th>
                <th className="px-3 py-3">{t("timer.felt.prosjekt")}</th>
                <th className="px-3 py-3">{t("timer.kol.aktivitet")}</th>
                <th className="px-3 py-3 text-right">{t("timer.kol.timer")}</th>
                <th className="px-3 py-3 text-right">{t("timer.kol.rader")}</th>
                <th className="px-3 py-3 text-right">
                  {t("handling.handlinger")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(rader as unknown as AttesteringRad[]).map((rad) => (
                <tr
                  key={rad.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {formatDato(rad.dato)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-900">
                      {rad.ansatt?.name ?? rad.ansatt?.email ?? "—"}
                    </div>
                    {rad.ansatt?.ansattnummer && (
                      <div className="text-xs text-gray-500">
                        #{rad.ansatt.ansattnummer}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-900">
                      {rad.prosjekt?.name ?? "—"}
                    </div>
                    {rad.prosjekt?.projectNumber && (
                      <div className="text-xs text-gray-500">
                        {rad.prosjekt.projectNumber}
                      </div>
                    )}
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
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/dashbord/firma/timer/attestering/${rad.id}`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("timer.aapne")}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setReturnerId(rad.id)}
                        disabled={attester.isPending}
                        className="rounded p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-40"
                        title={t("timer.attestering.returner")}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setFeil(null);
                          attester.mutate({ id: rad.id });
                        }}
                        disabled={attester.isPending}
                        className="rounded p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-40"
                        title={t("timer.attestering.attester")}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {returnerId && (
        <ReturnerDialog
          sheetId={returnerId}
          onLukk={() => setReturnerId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ReturnerDialog                                                      */
/* ------------------------------------------------------------------ */

function ReturnerDialog({
  sheetId,
  onLukk,
}: {
  sheetId: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returner.useMutation({
    onSuccess: (_data: unknown) => {
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    if (!kommentar.trim()) {
      setFeil(t("timer.attestering.kommentarPaakrevd"));
      return;
    }
    returner.mutate({ id: sheetId, kommentar: kommentar.trim() });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.attestering.returnerTittel")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("timer.attestering.returnerBeskrivelse")}
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.attestering.kommentar")}
          </label>
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            rows={4}
            placeholder={t("timer.attestering.kommentarPlaceholder")}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            autoFocus
            required
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={returner.isPending || !kommentar.trim()}>
            {returner.isPending
              ? t("handling.lagrer")
              : t("timer.attestering.returner")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
