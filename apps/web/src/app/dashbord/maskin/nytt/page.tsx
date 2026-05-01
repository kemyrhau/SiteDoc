"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Truck, Wrench, Hammer, Download, Info, CheckCircle2, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { TYPER_PER_KATEGORI, type MaskinKategori } from "@/lib/maskin-typer";
import { normaliserRegnummer, erGyldigRegnummer } from "@sitedoc/shared";

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

const EIERSKAP_VERDIER = ["eid", "leid", "leasing", "lant"] as const;
type Eierskap = (typeof EIERSKAP_VERDIER)[number];

type ForhandsvisningFelter = {
  registreringsnummer: string;
  vin: string | null;
  merke: string | null;
  modell: string | null;
  farge: string | null;
  drivstoff: string | null;
  kjoretoygruppe: string | null;
  kjoretoygruppeNavn: string | null;
  karosseritype: string | null;
  antallSeter: number | null;
  forsteRegistrering: string | null;
  effektKw: number | null;
  euroKlasse: string | null;
  totalvekt: number | null;
  egenvekt: number | null;
  nyttelast: number | null;
  girkasse: string | null;
  co2GramPerKm: number | null;
  forbrukLiterPer10km: number | null;
  euKontrollSist: string | null;
  euKontrollFrist: string | null;
};

export default function NyttUtstyrPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [kategori, setKategori] = useState<MaskinKategori | null>(null);
  const [type, setType] = useState("");
  const [merke, setMerke] = useState("");
  const [modell, setModell] = useState("");
  const [internNavn, setInternNavn] = useState("");
  const [internNummer, setInternNummer] = useState("");
  const [eierskap, setEierskap] = useState<Eierskap>("eid");
  const [aarsmodell, setAarsmodell] = useState("");
  const [lokasjon, setLokasjon] = useState("");
  const [anskaffelsesDato, setAnskaffelsesDato] = useState("");
  const [nypris, setNypris] = useState("");
  const [notater, setNotater] = useState("");
  const [registreringsnummer, setRegistreringsnummer] = useState("");
  const [serienummer, setSerienummer] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  // Vegvesen-flyt state
  const [forhandsvisning, setForhandsvisning] = useState<ForhandsvisningFelter | null>(null);
  const [vegvesenData, setVegvesenData] = useState<unknown>(null);
  const [vegvesenFeil, setVegvesenFeil] = useState<string | null>(null);

  interface MutationVennlig<TInput, TResult> {
    isPending: boolean;
    mutate: (input: TInput) => void;
    mutateAsync: (input: TInput) => Promise<TResult>;
  }

  const opprett = trpc.maskin.equipment.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      router.push("/dashbord/maskin");
    },
    onError: (e: { message: string }) => {
      setFeil(e.message);
    },
  }) as unknown as MutationVennlig<Record<string, unknown>, unknown>;

  const opprettMedVegvesen = trpc.maskin.equipment.opprettMedVegvesen.useMutation({
    onSuccess: (_data: unknown) => {
      router.push("/dashbord/maskin");
    },
    onError: (e: { message: string }) => {
      setFeil(e.message);
    },
  }) as unknown as MutationVennlig<Record<string, unknown>, unknown>;

  const forhandsvis = trpc.maskin.equipment.hentFraVegvesenForhandsvisning.useMutation({
    onSuccess: (data: { felter: ForhandsvisningFelter; vegvesenData?: unknown }) => {
      setForhandsvisning(data.felter);
      setVegvesenData(data.vegvesenData ?? null);
      setVegvesenFeil(null);
      // Auto-foreslå type og årsmodell fra Vegvesen
      if (data.felter.kjoretoygruppeNavn?.toLowerCase().includes("personbil")) setType("personbil");
      else if (data.felter.kjoretoygruppeNavn?.toLowerCase().includes("varebil")) setType("varebil");
      else if (data.felter.kjoretoygruppeNavn?.toLowerCase().includes("lastebil")) setType("lastebil");
      else if (data.felter.kjoretoygruppeNavn?.toLowerCase().includes("tilhenger")) setType("tilhenger");
      if (data.felter.forsteRegistrering) {
        const aar = new Date(data.felter.forsteRegistrering).getFullYear();
        setAarsmodell(String(aar));
      }
    },
    onError: (e: { message: string }) => {
      setForhandsvisning(null);
      setVegvesenData(null);
      setVegvesenFeil(e.message);
    },
  }) as unknown as MutationVennlig<{ registreringsnummer: string }, { felter: ForhandsvisningFelter; vegvesenData?: unknown }>;

  function hentFraVegvesen() {
    setVegvesenFeil(null);
    const normalisert = normaliserRegnummer(registreringsnummer);
    if (!erGyldigRegnummer(normalisert)) {
      setVegvesenFeil(t("maskin.vegvesen.ugyldigRegnr"));
      return;
    }
    forhandsvis.mutate({ registreringsnummer: normalisert });
  }

  function tilbakestillVegvesen() {
    setForhandsvisning(null);
    setVegvesenData(null);
    setVegvesenFeil(null);
    setRegistreringsnummer("");
    setMerke("");
    setModell("");
    setAarsmodell("");
  }

  function lagre(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);

    if (forhandsvisning && vegvesenData && kategori === "kjoretoy") {
      // Vegvesen-flyt: send bekreftet data
      if (!type) return;
      opprettMedVegvesen.mutate({
        registreringsnummer: forhandsvisning.registreringsnummer,
        vegvesenData,
        type,
        internNavn: internNavn || undefined,
        internNummer: internNummer || undefined,
        eierskap,
        aarsmodell: aarsmodell ? Number(aarsmodell) : undefined,
        lokasjon: lokasjon || undefined,
        anskaffelsesDato: anskaffelsesDato || undefined,
        nypris: nypris ? parseFloat(nypris) : undefined,
        notater: notater || undefined,
      });
      return;
    }

    if (!kategori || !type) return;
    opprett.mutate({
      kategori,
      type,
      merke: merke || undefined,
      modell: modell || undefined,
      internNavn: internNavn || undefined,
      internNummer: internNummer || undefined,
      eierskap,
      aarsmodell: aarsmodell ? Number(aarsmodell) : undefined,
      lokasjon: lokasjon || undefined,
      anskaffelsesDato: anskaffelsesDato || undefined,
      nypris: nypris ? parseFloat(nypris) : undefined,
      notater: notater || undefined,
      registreringsnummer: registreringsnummer || undefined,
      serienummer: serienummer || undefined,
    });
  }

  const typer = kategori ? TYPER_PER_KATEGORI[kategori] : [];
  const erVegvesenFlyt = forhandsvisning !== null;

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
                tilbakestillVegvesen();
              }}
              className="text-xs text-gray-500 hover:text-sitedoc-primary"
            >
              {t("handling.rediger")}
            </button>
          </div>

          {/* Kjøretøy — Vegvesen-flyt */}
          {kategori === "kjoretoy" && !erVegvesenFlyt && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {t("maskin.registreringsnummer")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={registreringsnummer}
                  onChange={(e) => setRegistreringsnummer(normaliserRegnummer(e.target.value))}
                  placeholder="AB12345"
                  maxLength={10}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono uppercase"
                />
                <button
                  type="button"
                  onClick={hentFraVegvesen}
                  disabled={!registreringsnummer || forhandsvis.isPending}
                  className="inline-flex items-center gap-1 rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
                >
                  {forhandsvis.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {forhandsvis.isPending ? t("maskin.vegvesen.henter") : t("maskin.hentFraVegvesen")}
                </button>
              </div>
              {vegvesenFeil && (
                <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {vegvesenFeil}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {t("maskin.vegvesen.eller")}{" "}
                <button
                  type="button"
                  className="text-sitedoc-primary hover:underline"
                  onClick={() => setForhandsvisning({
                    registreringsnummer: "",
                    vin: null, merke: null, modell: null, farge: null, drivstoff: null,
                    kjoretoygruppe: null, kjoretoygruppeNavn: null, karosseritype: null,
                    antallSeter: null, forsteRegistrering: null, effektKw: null,
                    euroKlasse: null, totalvekt: null, egenvekt: null, nyttelast: null,
                    girkasse: null, co2GramPerKm: null, forbrukLiterPer10km: null,
                    euKontrollSist: null, euKontrollFrist: null,
                  })}
                >
                  {t("maskin.vegvesen.fortsettUtenVegvesen")}
                </button>
              </p>
            </div>
          )}

          {/* Vegvesen-forhåndsvisning */}
          {kategori === "kjoretoy" && forhandsvisning && forhandsvisning.merke && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-green-900">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("maskin.vegvesen.forhandsvisning.kilde")}
                </div>
                <button
                  type="button"
                  onClick={tilbakestillVegvesen}
                  className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                >
                  <X className="h-3 w-3" />
                  {t("maskin.vegvesen.forhandsvisning.proeAnnet")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                <div className="col-span-2 text-sm font-semibold text-gray-900">
                  {[forhandsvisning.merke, forhandsvisning.modell].filter(Boolean).join(" ")}
                  {forhandsvisning.karosseritype && (
                    <span className="ml-2 font-normal text-gray-600">
                      ({forhandsvisning.karosseritype})
                    </span>
                  )}
                </div>
                {forhandsvisning.kjoretoygruppeNavn && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.kjoretoygruppe")} v={forhandsvisning.kjoretoygruppeNavn} />
                )}
                {forhandsvisning.farge && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.farge")} v={forhandsvisning.farge} />
                )}
                {forhandsvisning.drivstoff && (
                  <Linje k={t("maskin.drivstoff")} v={forhandsvisning.drivstoff} />
                )}
                {forhandsvisning.girkasse && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.girkasse")} v={forhandsvisning.girkasse} />
                )}
                {forhandsvisning.effektKw !== null && (
                  <Linje k={t("maskin.effektKw")} v={`${forhandsvisning.effektKw} kW`} />
                )}
                {forhandsvisning.euroKlasse && (
                  <Linje k={t("maskin.euroKlasse")} v={forhandsvisning.euroKlasse} />
                )}
                {forhandsvisning.totalvekt !== null && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.totalvekt")} v={`${forhandsvisning.totalvekt} kg`} />
                )}
                {forhandsvisning.nyttelast !== null && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.nyttelast")} v={`${forhandsvisning.nyttelast} kg`} />
                )}
                {forhandsvisning.antallSeter !== null && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.antallSeter")} v={String(forhandsvisning.antallSeter)} />
                )}
                {forhandsvisning.forsteRegistrering && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.forsteRegistrert")} v={forhandsvisning.forsteRegistrering} />
                )}
                {forhandsvisning.euKontrollFrist && (
                  <Linje k={t("maskin.vegvesen.forhandsvisning.euKontrollFrist")} v={forhandsvisning.euKontrollFrist} />
                )}
              </div>
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

            <Felt labelKey="maskin.internNavn">
              <input
                type="text"
                value={internNavn}
                onChange={(e) => setInternNavn(e.target.value)}
                placeholder={t("maskin.internNavnHint")}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            <Felt labelKey="maskin.aarsmodell">
              <input
                type="number"
                value={aarsmodell}
                onChange={(e) => setAarsmodell(e.target.value)}
                min="1900"
                max="2100"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>

            {/* Manuell merke/modell — skjules ved Vegvesen-flyt med data */}
            {!(erVegvesenFlyt && forhandsvisning?.merke) && (
              <>
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
              </>
            )}

            <div className="sm:col-span-2">
              <Felt labelKey="maskin.eierskap.label">
                <div className="flex flex-wrap gap-2">
                  {EIERSKAP_VERDIER.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEierskap(e)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                        eierskap === e
                          ? "border-sitedoc-primary bg-sitedoc-primary text-white"
                          : "border-gray-300 bg-white text-gray-700 hover:border-sitedoc-primary"
                      }`}
                    >
                      {t(`maskin.eierskap.${e}`)}
                    </button>
                  ))}
                </div>
              </Felt>
            </div>

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
              disabled={!type || opprett.isPending || opprettMedVegvesen.isPending}
              className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
            >
              {opprett.isPending || opprettMedVegvesen.isPending
                ? t("handling.lagrer")
                : t("handling.lagre")}
            </button>
          </div>
        </form>
      )}

      {kategori === "kjoretoy" && !registreringsnummer && !erVegvesenFlyt && (
        <p className="mt-3 flex items-start gap-1 text-xs text-gray-400">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
          {t("maskin.vegvesen.hentInnHint")}
        </p>
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

function Linje({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-gray-500">{k}:</span>
      <span className="text-gray-900">{v}</span>
    </>
  );
}
