"use client";

// T7-2b2 (2026-05-14): Edit-modus for sedel — firma-admin redigerer rader
// direkte uten å returnere til arbeider.
// Mounted fra AttesteringDetalj.tsx når redigerModus = true.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@sitedoc/ui";
import { Plus } from "lucide-react";
import { RedigerTimerRad } from "./RedigerTimerRad";
import { RedigerTilleggRad } from "./RedigerTilleggRad";
import { RedigerMaskinRad } from "./RedigerMaskinRad";
import type {
  RedigerTimerRadData,
  RedigerTilleggRadData,
  RedigerMaskinRadData,
  ProsjektValg,
} from "./rediger-types";

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

type TimerRad = {
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
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
};

type Props = {
  sheetId: string;
  organizationId: string;
  timerRader: TimerRad[];
  tilleggRader: TilleggRad[];
  maskinRader: MaskinRad[];
  onAvbryt: () => void;
  onLagret: () => void;
};

function nyKey(): string {
  return `ny-${Math.random().toString(36).slice(2, 11)}`;
}

export function AttesteringDetaljEdit({
  sheetId,
  organizationId,
  timerRader,
  tilleggRader,
  maskinRader,
  onAvbryt,
  onLagret,
}: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const { data: prosjekter } = trpc.prosjekt.hentAlle.useQuery(
    { organizationId },
    { enabled: !!organizationId },
  );

  // T.5: hent tidsrunding fra firma-setting for time-input runding.
  const { data: setting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId },
    { enabled: !!organizationId },
  );
  const tidsrundingMinutter = setting?.tidsrundingMinutter ?? null;

  const prosjektListe = (prosjekter ?? []) as Array<{
    id: string;
    name: string;
    projectNumber: string | null;
  }>;
  const prosjektValg: ProsjektValg[] = prosjektListe.map((p) => ({
    id: p.id,
    name: `${p.projectNumber ?? ""} ${p.name}`.trim(),
  }));

  const pendingTimer = timerRader.filter((r) => r.attestertStatus === "pending");
  const pendingTillegg = tilleggRader.filter((r) => r.attestertStatus === "pending");
  const pendingMaskin = maskinRader.filter((r) => r.attestertStatus === "pending");

  const initTimer: RedigerTimerRadData[] = pendingTimer.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    externalCostObjectId: r.externalCostObjectId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: tilTall(r.timer),
  }));
  const initTillegg: RedigerTilleggRadData[] = pendingTillegg.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    tilleggId: r.tilleggId,
    antall: tilTall(r.antall),
    kommentar: r.kommentar,
  }));
  const initMaskin: RedigerMaskinRadData[] = pendingMaskin.map((r) => ({
    key: r.id,
    originalId: r.id,
    projectId: r.projectId,
    vehicleId: r.vehicleId,
    byggeplassId: r.byggeplassId,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    timer: tilTall(r.timer),
    mengde: r.mengde === null || r.mengde === undefined ? null : tilTall(r.mengde),
    enhet: r.enhet,
  }));

  const [editTimer, setEditTimer] = useState<RedigerTimerRadData[]>(initTimer);
  const [editTillegg, setEditTillegg] = useState<RedigerTilleggRadData[]>(initTillegg);
  const [editMaskin, setEditMaskin] = useState<RedigerMaskinRadData[]>(initMaskin);
  const [feil, setFeil] = useState<string | null>(null);

  const lagre = trpc.timer.dagsseddel.redigerSedelRader.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: sheetId });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      onLagret();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const førsteProsjektId =
    editTimer[0]?.projectId ??
    editTillegg[0]?.projectId ??
    editMaskin[0]?.projectId ??
    prosjektValg[0]?.id ??
    "";

  function leggTilTimer() {
    setEditTimer((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: førsteProsjektId,
        lonnsartId: "",
        aktivitetId: "",
        externalCostObjectId: null,
        byggeplassId: null,
        fraTid: null,
        tilTid: null,
        timer: 0,
      },
    ]);
  }
  function leggTilTillegg() {
    setEditTillegg((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: førsteProsjektId,
        tilleggId: "",
        antall: 0,
        kommentar: null,
      },
    ]);
  }
  function leggTilMaskin() {
    setEditMaskin((rader) => [
      ...rader,
      {
        key: nyKey(),
        originalId: null,
        projectId: førsteProsjektId,
        vehicleId: "",
        byggeplassId: null,
        fraTid: null,
        tilTid: null,
        timer: 0,
        mengde: null,
        enhet: null,
      },
    ]);
  }

  function oppdaterTimer(key: string, felt: Partial<RedigerTimerRadData>) {
    setEditTimer((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }
  function oppdaterTillegg(key: string, felt: Partial<RedigerTilleggRadData>) {
    setEditTillegg((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }
  function oppdaterMaskin(key: string, felt: Partial<RedigerMaskinRadData>) {
    setEditMaskin((rader) =>
      rader.map((r) => (r.key === key ? { ...r, ...felt } : r)),
    );
  }

  function slettTimer(key: string) {
    setEditTimer((rader) => rader.filter((r) => r.key !== key));
  }
  function slettTillegg(key: string) {
    setEditTillegg((rader) => rader.filter((r) => r.key !== key));
  }
  function slettMaskin(key: string) {
    setEditMaskin((rader) => rader.filter((r) => r.key !== key));
  }

  function handleLagre() {
    setFeil(null);
    // Validering: ingen tomme dropdown-verdier på timer/tillegg/maskin
    for (const r of editTimer) {
      if (!r.projectId || !r.lonnsartId || !r.aktivitetId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.timerInkomplett"));
        return;
      }
    }
    for (const r of editTillegg) {
      if (!r.projectId || !r.tilleggId || r.antall <= 0) {
        setFeil(t("timer.rediger.feil.tilleggInkomplett"));
        return;
      }
    }
    for (const r of editMaskin) {
      if (!r.projectId || !r.vehicleId || r.timer <= 0) {
        setFeil(t("timer.rediger.feil.maskinInkomplett"));
        return;
      }
    }

    lagre.mutate({
      sheetId,
      nyeRader: {
        timer: editTimer.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          lonnsartId: r.lonnsartId,
          aktivitetId: r.aktivitetId,
          externalCostObjectId: r.externalCostObjectId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
        })),
        tillegg: editTillegg.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          tilleggId: r.tilleggId,
          antall: r.antall,
          kommentar: r.kommentar,
        })),
        maskin: editMaskin.map((r) => ({
          originalId: r.originalId,
          projectId: r.projectId,
          vehicleId: r.vehicleId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          mengde: r.mengde,
          enhet: r.enhet,
        })),
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>{t("timer.rediger.modus.tittel")}</strong>
        <p className="mt-1 text-xs">{t("timer.rediger.modus.beskrivelse")}</p>
      </div>

      {/* Original-rader komprimert (read-only) */}
      <OriginalKomprimering
        timer={pendingTimer}
        tillegg={pendingTillegg}
        maskin={pendingMaskin}
      />

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.detalj.timerRader")}
          </h3>
          <button
            type="button"
            onClick={leggTilTimer}
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilTimer")}
          </button>
        </div>
        <div className="space-y-2">
          {editTimer.length === 0 ? (
            <p className="text-xs italic text-gray-500">{t("timer.rediger.ingenTimer")}</p>
          ) : (
            editTimer.map((rad) => (
              <RedigerTimerRad
                key={rad.key}
                rad={rad}
                prosjekter={prosjektValg}
                tidsrundingMinutter={tidsrundingMinutter}
                onChange={(felt) => oppdaterTimer(rad.key, felt)}
                onSlett={() => slettTimer(rad.key)}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.detalj.tilleggRader")}
          </h3>
          <button
            type="button"
            onClick={leggTilTillegg}
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilTillegg")}
          </button>
        </div>
        <div className="space-y-2">
          {editTillegg.length === 0 ? (
            <p className="text-xs italic text-gray-500">{t("timer.rediger.ingenTillegg")}</p>
          ) : (
            editTillegg.map((rad) => (
              <RedigerTilleggRad
                key={rad.key}
                rad={rad}
                prosjekter={prosjektValg}
                onChange={(felt) => oppdaterTillegg(rad.key, felt)}
                onSlett={() => slettTillegg(rad.key)}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.detalj.maskinRader")}
          </h3>
          <button
            type="button"
            onClick={leggTilMaskin}
            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.rediger.leggTilMaskin")}
          </button>
        </div>
        <div className="space-y-2">
          {editMaskin.length === 0 ? (
            <p className="text-xs italic text-gray-500">{t("timer.rediger.ingenMaskin")}</p>
          ) : (
            editMaskin.map((rad) => (
              <RedigerMaskinRad
                key={rad.key}
                rad={rad}
                prosjekter={prosjektValg}
                tidsrundingMinutter={tidsrundingMinutter}
                onChange={(felt) => oppdaterMaskin(rad.key, felt)}
                onSlett={() => slettMaskin(rad.key)}
              />
            ))
          )}
        </div>
      </section>

      {feil && <p className="text-sm text-red-600">{feil}</p>}

      <div className="flex justify-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <Button variant="secondary" onClick={onAvbryt} disabled={lagre.isPending}>
          {t("handling.avbryt")}
        </Button>
        <Button onClick={handleLagre} disabled={lagre.isPending}>
          {lagre.isPending
            ? t("handling.lagrer")
            : t("timer.rediger.lagre")}
        </Button>
      </div>
    </div>
  );
}

function OriginalKomprimering({
  timer,
  tillegg,
  maskin,
}: {
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskin: MaskinRad[];
}) {
  const { t } = useTranslation();
  if (timer.length + tillegg.length + maskin.length === 0) return null;

  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm" open>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-600">
        {t("timer.rediger.original.tittel")} ({timer.length + tillegg.length + maskin.length}{" "}
        {t("timer.rediger.original.rader")})
      </summary>
      <div className="mt-2 space-y-1 text-xs text-gray-700">
        {timer.length > 0 && (
          <p>
            <strong>{t("timer.detalj.timerRader")}:</strong>{" "}
            {timer.map((r) => `${tilTall(r.timer).toFixed(2)}t`).join(" · ")}
          </p>
        )}
        {tillegg.length > 0 && (
          <p>
            <strong>{t("timer.detalj.tilleggRader")}:</strong> {tillegg.length}
          </p>
        )}
        {maskin.length > 0 && (
          <p>
            <strong>{t("timer.detalj.maskinRader")}:</strong>{" "}
            {maskin.map((r) => `${tilTall(r.timer).toFixed(2)}t`).join(" · ")}
          </p>
        )}
      </div>
    </details>
  );
}
