"use client";

// Flyt-rettighetsmatrise — admin-UI (Kloss 2, config-design § 2).
// Matrise rolle × status. Prosjektadmin-kolonnen er redigerbar; sitedoc-admin er kode-bypass
// (fotnote, ikke kolonne); firma-admin er IKKE et flyt-admin-nivå (droppet, Kenneth-vedtak).
// Skriving = KUN sitedoc_admin i fase 1. Lagring per celle-klikk med server-validering
// (statusmaskin-snittet); FlytRettighetLogg føres append-only ved hver endring.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { Lock, RotateCcw, Check } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { flytRettighetNoekkel, type RettighetsOverrides } from "@sitedoc/shared";
import {
  MATRISE_ROLLER,
  MATRISE_RADER,
  AUTO_OVERGANGER,
  ROLLE_LABEL_NOEKKEL,
  STATUS_LABEL_NOEKKEL,
  celleTilstand,
  type MatriseRolle,
  type CelleTilstand,
} from "@/lib/flytmatrise-def";

type Fane = "matrise" | "logg" | "lesrediger";

export default function FlytRettigheterSide() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const [fane, setFane] = useState<Fane>("matrise");

  const { data, isLoading, error } = trpc.flytMatrise.hentMatrise.useQuery(
    { orgId: orgId! },
    { enabled: !!orgId },
  );
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
    if (!kanRedigere || tilstand === "laast" || !orgId) return;
    const effektivPaa = tilstand === "standard-pa" || tilstand === "overstyrt-pa";
    settMutasjon.mutate({ orgId, rolle, fraStatus: fra, tilStatus: til, tillatt: !effektivPaa });
  };

  const tilbakestillCelle = (rolle: MatriseRolle, fra: string, til: string) => {
    if (!orgId) return;
    tilbakestillMutasjon.mutate({ orgId, rolle, fraStatus: fra, tilStatus: til });
  };

  return (
    <div className="max-w-6xl">
      <SonetonetSidehode sone="firma" className="mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("flytmatrise.tittel")}</h1>
          <p className="mt-1 text-sm text-gray-600">{t("flytmatrise.beskrivelse")}</p>
        </div>
      </SonetonetSidehode>

      {/* Faner */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {(["matrise", "logg", "lesrediger"] as const).map((f) => (
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

      {!orgId ? (
        <p className="py-12 text-center text-sm text-gray-500">{t("flytmatrise.velgFirma")}</p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-red-600">{error.message}</p>
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
        <LoggFane orgId={orgId} t={t} />
      ) : (
        <LesRedigerFane t={t} />
      )}
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
  t: (k: string) => string;
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
            {AUTO_OVERGANGER.map((a) => (
              <tr key={`${a.fra}-${a.til}`} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-700">
                  {t(STATUS_LABEL_NOEKKEL[a.fra] ?? a.fra)} → {t(STATUS_LABEL_NOEKKEL[a.til] ?? a.til)}
                </td>
                <td colSpan={MATRISE_ROLLER.length} className="px-3 py-2 text-center text-xs text-gray-400">
                  {t("flytmatrise.auto.merke")}
                </td>
              </tr>
            ))}
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
  t: (k: string) => string;
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
          <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t(rad.labelNoekkel)}</td>
          {MATRISE_ROLLER.map((rolle) => {
            const tilstand = celleTilstand(rolle, rad.fra, rad.til, overrides);
            const noekkel = flytRettighetNoekkel(rolle, rad.fra, rad.til);
            return (
              <td key={rolle} className="px-2 py-1.5 text-center">
                <Celle
                  tilstand={tilstand}
                  kanRedigere={kanRedigere}
                  metaTekst={meta[noekkel] ? t("flytmatrise.overstyrt.tooltip").replace("{navn}", meta[noekkel].navn).replace("{naar}", meta[noekkel].naar) : undefined}
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
  tilstand, kanRedigere, metaTekst, onKlikk, onTilbakestill, tilbakestillTekst,
}: {
  tilstand: CelleTilstand;
  kanRedigere: boolean;
  metaTekst?: string;
  onKlikk: () => void;
  onTilbakestill: () => void;
  tilbakestillTekst: string;
}) {
  if (tilstand === "laast") {
    return <Lock className="mx-auto h-3.5 w-3.5 text-gray-300" aria-hidden />;
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
          paa ? "bg-sitedoc-success/15 text-sitedoc-success" : "bg-gray-100 text-gray-300"
        } ${kanRedigere ? "hover:ring-1 hover:ring-sitedoc-primary/40 cursor-pointer" : "cursor-default"}`}
      >
        {paa ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px]">—</span>}
      </button>
      {overstyrt && (
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sitedoc-accent" title={metaTekst} />
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

function LoggFane({ orgId, t }: { orgId: string; t: (k: string) => string }) {
  const { data, isLoading } = trpc.flytMatrise.hentLogg.useQuery({ orgId });
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
