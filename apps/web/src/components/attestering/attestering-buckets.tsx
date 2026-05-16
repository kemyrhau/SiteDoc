"use client";

// T7-4f-2 (2026-05-16): Ekstrahert fra AttesteringDetalj.tsx for gjenbruk
// i firma-attestering-liste (T7-4f-3). Inneholder per-prosjekt+ECO-grupperingen
// + per-rad-komponenter med flytt-ECO og status-badge. Ingen logikk-endring.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Check, RotateCcw, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

type RadStatus = "pending" | "attestert" | "returnert" | null;

// T7-2d: per-rad prosjekt-join fra hentForAttestering / hentTilAttesteringFirma.
export type RadProsjekt = {
  id: string;
  name: string;
  projectNumber: string | null;
} | null;

export type TimerRad = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  projectId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  attestertStatus: string | null;
  project?: RadProsjekt;
};

export type TilleggRad = {
  id: string;
  tilleggId: string;
  projectId: string;
  antall: unknown;
  kommentar: string | null;
  attestertStatus: string | null;
  project?: RadProsjekt;
};

export type MaskinRad = {
  id: string;
  vehicleId: string;
  projectId: string;
  // T7-4d (2026-05-16): ECO på maskin-rad.
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
  project?: RadProsjekt;
};

export type EcoBucketAttestProps = {
  projectId: string;
  ecoId: string | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
};

/* ------------------------------------------------------------------ */
/*  Utility                                                             */
/* ------------------------------------------------------------------ */

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

/* ------------------------------------------------------------------ */
/*  RadStatusBadge                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  TimerRaderLeder                                                     */
/* ------------------------------------------------------------------ */

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
                    {/* T7-2d: vis prosjektnavn. I prosjekt-kontekst: kun når rad
                        tilhører annet prosjekt. I firma-kontekst: alltid. */}
                    {rad.project?.name &&
                      (!prosjektKontekst || rad.projectId !== prosjektKontekst) && (
                        <span className="text-xs text-blue-600">{rad.project.name}</span>
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

/* ------------------------------------------------------------------ */
/*  TilleggRaderLeder                                                   */
/* ------------------------------------------------------------------ */

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
                {/* T7-2d: prosjektnavn ved multi-prosjekt-sedler */}
                {rad.project?.name &&
                  (!prosjektKontekst || rad.projectId !== prosjektKontekst) && (
                    <span className="text-xs text-blue-600">{rad.project.name}</span>
                  )}
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

/* ------------------------------------------------------------------ */
/*  MaskinRaderLeder                                                    */
/* ------------------------------------------------------------------ */

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
                {/* T7-2d: prosjektnavn ved multi-prosjekt-sedler */}
                {rad.project?.name &&
                  (!prosjektKontekst || rad.projectId !== prosjektKontekst) && (
                    <span className="text-xs text-blue-600">{rad.project.name}</span>
                  )}
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

/* ------------------------------------------------------------------ */
/*  T7-4d: ProsjektSectionAttest + EcoBucketAttest                      */
/*                                                                      */
/*  Speil av T7-4c/edit-modus-strukturen for read-only attestering:     */
/*  per prosjekt → N ECO-buckets + per-prosjekt tillegg. Maskin         */
/*  indentert som underpost. Indigo-badge på ECO-grupper.               */
/*  Beholder per-rad-checkboks + flytt-ECO-funksjonalitet via           */
/*  eksisterende TimerRaderLeder/MaskinRaderLeder/TilleggRaderLeder.    */
/* ------------------------------------------------------------------ */

export function ProsjektSectionAttest({
  projectId,
  prosjektNavn,
  ecoKeys,
  bucketMap,
  tillegg,
  prosjektKontekst,
  valgteTimer,
  valgteMaskin,
  valgteTillegg,
  onToggleTimer,
  onToggleMaskin,
  onToggleTillegg,
  kanFlytte,
}: {
  projectId: string;
  prosjektNavn: RadProsjekt | null;
  ecoKeys: string[];
  bucketMap: Map<string, EcoBucketAttestProps>;
  tillegg: TilleggRad[];
  prosjektKontekst?: string;
  valgteTimer: Set<string>;
  valgteMaskin: Set<string>;
  valgteTillegg: Set<string>;
  onToggleTimer: (id: string) => void;
  onToggleMaskin: (id: string) => void;
  onToggleTillegg: (id: string) => void;
  kanFlytte: boolean;
}) {
  const { t } = useTranslation();
  // ECO-katalog for navn på subheaders (én query per prosjekt).
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId },
    { enabled: !!projectId },
  );
  const ecoNavnMap = new Map<string, { kortNavn: string; proAdmId: string }>(
    (ecoer ?? []).map((e) => [
      e.id,
      { kortNavn: e.kortNavn, proAdmId: e.proAdmId },
    ]),
  );

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        {prosjektNavn?.name ?? t("timer.detalj.ukjentProsjekt")}
        {prosjektNavn?.projectNumber && (
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({prosjektNavn.projectNumber})
          </span>
        )}
      </h2>

      <div className="space-y-3">
        {ecoKeys.map((ekv) => {
          const ecoId = ekv === "" ? null : ekv;
          const bucket = bucketMap.get(`${projectId}|${ekv}`) ?? {
            projectId,
            ecoId,
            timer: [],
            maskin: [],
          };
          return (
            <EcoBucketAttest
              key={ekv}
              ecoId={ecoId}
              ecoNavn={ecoId ? ecoNavnMap.get(ecoId) ?? null : null}
              timer={bucket.timer}
              maskin={bucket.maskin}
              prosjektKontekst={prosjektKontekst}
              valgteTimer={valgteTimer}
              valgteMaskin={valgteMaskin}
              onToggleTimer={onToggleTimer}
              onToggleMaskin={onToggleMaskin}
              kanFlytte={kanFlytte}
            />
          );
        })}
      </div>

      {/* Tillegg per-prosjekt (separat fra ECO-bukets) */}
      {tillegg.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.detalj.tilleggRader")}
          </h3>
          <TilleggRaderLeder
            rader={tillegg}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteTillegg}
            onToggle={onToggleTillegg}
          />
        </div>
      )}
    </section>
  );
}

export function EcoBucketAttest({
  ecoId,
  ecoNavn,
  timer,
  maskin,
  prosjektKontekst,
  valgteTimer,
  valgteMaskin,
  onToggleTimer,
  onToggleMaskin,
  kanFlytte,
}: {
  ecoId: string | null;
  ecoNavn: { kortNavn: string; proAdmId: string } | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
  prosjektKontekst?: string;
  valgteTimer: Set<string>;
  valgteMaskin: Set<string>;
  onToggleTimer: (id: string) => void;
  onToggleMaskin: (id: string) => void;
  kanFlytte: boolean;
}) {
  const { t } = useTranslation();
  const sumTimer = timer.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const sumMaskin = maskin.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const maskinOk = sumMaskin <= sumTimer + 0.001;

  return (
    <div
      className={`rounded border bg-gray-50 p-3 ${
        ecoId ? "border-indigo-200" : "border-gray-200"
      }`}
    >
      {/* ECO-subheader + indigo-badge (kun ekte ECO-er) */}
      {ecoId && (
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="text-xs font-semibold text-gray-800">
            {ecoNavn
              ? `${ecoNavn.proAdmId} · ${ecoNavn.kortNavn}`
              : t("timer.detalj.ukjentEco")}
          </div>
          <span
            className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
            title={t("timer.gruppe.tilByggherreHint")}
          >
            → {t("timer.gruppe.tilByggherre")}
          </span>
        </div>
      )}

      {/* Arbeidstimer (hovedpost) */}
      <div className="mb-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
          {t("timer.gruppe.arbeidstimer")}{" "}
          <span className="font-mono font-normal text-gray-500">
            ({sumTimer.toFixed(2)} {t("timer.timerEnhet")})
          </span>
        </h4>
        {timer.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.detalj.ingenTimer")}
          </p>
        ) : (
          <TimerRaderLeder
            rader={timer}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteTimer}
            onToggle={onToggleTimer}
            kanFlytte={kanFlytte}
          />
        )}
      </div>

      {/* Maskintimer som underpost (indentert) */}
      <div className="ml-3 border-l-2 border-gray-200 pl-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t("timer.gruppe.maskintimer")}{" "}
          <span className="font-mono font-normal text-gray-500">
            ({sumMaskin.toFixed(2)} {t("timer.timerEnhet")})
          </span>
        </h4>
        {maskin.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.detalj.ingenMaskiner")}
          </p>
        ) : (
          <MaskinRaderLeder
            rader={maskin}
            prosjektKontekst={prosjektKontekst}
            valgte={valgteMaskin}
            onToggle={onToggleMaskin}
          />
        )}
      </div>

      {/* Sum-indikator: speiler T7-4b server-validering */}
      {(sumTimer > 0 || sumMaskin > 0) && (
        <div
          className={`mt-3 rounded border px-3 py-1.5 text-xs font-medium ${
            maskinOk
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {t("timer.gruppe.maskinAvArbeid", {
            maskin: sumMaskin.toFixed(2),
            arbeid: sumTimer.toFixed(2),
          })}
        </div>
      )}
    </div>
  );
}
