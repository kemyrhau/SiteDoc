"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { Plus, Pencil, Power } from "lucide-react";

const TYPE_VERDIER = ["avhuking", "antall"] as const;
type TilleggType = (typeof TYPE_VERDIER)[number];

type TilleggRad = {
  id: string;
  type: string;
  kode: string | null;
  navn: string;
  prisMotKunde: unknown;
  internkostnad: unknown;
  skalEksporteres: boolean;
  tvungenKommentar: boolean;
  rekkefolge: number;
  aktiv: boolean;
  seedNivaa: number | null;
};

function nivaaTekst(seedNivaa: number | null, t: (k: string) => string): string {
  if (seedNivaa === 1) return t("firma.timer.nivaa.1");
  if (seedNivaa === 2) return t("firma.timer.nivaa.2");
  return t("firma.timer.nivaa.egendefinert");
}

function decimalTilTall(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function TilleggSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [visOpprett, setVisOpprett] = useState(false);
  const [redigerId, setRedigerId] = useState<string | null>(null);
  const [inkluderInaktiv, setInkluderInaktiv] = useState(false);

  const { data: rader, isLoading } = trpc.timer.tillegg.list.useQuery({ inkluderInaktiv });

  const deaktiver = trpc.timer.tillegg.deaktiver.useMutation({
    onSuccess: () => utils.timer.tillegg.list.invalidate(),
    onError: (e) => alert(e.message),
  });
  const oppdater = trpc.timer.tillegg.oppdater.useMutation({
    onSuccess: () => utils.timer.tillegg.list.invalidate(),
    onError: (e) => alert(e.message),
  });

  function handleToggleAktiv(rad: TilleggRad) {
    if (rad.aktiv) {
      deaktiver.mutate({ id: rad.id });
    } else {
      oppdater.mutate({ id: rad.id, aktiv: true });
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <p className="text-sm text-gray-600">
          {t("firma.timer.tillegg.beskrivelse")}
        </p>
        <Button onClick={() => setVisOpprett(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t("firma.timer.tillegg.leggTil")}
        </Button>
      </div>

      <label className="mb-3 inline-flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={inkluderInaktiv}
          onChange={(e) => setInkluderInaktiv(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        {t("firma.timer.visInaktive")}
      </label>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rader || rader.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">
            {t("firma.timer.tillegg.ingen")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">{t("firma.timer.felt.kode")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.navn")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.type")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.nivaa")}</th>
                <th className="px-3 py-3 text-right">{t("firma.timer.felt.prisMotKunde")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.eksport")}</th>
                <th className="px-3 py-3">{t("firma.timer.felt.status")}</th>
                <th className="px-3 py-3 text-right">{t("handling.handlinger")}</th>
              </tr>
            </thead>
            <tbody>
              {rader.map((rad) => (
                <tr
                  key={rad.id}
                  className={`border-b border-gray-100 last:border-b-0 ${
                    rad.aktiv ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{rad.kode ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{rad.navn}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {t(`firma.timer.tilleggType.${rad.type}`)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{nivaaTekst(rad.seedNivaa, t)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {rad.prisMotKunde !== null && rad.prisMotKunde !== undefined
                      ? decimalTilTall(rad.prisMotKunde)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {rad.skalEksporteres ? t("ja") : t("nei")}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rad.aktiv
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {rad.aktiv
                        ? t("firma.timer.status.aktiv")
                        : t("firma.timer.status.inaktiv")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setRedigerId(rad.id)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        title={t("handling.rediger")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleAktiv(rad)}
                        disabled={deaktiver.isPending || oppdater.isPending}
                        className="rounded p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                        title={
                          rad.aktiv
                            ? t("firma.timer.handling.deaktiver")
                            : t("firma.timer.handling.aktiver")
                        }
                      >
                        <Power className="h-4 w-4" />
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
        <TilleggDialog modus="opprett" onLukk={() => setVisOpprett(false)} />
      )}

      {redigerId && rader && (
        <TilleggDialog
          modus="rediger"
          rad={rader.find((r) => r.id === redigerId)!}
          onLukk={() => setRedigerId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TilleggDialog({
  modus,
  rad,
  onLukk,
}: {
  modus: "opprett" | "rediger";
  rad?: TilleggRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [type, setType] = useState<TilleggType>(
    (rad?.type as TilleggType) ?? "avhuking",
  );
  const [kode, setKode] = useState(rad?.kode ?? "");
  const [navn, setNavn] = useState(rad?.navn ?? "");
  const [prisMotKunde, setPrisMotKunde] = useState(decimalTilTall(rad?.prisMotKunde));
  const [internkostnad, setInternkostnad] = useState(decimalTilTall(rad?.internkostnad));
  const [skalEksporteres, setSkalEksporteres] = useState(rad?.skalEksporteres ?? true);
  const [tvungenKommentar, setTvungenKommentar] = useState(rad?.tvungenKommentar ?? false);
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.timer.tillegg.opprett.useMutation({
    onSuccess: () => {
      utils.timer.tillegg.list.invalidate();
      utils.timer.onboarding.status.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });
  const oppdater = trpc.timer.tillegg.oppdater.useMutation({
    onSuccess: () => {
      utils.timer.tillegg.list.invalidate();
      onLukk();
    },
    onError: (e) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);

    const tallEllerNull = (s: string): number | null => {
      const trimmet = s.trim();
      if (!trimmet) return null;
      const n = Number(trimmet);
      return isNaN(n) ? null : n;
    };

    const data = {
      type,
      kode: kode.trim() || null,
      navn,
      prisMotKunde: tallEllerNull(prisMotKunde),
      internkostnad: tallEllerNull(internkostnad),
      skalEksporteres,
      tvungenKommentar,
    };

    if (modus === "opprett") {
      opprett.mutate(data);
    } else if (rad) {
      oppdater.mutate({ id: rad.id, ...data });
    }
  }

  const lagrer = opprett.isPending || oppdater.isPending;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={
        modus === "opprett"
          ? t("firma.timer.tillegg.leggTil")
          : t("firma.timer.tillegg.rediger")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.timer.felt.navn")}
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
              {t("firma.timer.felt.type")}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TilleggType)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {TYPE_VERDIER.map((v) => (
                <option key={v} value={v}>
                  {t(`firma.timer.tilleggType.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.timer.felt.kode")}
            </label>
            <Input
              type="text"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.timer.felt.prisMotKunde")}
            </label>
            <Input
              type="number"
              step="0.01"
              value={prisMotKunde}
              onChange={(e) => setPrisMotKunde(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("firma.timer.felt.internkostnad")}
            </label>
            <Input
              type="number"
              step="0.01"
              value={internkostnad}
              onChange={(e) => setInternkostnad(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skalEksporteres}
              onChange={(e) => setSkalEksporteres(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("firma.timer.felt.skalEksporteres")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tvungenKommentar}
              onChange={(e) => setTvungenKommentar(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("firma.timer.felt.tvungenKommentar")}
          </label>
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={lagrer || !navn.trim()}>
            {lagrer ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
