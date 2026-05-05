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
  Pencil,
  Plus,
  X,
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
  "utgaatt",
] as const;
const UTGAATT_GRUNN = ["solgt", "destruert", "tapt", "stjaalet", "slitt"] as const;

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
  utgaattDato: string | Date | null;
  utgaattGrunn: string | null;

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

  erUtleieobjekt: boolean;
  utleieprisPerDogn: string | number | null;
  utleieprisPerTime: string | number | null;
  utleieEnhet: string | null;
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
  const [aktivModal, setAktivModal] = useState<
    | null
    | "generelt"
    | "anskaffelse"
    | "kjoretoyInfo"
    | "anleggsmaskinInfo"
    | "smautstyrInfo"
    | "utleie"
    | "endrePrimaer"
    | "leggTilAnsvarlig"
  >(null);

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

      {/* Status-historikk (kun utgaatt) */}
      {utstyr.status === "utgaatt" && (
        <Seksjon tittel={t("maskin.detalj.statusHistorikk")}>
          <Linje
            label={t("maskin.detalj.utgaattDato")}
            verdi={formaterDato(utstyr.utgaattDato)}
          />
          <Linje
            label={t("maskin.detalj.utgaattGrunn")}
            verdi={
              utstyr.utgaattGrunn
                ? t(`maskin.utgaattGrunn.${utstyr.utgaattGrunn}`)
                : "—"
            }
          />
        </Seksjon>
      )}

      {/* Generelt */}
      <Seksjon
        tittel={t("maskin.detalj.generelt")}
        onRediger={() => setAktivModal("generelt")}
      >
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
      <Seksjon
        tittel={t("maskin.detalj.anskaffelse")}
        onRediger={() => setAktivModal("anskaffelse")}
      >
        <Linje
          label={t("maskin.anskaffelsesdato")}
          verdi={formaterDato(utstyr.anskaffelsesDato)}
        />
        <Linje label={t("maskin.nypris")} verdi={formaterPris(utstyr.nypris)} />
        <Linje label={t("maskin.eksportKode")} verdi={utstyr.eksportKode} />
      </Seksjon>

      {/* Ansvarlig */}
      <AnsvarligSeksjon
        equipmentId={utstyr.id}
        primaerNavn={ansvarligNavn}
        onEndrePrimaer={() => setAktivModal("endrePrimaer")}
        onLeggTil={() => setAktivModal("leggTilAnsvarlig")}
      />

      {/* Kjøretøy-info */}
      {utstyr.kategori === "kjoretoy" && (
        <Seksjon
          tittel={t("maskin.detalj.kjoretoyInfo")}
          onRediger={() => setAktivModal("kjoretoyInfo")}
        >
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
        <Seksjon
          tittel={t("maskin.detalj.anleggsmaskinInfo")}
          onRediger={() => setAktivModal("anleggsmaskinInfo")}
        >
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
        <Seksjon
          tittel={t("maskin.detalj.smautstyrInfo")}
          onRediger={() => setAktivModal("smautstyrInfo")}
        >
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

      {/* Utleie (Steg 4b Fase 2) */}
      <Seksjon
        tittel={t("maskin.utleie.seksjon")}
        onRediger={() => setAktivModal("utleie")}
      >
        {utstyr.erUtleieobjekt ? (
          <>
            <Linje
              label={t("maskin.utleie.erUtleieobjekt")}
              verdi={t("ja")}
            />
            <Linje
              label={t("maskin.utleie.prisPerDogn")}
              verdi={formaterPris(utstyr.utleieprisPerDogn)}
            />
            <Linje
              label={t("maskin.utleie.prisPerTime")}
              verdi={formaterPris(utstyr.utleieprisPerTime)}
            />
            <Linje
              label={t("maskin.utleie.primaerEnhet")}
              verdi={
                utstyr.utleieEnhet
                  ? t(`maskin.utleie.enhet.${utstyr.utleieEnhet}`)
                  : null
              }
            />
          </>
        ) : (
          <Linje
            label={t("maskin.utleie.erUtleieobjekt")}
            verdi={t("nei")}
          />
        )}
      </Seksjon>

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

      {/* Redigér-modaler */}
      {aktivModal === "generelt" && (
        <RedigerModal
          equipment={utstyr}
          felt="generelt"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "anskaffelse" && (
        <RedigerModal
          equipment={utstyr}
          felt="anskaffelse"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "kjoretoyInfo" && (
        <RedigerModal
          equipment={utstyr}
          felt="kjoretoyInfo"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "anleggsmaskinInfo" && (
        <RedigerModal
          equipment={utstyr}
          felt="anleggsmaskinInfo"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "smautstyrInfo" && (
        <RedigerModal
          equipment={utstyr}
          felt="smautstyrInfo"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "utleie" && (
        <RedigerModal
          equipment={utstyr}
          felt="utleie"
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "endrePrimaer" && (
        <EndrePrimaerModal
          equipmentId={utstyr.id}
          naavaerendeUserId={utstyr.ansvarligUserId}
          brukere={brukere}
          onClose={() => setAktivModal(null)}
        />
      )}
      {aktivModal === "leggTilAnsvarlig" && (
        <LeggTilAnsvarligModal
          equipmentId={utstyr.id}
          brukere={brukere}
          primaerUserId={utstyr.ansvarligUserId}
          onClose={() => setAktivModal(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
 *  Ansvarlig-seksjon med CRUD
 * ======================================================================== */

function AnsvarligSeksjon({
  equipmentId,
  primaerNavn,
  onEndrePrimaer,
  onLeggTil,
}: {
  equipmentId: string;
  primaerNavn: string | null;
  onEndrePrimaer: () => void;
  onLeggTil: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: tilleggData } = trpc.maskin.ansvarlig.list.useQuery({ equipmentId });
  const tillegg = (tilleggData ?? []) as Array<{
    id: string;
    userId: string;
    userName: string | null;
    periodeStart: string | Date;
  }>;

  const fjern = trpc.maskin.ansvarlig.fjern.useMutation({
    onSuccess: () => {
      void utils.maskin.ansvarlig.list.invalidate({ equipmentId });
    },
  }) as unknown as MutationVennlig<{ id: string }, unknown>;

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("maskin.detalj.ansvarlig")}
        </h2>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>
            <span className="text-gray-500">{t("maskin.detalj.hovedansvarlig")}: </span>
            <span className="text-gray-900">
              {primaerNavn ?? t("maskin.detalj.ikkeSatt")}
            </span>
          </span>
          <button
            onClick={onEndrePrimaer}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-sitedoc-primary"
          >
            <Pencil className="h-3 w-3" />
            {primaerNavn ? t("handling.rediger") : t("maskin.detalj.sett")}
          </button>
        </div>

        {tillegg.length > 0 && (
          <>
            <div className="mt-3 border-t border-gray-100 pt-2">
              <span className="text-gray-500">
                {t("maskin.detalj.tilleggsansvarligeAntall", { antall: tillegg.length })}
              </span>
            </div>
            {tillegg.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1"
              >
                <span>
                  <span className="text-gray-900">{a.userName ?? "—"}</span>
                  <span className="ml-2 text-gray-400">
                    {t("maskin.detalj.sidenDato", {
                      dato: new Date(a.periodeStart).toLocaleDateString("nb-NO"),
                    })}
                  </span>
                </span>
                <button
                  onClick={() => {
                    if (confirm(t("maskin.detalj.fjernAnsvarligBekreft"))) {
                      fjern.mutate({ id: a.id });
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                  {t("handling.fjern")}
                </button>
              </div>
            ))}
          </>
        )}

        <button
          onClick={onLeggTil}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:border-sitedoc-primary hover:text-sitedoc-primary"
        >
          <Plus className="h-3 w-3" />
          {t("maskin.detalj.leggTilAnsvarlig")}
        </button>
      </div>
    </div>
  );
}

function Seksjon({
  tittel,
  children,
  onRediger,
  layout = "grid",
}: {
  tittel: string;
  children: React.ReactNode;
  onRediger?: () => void;
  layout?: "grid" | "stack";
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tittel}
        </h2>
        {onRediger && (
          <button
            onClick={onRediger}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-sitedoc-primary"
          >
            <Pencil className="h-3 w-3" />
            {t("handling.rediger")}
          </button>
        )}
      </div>
      {layout === "grid" ? (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
          {children}
        </dl>
      ) : (
        <div className="space-y-2 text-xs">{children}</div>
      )}
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
          : status === "utgaatt"
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
      utgaattGrunn?: (typeof UTGAATT_GRUNN)[number];
    },
    unknown
  >;

  function lagre() {
    setFeil(null);
    if (nyStatus === "utgaatt" && !grunn) {
      setFeil(t("maskin.detalj.utgaattGrunnPaakrevd"));
      return;
    }
    settStatus.mutate({
      id: equipment.id,
      status: nyStatus as (typeof STATUS_ALLE)[number],
      ...(nyStatus === "utgaatt"
        ? { utgaattGrunn: grunn as (typeof UTGAATT_GRUNN)[number] }
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

        {nyStatus === "utgaatt" && (
          <>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              {t("maskin.detalj.utgaattAdvarsel")}
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-700">
                {t("maskin.detalj.utgaattGrunn")}
              </span>
              <select
                value={grunn}
                onChange={(e) => setGrunn(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("maskin.detalj.velgGrunn")}</option>
                {UTGAATT_GRUNN.map((g) => (
                  <option key={g} value={g}>
                    {t(`maskin.utgaattGrunn.${g}`)}
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

/* ==========================================================================
 *  Redigér-modaler — én komponent med felt-pakke per seksjon
 * ======================================================================== */

const EIERSKAP = ["eid", "leid", "leasing", "lant"] as const;
const KATEGORIER_LISTE: ReadonlyArray<MaskinKategori> = [
  "kjoretoy",
  "anleggsmaskin",
  "smautstyr",
];

type RedigerInputs = {
  id: string;
  // Generelt
  kategori?: MaskinKategori;
  type?: string;
  merke?: string | null;
  modell?: string | null;
  internNavn?: string | null;
  internNummer?: string | null;
  eierskap?: (typeof EIERSKAP)[number] | null;
  aarsmodell?: number | null;
  lokasjon?: string | null;
  // Anskaffelse
  anskaffelsesDato?: string | null;
  nypris?: number | null;
  eksportKode?: string | null;
  notater?: string | null;
  // Kjøretøy-info (manuell)
  registreringsnummer?: string | null;
  kmStand?: number | null;
  motor?: string | null;
  drivstoff?: string | null;
  farge?: string | null;
  // Anleggsmaskin-info
  serienummer?: string | null;
  driftstimer?: number | null;
  skuffeKapasitet?: number | null;
  loftKapasitet?: number | null;
  maksVekt?: number | null;
  // Småutstyr-info
  kalibreringsDato?: string | null;
  kalibreringsFrist?: string | null;
  sertifiseringsDato?: string | null;
  sertifiseringsFrist?: string | null;
  effektW?: number | null;
  vekt?: number | null;
  // Utleie (Steg 4b Fase 2)
  erUtleieobjekt?: boolean;
  utleieprisPerDogn?: number | null;
  utleieprisPerTime?: number | null;
  utleieEnhet?: "doegn" | "time" | null;
};

function RedigerModal({
  equipment,
  felt,
  onClose,
}: {
  equipment: UtstyrDetalj;
  felt:
    | "generelt"
    | "anskaffelse"
    | "kjoretoyInfo"
    | "anleggsmaskinInfo"
    | "smautstyrInfo"
    | "utleie";
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [inn, setInn] = useState<RedigerInputs>(() => byggInitielt(equipment, felt));
  const [feil, setFeil] = useState<string | null>(null);

  const oppdater = trpc.maskin.equipment.oppdater.useMutation({
    onSuccess: () => {
      void utils.maskin.equipment.hentMedId.invalidate({ id: equipment.id });
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  }) as unknown as MutationVennlig<RedigerInputs, unknown>;

  const tittelKey =
    felt === "generelt"
      ? "maskin.detalj.rediger.generelt"
      : felt === "anskaffelse"
        ? "maskin.detalj.rediger.anskaffelse"
        : felt === "kjoretoyInfo"
          ? "maskin.detalj.rediger.kjoretoyInfo"
          : felt === "anleggsmaskinInfo"
            ? "maskin.detalj.rediger.anleggsmaskinInfo"
            : felt === "smautstyrInfo"
              ? "maskin.detalj.rediger.smautstyrInfo"
              : "maskin.utleie.rediger";

  return (
    <Modal open={true} onClose={onClose} title={t(tittelKey)}>
      <div className="space-y-3">
        {felt === "generelt" && (
          <>
            <Felt label={t("maskin.kategori")}>
              <select
                value={inn.kategori ?? equipment.kategori}
                onChange={(e) => setInn({ ...inn, kategori: e.target.value as MaskinKategori })}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {KATEGORIER_LISTE.map((k) => (
                  <option key={k} value={k}>
                    {t(`maskin.kategori${k.charAt(0).toUpperCase() + k.slice(1)}`)}
                  </option>
                ))}
              </select>
            </Felt>
            <Felt label={t("maskin.type")}>
              <input
                type="text"
                value={inn.type ?? ""}
                onChange={(e) => setInn({ ...inn, type: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>
            <Felt label={t("maskin.merke")}>
              <Input v={inn.merke} onChange={(v) => setInn({ ...inn, merke: v })} />
            </Felt>
            <Felt label={t("maskin.modell")}>
              <Input v={inn.modell} onChange={(v) => setInn({ ...inn, modell: v })} />
            </Felt>
            <Felt label={t("maskin.internNavn")}>
              <Input v={inn.internNavn} onChange={(v) => setInn({ ...inn, internNavn: v })} />
            </Felt>
            <Felt label={t("maskin.internNummer")}>
              <Input v={inn.internNummer} onChange={(v) => setInn({ ...inn, internNummer: v })} />
            </Felt>
            <Felt label={t("maskin.eierskap.label")}>
              <select
                value={inn.eierskap ?? "eid"}
                onChange={(e) =>
                  setInn({ ...inn, eierskap: e.target.value as (typeof EIERSKAP)[number] })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {EIERSKAP.map((e) => (
                  <option key={e} value={e}>
                    {t(`maskin.eierskap.${e}`)}
                  </option>
                ))}
              </select>
            </Felt>
            <Felt label={t("maskin.aarsmodell")}>
              <NumInput
                v={inn.aarsmodell}
                onChange={(v) => setInn({ ...inn, aarsmodell: v })}
              />
            </Felt>
            <Felt label={t("maskin.lokasjon")}>
              <Input v={inn.lokasjon} onChange={(v) => setInn({ ...inn, lokasjon: v })} />
            </Felt>
          </>
        )}

        {felt === "anskaffelse" && (
          <>
            <Felt label={t("maskin.anskaffelsesdato")}>
              <DateInput
                v={inn.anskaffelsesDato}
                onChange={(v) => setInn({ ...inn, anskaffelsesDato: v })}
              />
            </Felt>
            <Felt label={t("maskin.nypris")}>
              <NumInput v={inn.nypris} onChange={(v) => setInn({ ...inn, nypris: v })} />
            </Felt>
            <Felt label={t("maskin.eksportKode")}>
              <Input
                v={inn.eksportKode}
                onChange={(v) => setInn({ ...inn, eksportKode: v })}
              />
            </Felt>
            <Felt label={t("maskin.notater")}>
              <textarea
                value={inn.notater ?? ""}
                onChange={(e) => setInn({ ...inn, notater: e.target.value })}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </Felt>
          </>
        )}

        {felt === "kjoretoyInfo" && (
          <>
            <p className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
              {t("maskin.detalj.rediger.kjoretoyMerknad")}
            </p>
            <Felt label={t("maskin.registreringsnummer")}>
              <Input
                v={inn.registreringsnummer}
                onChange={(v) => setInn({ ...inn, registreringsnummer: v?.toUpperCase() ?? null })}
              />
            </Felt>
            <Felt label={t("maskin.kmStand")}>
              <NumInput v={inn.kmStand} onChange={(v) => setInn({ ...inn, kmStand: v })} />
            </Felt>
            <Felt label={t("maskin.motor")}>
              <Input v={inn.motor} onChange={(v) => setInn({ ...inn, motor: v })} />
            </Felt>
            <Felt label={t("maskin.drivstoff")}>
              <Input v={inn.drivstoff} onChange={(v) => setInn({ ...inn, drivstoff: v })} />
            </Felt>
            <Felt label={t("maskin.vegvesen.forhandsvisning.farge")}>
              <Input v={inn.farge} onChange={(v) => setInn({ ...inn, farge: v })} />
            </Felt>
          </>
        )}

        {felt === "anleggsmaskinInfo" && (
          <>
            <Felt label={t("maskin.serienummer")}>
              <Input
                v={inn.serienummer}
                onChange={(v) => setInn({ ...inn, serienummer: v })}
              />
            </Felt>
            <Felt label={t("maskin.driftstimer")}>
              <NumInput
                v={inn.driftstimer}
                onChange={(v) => setInn({ ...inn, driftstimer: v })}
              />
            </Felt>
            <Felt label={t("maskin.skuffeKapasitet") + " (m³)"}>
              <NumInput
                v={inn.skuffeKapasitet}
                onChange={(v) => setInn({ ...inn, skuffeKapasitet: v })}
                step={0.01}
              />
            </Felt>
            <Felt label={t("maskin.loftKapasitet") + " (t)"}>
              <NumInput
                v={inn.loftKapasitet}
                onChange={(v) => setInn({ ...inn, loftKapasitet: v })}
                step={0.01}
              />
            </Felt>
            <Felt label={t("maskin.maksVekt") + " (kg)"}>
              <NumInput v={inn.maksVekt} onChange={(v) => setInn({ ...inn, maksVekt: v })} />
            </Felt>
          </>
        )}

        {felt === "smautstyrInfo" && (
          <>
            <Felt label={t("maskin.kalibreringsDato")}>
              <DateInput
                v={inn.kalibreringsDato}
                onChange={(v) => setInn({ ...inn, kalibreringsDato: v })}
              />
            </Felt>
            <Felt label={t("maskin.kalibreringsFrist")}>
              <DateInput
                v={inn.kalibreringsFrist}
                onChange={(v) => setInn({ ...inn, kalibreringsFrist: v })}
              />
            </Felt>
            <Felt label={t("maskin.sertifiseringsDato")}>
              <DateInput
                v={inn.sertifiseringsDato}
                onChange={(v) => setInn({ ...inn, sertifiseringsDato: v })}
              />
            </Felt>
            <Felt label={t("maskin.sertifiseringsFrist")}>
              <DateInput
                v={inn.sertifiseringsFrist}
                onChange={(v) => setInn({ ...inn, sertifiseringsFrist: v })}
              />
            </Felt>
            <Felt label={t("maskin.effektW") + " (W)"}>
              <NumInput v={inn.effektW} onChange={(v) => setInn({ ...inn, effektW: v })} />
            </Felt>
            <Felt label={t("maskin.vekt") + " (kg)"}>
              <NumInput v={inn.vekt} onChange={(v) => setInn({ ...inn, vekt: v })} />
            </Felt>
          </>
        )}

        {felt === "utleie" && (
          <>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={inn.erUtleieobjekt ?? false}
                onChange={(e) => setInn({ ...inn, erUtleieobjekt: e.target.checked })}
              />
              {t("maskin.utleie.erUtleieobjekt")}
            </label>
            {inn.erUtleieobjekt && (
              <>
                <Felt label={t("maskin.utleie.prisPerDogn") + " (kr)"}>
                  <NumInput
                    v={inn.utleieprisPerDogn}
                    onChange={(v) => setInn({ ...inn, utleieprisPerDogn: v })}
                    step={0.01}
                  />
                </Felt>
                <Felt label={t("maskin.utleie.prisPerTime") + " (kr)"}>
                  <NumInput
                    v={inn.utleieprisPerTime}
                    onChange={(v) => setInn({ ...inn, utleieprisPerTime: v })}
                    step={0.01}
                  />
                </Felt>
                <Felt label={t("maskin.utleie.primaerEnhet")}>
                  <select
                    value={inn.utleieEnhet ?? ""}
                    onChange={(e) =>
                      setInn({
                        ...inn,
                        utleieEnhet: (e.target.value || null) as "doegn" | "time" | null,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    <option value="doegn">{t("maskin.utleie.enhet.doegn")}</option>
                    <option value="time">{t("maskin.utleie.enhet.time")}</option>
                  </select>
                </Felt>
              </>
            )}
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
            onClick={() => oppdater.mutate(inn)}
            disabled={oppdater.isPending}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {oppdater.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function byggInitielt(equipment: UtstyrDetalj, felt: string): RedigerInputs {
  const base: RedigerInputs = { id: equipment.id };
  if (felt === "generelt") {
    return {
      ...base,
      kategori: equipment.kategori as MaskinKategori,
      type: equipment.type,
      merke: equipment.merke,
      modell: equipment.modell,
      internNavn: equipment.internNavn,
      internNummer: equipment.internNummer,
      eierskap: equipment.eierskap as (typeof EIERSKAP)[number] | null,
      aarsmodell: equipment.aarsmodell,
      lokasjon: equipment.lokasjon,
    };
  }
  if (felt === "anskaffelse") {
    return {
      ...base,
      anskaffelsesDato: tilIsoDato(equipment.anskaffelsesDato),
      nypris: equipment.nypris ? Number(equipment.nypris) : null,
      eksportKode: equipment.eksportKode,
      notater: equipment.notater,
    };
  }
  if (felt === "kjoretoyInfo") {
    return {
      ...base,
      registreringsnummer: equipment.registreringsnummer,
      kmStand: equipment.kmStand,
      motor: equipment.motor,
      drivstoff: equipment.drivstoff,
      farge: equipment.farge,
    };
  }
  if (felt === "anleggsmaskinInfo") {
    return {
      ...base,
      serienummer: equipment.serienummer,
      driftstimer: equipment.driftstimer,
      skuffeKapasitet: equipment.skuffeKapasitet ? Number(equipment.skuffeKapasitet) : null,
      loftKapasitet: equipment.loftKapasitet ? Number(equipment.loftKapasitet) : null,
      maksVekt: equipment.maksVekt,
    };
  }
  if (felt === "smautstyrInfo") {
    return {
      ...base,
      kalibreringsDato: tilIsoDato(equipment.kalibreringsDato),
      kalibreringsFrist: tilIsoDato(equipment.kalibreringsFrist),
      sertifiseringsDato: tilIsoDato(equipment.sertifiseringsDato),
      sertifiseringsFrist: tilIsoDato(equipment.sertifiseringsFrist),
      effektW: equipment.effektW,
      vekt: equipment.vekt,
    };
  }
  // utleie
  return {
    ...base,
    erUtleieobjekt: equipment.erUtleieobjekt,
    utleieprisPerDogn: equipment.utleieprisPerDogn ? Number(equipment.utleieprisPerDogn) : null,
    utleieprisPerTime: equipment.utleieprisPerTime ? Number(equipment.utleieprisPerTime) : null,
    utleieEnhet: equipment.utleieEnhet as "doegn" | "time" | null,
  };
}

function tilIsoDato(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    const dato = typeof d === "string" ? new Date(d) : d;
    return dato.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function Felt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Input({
  v,
  onChange,
}: {
  v: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <input
      type="text"
      value={v ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
    />
  );
}

function NumInput({
  v,
  onChange,
  step,
}: {
  v: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step ?? 1}
      value={v ?? ""}
      onChange={(e) => {
        const t = e.target.value;
        if (t === "") return onChange(null);
        const n = Number(t);
        onChange(Number.isFinite(n) ? n : null);
      }}
      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
    />
  );
}

function DateInput({
  v,
  onChange,
}: {
  v: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={v ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
    />
  );
}

/* ==========================================================================
 *  Ansvarlig-modaler
 * ======================================================================== */

function EndrePrimaerModal({
  equipmentId,
  naavaerendeUserId,
  brukere,
  onClose,
}: {
  equipmentId: string;
  naavaerendeUserId: string | null;
  brukere: BrukerInfo[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [valgt, setValgt] = useState<string>(naavaerendeUserId ?? "");
  const [feil, setFeil] = useState<string | null>(null);

  const oppdater = trpc.maskin.equipment.oppdater.useMutation({
    onSuccess: () => {
      void utils.maskin.equipment.hentMedId.invalidate({ id: equipmentId });
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  }) as unknown as MutationVennlig<{ id: string; ansvarligUserId: string | null }, unknown>;

  return (
    <Modal open={true} onClose={onClose} title={t("maskin.detalj.endrePrimaer")}>
      <div className="space-y-3">
        <Felt label={t("maskin.detalj.hovedansvarlig")}>
          <select
            value={valgt}
            onChange={(e) => setValgt(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("maskin.detalj.ikkeSatt")}</option>
            {brukere.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.email}
              </option>
            ))}
          </select>
        </Felt>

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
            onClick={() =>
              oppdater.mutate({
                id: equipmentId,
                ansvarligUserId: valgt || null,
              })
            }
            disabled={oppdater.isPending}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {oppdater.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LeggTilAnsvarligModal({
  equipmentId,
  brukere,
  primaerUserId,
  onClose,
}: {
  equipmentId: string;
  brukere: BrukerInfo[];
  primaerUserId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [valgt, setValgt] = useState<string>("");
  const [feil, setFeil] = useState<string | null>(null);

  const tilfoy = trpc.maskin.ansvarlig.tilfoy.useMutation({
    onSuccess: () => {
      void utils.maskin.ansvarlig.list.invalidate({ equipmentId });
      onClose();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  }) as unknown as MutationVennlig<{ equipmentId: string; userId: string }, unknown>;

  // Filter ut primær (kan ikke være tilleggsansvarlig samtidig)
  const valgbare = brukere.filter((b) => b.id !== primaerUserId);

  return (
    <Modal open={true} onClose={onClose} title={t("maskin.detalj.leggTilAnsvarlig")}>
      <div className="space-y-3">
        <Felt label={t("maskin.detalj.velgBruker")}>
          <select
            value={valgt}
            onChange={(e) => setValgt(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">—</option>
            {valgbare.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.email}
              </option>
            ))}
          </select>
        </Felt>

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
            onClick={() => {
              if (!valgt) return;
              tilfoy.mutate({ equipmentId, userId: valgt });
            }}
            disabled={tilfoy.isPending || !valgt}
            className="rounded-md bg-sitedoc-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90 disabled:opacity-50"
          >
            {tilfoy.isPending ? t("handling.lagrer") : t("handling.leggTil")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
