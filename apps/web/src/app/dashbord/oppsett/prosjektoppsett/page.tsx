"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Input, Spinner } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";
import {
  Save,
  MapPin,
  Hash,
  FileText,
  Calendar,
  CheckCircle2,
  Archive,
  CircleDot,
  X,
  Upload,
  ImageIcon,
} from "lucide-react";

// Leaflet krever window — laster dynamisk uten SSR
const KartVelgerDynamic = dynamic(
  () => import("@/components/KartVelger").then((m) => m.KartVelger),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-gray-100" /> },
);

/* ------------------------------------------------------------------ */
/*  Status-alternativ                                                  */
/* ------------------------------------------------------------------ */

const statusAlternativer = [
  {
    value: "active",
    labelKey: "prosjektoppsett.aktivt",
    beskrivelseKey: "prosjektoppsett.aktivtBeskrivelse",
    ikon: <CircleDot className="h-5 w-5 text-green-500" />,
    fargeBg: "bg-green-50",
    fargeBorder: "border-green-200",
  },
  {
    value: "completed",
    labelKey: "prosjektoppsett.fullfort",
    beskrivelseKey: "prosjektoppsett.fullfortBeskrivelse",
    ikon: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
    fargeBg: "bg-blue-50",
    fargeBorder: "border-blue-200",
  },
  {
    value: "archived",
    labelKey: "prosjektoppsett.arkivert",
    beskrivelseKey: "prosjektoppsett.arkivertBeskrivelse",
    ikon: <Archive className="h-5 w-5 text-gray-400" />,
    fargeBg: "bg-gray-50",
    fargeBorder: "border-gray-200",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Seksjon-wrapper                                                    */
/* ------------------------------------------------------------------ */

function Seksjon({
  tittel,
  beskrivelse,
  children,
}: {
  tittel: string;
  beskrivelse?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">{tittel}</h3>
        {beskrivelse && (
          <p className="mt-0.5 text-xs text-gray-500">{beskrivelse}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function ProsjektoppsettSide() {
  const { prosjektId } = useProsjekt();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: prosjekt, isLoading } = trpc.prosjekt.hentMedId.useQuery(
    { id: prosjektId! },
    { enabled: !!prosjektId },
  );

  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [adresse, setAdresse] = useState("");
  const [status, setStatus] = useState("active");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [interntNummer, setInterntNummer] = useState("");
  const [eksterntNummer, setEksterntNummer] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [visInterntNummer, setVisInterntNummer] = useState(true);
  const [lasterOppLogo, setLasterOppLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [harEndringer, setHarEndringer] = useState(false);

  // Synkroniser skjemafelter med prosjektdata
  useEffect(() => {
    if (prosjekt) {
      setNavn(prosjekt.name);
      setBeskrivelse(prosjekt.description ?? "");
      setAdresse(prosjekt.address ?? "");
      setStatus(prosjekt.status);
      setLatitude(prosjekt.latitude ?? null);
      setLongitude(prosjekt.longitude ?? null);
      setInterntNummer((prosjekt as { internalProjectNumber?: string | null }).internalProjectNumber ?? "");
      setEksterntNummer(prosjekt.externalProjectNumber ?? "");
      setLogoUrl(prosjekt.logoUrl ?? null);
      setVisInterntNummer((prosjekt as { showInternalProjectNumber?: boolean }).showInternalProjectNumber !== false);
      setHarEndringer(false);
    }
  }, [prosjekt]);

  function handleFeltEndring<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setHarEndringer(true);
    };
  }

  const håndterLogoOpplasting = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fil = e.target.files?.[0];
    if (!fil) return;
    setLasterOppLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const respons = await fetch("/api/trpc/../../../upload", {
        method: "POST",
        body: formData,
      });
      if (!respons.ok) return;
      const data = await respons.json() as { fileUrl: string };
      setLogoUrl(data.fileUrl);
      setHarEndringer(true);
    } catch (feil) {
      console.error("Logo-opplasting feilet:", feil);
    } finally {
      setLasterOppLogo(false);
      e.target.value = "";
    }
  }, []);

  const oppdaterMutation = trpc.prosjekt.oppdater.useMutation({
    onSuccess: () => {
      utils.prosjekt.hentMedId.invalidate({ id: prosjektId! });
      utils.prosjekt.hentAlle.invalidate();
      setHarEndringer(false);
    },
  });

  function handleLagre() {
    if (!prosjektId) return;
    oppdaterMutation.mutate({
      id: prosjektId,
      name: navn.trim(),
      description: beskrivelse.trim() || undefined,
      address: adresse.trim() || undefined,
      latitude,
      longitude,
      internalProjectNumber: interntNummer.trim() || null,
      externalProjectNumber: eksterntNummer.trim() || null,
      logoUrl: logoUrl || null,
      showInternalProjectNumber: visInterntNummer,
      status: status as "active" | "archived" | "completed",
    });
  }

  if (isLoading || !prosjekt) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Prosjektoppsett</h2>
        {harEndringer && (
          <Button
            size="sm"
            onClick={handleLagre}
            loading={oppdaterMutation.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" />
            Lagre endringer
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {/* Firmalogo */}
        <Seksjon tittel={t("prosjektoppsett.firmalogo")} beskrivelse={t("prosjektoppsett.firmalogoBeskrivelse")}>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                <img
                  src={logoUrl.startsWith("/uploads/") ? `/api/uploads${logoUrl.replace("/uploads", "")}` : logoUrl}
                  alt="Firmalogo"
                  className="max-h-[60px] max-w-[200px] object-contain"
                />
                <button
                  onClick={() => {
                    setLogoUrl(null);
                    setHarEndringer(true);
                  }}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex h-[60px] w-[200px] items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <ImageIcon className="h-4 w-4" />
                  Ingen logo lastet opp
                </div>
              </div>
            )}
            <div>
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={lasterOppLogo}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {lasterOppLogo ? (
                  <Spinner size="sm" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {lasterOppLogo ? t("handling.lasterOpp") : t("prosjektoppsett.lastOppLogo")}
              </button>
              <p className="mt-1 text-xs text-gray-400">PNG eller JPG, maks 200×60px anbefalt</p>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept=".png,.jpg,.jpeg"
              onChange={håndterLogoOpplasting}
              className="hidden"
            />
          </div>
        </Seksjon>

        {/* Generell informasjon */}
        <Seksjon tittel={t("prosjektoppsett.generellInfo")}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <Hash className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Prosjektnummer</p>
                <p className="text-sm font-medium text-gray-900">
                  {prosjekt.projectNumber}
                </p>
              </div>
            </div>

            <Input
              label={t("prosjektoppsett.interntNr")}
              placeholder="F.eks. referanse til SharePoint, ERP e.l."
              value={interntNummer}
              onChange={(e) =>
                handleFeltEndring(setInterntNummer)(e.target.value)
              }
            />

            <Input
              label={t("prosjektoppsett.ekstertNr")}
              placeholder="F.eks. kundens prosjektnummer..."
              value={eksterntNummer}
              onChange={(e) =>
                handleFeltEndring(setEksterntNummer)(e.target.value)
              }
            />

            <Input
              label={t("prosjektoppsett.prosjektnavn")}
              value={navn}
              onChange={(e) =>
                handleFeltEndring(setNavn)(e.target.value)
              }
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Beskrivelse
              </label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sitedoc-primary focus:outline-none focus:ring-1 focus:ring-sitedoc-primary"
                rows={3}
                placeholder="Kort beskrivelse av prosjektet..."
                value={beskrivelse}
                onChange={(e) =>
                  handleFeltEndring(setBeskrivelse)(e.target.value)
                }
              />
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="mt-7 h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="flex-1">
                <Input
                  label="Adresse"
                  placeholder="Prosjektets adresse..."
                  value={adresse}
                  onChange={(e) =>
                    handleFeltEndring(setAdresse)(e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </Seksjon>

        {/* Prosjektlokasjon */}
        <Seksjon
          tittel={t("prosjektoppsett.prosjektlokasjon")}
          beskrivelse={t("prosjektoppsett.prosjektlokasjonBeskrivelse")}
        >
          <div className="flex flex-col gap-3">
            <KartVelgerDynamic
              latitude={latitude}
              longitude={longitude}
              onVelgPosisjon={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
                setHarEndringer(true);
              }}
            />
            {latitude != null && longitude != null && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
                <button
                  onClick={() => {
                    setLatitude(null);
                    setLongitude(null);
                    setHarEndringer(true);
                  }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                  Fjern lokasjon
                </button>
              </div>
            )}
          </div>
        </Seksjon>

        {/* Rapportinnstillinger */}
        <Seksjon
          tittel={t("prosjektoppsett.rapportinnstillinger")}
          beskrivelse={t("prosjektoppsett.rapportinnstillingerBeskrivelse")}
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={visInterntNummer}
              onChange={(e) => handleFeltEndring(setVisInterntNummer)(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Vis internt prosjektnummer på rapport
              </p>
              <p className="text-xs text-gray-500">
                Deaktiver for å skjule SiteDoc-prosjektnummeret (SD-...) i utskriftshodet
              </p>
            </div>
          </label>
        </Seksjon>

        {/* Prosjektstatus */}
        <Seksjon
          tittel={t("prosjektoppsett.prosjektstatus")}
          beskrivelse={t("prosjektoppsett.prosjektstatusBeskrivelse")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {statusAlternativer.map((alt) => {
              const erValgt = status === alt.value;
              return (
                <button
                  key={alt.value}
                  onClick={() => handleFeltEndring(setStatus)(alt.value)}
                  className={`flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                    erValgt
                      ? `${alt.fargeBg} ${alt.fargeBorder}`
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {alt.ikon}
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        erValgt ? "text-gray-900" : "text-gray-700"
                      }`}
                    >
                      {t(alt.labelKey)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {t(alt.beskrivelseKey)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Seksjon>

        {/* Prosjektdetaljer (read-only) */}
        <Seksjon tittel={t("prosjektoppsett.prosjektdetaljer")}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Opprettet</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(prosjekt.createdAt).toLocaleDateString("nb-NO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Maler</p>
                <p className="text-sm font-medium text-gray-900">
                  {prosjekt.templates?.length ?? 0} rapportmaler
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Entrepriser</p>
                <p className="text-sm font-medium text-gray-900">
                  {prosjekt.enterprises?.length ?? 0} entrepriser
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Medlemmer</p>
                <p className="text-sm font-medium text-gray-900">
                  {prosjekt.members?.length ?? 0} brukere
                </p>
              </div>
            </div>
          </div>
        </Seksjon>

        {/* Lagre-knapp nederst */}
        <div className="flex justify-end">
          <Button
            onClick={handleLagre}
            loading={oppdaterMutation.isPending}
            disabled={!harEndringer}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {harEndringer ? t("prosjektoppsett.lagreEndringer") : t("prosjektoppsett.ingenEndringer")}
          </Button>
        </div>
      </div>
    </div>
  );
}
