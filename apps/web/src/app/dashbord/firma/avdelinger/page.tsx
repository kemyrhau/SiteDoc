"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";

type AvdelingRad = {
  id: string;
  navn: string;
  kode: string | null;
  aktiv: boolean;
  _count: { brukere: number };
};

export default function AvdelingerSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;

  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerId, setRedigerId] = useState<string | null>(null);

  const { data: avdelinger, isLoading } = trpc.avdeling.hentAlle.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const slettMutation = trpc.avdeling.slett.useMutation({
    onSuccess: () => {
      utils.avdeling.hentAlle.invalidate();
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  const oppdaterMutation = trpc.avdeling.oppdater.useMutation({
    onSuccess: () => {
      utils.avdeling.hentAlle.invalidate();
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  function handleSlett(rad: AvdelingRad) {
    if (!confirm(t("firma.avdelinger.slettBekreft", { navn: rad.navn }))) return;
    slettMutation.mutate({ id: rad.id, organizationId: orgId! });
  }

  function handleToggleAktiv(rad: AvdelingRad) {
    oppdaterMutation.mutate({ id: rad.id, aktiv: !rad.aktiv, organizationId: orgId! });
  }

  return (
    <div className="max-w-5xl">
      <SonetonetSidehode sone="firma" className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t("firma.avdelinger.tittel")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("firma.avdelinger.beskrivelse")}
            </p>
          </div>
          <Button onClick={() => setVisOpprett(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("firma.avdelinger.leggTil")}
          </Button>
        </div>
      </SonetonetSidehode>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !avdelinger || avdelinger.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {t("firma.avdelinger.ingen")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">{t("firma.avdelinger.navn")}</th>
                <th className="px-4 py-3">{t("firma.avdelinger.kode")}</th>
                <th className="px-4 py-3">{t("firma.avdelinger.status")}</th>
                <th className="px-4 py-3">{t("firma.avdelinger.antallBrukere")}</th>
                <th className="px-4 py-3 text-right">{t("firma.avdelinger.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {avdelinger.map((rad) => (
                <tr key={rad.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-4 py-3 text-gray-600">{rad.kode ?? "—"}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAktiv(rad)}
                      disabled={oppdaterMutation.isPending}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        rad.aktiv
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {rad.aktiv ? t("firma.avdelinger.aktiv") : t("firma.avdelinger.inaktiv")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{rad._count.brukere}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRedigerId(rad.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("handling.rediger")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleSlett(rad)}
                        disabled={slettMutation.isPending}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title={t("handling.slett")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visOpprett && (
        <OpprettAvdelingDialog onLukk={() => setVisOpprett(false)} />
      )}

      {redigerId && avdelinger && (
        <RedigerAvdelingDialog
          avdeling={avdelinger.find((a) => a.id === redigerId)!}
          onLukk={() => setRedigerId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OpprettAvdelingDialog                                               */
/* ------------------------------------------------------------------ */

function OpprettAvdelingDialog({ onLukk }: { onLukk: () => void }) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const [navn, setNavn] = useState("");
  const [kode, setKode] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const opprettMutation = trpc.avdeling.opprett.useMutation({
    onSuccess: () => {
      utils.avdeling.hentAlle.invalidate();
      onLukk();
    },
    onError: (error) => {
      setFeil(error.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    opprettMutation.mutate({
      navn,
      kode: kode.trim() || undefined,
      organizationId: orgId!,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("firma.avdelinger.leggTil")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.avdelinger.navn")}
          </label>
          <Input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            placeholder={t("firma.avdelinger.navnPlaceholder")}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.avdelinger.kode")} <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input
            type="text"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            placeholder={t("firma.avdelinger.kodePlaceholder")}
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="submit"
            disabled={opprettMutation.isPending || !navn.trim()}
          >
            {opprettMutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerAvdelingDialog                                               */
/* ------------------------------------------------------------------ */

function RedigerAvdelingDialog({
  avdeling,
  onLukk,
}: {
  avdeling: AvdelingRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const [navn, setNavn] = useState(avdeling.navn);
  const [kode, setKode] = useState(avdeling.kode ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  const oppdaterMutation = trpc.avdeling.oppdater.useMutation({
    onSuccess: () => {
      utils.avdeling.hentAlle.invalidate();
      onLukk();
    },
    onError: (error) => {
      setFeil(error.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    oppdaterMutation.mutate({
      id: avdeling.id,
      navn,
      kode: kode.trim() || null,
      organizationId: orgId!,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("firma.avdelinger.rediger")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.avdelinger.navn")}
          </label>
          <Input
            type="text"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.avdelinger.kode")} <span className="text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input
            type="text"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="submit"
            disabled={oppdaterMutation.isPending || !navn.trim()}
          >
            {oppdaterMutation.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
