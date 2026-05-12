"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { ArrowLeft, AlertCircle, Check, RotateCcw, X } from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function isoTidspunktTilHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type TimerRad = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timer: unknown;
};

type TilleggRad = {
  id: string;
  tilleggId: string;
  antall: unknown;
  kommentar: string | null;
};

type MaskinRad = {
  id: string;
  vehicleId: string;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
};

export default function AttesteringDetaljSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ prosjektId: string; id: string }>();
  const utils = trpc.useUtils();

  const [returnerVises, setReturnerVises] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const { data: kanAttestere, isLoading: tilgangLaster } =
    trpc.timer.dagsseddel.kanAttestere.useQuery({
      projectId: params.prosjektId,
    });

  const { data: sheet, isLoading } =
    trpc.timer.dagsseddel.hentForAttestering.useQuery(
      { id: params.id },
      { enabled: kanAttestere === true, retry: false },
    );

  const attester = trpc.timer.dagsseddel.attester.useMutation({
    onSuccess: (_data: unknown) => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({
        id: params.id,
      });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      router.push(`/dashbord/${params.prosjektId}/timer/attestering`);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  if (tilgangLaster || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (kanAttestere === false) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mr-1 inline-block h-4 w-4" />
          {t("timer.attestering.ingenTilgang")}
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-600">{t("timer.detalj.ikkeFunnet")}</p>
        <Link
          href={`/dashbord/${params.prosjektId}/timer/attestering`}
          className="mt-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("timer.attestering.tilbake")}
        </Link>
      </div>
    );
  }

  const timerRader = sheet.timer as unknown as TimerRad[];
  const tilleggRader = sheet.tillegg as unknown as TilleggRad[];
  const maskinRader = (sheet.maskiner ?? []) as unknown as MaskinRad[];
  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);

  const erSent = sheet.status === "sent";

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        href={`/dashbord/${params.prosjektId}/timer/attestering`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("timer.attestering.tilbake")}
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {formatDato(sheet.dato)}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {sheet.prosjekt?.name ?? t("timer.detalj.ukjentProsjekt")}
            {sheet.prosjekt?.projectNumber
              ? ` (${sheet.prosjekt.projectNumber})`
              : ""}
          </p>
          {sheet.ansatt && (
            <p className="mt-0.5 text-sm text-gray-600">
              {t("timer.attestering.kol.ansatt")}:{" "}
              <span className="font-medium text-gray-900">
                {sheet.ansatt.name ?? sheet.ansatt.email}
              </span>
              {sheet.ansatt.ansattnummer && (
                <span className="ml-1 text-xs text-gray-500">
                  #{sheet.ansatt.ansattnummer}
                </span>
              )}
            </p>
          )}
        </div>
        <StatusBadge status={sheet.status} />
      </div>

      {/* Header-info read-only */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          {t("timer.detalj.detaljer")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Definisjon
            term={t("timer.felt.aktivitet")}
            verdi={sheet.aktivitet?.navn ?? "—"}
          />
          <Definisjon
            term={t("timer.felt.startTid")}
            verdi={isoTidspunktTilHHMM(sheet.startAt as string | null) || "—"}
          />
          <Definisjon
            term={t("timer.felt.sluttTid")}
            verdi={isoTidspunktTilHHMM(sheet.endAt as string | null) || "—"}
          />
          <Definisjon
            term={t("timer.felt.pauseMin")}
            verdi={`${sheet.pauseMin} min`}
          />
          {sheet.beskrivelse && (
            <Definisjon
              term={t("timer.felt.beskrivelse")}
              verdi={sheet.beskrivelse}
              spann={2}
            />
          )}
        </dl>
      </section>

      {/* Timer-rader — leder kan endre ECO på sent-sedler */}
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          {t("timer.detalj.timerRader")}{" "}
          <span className="text-sm font-normal text-gray-500">
            ({totaltimer.toFixed(2)} {t("timer.timerEnhet")})
          </span>
        </h2>
        {timerRader.length === 0 ? (
          <p className="text-sm text-gray-500">{t("timer.detalj.ingenTimer")}</p>
        ) : (
          <TimerRaderLeder
            projectId={params.prosjektId}
            sheetId={sheet.id}
            rader={timerRader}
            kanFlytte={erSent}
          />
        )}
      </section>

      {/* Tillegg read-only */}
      {tilleggRader.length > 0 && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("timer.detalj.tilleggRader")}
          </h2>
          <TilleggRaderLeder rader={tilleggRader} />
        </section>
      )}

      {/* Maskin read-only */}
      {maskinRader.length > 0 && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("timer.detalj.maskinRader")}
          </h2>
          <MaskinRaderLeder rader={maskinRader} />
        </section>
      )}

      {feil && <p className="mb-3 text-sm text-red-600">{feil}</p>}

      {/* Action-bar — kun for sent-sedler */}
      {erSent ? (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border border-gray-200 bg-white p-5">
          <Button
            variant="secondary"
            onClick={() => setReturnerVises(true)}
            disabled={attester.isPending}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {t("timer.attestering.returner")}
          </Button>
          <Button
            onClick={() => {
              setFeil(null);
              attester.mutate({ id: sheet.id });
            }}
            disabled={attester.isPending}
          >
            <Check className="mr-1 h-4 w-4" />
            {attester.isPending
              ? t("handling.lagrer")
              : t("timer.attestering.attester")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t("timer.attestering.detalj.ikkeRedigerbar", {
            status: t(`timer.statusType.${sheet.status}`),
          })}
        </div>
      )}

      {returnerVises && (
        <ReturnerDialog
          sheetId={sheet.id}
          prosjektId={params.prosjektId}
          onLukk={() => setReturnerVises(false)}
        />
      )}
    </div>
  );
}

function Definisjon({
  term,
  verdi,
  spann,
}: {
  term: string;
  verdi: React.ReactNode;
  spann?: number;
}) {
  return (
    <div className={spann === 2 ? "col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {term}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{verdi}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timer-rader (leder-modus — kun ECO redigerbar)                    */
/* ------------------------------------------------------------------ */

function TimerRaderLeder({
  projectId,
  sheetId,
  rader,
  kanFlytte,
}: {
  projectId: string;
  sheetId: string;
  rader: TimerRad[];
  kanFlytte: boolean;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery({
    projectId,
  });

  const [feil, setFeil] = useState<string | null>(null);

  const flytt = trpc.timer.dagsseddel.flyttTimerRadEco.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function navnFor(lonnsartId: string): string {
    return lonnsarter?.find((l) => l.id === lonnsartId)?.navn ?? "—";
  }
  function aktivitetNavn(aktivitetId: string): string {
    return aktiviteter?.find((a) => a.id === aktivitetId)?.navn ?? "—";
  }
  function ecoEtikett(ecoId: string | null): string | null {
    if (!ecoId) return null;
    const eco = ecoListe?.find((e) => e.id === ecoId);
    if (!eco) return null;
    return `${eco.proAdmId} · ${eco.kortNavn}`;
  }
  void sheetId;

  return (
    <>
      {feil && <p className="mb-2 text-sm text-red-600">{feil}</p>}
      <ul className="divide-y divide-gray-100">
        {rader.map((rad) => {
          const ecoNavn = ecoEtikett(rad.externalCostObjectId);
          return (
            <li key={rad.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {navnFor(rad.lonnsartId)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {aktivitetNavn(rad.aktivitetId)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t("timer.attestering.flyttEco.etikett")}:
                    </span>
                    {kanFlytte ? (
                      <>
                        <select
                          value={rad.externalCostObjectId ?? ""}
                          onChange={(e) => {
                            setFeil(null);
                            flytt.mutate({
                              timerRadId: rad.id,
                              externalCostObjectId: e.target.value || null,
                            });
                          }}
                          disabled={flytt.isPending}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <option value="">
                            {t("timer.attestering.flyttEco.ingenEco")}
                          </option>
                          {ecoListe?.map((eco) => (
                            <option key={eco.id} value={eco.id}>
                              {eco.proAdmId} · {eco.kortNavn}
                            </option>
                          ))}
                        </select>
                        {rad.externalCostObjectId && (
                          <button
                            onClick={() => {
                              setFeil(null);
                              flytt.mutate({
                                timerRadId: rad.id,
                                externalCostObjectId: null,
                              });
                            }}
                            disabled={flytt.isPending}
                            className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title={t("timer.attestering.flyttEco.fjernEco")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-700">
                        {ecoNavn ?? t("timer.attestering.flyttEco.ingenEco")}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-sm text-gray-900">
                  {tilTall(rad.timer).toFixed(2)} {t("timer.timerEnhet")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tillegg-rader (read-only)                                          */
/* ------------------------------------------------------------------ */

function TilleggRaderLeder({ rader }: { rader: TilleggRad[] }) {
  const { t } = useTranslation();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  function infoFor(tilleggId: string): { navn: string; type: string } {
    const tt = tilleggKatalog?.find((x) => x.id === tilleggId);
    return { navn: tt?.navn ?? "—", type: tt?.type ?? "antall" };
  }

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => {
        const info = infoFor(rad.tilleggId);
        return (
          <li key={rad.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{info.navn}</p>
              {rad.kommentar && (
                <p className="text-xs text-gray-500">{rad.kommentar}</p>
              )}
            </div>
            <span className="font-mono text-sm text-gray-900">
              {info.type === "avhuking"
                ? tilTall(rad.antall) > 0
                  ? "✓"
                  : "—"
                : tilTall(rad.antall).toFixed(2)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Maskin-rader (read-only)                                           */
/* ------------------------------------------------------------------ */

function MaskinRaderLeder({ rader }: { rader: MaskinRad[] }) {
  const { t } = useTranslation();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
      }>
    | undefined;
  const equipmentMap = new Map<string, string>(
    (equipment ?? []).map((e) => [
      e.id,
      `${e.merke} ${e.modell}${e.internNavn ? ` (${e.internNavn})` : ""}`,
    ]),
  );

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => (
        <li key={rad.id} className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {equipmentMap.get(rad.vehicleId) ?? "—"}
            </p>
            {rad.mengde !== null && rad.mengde !== undefined && (
              <p className="text-xs text-gray-500">
                {tilTall(rad.mengde).toFixed(2)} {rad.enhet ?? ""}
              </p>
            )}
          </div>
          <span className="font-mono text-sm text-gray-900">
            {tilTall(rad.timer).toFixed(2)} {t("timer.timerEnhet")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  ReturnerDialog                                                      */
/* ------------------------------------------------------------------ */

function ReturnerDialog({
  sheetId,
  prosjektId,
  onLukk,
}: {
  sheetId: string;
  prosjektId: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returner.useMutation({
    onSuccess: (_data: unknown) => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      onLukk();
      router.push(`/dashbord/${prosjektId}/timer/attestering`);
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
    <Modal
      open={true}
      onClose={onLukk}
      title={t("timer.attestering.returnerTittel")}
    >
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
          <Button
            type="submit"
            disabled={returner.isPending || !kommentar.trim()}
          >
            {returner.isPending
              ? t("handling.lagrer")
              : t("timer.attestering.returner")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
