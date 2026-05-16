"use client";

// T7-2c2 (2026-05-16): Modal for å splitte én pending rad til N nye rader.
// Bruker splittRad-mutation fra T7-2c1. Sum av split-rader må === original
// (server-side toleranse Math.abs(diff) < 0.001).

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button, Modal } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import { RedigerTimerRad } from "./RedigerTimerRad";
import { RedigerTilleggRad } from "./RedigerTilleggRad";
import { RedigerMaskinRad } from "./RedigerMaskinRad";
import type {
  RedigerTimerRadData,
  RedigerTilleggRadData,
  RedigerMaskinRadData,
  ProsjektValg,
} from "./rediger-types";

// Original-rad-typer (matcher AttesteringDetalj_Edit.tsx) — beholdes inline
// her for å unngå en delt types-fil med innslag fra to PR-er.
type TimerRadOriginal = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  projectId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
};
type TilleggRadOriginal = {
  id: string;
  tilleggId: string;
  projectId: string;
  antall: unknown;
  kommentar: string | null;
};
type MaskinRadOriginal = {
  id: string;
  vehicleId: string;
  projectId: string;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
};

type Props =
  | {
      radType: "timer";
      original: TimerRadOriginal;
      sheetId: string;
      prosjekter: ProsjektValg[];
      tidsrundingMinutter: number | null;
      onLukk: () => void;
      onLagret: () => void;
    }
  | {
      radType: "tillegg";
      original: TilleggRadOriginal;
      sheetId: string;
      prosjekter: ProsjektValg[];
      tidsrundingMinutter: number | null;
      onLukk: () => void;
      onLagret: () => void;
    }
  | {
      radType: "maskin";
      original: MaskinRadOriginal;
      sheetId: string;
      prosjekter: ProsjektValg[];
      tidsrundingMinutter: number | null;
      onLukk: () => void;
      onLagret: () => void;
    };

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function nyKey(): string {
  return `split-${Math.random().toString(36).slice(2, 11)}`;
}

export function SplittRadModal(props: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Original-sum som split-rader må matche
  const originalSum =
    props.radType === "tillegg"
      ? tilTall(props.original.antall)
      : tilTall(props.original.timer);

  // Initial state: én split-rad pre-fylt med original-verdier
  const [splitTimer, setSplitTimer] = useState<RedigerTimerRadData[]>(() => {
    if (props.radType !== "timer") return [];
    const o = props.original;
    return [
      {
        key: nyKey(),
        originalId: null,
        projectId: o.projectId,
        lonnsartId: o.lonnsartId,
        aktivitetId: o.aktivitetId,
        externalCostObjectId: o.externalCostObjectId,
        byggeplassId: o.byggeplassId,
        fraTid: o.fraTid,
        tilTid: o.tilTid,
        timer: tilTall(o.timer),
      },
    ];
  });
  const [splitTillegg, setSplitTillegg] = useState<RedigerTilleggRadData[]>(() => {
    if (props.radType !== "tillegg") return [];
    const o = props.original;
    return [
      {
        key: nyKey(),
        originalId: null,
        projectId: o.projectId,
        tilleggId: o.tilleggId,
        antall: tilTall(o.antall),
        kommentar: o.kommentar,
      },
    ];
  });
  const [splitMaskin, setSplitMaskin] = useState<RedigerMaskinRadData[]>(() => {
    if (props.radType !== "maskin") return [];
    const o = props.original;
    return [
      {
        key: nyKey(),
        originalId: null,
        projectId: o.projectId,
        vehicleId: o.vehicleId,
        byggeplassId: o.byggeplassId,
        fraTid: o.fraTid,
        tilTid: o.tilTid,
        timer: tilTall(o.timer),
        mengde: o.mengde === null || o.mengde === undefined ? null : tilTall(o.mengde),
        enhet: o.enhet,
      },
    ];
  });

  const [feil, setFeil] = useState<string | null>(null);

  // Running sum based on radType
  const splitSum = useMemo(() => {
    if (props.radType === "timer") return splitTimer.reduce((acc, r) => acc + r.timer, 0);
    if (props.radType === "tillegg") return splitTillegg.reduce((acc, r) => acc + r.antall, 0);
    return splitMaskin.reduce((acc, r) => acc + r.timer, 0);
  }, [props.radType, splitTimer, splitTillegg, splitMaskin]);

  const gjenstaar = originalSum - splitSum;
  const erBalansert = Math.abs(gjenstaar) < 0.001;
  const radTeller =
    props.radType === "timer"
      ? splitTimer.length
      : props.radType === "tillegg"
        ? splitTillegg.length
        : splitMaskin.length;

  // Lokal lagring av mutation result
  const lagre = trpc.timer.dagsseddel.splittRad.useMutation({
    onSuccess: () => {
      void utils.timer.dagsseddel.hentForAttestering.invalidate({ id: props.sheetId });
      void utils.timer.dagsseddel.hentTilAttestering.invalidate();
      void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
      props.onLagret();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function leggTilRad() {
    if (props.radType === "timer") {
      setSplitTimer((rader) => {
        const sisteTilTid = rader[rader.length - 1]?.tilTid ?? null;
        const o = props.original;
        return [
          ...rader,
          {
            key: nyKey(),
            originalId: null,
            projectId: o.projectId,
            lonnsartId: o.lonnsartId,
            aktivitetId: o.aktivitetId,
            externalCostObjectId: o.externalCostObjectId,
            byggeplassId: o.byggeplassId,
            fraTid: sisteTilTid,
            tilTid: null,
            timer: Math.max(0, gjenstaar),
          },
        ];
      });
    } else if (props.radType === "tillegg") {
      setSplitTillegg((rader) => {
        const o = props.original;
        return [
          ...rader,
          {
            key: nyKey(),
            originalId: null,
            projectId: o.projectId,
            tilleggId: o.tilleggId,
            antall: Math.max(0, gjenstaar),
            kommentar: null,
          },
        ];
      });
    } else {
      setSplitMaskin((rader) => {
        const sisteTilTid = rader[rader.length - 1]?.tilTid ?? null;
        const o = props.original;
        return [
          ...rader,
          {
            key: nyKey(),
            originalId: null,
            projectId: o.projectId,
            vehicleId: o.vehicleId,
            byggeplassId: o.byggeplassId,
            fraTid: sisteTilTid,
            tilTid: null,
            timer: Math.max(0, gjenstaar),
            mengde: null,
            enhet: o.enhet,
          },
        ];
      });
    }
  }

  function slettRad(key: string) {
    if (props.radType === "timer") {
      setSplitTimer((rader) => rader.filter((r) => r.key !== key));
    } else if (props.radType === "tillegg") {
      setSplitTillegg((rader) => rader.filter((r) => r.key !== key));
    } else {
      setSplitMaskin((rader) => rader.filter((r) => r.key !== key));
    }
  }

  function oppdaterTimer(key: string, felt: Partial<RedigerTimerRadData>) {
    setSplitTimer((rader) => rader.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }
  function oppdaterTillegg(key: string, felt: Partial<RedigerTilleggRadData>) {
    setSplitTillegg((rader) => rader.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }
  function oppdaterMaskin(key: string, felt: Partial<RedigerMaskinRadData>) {
    setSplitMaskin((rader) => rader.map((r) => (r.key === key ? { ...r, ...felt } : r)));
  }

  function handleLagre() {
    setFeil(null);
    if (radTeller < 2) {
      setFeil(t("timer.splitt.feil.minst2Rader"));
      return;
    }
    if (!erBalansert) {
      setFeil(t("timer.splitt.feil.sumIkkeMatch"));
      return;
    }
    if (props.radType === "timer") {
      for (const r of splitTimer) {
        if (!r.projectId || !r.lonnsartId || !r.aktivitetId || r.timer <= 0) {
          setFeil(t("timer.rediger.feil.timerInkomplett"));
          return;
        }
      }
      lagre.mutate({
        radType: "timer",
        radId: props.original.id,
        nyeRader: splitTimer.map((r) => ({
          projectId: r.projectId,
          lonnsartId: r.lonnsartId,
          aktivitetId: r.aktivitetId,
          externalCostObjectId: r.externalCostObjectId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
        })),
      });
    } else if (props.radType === "tillegg") {
      for (const r of splitTillegg) {
        if (!r.projectId || !r.tilleggId || r.antall <= 0) {
          setFeil(t("timer.rediger.feil.tilleggInkomplett"));
          return;
        }
      }
      lagre.mutate({
        radType: "tillegg",
        radId: props.original.id,
        nyeRader: splitTillegg.map((r) => ({
          projectId: r.projectId,
          tilleggId: r.tilleggId,
          antall: r.antall,
          kommentar: r.kommentar,
        })),
      });
    } else {
      for (const r of splitMaskin) {
        if (!r.projectId || !r.vehicleId || r.timer <= 0) {
          setFeil(t("timer.rediger.feil.maskinInkomplett"));
          return;
        }
      }
      lagre.mutate({
        radType: "maskin",
        radId: props.original.id,
        nyeRader: splitMaskin.map((r) => ({
          projectId: r.projectId,
          vehicleId: r.vehicleId,
          byggeplassId: r.byggeplassId,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          mengde: r.mengde,
          enhet: r.enhet,
        })),
      });
    }
  }

  // Indikator-fargekoding
  const indikatorKlasse = erBalansert
    ? "bg-green-50 border-green-200 text-green-900"
    : gjenstaar < 0
      ? "bg-red-50 border-red-200 text-red-900"
      : "bg-amber-50 border-amber-200 text-amber-900";

  const indikatorTekst = erBalansert
    ? t("timer.splitt.balansert")
    : gjenstaar < 0
      ? t("timer.splitt.foredelt", { antall: Math.abs(gjenstaar).toFixed(2) })
      : t("timer.splitt.gjenstaar", { antall: gjenstaar.toFixed(2) });

  return (
    <Modal
      open={true}
      onClose={props.onLukk}
      title={t(`timer.splitt.tittel.${props.radType}`)}
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Original referanse */}
        <section className="rounded-lg border border-gray-300 bg-gray-100 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("timer.splitt.original")}
          </p>
          <OriginalRefVisning radType={props.radType} original={props.original} prosjekter={props.prosjekter} />
        </section>

        {/* Split-rader */}
        <section className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("timer.splitt.splitRader")} ({radTeller})
          </p>
          <div className="space-y-2">
            {props.radType === "timer" &&
              splitTimer.map((rad, i) => (
                <RedigerTimerRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={props.prosjekter}
                  tidsrundingMinutter={props.tidsrundingMinutter}
                  onChange={(felt) => oppdaterTimer(rad.key, felt)}
                  onSlett={i === 0 ? () => {} : () => slettRad(rad.key)}
                />
              ))}
            {props.radType === "tillegg" &&
              splitTillegg.map((rad, i) => (
                <RedigerTilleggRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={props.prosjekter}
                  onChange={(felt) => oppdaterTillegg(rad.key, felt)}
                  onSlett={i === 0 ? () => {} : () => slettRad(rad.key)}
                />
              ))}
            {props.radType === "maskin" &&
              splitMaskin.map((rad, i) => (
                <RedigerMaskinRad
                  key={rad.key}
                  rad={rad}
                  prosjekter={props.prosjekter}
                  tidsrundingMinutter={props.tidsrundingMinutter}
                  onChange={(felt) => oppdaterMaskin(rad.key, felt)}
                  onSlett={i === 0 ? () => {} : () => slettRad(rad.key)}
                />
              ))}
          </div>
          <button
            type="button"
            onClick={leggTilRad}
            className="mt-3 inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" />
            {t("timer.splitt.leggTilRad")}
          </button>
        </section>

        {/* Gjenstår-indikator */}
        <div className={`rounded-lg border p-3 text-sm font-medium ${indikatorKlasse}`}>
          {indikatorTekst}
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={props.onLukk} disabled={lagre.isPending}>
            {t("handling.avbryt")}
          </Button>
          <Button onClick={handleLagre} disabled={!erBalansert || radTeller < 2 || lagre.isPending}>
            {lagre.isPending ? t("handling.lagrer") : t("timer.splitt.lagre")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----- Original referanse-visning -----

function OriginalRefVisning({
  radType,
  original,
  prosjekter,
}: {
  radType: "timer" | "tillegg" | "maskin";
  original: TimerRadOriginal | TilleggRadOriginal | MaskinRadOriginal;
  prosjekter: ProsjektValg[];
}) {
  const { t } = useTranslation();
  const prosjektNavn =
    prosjekter.find((p) => p.id === original.projectId)?.name ?? original.projectId;

  if (radType === "timer") {
    const o = original as TimerRadOriginal;
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
        <div>
          <span className="text-gray-500">{t("timer.felt.prosjekt")}: </span>
          <span className="font-medium">{prosjektNavn}</span>
        </div>
        <div>
          <span className="text-gray-500">{t("timer.felt.timer")}: </span>
          <span className="font-mono font-medium">{tilTall(o.timer).toFixed(2)}t</span>
        </div>
        {(o.fraTid || o.tilTid) && (
          <div className="col-span-2">
            <span className="text-gray-500">{t("timer.felt.startTid")}: </span>
            <span className="font-mono">{o.fraTid ?? "—"}</span>
            <span className="mx-1">→</span>
            <span className="font-mono">{o.tilTid ?? "—"}</span>
          </div>
        )}
      </div>
    );
  }
  if (radType === "tillegg") {
    const o = original as TilleggRadOriginal;
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
        <div>
          <span className="text-gray-500">{t("timer.felt.prosjekt")}: </span>
          <span className="font-medium">{prosjektNavn}</span>
        </div>
        <div>
          <span className="text-gray-500">{t("timer.felt.antall")}: </span>
          <span className="font-mono font-medium">{tilTall(o.antall).toFixed(2)}</span>
        </div>
        {o.kommentar && (
          <div className="col-span-2">
            <span className="text-gray-500">{t("timer.felt.kommentar")}: </span>
            <span>{o.kommentar}</span>
          </div>
        )}
      </div>
    );
  }
  // maskin
  const o = original as MaskinRadOriginal;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
      <div>
        <span className="text-gray-500">{t("timer.felt.prosjekt")}: </span>
        <span className="font-medium">{prosjektNavn}</span>
      </div>
      <div>
        <span className="text-gray-500">{t("timer.felt.timer")}: </span>
        <span className="font-mono font-medium">{tilTall(o.timer).toFixed(2)}t</span>
      </div>
      {(o.fraTid || o.tilTid) && (
        <div className="col-span-2">
          <span className="text-gray-500">{t("timer.felt.startTid")}: </span>
          <span className="font-mono">{o.fraTid ?? "—"}</span>
          <span className="mx-1">→</span>
          <span className="font-mono">{o.tilTid ?? "—"}</span>
        </div>
      )}
      {o.mengde !== null && o.mengde !== undefined && (
        <div className="col-span-2">
          <span className="text-gray-500">{t("timer.splitt.mengde")}: </span>
          <span className="font-mono">{tilTall(o.mengde).toFixed(2)}</span>
          {o.enhet && <span className="ml-1 text-gray-600">{o.enhet}</span>}
        </div>
      )}
    </div>
  );
}
