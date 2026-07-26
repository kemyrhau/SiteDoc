"use client";

// Flytvisning-fane (default) — boks/retningsgruppe-projeksjon over rettighetsmatrisen.
//
// Ren projeksjon over de SAMME cellene som matrise-fanen. Gjenbruker Celle + klikk/tilbakestill →
// identisk skriving, logg og server-validering. Layout fra FLYTVISNING_BOKS_DEF + FLYTVISNING_ADMIN_SONE
// (delt def, ingen drift). Egen fil (ikke page.tsx) fordi Next kun tillater side-eksporter fra page-filer
// — Celle deles med matrise-fanen og eksporteres herfra.

import { Tooltip } from "@sitedoc/ui";
import { Lock, RotateCcw, Check } from "lucide-react";
import { CELLE } from "@/lib/flytmatrise-farger";
import { flytRettighetNoekkel, type RettighetsOverrides } from "@sitedoc/shared";
import {
  AUTO_OVERGANGER,
  ROLLE_LABEL_NOEKKEL,
  STATUS_LABEL_NOEKKEL,
  celleTilstand,
  erVideresendAdminLaast,
  matriseTittel,
  flythjelpTekst,
  finnRad,
  handlingLabelNoekkel,
  FLYTVISNING_BOKS_DEF,
  FLYTVISNING_ADMIN_SONE,
  RETNINGSGRUPPE_REKKEFOLGE,
  RETNINGSGRUPPE_NOEKKEL,
  type MatriseRolle,
  type CelleTilstand,
  type OversettFn,
  type FlytHandling,
  type FlytOppslag,
  type FlytboksDef,
} from "@/lib/flytmatrise-def";

/** Trigger-styling for mikrotekst-hover: prikket understrek + hjelpe-cursor (spec Flate 1). */
export const HOVER_TRIGGER = "underline decoration-dotted underline-offset-[3px] decoration-gray-400/40 cursor-help";

export type FaneProps = {
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
            <div className="flex flex-col gap-1.5">
              {def.grupper[g]!.map((handling, idx) => (
                <FlytHandlingRad key={idx} handling={handling} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
              ))}
            </div>
          </div>
        ))}

        {/* Videresend for flyt-roller = admin-only (H3) → låst chip */}
        <div className="mt-1 flex flex-col border-t border-gray-100 pt-2">
          <FlytHandlingRad handling={{ type: "handling", celler: [def.videresendLaast] }} overrides={overrides} meta={meta} kanRedigere={kanRedigere} onKlikk={onKlikk} onTilbakestill={onTilbakestill} t={t} />
        </div>
      </div>
    </div>
  );
}

/** Én bryter (celle) med alle koblinger — deler celle-tilstand og skriving med matrise-fanen. */
function FlytCelle({
  rolle, fra, til, overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: FlytOppslag & FaneProps) {
  const tilstand = celleTilstand(rolle, fra, til, overrides);
  const noekkel = flytRettighetNoekkel(rolle, fra, til);
  return (
    <Celle
      tilstand={tilstand}
      kanRedigere={kanRedigere}
      metaTekst={meta[noekkel] ? t("flytmatrise.overstyrt.tooltip").replace("{navn}", meta[noekkel].navn).replace("{naar}", meta[noekkel].naar) : undefined}
      laastTekst={erVideresendAdminLaast(rolle, fra, til) ? t("flytmatrise.laast.videresend") : undefined}
      onKlikk={() => onKlikk(rolle, fra, til, tilstand)}
      onTilbakestill={() => onTilbakestill(rolle, fra, til)}
      tilbakestillTekst={t("flytmatrise.tilbakestill")}
    />
  );
}

/**
 * Én handling: enten et H2-fantom (disabled ?-bryter), en enkeltcelle (bryter + etikett), eller en
 * gruppert handling med flere fra-statuser (Avvik-1-fiks: én etikett + delceller, hver med sin
 * fra-status-tekst). Grupperingen er ren visning — hver delcelle skriver samme FlytRettighetOverride
 * som matrise-fanen.
 */
function FlytHandlingRad({
  handling, overrides, meta, kanRedigere, onKlikk, onTilbakestill, t,
}: { handling: FlytHandling } & FaneProps) {
  if (handling.type === "fantom") {
    return (
      <Tooltip tekst={t("flytvisning.fantom.tooltip")} side="top">
        <div className="flex items-center gap-2 self-start opacity-60 cursor-help">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-[#a8a49b] text-[11px] font-semibold text-gray-400" aria-hidden>?</span>
          <span className="text-xs text-gray-400 underline decoration-dotted underline-offset-[3px]">{t(handling.labelNoekkel)}</span>
        </div>
      </Tooltip>
    );
  }

  const { celler } = handling;
  const forste = celler[0];
  if (!forste) return null;
  const rad = finnRad(forste.fra, forste.til);
  const etikett = t(handlingLabelNoekkel(handling));
  const celleProps = { overrides, meta, kanRedigere, onKlikk, onTilbakestill, t };

  const etikettSpan = rad ? (
    <Tooltip
      tittel={matriseTittel(rad, t)}
      tekst={flythjelpTekst(rad.flythjelpNoekkel, rad.fallbackNoekkel ? t(rad.fallbackNoekkel) : undefined, t)}
      side="top"
    >
      <span className={`text-xs text-gray-700 ${HOVER_TRIGGER}`}>{etikett}</span>
    </Tooltip>
  ) : (
    <span className="text-xs text-gray-700">{etikett}</span>
  );

  // Enkeltcelle: bryter + etikett på én linje (handlingen er entydig, ingen fra-status-tekst).
  if (celler.length === 1) {
    return (
      <div className="flex items-center gap-2 self-start">
        <FlytCelle {...forste} {...celleProps} />
        {etikettSpan}
      </div>
    );
  }

  // Gruppert: én etikett, delceller under med hver sin fra-status-tekst (unngår duplikat-etiketter).
  return (
    <div className="self-start">
      <div className="mb-1">{etikettSpan}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 pl-0.5">
        {celler.map((cel, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <FlytCelle {...cel} {...celleProps} />
            <span className="text-[9px] leading-none text-gray-400">{t(STATUS_LABEL_NOEKKEL[cel.fra] ?? cel.fra)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Prosjektadmin-sonen — full bredde under boks-linjen. Farlig-gruppe får rød aksent. */
function AdminSone({ overrides, meta, kanRedigere, onKlikk, onTilbakestill, t }: FaneProps) {
  const celleProps = { overrides, meta, kanRedigere, onKlikk, onTilbakestill, t };
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-800">{t("flytmatrise.prosjektadmin")}</h3>
      <div className="flex flex-wrap gap-4">
        {FLYTVISNING_ADMIN_SONE.map((gruppe) => (
          <div
            key={gruppe.labelNoekkel}
            className={`rounded-md p-2 ${gruppe.farlig ? "border border-sitedoc-error/40 bg-sitedoc-error/5" : ""}`}
          >
            <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${gruppe.farlig ? "text-sitedoc-error" : "text-gray-400"}`}>
              {t(gruppe.labelNoekkel)}{gruppe.farlig ? ` · ${t("flytvisning.admin.farlig")}` : ""}
            </p>
            <div className="flex flex-col gap-1.5">
              {gruppe.handlinger.map((handling, idx) => (
                <FlytHandlingRad key={idx} handling={handling} {...celleProps} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Celle-bryter — delt av flytvisning- og matrise-fanen. Fylt hake = på, tom ramme = av, amber-prikk
 * = overstyrt (med «Tilbakestill»), hengelås = låst (lovkrav/invariant, f.eks. videresend admin-only).
 */
export function Celle({
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
