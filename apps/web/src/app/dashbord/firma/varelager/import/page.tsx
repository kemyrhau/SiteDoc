"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileSpreadsheet, AlertTriangle, Check, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

type ImportSteg = "opplastning" | "forhandsvisning" | "bekreft" | "resultat";

type Forhåndsvisningsrad = {
  radnummer: number;
  navn: string;
  varenummer: string | null;
  kategori: string;
  enhet: string;
  enhetRaw: string;
  pris: number | null;
  erDuplikat: boolean;
  duplikatGrunn: string | null;
};

type UtelattRad = {
  radnummer: number;
  navn: string;
  grunn: "ugyldig-navn" | "heatwork-utleie";
  kategori?: string;
  forventetEquipmentInternnr?: string;
};

type ForhandsvisningResultat = {
  filhash: string;
  totaltIFil: number;
  importerbart: number;
  utelatte: UtelattRad[];
  kategorier: string[];
  eksisterendeKategorier: string[];
  nyeKategorier: string[];
  duplikaterIDB: number;
  duplikaterIFil: number;
  valideringsfeil: string[];
  forhåndsvisning: Forhåndsvisningsrad[];
};

type BekreftResultat = {
  opprettedeVarer: number;
  opprettedeKategorier: number;
  hoppetOver: Array<{ navn: string; grunn: string }>;
  utelatte: number;
  heatworkUtelatt: UtelattRad[];
  filhash: string;
};

export default function VareImportSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const harVarelager = valgtFirma?.aktiveFirmamoduler.includes("varelager") ?? false;

  const [steg, setSteg] = useState<ImportSteg>("opplastning");
  const [filInnhold, setFilInnhold] = useState<string>("");
  const [filnavn, setFilnavn] = useState<string>("");
  const [forhandsvisning, setForhandsvisning] = useState<ForhandsvisningResultat | null>(null);
  const [resultat, setResultat] = useState<BekreftResultat | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [drarOver, setDrarOver] = useState(false);

  type ForhandInput = { filInnhold: string; organizationId: string };
  type BekreftInput = ForhandInput & { filhash: string };

  const forhandMutation = (
    trpc.vareImport.importerForhandsvisning as unknown as {
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
    trpc.vareImport.importerBekreft as unknown as {
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
    const navnLower = fil.name.toLowerCase();
    if (!navnLower.endsWith(".xls") && !navnLower.endsWith(".xml")) {
      setFeil(t("firma.varelager.import.feil.kunSpreadsheetXml"));
      return;
    }
    const tekst = await fil.text();
    setFilInnhold(tekst);
    forhandMutation.mutate({ filInnhold: tekst, organizationId: orgId! });
  }

  function handleBekreft() {
    if (!forhandsvisning) return;
    setFeil(null);
    bekreftMutation.mutate({
      filInnhold,
      filhash: forhandsvisning.filhash,
      organizationId: orgId!,
    });
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!harVarelager) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          {t("firma.varelager.modulIkkeAktivert.tittel")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("firma.varelager.modulIkkeAktivert.beskrivelse")}
        </p>
      </div>
    );
  }

  const heatworkUtelatt = forhandsvisning?.utelatte.filter((u) => u.grunn === "heatwork-utleie") ?? [];
  const ugyldigeUtelatt = forhandsvisning?.utelatte.filter((u) => u.grunn === "ugyldig-navn") ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/dashbord/firma/varelager"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          title={t("firma.varelager.import.tilbakeTilKatalog")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("firma.varelager.import.tittel")}
        </h1>
      </div>

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
                  {t(`firma.varelager.import.steg.${s}`)}
                </span>
                {i < 3 && <div className="h-px w-8 bg-gray-300" />}
              </div>
            );
          },
        )}
      </div>

      {/* Steg 1: Opplastning */}
      {steg === "opplastning" && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrarOver(true);
          }}
          onDragLeave={() => setDrarOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrarOver(false);
            const fil = e.dataTransfer.files?.[0];
            if (fil) void handleFilValg(fil);
          }}
          className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            drarOver
              ? "border-sitedoc-primary bg-blue-50"
              : "border-gray-300 bg-white hover:border-sitedoc-primary hover:bg-blue-50/40"
          }`}
        >
          <UploadCloud
            className={`h-12 w-12 transition-colors ${
              drarOver ? "text-sitedoc-primary" : "text-gray-400 group-hover:text-sitedoc-primary"
            }`}
          />
          <p className="mt-4 text-base font-semibold text-gray-900">
            {t("firma.varelager.import.steg1.dropKlikk")}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {t("firma.varelager.import.steg1.dropFormat")}
          </p>
          <input
            type="file"
            accept=".xls,.xml"
            className="hidden"
            onChange={(e) => {
              const fil = e.target.files?.[0];
              if (fil) void handleFilValg(fil);
              e.target.value = "";
            }}
          />
          {forhandMutation.isPending && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" />
              <span>{t("firma.varelager.import.steg1.parser")}</span>
            </div>
          )}
          {feil && <p className="mt-4 text-sm text-red-600">{feil}</p>}
        </label>
      )}

      {/* Steg 2: Forhåndsvisning */}
      {steg === "forhandsvisning" && forhandsvisning && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileSpreadsheet className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-900">{filnavn}</span>
            <span className="text-gray-400">·</span>
            <span>
              {t("firma.varelager.import.fillinje", {
                totalt: forhandsvisning.totaltIFil,
                utelatt: forhandsvisning.utelatte.length,
              })}
            </span>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("firma.varelager.import.gruppe.sammendrag")}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Stat label={t("firma.varelager.import.sammendrag.importerbart")} verdi={forhandsvisning.importerbart} fremhev />
              <Stat label={t("firma.varelager.import.sammendrag.nyeKategorier")} verdi={forhandsvisning.nyeKategorier.length} />
              <Stat label={t("firma.varelager.import.sammendrag.duplikaterDB")} verdi={forhandsvisning.duplikaterIDB} />
              <Stat label={t("firma.varelager.import.sammendrag.duplikaterFil")} verdi={forhandsvisning.duplikaterIFil} />
            </div>
          </div>

          {/* Kategori-oversikt */}
          {forhandsvisning.kategorier.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("firma.varelager.import.gruppe.kategorier")}
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {forhandsvisning.kategorier.map((k) => {
                  const erNy = forhandsvisning.nyeKategorier.includes(k);
                  return (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-gray-900">{k}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          erNy
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {erNy
                          ? t("firma.varelager.import.kategori.ny")
                          : t("firma.varelager.import.kategori.eksisterende")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {forhandsvisning.valideringsfeil.length > 0 && (
            <Boks farge="red" tittel={t("firma.varelager.import.varsel.valideringsfeil")}>
              <ul className="list-disc pl-5 text-sm">
                {forhandsvisning.valideringsfeil.slice(0, 10).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </Boks>
          )}

          {ugyldigeUtelatt.length > 0 && (
            <Boks farge="gray" tittel={t("firma.varelager.import.varsel.ugyldige", { antall: ugyldigeUtelatt.length })}>
              <ul className="text-xs text-gray-700">
                {ugyldigeUtelatt.map((u) => (
                  <li key={u.radnummer}>
                    {t("firma.varelager.import.varsel.ugyldigRad", { rad: u.radnummer, navn: u.navn })}
                  </li>
                ))}
              </ul>
            </Boks>
          )}

          {heatworkUtelatt.length > 0 && (
            <Boks farge="amber" tittel={t("firma.varelager.import.varsel.heatwork", { antall: heatworkUtelatt.length })}>
              <p className="mb-2 text-sm">
                {t("firma.varelager.import.varsel.heatworkBeskrivelse")}
              </p>
              <ul className="text-xs">
                {heatworkUtelatt.map((u) => (
                  <li key={u.radnummer}>
                    {u.navn}
                    {u.forventetEquipmentInternnr && (
                      <span className="ml-2 text-gray-500">→ Equipment internnr {u.forventetEquipmentInternnr}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Boks>
          )}

          {(forhandsvisning.duplikaterIDB > 0 || forhandsvisning.duplikaterIFil > 0) && (
            <Boks
              farge="yellow"
              tittel={t("firma.varelager.import.varsel.duplikater", {
                antall: forhandsvisning.duplikaterIDB + forhandsvisning.duplikaterIFil,
              })}
            >
              <p className="text-sm">{t("firma.varelager.import.varsel.duplikaterBeskrivelse")}</p>
            </Boks>
          )}

          {/* Forhåndsvisnings-tabell (25 første) */}
          {forhandsvisning.forhåndsvisning.length > 0 && (
            <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.varelager.import.kolonne.navn")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.varelager.import.kolonne.varenummer")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.varelager.import.kolonne.kategori")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.varelager.import.kolonne.enhet")}</th>
                    <th className="px-2 py-1.5 text-right">{t("firma.varelager.import.kolonne.pris")}</th>
                    <th className="px-2 py-1.5 text-left">{t("firma.varelager.import.kolonne.merknad")}</th>
                  </tr>
                </thead>
                <tbody>
                  {forhandsvisning.forhåndsvisning.slice(0, 25).map((rad) => (
                    <tr
                      key={rad.radnummer}
                      className={`border-t border-gray-100 ${rad.erDuplikat ? "bg-yellow-50" : ""}`}
                    >
                      <td className="px-2 py-1 text-gray-500">{rad.radnummer}</td>
                      <td className="px-2 py-1">{rad.navn}</td>
                      <td className="px-2 py-1 font-mono">{rad.varenummer ?? "—"}</td>
                      <td className="px-2 py-1">{rad.kategori}</td>
                      <td className="px-2 py-1">
                        <span title={rad.enhetRaw !== rad.enhet ? rad.enhetRaw : undefined}>
                          {rad.enhet}
                        </span>
                      </td>
                      <td className="px-2 py-1 text-right">{rad.pris ?? "—"}</td>
                      <td className="px-2 py-1 text-amber-700">{rad.duplikatGrunn ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {forhandsvisning.forhåndsvisning.length > 25 && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {t("firma.varelager.import.flereRader", {
                    vist: 25,
                    totalt: forhandsvisning.forhåndsvisning.length,
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSteg("opplastning")}>
              {t("firma.varelager.import.knapp.tilbake")}
            </Button>
            <Button
              type="button"
              onClick={() => setSteg("bekreft")}
              disabled={
                forhandsvisning.valideringsfeil.length > 0 ||
                forhandsvisning.importerbart === 0
              }
            >
              {t("firma.varelager.import.knapp.neste")}
            </Button>
          </div>
        </div>
      )}

      {/* Steg 3: Bekreft */}
      {steg === "bekreft" && forhandsvisning && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-blue-900">
              {t("firma.varelager.import.steg3.tittel")}
            </h3>
            <ul className="space-y-1 text-sm text-blue-900">
              <li>
                <strong>{forhandsvisning.nyeKategorier.length}</strong>{" "}
                {t("firma.varelager.import.steg3.kategorierOpprettes")}
              </li>
              <li>
                <strong>{forhandsvisning.importerbart}</strong>{" "}
                {t("firma.varelager.import.steg3.varerOpprettes")}
              </li>
              {forhandsvisning.duplikaterIDB + forhandsvisning.duplikaterIFil > 0 && (
                <li>
                  <strong>
                    {forhandsvisning.duplikaterIDB + forhandsvisning.duplikaterIFil}
                  </strong>{" "}
                  {t("firma.varelager.import.steg3.duplikaterHopper")}
                </li>
              )}
              {heatworkUtelatt.length > 0 && (
                <li>
                  <strong>{heatworkUtelatt.length}</strong>{" "}
                  {t("firma.varelager.import.steg3.heatworkUtelates")}
                </li>
              )}
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            {t("firma.varelager.import.steg3.advarsel")}
          </p>

          {feil && <p className="text-sm text-red-600">{feil}</p>}

          <div className="flex justify-between gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSteg("forhandsvisning")}>
              {t("firma.varelager.import.knapp.tilbake")}
            </Button>
            <Button
              type="button"
              onClick={handleBekreft}
              disabled={bekreftMutation.isPending}
            >
              {bekreftMutation.isPending
                ? t("firma.varelager.import.knapp.importerer")
                : t("firma.varelager.import.knapp.bekreft")}
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
              {t("firma.varelager.import.steg4.suksess")}
            </h3>
            <ul className="space-y-1 text-sm text-green-900">
              <li>
                {t("firma.varelager.import.steg4.opprettetVarer", { antall: resultat.opprettedeVarer })}
              </li>
              <li>
                {t("firma.varelager.import.steg4.opprettetKategorier", { antall: resultat.opprettedeKategorier })}
              </li>
              {resultat.hoppetOver.length > 0 && (
                <li>
                  {t("firma.varelager.import.steg4.hoppetOver", { antall: resultat.hoppetOver.length })}
                </li>
              )}
              {resultat.heatworkUtelatt.length > 0 && (
                <li>
                  {t("firma.varelager.import.steg4.heatwork", { antall: resultat.heatworkUtelatt.length })}
                </li>
              )}
            </ul>
          </div>

          {resultat.heatworkUtelatt.length > 0 && (
            <Boks farge="amber" tittel={t("firma.varelager.import.steg4.heatworkTittel")}>
              <p className="mb-2 text-sm">
                {t("firma.varelager.import.steg4.heatworkBeskrivelse")}
              </p>
              <ul className="text-xs">
                {resultat.heatworkUtelatt.map((u) => (
                  <li key={u.radnummer}>
                    {u.navn}
                    {u.forventetEquipmentInternnr && (
                      <span className="ml-2 text-gray-500">→ Equipment internnr {u.forventetEquipmentInternnr}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Boks>
          )}

          {resultat.hoppetOver.length > 0 && (
            <Boks farge="yellow" tittel={t("firma.varelager.import.steg4.hoppetOverTittel")}>
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
            <Button type="button" onClick={() => router.push("/dashbord/firma/varelager")}>
              {t("firma.varelager.import.knapp.tilKatalog")}
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
