"use client";

// T7-2b1 (2026-05-14): Felleskomponent for attestering-detalj.
// Monteres fra to wrapper-sider:
//   - /dashbord/[prosjektId]/timer/attestering/[id] (prosjektleder-kontekst)
//   - /dashbord/firma/timer/attestering/[id]        (firma-admin-kontekst)
// Per-rad-attestering: hver rad har egen status, leder velger hvilke som
// attesteres/returneres via checkboxer.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Modal, Spinner } from "@sitedoc/ui";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
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

type RadStatus = "pending" | "attestert" | "returnert" | null;

type TimerRad = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  projectId: string;
  timer: unknown;
  attestertStatus: string | null;
};

type TilleggRad = {
  id: string;
  tilleggId: string;
  projectId: string;
  antall: unknown;
  kommentar: string | null;
  attestertStatus: string | null;
};

type MaskinRad = {
  id: string;
  vehicleId: string;
  projectId: string;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
};

type Props = {
  sheetId: string;
  // undefined = firma-kontekst (firma-admin attesterer alle rader leder har tilgang til)
  // gitt    = prosjekt-kontekst (kun rader for det prosjektet er aktivt valgbare)
  prosjektKontekst?: string;
  // Hvor «Tilbake» og redirect etter mutasjon peker
  tilbakeUrl: string;
};

export function AttesteringDetalj({ sheetId, prosjektKontekst, tilbakeUrl }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [returnerVises, setReturnerVises] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [valgteTimer, setValgteTimer] = useState<Set<string>>(new Set());
  const [valgteTillegg, setValgteTillegg] = useState<Set<string>>(new Set());
  const [valgteMaskin, setValgteMaskin] = useState<Set<string>>(new Set());

  const { data: sheet, isLoading } =
    trpc.timer.dagsseddel.hentForAttestering.useQuery(
      { id: sheetId },
      { retry: false },
    );

  const attesterRader = trpc.timer.dagsseddel.attesterRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      router.push(tilbakeUrl);
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const timerRader = (sheet?.timer ?? []) as unknown as TimerRad[];
  const tilleggRader = (sheet?.tillegg ?? []) as unknown as TilleggRad[];
  const maskinRader = (sheet?.maskiner ?? []) as unknown as MaskinRad[];

  const radTilgjengelig = (rad: { projectId: string; attestertStatus: string | null }) => {
    if (rad.attestertStatus !== "pending") return false;
    if (prosjektKontekst && rad.projectId !== prosjektKontekst) return false;
    return true;
  };

  // Pre-utvalg: alle pending-rader leder har tilgang til
  useEffect(() => {
    if (!sheet) return;
    setValgteTimer(new Set(timerRader.filter(radTilgjengelig).map((r) => r.id)));
    setValgteTillegg(new Set(tilleggRader.filter(radTilgjengelig).map((r) => r.id)));
    setValgteMaskin(new Set(maskinRader.filter(radTilgjengelig).map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-600">{t("timer.detalj.ikkeFunnet")}</p>
        <Link
          href={tilbakeUrl}
          className="mt-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("timer.attestering.tilbake")}
        </Link>
      </div>
    );
  }

  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const totaltAntallRader = timerRader.length + tilleggRader.length + maskinRader.length;
  const antallAttestert = [...timerRader, ...tilleggRader, ...maskinRader]
    .filter((r) => r.attestertStatus === "attestert").length;
  const antallReturnert = [...timerRader, ...tilleggRader, ...maskinRader]
    .filter((r) => r.attestertStatus === "returnert").length;
  const antallPending = totaltAntallRader - antallAttestert - antallReturnert;

  const antallValgt = valgteTimer.size + valgteTillegg.size + valgteMaskin.size;
  const kanHandle = sheet.status === "sent" && antallValgt > 0;

  function toggle(set: Set<string>, id: string, oppdater: (s: Set<string>) => void) {
    const ny = new Set(set);
    if (ny.has(id)) ny.delete(id);
    else ny.add(id);
    oppdater(ny);
  }

  function handleAttester() {
    setFeil(null);
    attesterRader.mutate({
      radIder: {
        timerIder: Array.from(valgteTimer),
        tilleggIder: Array.from(valgteTillegg),
        maskinIder: Array.from(valgteMaskin),
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        href={tilbakeUrl}
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

      {/* Container-status-banner (T7-2b1): viser fremdrift på tvers av rader */}
      {totaltAntallRader > 0 && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            antallPending === 0
              ? "border-green-200 bg-green-50 text-green-900"
              : antallAttestert > 0 || antallReturnert > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          {antallPending === 0
            ? t("timer.attestering.container.alleBehandlet", {
                attestert: antallAttestert,
                returnert: antallReturnert,
              })
            : antallAttestert > 0 || antallReturnert > 0
              ? t("timer.attestering.container.delvis", {
                  attestert: antallAttestert,
                  returnert: antallReturnert,
                  total: totaltAntallRader,
                  pending: antallPending,
                })
              : t("timer.attestering.container.pending", {
                  total: totaltAntallRader,
                })}
        </div>
      )}

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
            rader={timerRader}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteTimer}
            onToggle={(id) => toggle(valgteTimer, id, setValgteTimer)}
            kanFlytte={sheet.status === "sent"}
          />
        )}
      </section>

      {tilleggRader.length > 0 && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("timer.detalj.tilleggRader")}
          </h2>
          <TilleggRaderLeder
            rader={tilleggRader}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteTillegg}
            onToggle={(id) => toggle(valgteTillegg, id, setValgteTillegg)}
          />
        </section>
      )}

      {maskinRader.length > 0 && (
        <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {t("timer.detalj.maskinRader")}
          </h2>
          <MaskinRaderLeder
            rader={maskinRader}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteMaskin}
            onToggle={(id) => toggle(valgteMaskin, id, setValgteMaskin)}
          />
        </section>
      )}

      {feil && <p className="mb-3 text-sm text-red-600">{feil}</p>}

      {sheet.status === "sent" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">
            {t("timer.attestering.radValg.antallValgt", { antall: antallValgt })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setReturnerVises(true)}
              disabled={!kanHandle || attesterRader.isPending}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              {t("timer.attestering.radValg.returnerValgte")}
            </Button>
            <Button onClick={handleAttester} disabled={!kanHandle || attesterRader.isPending}>
              <Check className="mr-1 h-4 w-4" />
              {attesterRader.isPending
                ? t("handling.lagrer")
                : t("timer.attestering.radValg.attesterValgte")}
            </Button>
          </div>
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
          radIder={{
            timerIder: Array.from(valgteTimer),
            tilleggIder: Array.from(valgteTillegg),
            maskinIder: Array.from(valgteMaskin),
          }}
          tilbakeUrl={tilbakeUrl}
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

function RadStatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();
  const normalisert = (status ?? "pending") as RadStatus;
  if (normalisert === "attestert") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
        <Check className="h-3 w-3" />
        {t("timer.attestering.radStatus.attestert")}
      </span>
    );
  }
  if (normalisert === "returnert") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
        <RotateCcw className="h-3 w-3" />
        {t("timer.attestering.radStatus.returnert")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
      {t("timer.attestering.radStatus.pending")}
    </span>
  );
}

function TimerRaderLeder({
  rader,
  prosjektKontekst,
  valgte,
  onToggle,
  kanFlytte,
}: {
  rader: TimerRad[];
  prosjektKontekst?: string;
  valgte: Set<string>;
  onToggle: (id: string) => void;
  kanFlytte: boolean;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const førsteProsjektId = prosjektKontekst ?? rader[0]?.projectId;
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: førsteProsjektId ?? "" },
    { enabled: !!førsteProsjektId },
  );

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

  return (
    <>
      {feil && <p className="mb-2 text-sm text-red-600">{feil}</p>}
      <ul className="divide-y divide-gray-100">
        {rader.map((rad) => {
          const pending = (rad.attestertStatus ?? "pending") === "pending";
          const tilgjengelig =
            pending && (!prosjektKontekst || rad.projectId === prosjektKontekst);
          const valgt = valgte.has(rad.id);
          const ecoNavn = ecoEtikett(rad.externalCostObjectId);
          return (
            <li key={rad.id} className={`py-3 ${!tilgjengelig ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={valgt}
                  disabled={!tilgjengelig}
                  onChange={() => onToggle(rad.id)}
                  className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary disabled:cursor-not-allowed"
                  aria-label={t("timer.attestering.radValg.velgRad")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {navnFor(rad.lonnsartId)}
                    </p>
                    <RadStatusBadge status={rad.attestertStatus} />
                    {prosjektKontekst && rad.projectId !== prosjektKontekst && (
                      <span className="text-xs italic text-gray-500">
                        {t("timer.attestering.radValg.annetProsjekt")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {aktivitetNavn(rad.aktivitetId)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {t("timer.attestering.flyttEco.etikett")}:
                    </span>
                    {kanFlytte && tilgjengelig ? (
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

function TilleggRaderLeder({
  rader,
  prosjektKontekst,
  valgte,
  onToggle,
}: {
  rader: TilleggRad[];
  prosjektKontekst?: string;
  valgte: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  function infoFor(tilleggId: string): { navn: string; type: string } {
    const tt = tilleggKatalog?.find((x) => x.id === tilleggId);
    return { navn: tt?.navn ?? "—", type: tt?.type ?? "antall" };
  }

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => {
        const pending = (rad.attestertStatus ?? "pending") === "pending";
        const tilgjengelig =
          pending && (!prosjektKontekst || rad.projectId === prosjektKontekst);
        const valgt = valgte.has(rad.id);
        const info = infoFor(rad.tilleggId);
        return (
          <li
            key={rad.id}
            className={`flex items-start gap-3 py-2 ${!tilgjengelig ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={valgt}
              disabled={!tilgjengelig}
              onChange={() => onToggle(rad.id)}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary disabled:cursor-not-allowed"
              aria-label={t("timer.attestering.radValg.velgRad")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{info.navn}</p>
                <RadStatusBadge status={rad.attestertStatus} />
              </div>
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

function MaskinRaderLeder({
  rader,
  prosjektKontekst,
  valgte,
  onToggle,
}: {
  rader: MaskinRad[];
  prosjektKontekst?: string;
  valgte: Set<string>;
  onToggle: (id: string) => void;
}) {
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
      {rader.map((rad) => {
        const pending = (rad.attestertStatus ?? "pending") === "pending";
        const tilgjengelig =
          pending && (!prosjektKontekst || rad.projectId === prosjektKontekst);
        const valgt = valgte.has(rad.id);
        return (
          <li
            key={rad.id}
            className={`flex items-start gap-3 py-2 ${!tilgjengelig ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={valgt}
              disabled={!tilgjengelig}
              onChange={() => onToggle(rad.id)}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-sitedoc-primary focus:ring-sitedoc-primary disabled:cursor-not-allowed"
              aria-label={t("timer.attestering.radValg.velgRad")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {equipmentMap.get(rad.vehicleId) ?? "—"}
                </p>
                <RadStatusBadge status={rad.attestertStatus} />
              </div>
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
        );
      })}
    </ul>
  );
}

function ReturnerDialog({
  radIder,
  tilbakeUrl,
  onLukk,
}: {
  radIder: { timerIder: string[]; tilleggIder: string[]; maskinIder: string[] };
  tilbakeUrl: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const [kommentar, setKommentar] = useState("");
  const [feil, setFeil] = useState<string | null>(null);

  const returner = trpc.timer.dagsseddel.returnerRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLukk();
      router.push(tilbakeUrl);
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
    returner.mutate({ radIder, kommentar: kommentar.trim() });
  }

  const antall =
    radIder.timerIder.length + radIder.tilleggIder.length + radIder.maskinIder.length;

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
        <p className="text-sm font-medium text-gray-700">
          {t("timer.attestering.radValg.returnererAntall", { antall })}
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

