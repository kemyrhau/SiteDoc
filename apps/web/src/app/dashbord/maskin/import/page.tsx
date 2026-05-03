"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileSpreadsheet, AlertTriangle, Check, X, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";

type ImportSteg = "opplastning" | "forhandsvisning" | "bekreft" | "resultat";

type ForhandsvisningRad = {
  radnummer: number;
  navn: string;
  internnummer: string | null;
  regnummer: string | null;
  kategori: "kjoretoy" | "anleggsmaskin" | "smautstyr";
  eierskap: "eid" | "leid";
  aarsmodell: number | null;
  ansvarlig1Navn: string | null;
  ansvarlig2Navn: string | null;
  ansvarlig1Match: boolean | null;
  ansvarlig2Match: boolean | null;
  erDuplikat: boolean;
};

type ForhandsvisningResultat = {
  filHash: string;
  totaltIFil: number;
  importerbart: number;
  duplikater: number;
  filtrerte: Array<{ radnummer: number; navn: string; grunn: string }>;
  fordeling: { kjoretoy: number; anleggsmaskin: number; smautstyr: number };
  medRegnummer: number;
  leid: number;
  ansvarligeMatcha: string[];
  ansvarligeUmatcha: string[];
  valideringsfeil: string[];
  forhåndsvisning: ForhandsvisningRad[];
};

type BekreftResultat = {
  opprettet: number;
  hoppetOver: Array<{ navn: string; grunn: string }>;
  vegvesenKølagt: number;
  umatchaAnsvarlige: string[];
  filtrerte: number;
};

export default function MaskinImportSide() {
  const { t } = useTranslation();
  const router = useRouter();

  const [steg, setSteg] = useState<ImportSteg>("opplastning");
  const [filInnhold, setFilInnhold] = useState<string>("");
  const [filnavn, setFilnavn] = useState<string>("");
  const [draOver, setDraOver] = useState(false);
  const filInputRef = useRef<HTMLInputElement>(null);
  const [forhandsvisning, setForhandsvisning] = useState<ForhandsvisningResultat | null>(null);
  const [resultat, setResultat] = useState<BekreftResultat | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  type ForhandInput = { filInnhold: string };
  type BekreftInput = ForhandInput & { filHash: string };

  // Smal lokal interface-cast (etablert mønster mot TS2589)
  const forhandMutation = (
    trpc.maskin.import.importerForhandsvisning as unknown as {
      useMutation: (opts: {
        onSuccess: (data: ForhandsvisningResultat) => void;
        onError: (e: { message: string }) => void;
      }) => { mutate: (i: ForhandInput) => void; isPending: boolean };
    }
  ).useMutation({
    onSuccess: (data) => {
      setForhandsvisning(data);
      setSteg("forhandsvisning");
    },
    onError: (e) => setFeil(e.message),
  });

  const bekreftMutation = (
    trpc.maskin.import.importerBekreft as unknown as {
      useMutation: (opts: {
        onSuccess: (data: BekreftResultat) => void;
        onError: (e: { message: string }) => void;
      }) => { mutate: (i: BekreftInput) => void; isPending: boolean };
    }
  ).useMutation({
    onSuccess: (data) => {
      setResultat(data);
      setSteg("resultat");
    },
    onError: (e) => setFeil(e.message),
  });

  async function handleFilValg(fil: File) {
    setFeil(null);
    setFilnavn(fil.name);
    if (!fil.name.toLowerCase().endsWith(".xlsx")) {
      setFeil(t("firma.maskin.import.feil.kunXlsx"));
      return;
    }
    const buffer = await fil.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    setFilInnhold(base64);
    forhandMutation.mutate({ filInnhold: base64 });
  }

  function handleBekreft() {
    if (!forhandsvisning) return;
    setFeil(null);
    bekreftMutation.mutate({
      filInnhold,
      filHash: forhandsvisning.filHash,
    });
  }

  const kategoriLabel: Record<ForhandsvisningRad["kategori"], string> = {
    kjoretoy: t("maskin.kategoriKjoretoy"),
    anleggsmaskin: t("maskin.kategoriAnleggsmaskin"),
    smautstyr: t("maskin.kategoriSmautstyr"),
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header — tilbake-pil og tittel på samme linje */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/dashbord/maskin"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          title={t("firma.maskin.import.tilbakeTilMaskin")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("firma.maskin.import.tittel")}
        </h1>
      </div>

      {/* Steg-indikator */}
      <div className="mb-6 flex items-center gap-2 text-xs text-gray-500">
        {(["opplastning", "forhandsvisning", "bekreft", "resultat"] as ImportSteg[]).map(
          (s, i, arr) => {
            const erFerdig = arr.indexOf(steg) > i;
            const erAktiv = steg === s;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    erAktiv
                      ? "bg-sitedoc-primary text-white"
                      : erFerdig
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {erFerdig ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={erAktiv ? "font-medium text-gray-900" : ""}>
                  {t(`firma.maskin.import.steg.${s}`)}
                </span>
                {i < 3 && <div className="h-px w-8 bg-gray-300" />}
              </div>
            );
          },
        )}
      </div>

      {/* Steg 1: Opplastning — klikkbar drop-sone */}
      {steg === "opplastning" && (
        <div
          onClick={() => filInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDraOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDraOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDraOver(false);
            const fil = e.dataTransfer.files?.[0];
            if (fil) handleFilValg(fil);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              filInputRef.current?.click();
            }
          }}
          className={`group cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-sitedoc-primary focus:ring-offset-2 ${
            draOver
              ? "border-sitedoc-primary bg-blue-50"
              : "border-gray-300 bg-white hover:border-sitedoc-primary hover:bg-blue-50/40"
          }`}
        >
          <input
            ref={filInputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(e) => {
              const fil = e.target.files?.[0];
              if (fil) handleFilValg(fil);
              // Tillat valg av samme fil to ganger på rad
              e.target.value = "";
            }}
          />
          <UploadCloud
            className={`mx-auto h-12 w-12 transition-colors ${
              draOver ? "text-sitedoc-primary" : "text-gray-400 group-hover:text-sitedoc-primary"
            }`}
          />
          <h3 className="mt-4 text-base font-semibold text-gray-900">
            {t("firma.maskin.import.steg1.dropTittel")}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t("firma.maskin.import.steg1.dropEller")}{" "}
            <span className="font-medium text-sitedoc-primary underline-offset-2 group-hover:underline">
              {t("firma.maskin.import.steg1.dropKlikk")}
            </span>
          </p>
          <p className="mt-3 text-xs text-gray-400">
            {t("firma.maskin.import.steg1.dropFormat")}
          </p>
          {forhandMutation.isPending && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" />
              <span>{t("firma.maskin.import.steg1.parser")}</span>
            </div>
          )}
          {feil && <p className="mt-4 text-sm text-red-600">{feil}</p>}
        </div>
      )}

      {/* Steg 2: Forhåndsvisning */}
      {steg === "forhandsvisning" && forhandsvisning && (
        <div className="space-y-4">
          {/* Filnavn — kompakt enkelt-linje */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileSpreadsheet className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{filnavn}</span>
            <span className="text-gray-400">·</span>
            <span>
              {t("firma.maskin.import.fillinje", {
                totalt: forhandsvisning.totaltIFil,
                filtrert: forhandsvisning.filtrerte.length,
              })}
            </span>
          </div>

          {/* Sammendrag — 4 stats med fremhevet «Importerbart» */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.maskin.import.gruppe.sammendrag")}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label={t("firma.maskin.import.sammendrag.importerbart")} verdi={forhandsvisning.importerbart} fremhev />
              <Stat label={t("firma.maskin.import.sammendrag.duplikater")} verdi={forhandsvisning.duplikater} />
              <Stat label={t("firma.maskin.import.sammendrag.medRegnr")} verdi={forhandsvisning.medRegnummer} />
              <Stat label={t("firma.maskin.import.sammendrag.leid")} verdi={forhandsvisning.leid} />
            </div>
          </div>

          {/* Kategori — separat seksjon med 3-kol-grid */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.maskin.import.gruppe.kategori")}
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <Stat label={t("maskin.kategoriKjoretoy")} verdi={forhandsvisning.fordeling.kjoretoy} />
              <Stat label={t("maskin.kategoriAnleggsmaskin")} verdi={forhandsvisning.fordeling.anleggsmaskin} />
              <Stat label={t("maskin.kategoriSmautstyr")} verdi={forhandsvisning.fordeling.smautstyr} />
            </div>
          </div>

          {/* Advarsler */}
          {forhandsvisning.valideringsfeil.length > 0 && (
            <Boks farge="red" tittel={t("firma.maskin.import.varsel.valideringsfeil")}>
              <ul className="list-disc pl-5 text-sm">
                {forhandsvisning.valideringsfeil.slice(0, 10).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </Boks>
          )}

          {forhandsvisning.filtrerte.length > 0 && (
            <Boks farge="gray" tittel={t("firma.maskin.import.varsel.filtrerte", { antall: forhandsvisning.filtrerte.length })}>
              <ul className="text-xs text-gray-600">
                {forhandsvisning.filtrerte.slice(0, 5).map((f) => (
                  <li key={f.radnummer}>
                    {t("firma.maskin.import.varsel.filtrertRad", { rad: f.radnummer, navn: f.navn, grunn: f.grunn })}
                  </li>
                ))}
              </ul>
            </Boks>
          )}

          {forhandsvisning.duplikater > 0 && (
            <Boks farge="yellow" tittel={t("firma.maskin.import.varsel.duplikater", { antall: forhandsvisning.duplikater })}>
              <p className="text-sm">{t("firma.maskin.import.varsel.duplikaterBeskrivelse")}</p>
            </Boks>
          )}

          {forhandsvisning.ansvarligeUmatcha.length > 0 && (
            <Boks farge="amber" tittel={t("firma.maskin.import.varsel.ansvarligeUmatcha", { antall: forhandsvisning.ansvarligeUmatcha.length })}>
              <p className="mb-1 text-sm">{t("firma.maskin.import.varsel.ansvarligeUmatchaBeskrivelse")}</p>
              <p className="font-mono text-xs">{forhandsvisning.ansvarligeUmatcha.join(", ")}</p>
            </Boks>
          )}

          {forhandsvisning.ansvarligeMatcha.length > 0 && (
            <Boks farge="green" tittel={t("firma.maskin.import.varsel.ansvarligeMatcha", { antall: forhandsvisning.ansvarligeMatcha.length })}>
              <p className="font-mono text-xs">{forhandsvisning.ansvarligeMatcha.join(", ")}</p>
            </Boks>
          )}

          {/* Forhåndsvisnings-tabell (25 første) */}
          {forhandsvisning.forhåndsvisning.length > 0 && (
            <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.navn")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.internnummer")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.regnr")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.kategori")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.eierskap")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.ansvarlig1")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.maskin.import.kolonne.ansvarlig2")}</th>
                  </tr>
                </thead>
                <tbody>
                  {forhandsvisning.forhåndsvisning.map((rad) => (
                    <tr
                      key={rad.radnummer}
                      className={`border-t border-gray-100 ${
                        rad.erDuplikat ? "bg-yellow-50" : ""
                      }`}
                    >
                      <td className="px-2 py-1 text-gray-500">{rad.radnummer}</td>
                      <td className="px-2 py-1">{rad.navn}</td>
                      <td className="px-2 py-1 font-mono">{rad.internnummer ?? "—"}</td>
                      <td className="px-2 py-1 font-mono">{rad.regnummer ?? "—"}</td>
                      <td className="px-2 py-1">{kategoriLabel[rad.kategori]}</td>
                      <td className="px-2 py-1">
                        <span className={rad.eierskap === "leid" ? "rounded bg-blue-50 px-1.5 py-0.5 text-blue-700" : ""}>
                          {rad.eierskap === "leid"
                            ? t("firma.maskin.import.eierskap.leid")
                            : t("firma.maskin.import.eierskap.eid")}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <AnsvarligCell navn={rad.ansvarlig1Navn} match={rad.ansvarlig1Match} />
                      </td>
                      <td className="px-2 py-1">
                        <AnsvarligCell navn={rad.ansvarlig2Navn} match={rad.ansvarlig2Match} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {forhandsvisning.importerbart > forhandsvisning.forhåndsvisning.length && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {t("firma.maskin.import.flereRader", {
                    vist: forhandsvisning.forhåndsvisning.length,
                    totalt: forhandsvisning.importerbart,
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSteg("opplastning")}>
              {t("firma.maskin.import.knapp.tilbake")}
            </Button>
            <Button
              type="button"
              onClick={() => setSteg("bekreft")}
              disabled={
                forhandsvisning.valideringsfeil.length > 0 ||
                forhandsvisning.importerbart - forhandsvisning.duplikater === 0
              }
            >
              {t("firma.maskin.import.knapp.neste")}
            </Button>
          </div>
        </div>
      )}

      {/* Steg 3: Bekreft */}
      {steg === "bekreft" && forhandsvisning && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-blue-900">
              {t("firma.maskin.import.steg3.tittel")}
            </h3>
            <ul className="space-y-1 text-sm text-blue-900">
              <li>
                <strong>{forhandsvisning.importerbart - forhandsvisning.duplikater}</strong>{" "}
                {t("firma.maskin.import.steg3.opprettes")}
              </li>
              {forhandsvisning.duplikater > 0 && (
                <li>
                  <strong>{forhandsvisning.duplikater}</strong>{" "}
                  {t("firma.maskin.import.steg3.duplikaterHopper")}
                </li>
              )}
              <li>
                <strong>{forhandsvisning.medRegnummer}</strong>{" "}
                {t("firma.maskin.import.steg3.vegvesenKo")}
              </li>
              {forhandsvisning.ansvarligeUmatcha.length > 0 && (
                <li>
                  <strong>{forhandsvisning.ansvarligeUmatcha.length}</strong>{" "}
                  {t("firma.maskin.import.steg3.umatcha")}
                </li>
              )}
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            {t("firma.maskin.import.steg3.advarsel")}
          </p>

          {feil && <p className="text-sm text-red-600">{feil}</p>}

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSteg("forhandsvisning")}>
              {t("firma.maskin.import.knapp.tilbake")}
            </Button>
            <Button
              type="button"
              onClick={handleBekreft}
              disabled={bekreftMutation.isPending}
            >
              {bekreftMutation.isPending
                ? t("firma.maskin.import.knapp.importerer")
                : t("firma.maskin.import.knapp.bekreft")}
            </Button>
          </div>
        </div>
      )}

      {/* Steg 4: Resultat */}
      {steg === "resultat" && resultat && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-900">
              <Check className="h-4 w-4" />
              {t("firma.maskin.import.steg4.suksess")}
            </h3>
            <ul className="space-y-1 text-sm text-green-900">
              <li>
                {t("firma.maskin.import.steg4.opprettet", { antall: resultat.opprettet })}
              </li>
              <li>
                {t("firma.maskin.import.steg4.vegvesenKo", { antall: resultat.vegvesenKølagt })}
              </li>
              {resultat.hoppetOver.length > 0 && (
                <li>
                  {t("firma.maskin.import.steg4.hoppetOver", { antall: resultat.hoppetOver.length })}
                </li>
              )}
              {resultat.umatchaAnsvarlige.length > 0 && (
                <li>
                  {t("firma.maskin.import.steg4.umatcha", { antall: resultat.umatchaAnsvarlige.length })}
                </li>
              )}
              {resultat.filtrerte > 0 && (
                <li>
                  {t("firma.maskin.import.steg4.filtrerte", { antall: resultat.filtrerte })}
                </li>
              )}
            </ul>
          </div>

          {resultat.umatchaAnsvarlige.length > 0 && (
            <Boks farge="amber" tittel={t("firma.maskin.import.steg4.umatchaTittel")}>
              <p className="mb-1 text-sm">{t("firma.maskin.import.steg4.umatchaBeskrivelse")}</p>
              <p className="font-mono text-xs">{resultat.umatchaAnsvarlige.join(", ")}</p>
            </Boks>
          )}

          {resultat.hoppetOver.length > 0 && (
            <Boks farge="yellow" tittel={t("firma.maskin.import.steg4.hoppetOverTittel")}>
              <ul className="text-xs">
                {resultat.hoppetOver.slice(0, 10).map((h, i) => (
                  <li key={i}>{h.navn} — {h.grunn}</li>
                ))}
                {resultat.hoppetOver.length > 10 && (
                  <li className="text-gray-500">… +{resultat.hoppetOver.length - 10}</li>
                )}
              </ul>
            </Boks>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" onClick={() => router.push("/dashbord/maskin")}>
              {t("firma.maskin.import.knapp.tilMaskinliste")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, verdi, fremhev }: { label: string; verdi: number; fremhev?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-semibold ${fremhev ? "text-sitedoc-primary" : "text-gray-900"}`}>
        {verdi}
      </div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function Boks({
  farge,
  tittel,
  children,
}: {
  farge: "red" | "yellow" | "amber" | "green" | "blue" | "gray";
  tittel: string;
  children: React.ReactNode;
}) {
  const farger: Record<string, string> = {
    red: "border-red-200 bg-red-50 text-red-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-green-200 bg-green-50 text-green-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    gray: "border-gray-200 bg-gray-50 text-gray-900",
  };
  const ikon = farge === "green" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />;
  return (
    <div className={`rounded-lg border p-3 ${farger[farge]}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        {ikon}
        {tittel}
      </div>
      {children}
    </div>
  );
}

function AnsvarligCell({ navn, match }: { navn: string | null; match: boolean | null }) {
  if (!navn) return <span className="text-gray-400">—</span>;
  if (match === true) {
    return (
      <span className="inline-flex items-center gap-1 text-green-700">
        <Check className="h-3 w-3" />
        {navn}
      </span>
    );
  }
  if (match === false) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <X className="h-3 w-3" />
        {navn}
      </span>
    );
  }
  return <span>{navn}</span>;
}
