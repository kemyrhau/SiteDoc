"use client";

// Flyt-rettighetsmatrise — admin-UI (config-design rev.7 § 2; på Admin-flaten fra Kloss 2c § 1c).
// Matrise rolle × status. Prosjektadmin-kolonnen er redigerbar; sitedoc-admin er kode-bypass
// (fotnote, ikke kolonne); firma-admin er IKKE et flyt-admin-nivå (droppet, Kenneth-vedtak).
// Skriving = KUN sitedoc_admin i fase 1. Lagring per celle-klikk med server-validering
// (statusmaskin-snittet); FlytRettighetLogg føres append-only ved hver endring.
//
// Kloss 2d (Kenneth-vedtak 2026-07-24): matrisen er ÉN global sitedoc-konfig — ikke per-firma.
// Ingen firma-velger; matrisen lastes direkte.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner, Tooltip } from "@sitedoc/ui";
import { Lock, RotateCcw, Check } from "lucide-react";
import { CELLE } from "@/lib/flytmatrise-farger";
import { flytRettighetNoekkel, type RettighetsOverrides } from "@sitedoc/shared";
import {
  MATRISE_ROLLER,
  MATRISE_RADER,
  AUTO_OVERGANGER,
  ROLLE_LABEL_NOEKKEL,
  STATUS_LABEL_NOEKKEL,
  celleTilstand,
  erVideresendAdminLaast,
  matriseTittel,
  flythjelpTekst,
  finnRad,
  FLYTVISNING_BOKS_DEF,
  FLYTVISNING_ADMIN_SONE,
  RETNINGSGRUPPE_REKKEFOLGE,
  RETNINGSGRUPPE_NOEKKEL,
  type MatriseRolle,
  type CelleTilstand,
  type OversettFn,
  type FlytEntry,
  type FlytboksDef,
  type AdminSoneGruppe,
} from "@/lib/flytmatrise-def";

/** Trigger-styling for mikrotekst-hover: prikket understrek + hjelpe-cursor (spec Flate 1). */
const HOVER_TRIGGER = "underline decoration-dotted underline-offset-[3px] decoration-gray-400/40 cursor-help";

type Fane = "flytvisning" | "matrise" | "logg" | "lesrediger";

export default function FlytRettigheterSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [fane, setFane] = useState<Fane>("flytvisning");

  // Global konfig (Kloss 2d): matrisen lastes direkte, ingen firma-valg.
  const { data, isLoading, error } = trpc.flytMatrise.hentMatrise.useQuery();
  const kanRedigere = data?.kanRedigere === true;

  // Bygg overrides-map + metadata-map (hvem/når) fra radene.
  const { overrides, meta } = useMemo(() => {
    const o: RettighetsOverrides = {};
    const m: Record<string, { navn: string; naar: string }> = {};
    for (const r of data?.overrides ?? []) {
      const noekkel = flytRettighetNoekkel(r.rolle, r.fraStatus, r.tilStatus);
      o[noekkel] = r.tillatt;
      m[noekkel] = { navn: r.endretAv?.name ?? r.endretAv?.email ?? "—", naar: new Date(r.endretAt).toLocaleString("nb-NO") };
    }
    return { overrides: o, meta: m };
  }, [data?.overrides]);

  const settMutasjon = trpc.flytMatrise.settRettighet.useMutation({
    onSuccess: () => { utils.flytMatrise.hentMatrise.invalidate(); utils.flytMatrise.hentLogg.invalidate(); },
    onError: (e) => alert(e.message),
  });
  const tilbakestillMutasjon = trpc.flytMatrise.tilbakestill.useMutation({
    onSuccess: () => { utils.flytMatrise.hentMatrise.invalidate(); utils.flytMatrise.hentLogg.invalidate(); },
    onError: (e) => alert(e.message),
  });

  const klikkCelle = (rolle: MatriseRolle, fra: string, til: string, tilstand: CelleTilstand) => {
    if (!kanRedigere || tilstand === "laast") return;
    const effektivPaa = tilstand === "standard-pa" || tilstand === "overstyrt-pa";
    settMutasjon.mutate({ rolle, fraStatus: fra, tilStatus: til, tillatt: !effektivPaa });
  };

  const tilbakestillCelle = (rolle: MatriseRolle, fra: string, til: string) => {
    tilbakestillMutasjon.mutate({ rolle, fraStatus: fra, tilStatus: til });
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t("flytmatrise.tittel")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("flytmatrise.beskrivelse")}</p>
      </div>

      {/* Faner */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(["flytvisning", "matrise", "logg", "lesrediger"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFane(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              fane === f ? "border-sitedoc-primary text-sitedoc-primary" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`flytmatrise.fane.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-600">{error.message}</p>
      ) : fane === "flytvisning" ? (
        <FlytvisningFane
          overrides={overrides}
          meta={meta}
          kanRedigere={kanRedigere}
          onKlikk={klikkCelle}
          onTilbakestill={tilbakestillCelle}
          t={t}
        />
      ) : fane === "matrise" ? (
        <MatriseFane
          overrides={overrides}
          meta={meta}
          kanRedigere={kanRedigere}
          onKlikk={klikkCelle}
          onTilbakestill={tilbakestillCelle}
          t={t}
        />
      ) : fane === "logg" ? (
        <LoggFane t={t} />
      ) : (
        <LesRedigerFane t={t} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flytvisning-fane (default) — boks/retningsgruppe-projeksjon         */
/* ------------------------------------------------------------------ */
//
// Ren projeksjon over de SAMME cellene som matrise-fanen. Gjenbruker Celle + klikkCelle/
// tilbakestillCelle → identisk skriving, logg og server-validering. Layout fra FLYTVISNING_BOKS_DEF
// + FLYTVISNING_ADMIN_SONE (delt def, ingen drift).

type FaneProps = {
  overrides: RettighetsOverrides;
  meta: Record<string, { navn: string; naar: string }>;
  kanRedigere: boolean;
  onKlikk: (rolle: MatriseRolle, fra: string, til: string, tilstand: CelleTilstand) => void;
  onTilbakestill: (rolle: MatriseRolle, fra: string, til: string) => void;
  t: OversettFn;
};

export function FlytvisningFane({ overrides, meta, kanRedigere, onKlikk, onTilbakestill, t }: FaneProps) {
  return (
    <div>
      {/* Fire flytbokser på linje med →-piler (A-merke = auto-overgang, ingen brytere) */}
      <div className="flex flex-wrap items-stretch gap-2 overflow-x-auto">
        {FLYTVISNING_BOKS_DEF.map((boks, i) => (
          <div key={boks.boks} className="flex items-stretch gap-2">
            <FlytBoks def={boks} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
            {i < FLYTVISNING_BOKS_DEF.length - 1 && <PilMedAuto t={t} />}
          </div>
        ))}
      </div>

      {/* Prosjektadmin-sone — full bredde, ikke en boks */}
      <AdminSone overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />

      {/* Tegnforklaring + fotnoter (delt med matrise-fanen) */}
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium">{t("flytmatrise.tegn.overskrift")}:</span> {t("flytmatrise.tegn.forklaring")}</p>
        <p>{t("flytvisning.forklaring.h1")}</p>
        <p>{t("flytvisning.forklaring.h2")}</p>
        <p>{t("flytmatrise.fotnote.sitedoc")}</p>
        {!kanRedigere && <p className="text-amber-600">{t("flytmatrise.kunLesing")}</p>}
      </div>
    </div>
  );
}

/** →-pil mellom to bokser, med «A»-merke for auto-overgangen (Sendt → Mottatt). */
function PilMedAuto({ t }: { t: OversettFn }) {
  const auto = AUTO_OVERGANGER[0];
  const tekst = auto
    ? `${t(STATUS_LABEL_NOEKKEL[auto.fra] ?? auto.fra)} → ${t(STATUS_LABEL_NOEKKEL[auto.til] ?? auto.til)}`
    : "";
  return (
    <div className="flex flex-col items-center justify-center px-1 text-gray-300">
      <Tooltip tittel={tekst} tekst={auto?.flythjelpNoekkel ? t(auto.flythjelpNoekkel) : t("flytmatrise.auto.merke")} side="top">
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-lg leading-none">→</span>
          <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-semibold ${CELLE.auto}`} aria-hidden>A</span>
        </span>
      </Tooltip>
    </div>
  );
}

/** Én flytboks med retningsgrupper + låst videresend-chip. */
function FlytBoks({
  def, overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: { def: FlytboksDef } & FaneProps) {
  return (
    <div
      className={`flex min-w-[190px] flex-col rounded-lg bg-white p-3 ${
        def.stiplet ? "border-2 border-dashed border-[#a8a49b]" : "border border-gray-200"
      }`}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-gray-800">{t(ROLLE_LABEL_NOEKKEL[def.boks])}</h3>
        {def.stiplet && (
          <Tooltip tekst={t("flytvisning.bestiller.h1")} side="top">
            <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 cursor-help">{t("flytvisning.bestiller.h1merke")}</span>
          </Tooltip>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {RETNINGSGRUPPE_REKKEFOLGE.filter((g) => def.grupper[g]?.length).map((g) => (
          <div key={g}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {t(RETNINGSGRUPPE_NOEKKEL[g])}
            </p>
            <div className="flex flex-col gap-1">
              {def.grupper[g]!.map((entry, idx) => (
                <FlytEntryRad key={idx} entry={entry} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
              ))}
            </div>
          </div>
        ))}

        {/* Videresend for flyt-roller = admin-only (H3) → låst chip */}
        <div className="mt-1 flex flex-col border-t border-gray-100 pt-2">
          <FlytEntryRad entry={def.videresendLaast} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
        </div>
      </div>
    </div>
  );
}

/** Én rad i en gruppe: bryter (celle) + etikett, ELLER et H2-fantom (disabled ?-bryter). */
function FlytEntryRad({
  entry, overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: { entry: FlytEntry } & FaneProps) {
  if (entry.type === "fantom") {
    return (
      <Tooltip tekst={t("flytvisning.fantom.tooltip")} side="top">
        <div className="flex items-center gap-2 self-start opacity-60 cursor-help">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-[#a8a49b] text-[11px] font-semibold text-gray-400" aria-hidden>?</span>
          <span className="text-xs text-gray-400 underline decoration-dotted underline-offset-[3px]">{t(entry.labelNoekkel)}</span>
        </div>
      </Tooltip>
    );
  }

  const { rolle, fra, til } = entry;
  const rad = finnRad(fra, til);
  const tilstand = celleTilstand(rolle, fra, til, overrides);
  const noekkel = flytRettighetNoekkel(rolle, fra, til);
  const etikett = rad ? t(rad.labelNoekkel) : `${fra} → ${til}`;

  return (
    <div className="flex items-center gap-2 self-start">
      <Celle
        tilstand={tilstand}
        kanRedigere={kanRedigere}
        metaTekst={meta[noekkel] ? t("flytmatrise.overstyrt.tooltip").replace("{navn}", meta[noekkel].navn).replace("{naar}", meta[noekkel].naar) : undefined}
        laastTekst={erVideresendAdminLaast(rolle, fra, til) ? t("flytmatrise.laast.videresend") : undefined}
        onKlikk={() => onKlikk(rolle, fra, til, tilstand)}
        onTilbakestill={() => onTilbakestill(rolle, fra, til)}
        tilbakestillTekst={t("flytmatrise.tilbakestill")}
      />
      {rad ? (
        <Tooltip
          tittel={matriseTittel(rad, t)}
          tekst={flythjelpTekst(rad.flythjelpNoekkel, rad.fallbackNoekkel ? t(rad.fallbackNoekkel) : undefined, t)}
          side="top"
        >
          <span className={`text-xs text-gray-700 ${HOVER_TRIGGER}`}>{etikett}</span>
        </Tooltip>
      ) : (
        <span className="text-xs text-gray-700">{etikett}</span>
      )}
    </div>
  );
}

/** Prosjektadmin-sonen — full bredde under boks-linjen. Farlig-gruppe får rød aksent. */
function AdminSone({ overrides, meta, kanRedigere, onKlikk, onTilbakestill, t }: FaneProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{t("flytmatrise.prosjektadmin")}</h3>
      <div className="flex flex-wrap gap-4">
        {FLYTVISNING_ADMIN_SONE.map((gruppe: AdminSoneGruppe) => (
          <div
            key={gruppe.labelNoekkel}
            className={`rounded-md p-2 ${gruppe.farlig ? "border border-sitedoc-error/40 bg-sitedoc-error/5" : ""}`}
          >
            <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${gruppe.farlig ? "text-sitedoc-error" : "text-gray-400"}`}>
              {t(gruppe.labelNoekkel)}{gruppe.farlig ? ` · ${t("flytvisning.admin.farlig")}` : ""}
            </p>
            <div className="flex flex-col gap-1">
              {gruppe.celler.map((entry, idx) => (
                <FlytEntryRad key={idx} entry={entry} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Matrise-fane                                                       */
/* ------------------------------------------------------------------ */

function MatriseFane({
  overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: {
  overrides: RettighetsOverrides;
  meta: Record<string, { navn: string; naar: string }>;
  kanRedigere: boolean;
  onKlikk: (rolle: MatriseRolle, fra: string, til: string, tilstand: CelleTilstand) => void;
  onTilbakestill: (rolle: MatriseRolle, fra: string, til: string) => void;
  t: OversettFn;
}) {
  // Grupper rader etter fra-status for seksjonsoverskrifter.
  const grupper = useMemo(() => {
    const map = new Map<string, typeof MATRISE_RADER>();
    for (const rad of MATRISE_RADER) {
      const liste = map.get(rad.fra) ?? [];
      liste.push(rad);
      map.set(rad.fra, liste);
    }
    return [...map.entries()];
  }, []);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-600">{t("flytmatrise.kolonne.handling")}</th>
              {MATRISE_ROLLER.map((rolle) => (
                <th key={rolle} className="px-3 py-2 text-center font-medium text-gray-600 whitespace-nowrap">
                  {t(ROLLE_LABEL_NOEKKEL[rolle])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupper.map(([fra, rader]) => (
              <FraGruppe key={fra} fra={fra} rader={rader} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
            ))}
            {/* Auto-overganger — ingen rolle-celler */}
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td colSpan={MATRISE_ROLLER.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("flytmatrise.auto.overskrift")}
              </td>
            </tr>
            {AUTO_OVERGANGER.map((a) => {
              const overgangTekst = `${t(STATUS_LABEL_NOEKKEL[a.fra] ?? a.fra)} → ${t(STATUS_LABEL_NOEKKEL[a.til] ?? a.til)}`;
              return (
              <tr key={`${a.fra}-${a.til}`} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-700">
                  {/* Kun sent→received har mikrotekst (autoMottatt); received→in_progress står urørt (spec ⚠2). */}
                  {a.flythjelpNoekkel ? (
                    <Tooltip tittel={overgangTekst} tekst={t(a.flythjelpNoekkel)} side="right">
                      <span className={HOVER_TRIGGER}>{overgangTekst}</span>
                    </Tooltip>
                  ) : (
                    overgangTekst
                  )}
                </td>
                <td colSpan={MATRISE_ROLLER.length} className="px-3 py-2 text-center">
                  <span className="inline-flex items-center gap-2 text-xs text-gray-400">
                    <span className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold ${CELLE.auto}`} aria-hidden>A</span>
                    {t("flytmatrise.auto.merke")}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tegnforklaring + fotnoter */}
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium">{t("flytmatrise.tegn.overskrift")}:</span> {t("flytmatrise.tegn.forklaring")}</p>
        <p>{t("flytmatrise.fotnote.sitedoc")}</p>
        <p>{t("flytmatrise.fotnote.firmaadmin")}</p>
        {!kanRedigere && <p className="text-amber-600">{t("flytmatrise.kunLesing")}</p>}
      </div>
    </div>
  );
}

function FraGruppe({
  fra, rader, overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: {
  fra: string;
  rader: typeof MATRISE_RADER;
  overrides: RettighetsOverrides;
  meta: Record<string, { navn: string; naar: string }>;
  kanRedigere: boolean;
  onKlikk: (rolle: MatriseRolle, fra: string, til: string, tilstand: CelleTilstand) => void;
  onTilbakestill: (rolle: MatriseRolle, fra: string, til: string) => void;
  t: OversettFn;
}) {
  return (
    <>
      <tr className="border-t border-gray-100 bg-gray-50/60">
        <td colSpan={MATRISE_ROLLER.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          {t(STATUS_LABEL_NOEKKEL[fra] ?? fra)}
        </td>
      </tr>
      {rader.map((rad) => (
        <tr key={`${rad.fra}-${rad.til}`} className="border-b border-gray-100 hover:bg-gray-50/40">
          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
            <Tooltip
              tittel={matriseTittel(rad, t)}
              tekst={flythjelpTekst(rad.flythjelpNoekkel, rad.fallbackNoekkel ? t(rad.fallbackNoekkel) : undefined, t)}
              side="right"
            >
              <span className={HOVER_TRIGGER}>{t(rad.labelNoekkel)}</span>
            </Tooltip>
          </td>
          {MATRISE_ROLLER.map((rolle) => {
            const tilstand = celleTilstand(rolle, rad.fra, rad.til, overrides);
            const noekkel = flytRettighetNoekkel(rolle, rad.fra, rad.til);
            return (
              <td key={rolle} className="px-2 py-1.5 text-center">
                <Celle
                  tilstand={tilstand}
                  kanRedigere={kanRedigere}
                  metaTekst={meta[noekkel] ? t("flytmatrise.overstyrt.tooltip").replace("{navn}", meta[noekkel].navn).replace("{naar}", meta[noekkel].naar) : undefined}
                  laastTekst={erVideresendAdminLaast(rolle, rad.fra, rad.til) ? t("flytmatrise.laast.videresend") : undefined}
                  onKlikk={() => onKlikk(rolle, rad.fra, rad.til, tilstand)}
                  onTilbakestill={() => onTilbakestill(rolle, rad.fra, rad.til)}
                  tilbakestillTekst={t("flytmatrise.tilbakestill")}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function Celle({
  tilstand, kanRedigere, metaTekst, laastTekst, onKlikk, onTilbakestill, tilbakestillTekst,
}: {
  tilstand: CelleTilstand;
  kanRedigere: boolean;
  metaTekst?: string;
  /** H3: forklaring på hvorfor cellen er låst (videresend = admin-only). Vises som hover-tooltip. */
  laastTekst?: string;
  onKlikk: () => void;
  onTilbakestill: () => void;
  tilbakestillTekst: string;
}) {
  // Låst — hengelås på lys bakgrunn (fabel-cellespec).
  if (tilstand === "laast") {
    const laasIkon = (
      <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded ${CELLE.laastBg}`}>
        <Lock className={`h-3.5 w-3.5 ${CELLE.laastIkon}`} aria-hidden />
      </div>
    );
    return laastTekst ? (
      <Tooltip tekst={laastTekst} side="top">{laasIkon}</Tooltip>
    ) : (
      laasIkon
    );
  }
  const paa = tilstand === "standard-pa" || tilstand === "overstyrt-pa";
  const overstyrt = tilstand === "overstyrt-pa" || tilstand === "overstyrt-av";
  return (
    <div className="relative inline-flex items-center justify-center">
      <button
        type="button"
        disabled={!kanRedigere}
        onClick={onKlikk}
        title={metaTekst}
        className={`flex h-6 w-6 items-center justify-center rounded ${
          paa ? CELLE.paa : CELLE.av
        } ${kanRedigere ? `cursor-pointer ${CELLE.hover}` : "cursor-default"}`}
      >
        {/* På = hvit hake; av = tom ramme (ingen strek/dash). */}
        {paa && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
      </button>
      {overstyrt && (
        <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-1 ring-white ${CELLE.overstyrtPrikk}`} title={metaTekst} />
      )}
      {overstyrt && kanRedigere && (
        <button
          type="button"
          onClick={onTilbakestill}
          title={tilbakestillTekst}
          className="ml-1 text-gray-300 hover:text-gray-500"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Endringslogg-fane                                                  */
/* ------------------------------------------------------------------ */

function LoggFane({ t }: { t: (k: string) => string }) {
  const { data, isLoading } = trpc.flytMatrise.hentLogg.useQuery();
  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  if (!data || data.length === 0) return <p className="py-12 text-center text-sm text-gray-500">{t("flytmatrise.logg.tom")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
            <th className="px-3 py-2 font-medium">{t("flytmatrise.logg.celle")}</th>
            <th className="px-3 py-2 font-medium">{t("flytmatrise.logg.endring")}</th>
            <th className="px-3 py-2 font-medium">{t("flytmatrise.logg.hvem")}</th>
            <th className="px-3 py-2 font-medium">{t("flytmatrise.logg.naar")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rad, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{rad.rolle}: {rad.fraStatus} → {rad.tilStatus}</td>
              <td className="px-3 py-2 text-gray-600">{rad.fraVerdi} → {rad.tilVerdi}</td>
              <td className="px-3 py-2 text-gray-600">{rad.endretAv?.name ?? rad.endretAv?.email ?? "—"}</td>
              <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{new Date(rad.endretAt).toLocaleString("nb-NO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Les/rediger-fane (ren visning, config-design § 2 / vedtak 5)       */
/* ------------------------------------------------------------------ */

function LesRedigerFane({ t }: { t: (k: string) => string }) {
  return (
    <div className="max-w-2xl space-y-3 text-sm text-gray-600">
      <p>{t("flytmatrise.lesrediger.intro")}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t("flytmatrise.lesrediger.sjekkliste")}</li>
        <li>{t("flytmatrise.lesrediger.oppgave")}</li>
        <li>{t("flytmatrise.lesrediger.flytledd")}</li>
      </ul>
      <p className="text-xs text-gray-400">{t("flytmatrise.lesrediger.forbehold")}</p>
    </div>
  );
}
