"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Truck,
  Wrench,
  Hammer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner, Modal } from "@sitedoc/ui";
import type { MaskinKategori } from "@/lib/maskin-typer";

const STATUS_ALLE = [
  "bestilt",
  "mottatt",
  "tilgjengelig",
  "utlaant",
  "paa_service",
  "pensjonert",
] as const;
const PENSJONERT_GRUNN = ["solgt", "destruert", "tapt", "stjaalet", "slitt"] as const;

const KATEGORI_IKON: Record<MaskinKategori, React.ReactNode> = {
  kjoretoy: <Truck className="h-5 w-5 text-sitedoc-primary" />,
  anleggsmaskin: <Wrench className="h-5 w-5 text-sitedoc-primary" />,
  smautstyr: <Hammer className="h-5 w-5 text-sitedoc-primary" />,
};

interface UtstyrDetalj {
  id: string;
  organizationId: string;
  kategori: string;
  type: string;
  merke: string | null;
  modell: string | null;
  internNavn: string | null;
  internNummer: string | null;
  ansvarligUserId: string | null;
  eierskap: string | null;
  aarsmodell: number | null;
  lokasjon: string | null;
  anskaffelsesDato: string | Date | null;
  nypris: string | number | null;
  notater: string | null;
  eksportKode: string | null;
  status: string;
  pensjonertDato: string | Date | null;
  pensjonertGrunn: string | null;

  registreringsnummer: string | null;
  vin: string | null;
  kjoretoygruppe: string | null;
  kjoretoygruppeNavn: string | null;
  antallSeter: number | null;
  effektKw: string | number | null;
  euroKlasse: string | null;
  nyttelast: number | null;
  girkasse: string | null;
  co2GramPerKm: string | number | null;
  forbrukLiterPer10km: string | number | null;
  kmStand: number | null;
  euKontrollSist: string | Date | null;
  euKontrollFrist: string | Date | null;
  motor: string | null;
  drivstoff: string | null;
  forsteRegistrering: string | Date | null;
  egenvekt: number | null;
  totalvekt: number | null;
  farge: string | null;
  vegvesenDataOppdatert: string | Date | null;
  vegvesenDataStatus: string | null;

  serienummer: string | null;
  driftstimer: number | null;
  skuffeKapasitet: string | number | null;
  loftKapasitet: string | number | null;
  maksVekt: number | null;

  kalibreringsDato: string | Date | null;
  kalibreringsFrist: string | Date | null;
  sertifiseringsDato: string | Date | null;
  sertifiseringsFrist: string | Date | null;
  effektW: number | null;
  vekt: number | null;
}

interface BrukerInfo {
  id: string;
  name: string | null;
  email: string;
}

interface MutationVennlig<TInput, TResult> {
  isPending: boolean;
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
}

export default function MaskinDetaljSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.maskin.equipment.hentMedId.useQuery(
    { id },
    { enabled: !!id },
  );
  const { data: brukereData } = trpc.maskin.equipment.hentMuligeAnsvarlige.useQuery();
  const { data: meg } = trpc.bruker.hentMin.useQuery();

  const [statusModalApen, setStatusModalApen] = useState(false);
  const [vegvesenKoId, setVegvesenKoId] = useState<string | null>(null);

  const utstyr = data as UtstyrDetalj | undefined;
  const brukere = (brukereData ?? []) as BrukerInfo[];
  const ansvarligNavn = utstyr?.ansvarligUserId
    ? brukere.find((b) => b.id === utstyr.ansvarligUserId)?.name ?? "—"
    : null;

  const erAdmin =
    (meg as { role?: string } | undefined)?.role === "company_admin" ||
    (meg as { role?: string } | undefined)?.role === "sitedoc_admin";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!utstyr) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-700">{t("maskin.detalj.ikkeFunnet")}</p>
          <Link
            href="/dashbord/maskin"
            className="mt-3 inline-flex items-center gap-1 text-xs text-sitedoc-primary hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("maskin.tittel")}
          </Link>
        </div>
      </div>
    );
  }

  const visningsnavn =
    [utstyr.merke, utstyr.modell].filter(Boolean).join(" ") ||
    utstyr.internNavn ||
    utstyr.type;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-4">
        <Link
          href="/dashbord/maskin"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("maskin.tittel")}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {KATEGORI_IKON[utstyr.kategori as MaskinKategori]}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{visningsnavn}</h1>
            <p className="text-xs text-gray-500">
              {t(
                `maskin.kategori${utstyr.kategori.charAt(0).toUpperCase() + utstyr.kategori.slice(1)}`,
              )}
              {utstyr.internNummer && ` · ${utstyr.internNummer}`}
              {utstyr.registreringsnummer && ` · ${utstyr.registreringsnummer}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={utstyr.status} />
          <button
            onClick={() => setStatusModalApen(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-sitedoc-primary hover:text-sitedoc-primary"
          >
            {t("maskin.detalj.endreStatus")}
          </button>
          {utstyr.kategori === "kjoretoy" &&
            utstyr.registreringsnummer &&
            erAdmin && (
              <VegvesenOppdaterKnapp
                equipmentId={utstyr.id}
                vegvesenKoId={vegvesenKoId}
                setVegvesenKoId={setVegvesenKoId}
              />
            )}
        </div>
      </div>

      {/* Status-historikk (kun pensjonert) */}
      {utstyr.status === "pensjonert" && (
        <Seksjon tittel={t("maskin.detalj.statusHistorikk")}>
          <Linje
            label={t("maskin.detalj.pensjonertDato")}
            verdi={formaterDato(utstyr.pensjonertDato)}
          />
          <Linje
            label={t("maskin.detalj.pensjonertGrunn")}
            verdi={
              utstyr.pensjonertGrunn
                ? t(`maskin.pensjonertGrunn.${utstyr.pensjonertGrunn}`)
                : "—"
            }
          />
        </Seksjon>
      )}

      {/* Generelt */}
      <Seksjon tittel={t("maskin.detalj.generelt")}>
        <Linje label={t("maskin.type")} verdi={utstyr.type} />
        <Linje label={t("maskin.merke")} verdi={utstyr.merke} />
        <Linje label={t("maskin.modell")} verdi={utstyr.modell} />
        <Linje label={t("maskin.internNavn")} verdi={utstyr.internNavn} />
        <Linje label={t("maskin.internNummer")} verdi={utstyr.internNummer} />
        <Linje
          label={t("maskin.eierskap.label")}
          verdi={utstyr.eierskap ? t(`maskin.eierskap.${utstyr.eierskap}`) : null}
        />
        <Linje label={t("maskin.aarsmodell")} verdi={utstyr.aarsmodell} />
        <Linje label={t("maskin.lokasjon")} verdi={utstyr.lokasjon} />
      </Seksjon>

      {/* Anskaffelse */}
      <Seksjon tittel={t("maskin.detalj.anskaffelse")}>
        <Linje
          label={t("maskin.anskaffelsesdato")}
          verdi={formaterDato(utstyr.anskaffelsesDato)}
        />
        <Linje label={t("maskin.nypris")} verdi={formaterPris(utstyr.nypris)} />
        <Linje label={t("maskin.eksportKode")} verdi={utstyr.eksportKode} />
      </Seksjon>

      {/* Ansvarlig */}
      <Seksjon tittel={t("maskin.detalj.ansvarlig")}>
        <Linje label={t("maskin.detalj.hovedansvarlig")} verdi={ansvarligNavn} />
        <p className="text-xs text-gray-400">
          {t("maskin.detalj.tilleggsansvarligeKommer")}
        </p>
      </Seksjon>

      {/* Kjøretøy-info */}
      {utstyr.kategori === "kjoretoy" && (
        <Seksjon tittel={t("maskin.detalj.kjoretoyInfo")}>
          <Linje
            label={t("maskin.registreringsnummer")}
            verdi={utstyr.registreringsnummer}
            mono
          />
          <Linje label={t("maskin.vin")} verdi={utstyr.vin} mono />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.kjoretoygruppe")}
            verdi={
              utstyr.kjoretoygruppe
                ? `${utstyr.kjoretoygruppeNavn ?? ""} (${utstyr.kjoretoygruppe})`.trim()
                : null
            }
          />
          <Linje label={t("maskin.drivstoff")} verdi={utstyr.drivstoff} />
          <Linje label={t("maskin.motor")} verdi={utstyr.motor} />
          <Linje label={t("maskin.effektKw")} verdi={utstyr.effektKw} />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.girkasse")}
            verdi={utstyr.girkasse}
          />
          <Linje label={t("maskin.euroKlasse")} verdi={utstyr.euroKlasse} />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.farge")}
            verdi={utstyr.farge}
          />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.antallSeter")}
            verdi={utstyr.antallSeter}
          />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.totalvekt")}
            verdi={utstyr.totalvekt ? `${utstyr.totalvekt} kg` : null}
          />
          <Linje
            label={t("maskin.egenvekt")}
            verdi={utstyr.egenvekt ? `${utstyr.egenvekt} kg` : null}
          />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.nyttelast")}
            verdi={utstyr.nyttelast ? `${utstyr.nyttelast} kg` : null}
          />
          <Linje
            label={t("maskin.co2GramPerKm")}
            verdi={utstyr.co2GramPerKm ? `${utstyr.co2GramPerKm} g/km` : null}
          />
          <Linje
            label={t("maskin.forbrukLiterPer100km")}
            verdi={
              utstyr.forbrukLiterPer10km ? `${utstyr.forbrukLiterPer10km} l/100km` : null
            }
          />
          <Linje label={t("maskin.kmStand")} verdi={utstyr.kmStand} />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.forsteRegistrert")}
            verdi={formaterDato(utstyr.forsteRegistrering)}
          />
          {utstyr.vegvesenDataOppdatert && (
            <Linje
              label={t("maskin.detalj.vegvesenSistOppdatert")}
              verdi={formaterDato(utstyr.vegvesenDataOppdatert)}
            />
          )}
        </Seksjon>
      )}

      {/* EU-kontroll */}
      {utstyr.kategori === "kjoretoy" && utstyr.euKontrollFrist && (
        <Seksjon tittel={t("maskin.detalj.euKontroll")}>
          <EuKontrollBanner frist={utstyr.euKontrollFrist} />
          <Linje
            label={t("maskin.euKontrollSist")}
            verdi={formaterDato(utstyr.euKontrollSist)}
          />
          <Linje
            label={t("maskin.vegvesen.forhandsvisning.euKontrollFrist")}
            verdi={formaterDato(utstyr.euKontrollFrist)}
          />
        </Seksjon>
      )}

      {/* Anleggsmaskin-info */}
      {utstyr.kategori === "anleggsmaskin" && (
        <Seksjon tittel={t("maskin.detalj.anleggsmaskinInfo")}>
          <Linje label={t("maskin.serienummer")} verdi={utstyr.serienummer} mono />
          <Linje label={t("maskin.driftstimer")} verdi={utstyr.driftstimer} />
          <Linje
            label={t("maskin.skuffeKapasitet")}
            verdi={utstyr.skuffeKapasitet ? `${utstyr.skuffeKapasitet} m³` : null}
          />
          <Linje
            label={t("maskin.loftKapasitet")}
            verdi={utstyr.loftKapasitet ? `${utstyr.loftKapasitet} t` : null}
          />
          <Linje
            label={t("maskin.maksVekt")}
            verdi={utstyr.maksVekt ? `${utstyr.maksVekt} kg` : null}
          />
        </Seksjon>
      )}

      {/* Småutstyr-info */}
      {utstyr.kategori === "smautstyr" && (
        <Seksjon tittel={t("maskin.detalj.smautstyrInfo")}>
          <Linje
            label={t("maskin.kalibreringsDato")}
            verdi={formaterDato(utstyr.kalibreringsDato)}
          />
          <Linje
            label={t("maskin.kalibreringsFrist")}
            verdi={formaterDato(utstyr.kalibreringsFrist)}
          />
          <Linje
            label={t("maskin.sertifiseringsDato")}
            verdi={formaterDato(utstyr.sertifiseringsDato)}
          />
          <Linje
            label={t("maskin.sertifiseringsFrist")}
            verdi={formaterDato(utstyr.sertifiseringsFrist)}
          />
          <Linje
            label={t("maskin.effektW")}
            verdi={utstyr.effektW ? `${utstyr.effektW} W` : null}
          />
          <Linje
            label={t("maskin.vekt")}
            verdi={utstyr.vekt ? `${utstyr.vekt} kg` : null}
          />
        </Seksjon>
      )}

      {/* Notater */}
      {utstyr.notater && (
        <Seksjon tittel={t("maskin.notater")}>
          <pre className="whitespace-pre-wrap font-sans text-xs text-gray-700">
            {utstyr.notater}
          </pre>
        </Seksjon>
      )}

      {/* Statusendring-modal */}
      {statusModalApen && (
        <StatusEndringModal
          equipment={utstyr}
          onClose={() => setStatusModalApen(false)}
          onSuksess={() => {
            setStatusModalApen(false);
            void utils.maskin.equipment.hentMedId.invalidate({ id });
          }}
        />
      )}
    </div>
  );
}

function Seksjon({
  tittel,
  children,
}: {
  tittel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {tittel}
      </h2>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {children}
      </dl>
    </div>
  );
}

function Linje({
  label,
  verdi,
  mono,
}: {
  label: string;
  verdi: string | number | null | undefined;
  mono?: boolean;
}) {
  if (verdi === null || verdi === undefined || verdi === "") return null;
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right text-gray-900 ${mono ? "font-mono" : ""}`}>{verdi}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const farge =
    status === "tilgjengelig"
      ? "bg-green-100 text-green-800"
      : status === "utlaant"
        ? "bg-blue-100 text-blue-800"
        : status === "paa_service"
          ? "bg-amber-100 text-amber-800"
          : status === "pensjonert"
            ? "bg-gray-100 text-gray-600"
            : "bg-gray-100 text-gray-800";
  const noekkel =
    status === "paa_service"
      ? "maskin.statusPaaService"
      : `maskin.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${farge}`}>
      {t(noekkel)}
    </span>
  );
}

function EuKontrollBanner({ frist }: { frist: string | Date }) {
  const { t } = useTranslation();
  const fristMs = new Date(frist).getTime();
  const naa = Date.now();
  const dagerIgjen = Math.floor((fristMs - naa) / (24 * 60 * 60 * 1000));

  if (dagerIgjen < 0) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("maskin.detalj.euKontrollUtlopt", { dager: Math.abs(dagerIgjen) })}
      </div>
    );
  }
  if (dagerIgjen < 30) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("maskin.detalj.euKontrollSnart", { dager: dagerIgjen })}
      </div>
    );
  }
  if (dagerIgjen < 90) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800">
        <Clock className="h-3.5 w-3.5" />
        {t("maskin.detalj.euKontrollGyldig", { dager: dagerIgjen })}
      </div>
    );
  }
  return (
    <div className="mb-2 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {t("maskin.detalj.euKontrollGyldig", { dager: dagerIgjen })}
    </div>
  );
}

function StatusEndringModal({
  equipment,
  onClose,
  onSuksess,
}: {
  equipment: UtstyrDetalj;
  onClose: () => void;
  onSuksess: () => void;
}) {
  const { t } = useTranslation();
  const [nyStatus, setNyStatus] = useState<string>(equipment.status);
  const [grunn, setGrunn] = useState<string>("");
  const [feil, setFeil] = useState<string | null>(null);

  const settStatus = trpc.maskin.equipment.settStatus.useMutation({
    onSuccess: () => onSuksess(),
    onError: (e: { message: string }) => setFeil(e.message),
  }) as unknown as MutationVennlig<
    {
      id: string;
      status: (typeof STATUS_ALLE)[number];
      pensjonertGrunn?: (typeof PENSJONERT_GRUNN)[number];
    },
    unknown
  >;

  function lagre() {
    setFeil(null);
    if (nyStatus === "pensjonert" && !grunn) {
      setFeil(t("maskin.detalj.pensjonertGrunnPaakrevd"));
      return;
    }
    settStatus.mutate({
      id: equipment.id,
      status: nyStatus as (typeof STATUS_ALLE)[number],
      ...(nyStatus === "pensjonert"
        ? { pensjonertGrunn: grunn as (typeof PENSJONERT_GRUNN)[number] }
        : {}),
    });
  }

  return (
    <Modal open={true} onClose={onClose} title={t("maskin.detalj.endreStatus")}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{t("maskin.detalj.velgNyStatus")}</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_ALLE.map((s) => {
            const noekkel =
              s === "paa_service"
                ? "maskin.statusPaaService"
                : `maskin.status${s.charAt(0).toUpperCase() + s.slice(1)}`;
            return (
              <button
                key={s}
                onClick={() => setNyStatus(s)}
                className={`rounded-md border px-3 py-2 text-xs font-medium ${
                  nyStatus === s
                    ? "border-sitedoc-primary bg-sitedoc-primary text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-sitedoc-primary"
                }`}
              >
                {t(noekkel)}
              </button>
            );
          })}
        </div>

        {nyStatus === "pensjonert" && (
          <>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {t("maskin.detalj.pensjonertAdvarsel")}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">
                {t("maskin.detalj.pensjonertGrunn")}
              </span>
              <select
                value={grunn}
                onChange={(e) => setGrunn(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("maskin.detalj.velgGrunn")}</option>
                {PENSJONERT_GRUNN.map((g) => (
                  <option key={g} value={g}>
                    {t(`maskin.pensjonertGrunn.${g}`)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {feil && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {feil}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
          >
            {t("handling.avbryt")}
          </button>
          <button
            onClick={lagre}
            disabled={settStatus.isPending || nyStatus === equipment.status}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {settStatus.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VegvesenOppdaterKnapp({
  equipmentId,
  vegvesenKoId: _vegvesenKoId,
  setVegvesenKoId,
}: {
  equipmentId: string;
  vegvesenKoId: string | null;
  setVegvesenKoId: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [statusVisning, setStatusVisning] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const koerOppdatering = trpc.maskin.equipment.oppdaterFraVegvesen.useMutation({
    onSuccess: (data: { id: string }) => {
      setVegvesenKoId(data.id);
      setStatusVisning("ventende");
      setFeil(null);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  }) as unknown as MutationVennlig<{ id: string }, { id: string }>;

  const { data: koStatus } = trpc.maskin.vegvesenKo.hentStatus.useQuery(
    { equipmentId },
    {
      enabled: !!statusVisning,
      refetchInterval: statusVisning === "fullfort" || statusVisning === "feilet" ? false : 10_000,
    },
  ) as { data: { status: string; feilmelding: string | null } | null | undefined };

  useEffect(() => {
    if (!koStatus) return;
    setStatusVisning(koStatus.status);
    if (koStatus.status === "fullfort") {
      void utils.maskin.equipment.hentMedId.invalidate({ id: equipmentId });
      const timer = setTimeout(() => setStatusVisning(null), 5000);
      return () => clearTimeout(timer);
    }
    if (koStatus.status === "feilet") {
      setFeil(koStatus.feilmelding ?? "Vegvesen-oppslag feilet");
    }
  }, [koStatus, equipmentId, utils]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => koerOppdatering.mutate({ id: equipmentId })}
        disabled={koerOppdatering.isPending || statusVisning === "ventende" || statusVisning === "prosesserer"}
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-sitedoc-primary hover:text-sitedoc-primary disabled:opacity-50"
      >
        {(statusVisning === "ventende" || statusVisning === "prosesserer") ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        {t("maskin.vegvesen.oppdater.knapp")}
      </button>

      {statusVisning && statusVisning !== "fullfort" && (
        <span className="text-xs text-gray-500">
          {statusVisning === "ventende" && t("maskin.vegvesen.oppdater.statusVentende")}
          {statusVisning === "prosesserer" && t("maskin.vegvesen.oppdater.statusProsesserer")}
          {statusVisning === "feilet" && (
            <span className="text-red-600">
              {t("maskin.vegvesen.oppdater.statusFeilet")}
              {feil && `: ${feil}`}
            </span>
          )}
        </span>
      )}
      {statusVisning === "fullfort" && (
        <span className="inline-flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          {t("maskin.vegvesen.oppdater.statusFullfort")}
        </span>
      )}
    </div>
  );
}

function formaterDato(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    const dato = typeof d === "string" ? new Date(d) : d;
    return dato.toLocaleDateString("nb-NO");
  } catch {
    return null;
  }
}

function formaterPris(p: string | number | null | undefined): string | null {
  if (p === null || p === undefined || p === "") return null;
  const n = typeof p === "string" ? Number(p) : p;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(n);
}
