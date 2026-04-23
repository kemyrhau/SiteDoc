"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Wrench, Hammer, Download, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { TYPER_PER_KATEGORI, type MaskinKategori } from "@/lib/maskin-typer";

const KATEGORI_KNAPP: Array<{
  verdi: MaskinKategori;
  ikon: React.ReactNode;
  labelKey: string;
  beskrivelseKey: string;
}> = [
  {
    verdi: "kjoretoy",
    ikon: <Truck className="h-6 w-6" />,
    labelKey: "maskin.kategoriKjoretoy",
    beskrivelseKey: "maskin.kategoriKjoretoyBeskrivelse",
  },
  {
    verdi: "anleggsmaskin",
    ikon: <Wrench className="h-6 w-6" />,
    labelKey: "maskin.kategoriAnleggsmaskin",
    beskrivelseKey: "maskin.kategoriAnleggsmaskinBeskrivelse",
  },
  {
    verdi: "smautstyr",
    ikon: <Hammer className="h-6 w-6" />,
    labelKey: "maskin.kategoriSmautstyr",
    beskrivelseKey: "maskin.kategoriSmautstyrBeskrivelse",
  },
];

export default function NyttUtstyrPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [kategori, setKategori] = useState<MaskinKategori | null>(null);
  const [type, setType] = useState("");
  const [merke, setMerke] = useState("");
  const [modell, setModell] = useState("");
  const [internNummer, setInternNummer] = useState("");
  const [lokasjon, setLokasjon] = useState("");
  const [anskaffelsesDato, setAnskaffelsesDato] = useState("");
  const [nypris, setNypris] = useState("");
  const [notater, setNotater] = useState("");
  const [registreringsnummer, setRegistreringsnummer] = useState("");
  const [serienummer, setSerienummer] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const opprett = trpc.maskin.equipment.opprett.useMutation({
    onSuccess: () => {
      router.push("/dashbord/maskin");
    },
    onError: (e) => {
      setFeil(e.message);
    },
  });

  function lagre(e: React.FormEvent) {
    e.preventDefault();
    if (!kategori || !type) return;
    setFeil(null);
    opprett.mutate({
      kategori,
      type,
      merke: merke || undefined,
      modell: modell || undefined,
      internNummer: internNummer || undefined,
      lokasjon: lokasjon || undefined,
      anskaffelsesDato: anskaffelsesDato || undefined,
      nypris: nypris ? parseFloat(nypris) : undefined,
      notater: notater || undefined,
      registreringsnummer: registreringsnummer || undefined,
      serienummer: serienummer || undefined,
    });
  }

  const typer = kategori ? TYPER_PER_KATEGORI[kategori] : [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href="/dashbord/maskin"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("maskin.tittel")}
        </Link>
      </div>

      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        {t("maskin.nyttUtstyrTittel")}
      </h1>

      {/* Steg 1: Kategori */}
      {!kategori ? (
        <div>
          <p className="mb-3 text-sm text-gray-600">{t("maskin.velgKategori")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {KATEGORI_KNAPP.map((k) => (
              <button
                key={k.verdi}
                type="button"
                onClick={() => setKategori(k.verdi)}
                className="flex flex-col items-start gap-2 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-sitedoc-primary hover:bg-blue-50"
              >
                <span className="text-sitedoc-primary">{k.ikon}</span>
                <span className="text-sm font-medium text-gray-900">{t(k.labelKey)}</span>
                <span className="text-xs text-gray-500">{t(k.beskrivelseKey)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={lagre} className="space-y-4">
          {/* Kategori-header med byttelenke */}
          <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="text-sm text-gray-700">
              {t("maskin.kategori")}:{" "}
              <span className="font-medium">
                {t(KATEGORI_KNAPP.find((k) => k.verdi === kategori)!.labelKey)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setKategori(null);
                setType("");
                setRegistreringsnummer("");
                setSerienummer("");
              }}
              className="text-xs text-gray-500 hover:text-sitedoc-primary"
            >
              {t("handling.rediger")}
            </button>
          </div>

          {/* Kjøretøy — Vegvesen-placeholder øverst */}
          {kategori === "kjoretoy" && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {t("maskin.registreringsnummer")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={registreringsnummer}
                  onChange={(e) => setRegistreringsnummer(e.target.value.toUpperCase())}
                  placeholder="AB12345"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled
                  title={t("maskin.hentFraVegvesenKommerSnart")}
                  className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm text-gray-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("maskin.hentFraVegvesen")}
                </button>
              </div>
              <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-400">
                <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                {t("maskin.hentFraVegvesenKommerSnart")}
              </p>
            </div>
          )}

          {/* Hovedskjema */}
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
            <Felt labelKey="maskin.type" required>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("maskin.velgType")}</option>
                {typer.map((tt) => (
                  <option key={tt.verdi} value={tt.verdi}>
                    {tt.labelKey} — {tt.eksempel}
                  </option>
                ))}
              </select>
            </Felt>

            <Felt labelKey="maskin.internNummer">
              <input
                type="text"
                value={internNummer}
                onChange={(e) => setInternNummer(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <Felt labelKey="maskin.merke">
              <input
                type="text"
                value={merke}
                onChange={(e) => setMerke(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <Felt labelKey="maskin.modell">
              <input
                type="text"
                value={modell}
                onChange={(e) => setModell(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            {kategori === "anleggsmaskin" && (
              <Felt labelKey="maskin.serienummer">
                <input
                  type="text"
                  value={serienummer}
                  onChange={(e) => setSerienummer(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </Felt>
            )}

            <Felt labelKey="maskin.lokasjon">
              <input
                type="text"
                value={lokasjon}
                onChange={(e) => setLokasjon(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <Felt labelKey="maskin.anskaffelsesdato">
              <input
                type="date"
                value={anskaffelsesDato}
                onChange={(e) => setAnskaffelsesDato(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <Felt labelKey="maskin.nypris">
              <input
                type="number"
                min="0"
                step="0.01"
                value={nypris}
                onChange={(e) => setNypris(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <div className="sm:col-span-2">
              <Felt labelKey="maskin.notater">
                <textarea
                  value={notater}
                  onChange={(e) => setNotater(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </Felt>
            </div>
          </div>

          {feil && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {feil}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Link
              href="/dashbord/maskin"
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              {t("handling.avbryt")}
            </Link>
            <button
              type="submit"
              disabled={!type || opprett.isPending}
              className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
            >
              {t("handling.lagre")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Felt({
  labelKey,
  required,
  children,
}: {
  labelKey: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {t(labelKey)}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
