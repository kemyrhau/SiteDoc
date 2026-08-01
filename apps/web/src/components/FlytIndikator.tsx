"use client";

/**
 * Flyt-posisjon i dokument-headeren (evolusjon 2026-07-26; Fase 4-konsolidering 2026-08-01).
 *
 * Kompakt ledd-rad som viser HVOR i flyten dokumentet står. Rendres DYNAMISK fra dokumentets
 * faktiske flyt (`byggLedd` grupperer medlemmer på `steg` = posisjon). Aktivt ledd leses fra
 * dokumentets `aktivPosisjon` (server-fakta), ALDRI gjettet fra status/recipient. Antall ledd
 * er dynamisk (2, 4, 8, …) — kollaps holder headeren kompakt uansett.
 *
 * - Passert ledd: hvit boks, ✓, dempet.
 * - Aktivt ledd (ballen): fylt blå boks, ● + ball-holderens navn.
 * - Kommende ledd: stiplet ramme, dempet.
 * - Ansvarsmerke (§ 2.6) i caps over navnet — erstatter rollenavnet som brukervendt etikett.
 * - 5+ ledd: fjerne ledd kollapses til «+N»-pille (aktivt ± 1 vises).
 * - Medlems-hover: boksen viser ETT navn, hover ramser opp alle medlemmene.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@sitedoc/ui";
import {
  byggLedd,
  finnAktivtIndex,
  filtrerNaboer,
  type FlytMedlem,
  type Ledd,
} from "@/lib/flyt-ledd";

// Re-eksporter for eksisterende importører (hentFlytLedd-konsumenter i tabeller).
export type { FlytMedlem } from "@/lib/flyt-ledd";
export { hentFlytLedd } from "@/lib/flyt-ledd";

interface FlytIndikatorProps {
  medlemmer: FlytMedlem[];
  /** Aktivt ledd = dokumentets `aktivPosisjon` (server-fakta). */
  aktivPosisjon?: number | null;
  /** Kompakt modus: vis kun aktiv boks + naboer, ekspandér ved tap. */
  kompakt?: boolean;
  /** Detalj-header: vis «Godkjenn og fullfør»-hint ved siste ledd (utelates i tabellceller). */
  visUtveier?: boolean;
  /**
   * Holder innlogget bruker ballen? (posisjon-basert, fra useFlytKontekst.) Når satt +
   * aktivt ledд finnes: vis «Du har ballen — {ansvarsmerke}»-mikrotekst under ledd-raden
   * (fabel steg 4: ballholder ser forventningen uten å åpne flyt-sheeten). Utelates i
   * tabellceller (viewer-spesifikt, ikke meningsfullt i en dokumentliste).
   */
  harBallen?: boolean;
}

function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}

export function FlytIndikator({ medlemmer, aktivPosisjon, kompakt, visUtveier, harBallen }: FlytIndikatorProps) {
  const { t } = useTranslation();
  const [ekspandert, setEkspandert] = useState(false);

  if (!medlemmer || medlemmer.length === 0) {
    return <span className="text-gray-300">—</span>;
  }

  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return <span className="text-gray-300">—</span>;

  const aktivtIndex = finnAktivtIndex(ledd, aktivPosisjon);

  // Kollaps: kompakt (mobil) fra >3 ledd, ellers variant D-terskel (5+). Aktiv ± 1 vises.
  const kollapsTerskel = kompakt ? 3 : 4;
  const skalKollapse = !ekspandert && ledd.length > kollapsTerskel;
  const visbareLedd = skalKollapse
    ? filtrerNaboer(ledd, aktivtIndex)
    : ledd.map((l, i) => ({ ledd: l, originalIndex: i }));

  const skjulteLedd = skalKollapse
    ? ledd.filter((_, i) => !visbareLedd.some((v) => v.originalIndex === i))
    : [];

  // Siste-ledd: dokumentet står på ytterste ledd → «Send» er «Godkjenn og fullfør».
  const erSisteBoks = visUtveier && aktivtIndex >= 0 && ledd.length > 1 && aktivtIndex === ledd.length - 1;

  const boksHover = (l: Ledd): string => l.medlemmer.map((m) => m.navn).join(" · ");

  return (
    <div className="flex flex-col gap-1 text-[11px] leading-none">
      <div
        data-testid="flyt-indikator"
        data-antall-ledd={ledd.length}
        data-kompakt={kompakt ? "true" : "false"}
        className={`flex items-center gap-0.5 whitespace-nowrap overflow-hidden ${kompakt ? "cursor-pointer" : "cursor-default"}`}
        onClick={kompakt ? () => setEkspandert((e) => !e) : undefined}
        title={kompakt && skalKollapse ? t("flytindikator.visHele") : undefined}
      >
        {visbareLedd.map((item, visIdx) => {
          const erAktiv = item.originalIndex === aktivtIndex;
          const erPassert = aktivtIndex === -1 || item.originalIndex < aktivtIndex;
          const visningstekst = erAktiv ? item.ledd.aktivNavn : item.ledd.navn;

          const boks = (
            <span
              data-testid="flyt-ledd"
              data-posisjon={item.ledd.posisjon}
              data-rolle={item.ledd.rolle}
              data-aktiv={erAktiv ? "true" : "false"}
              data-passert={erPassert ? "true" : "false"}
              className={`inline-flex flex-col gap-0.5 rounded px-1.5 py-1 ${
                erAktiv
                  ? "bg-sitedoc-primary text-white font-medium"
                  : erPassert
                    ? "border border-gray-200 bg-white text-gray-400"
                    : "border border-dashed border-gray-300 bg-white text-gray-400"
              }`}
            >
              {/* Fabel steg 4 (01.08): header = nummer + hvem (ansvarsmerke bor i sheet/«Du har ballen»). */}
              <span className="flex items-center gap-0.5 leading-none">
                {erAktiv && <span>●</span>}
                {erPassert && <span className="text-gray-400">✓</span>}
                <span className={erAktiv ? "text-blue-100" : "text-gray-400"}>{item.ledd.posisjon}.</span>
                {forkort(visningstekst, erAktiv ? 24 : 14)}
              </span>
            </span>
          );

          return (
            <span key={item.originalIndex} className="flex items-center gap-0.5">
              {visIdx > 0 && <span className={erAktiv ? "text-blue-400" : "text-gray-300"}>→</span>}
              <Tooltip tekst={boksHover(item.ledd)} side="top">
                {boks}
              </Tooltip>
            </span>
          );
        })}

        {skjulteLedd.length > 0 && (
          <Tooltip tekst={skjulteLedd.map((l) => l.navn).join(", ")} side="top">
            <span className="ml-0.5 rounded px-1 py-0.5 text-[10px] text-gray-400 hover:text-gray-600">
              +{skjulteLedd.length}
            </span>
          </Tooltip>
        )}

        {/* Siste-ledd: «Godkjenn og fullfør» — ingen neste mottaker å sende til. */}
        {erSisteBoks && (
          <span className="flex items-center gap-0.5">
            <span className="text-gray-300">→</span>
            <Tooltip tekst={t("flyt.godkjennOgFullfor")} side="top">
              <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-gray-200 px-1.5 py-1 text-gray-400">
                ✓
              </span>
            </Tooltip>
          </span>
        )}
      </div>

      {/* Fabel steg 4: ballholderen ser ansvarsmerket sitt uten å åpne flyt-sheeten. */}
      {harBallen && aktivtIndex >= 0 && ledd[aktivtIndex] && (
        <span data-testid="du-har-ballen-merke" className="flex items-center gap-1 text-[10px] font-medium text-sitedoc-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-sitedoc-primary" />
          {t("flyt.duHarBallenMerke", { merke: t(ledd[aktivtIndex].ansvarsmerkeKey) })}
        </span>
      )}
    </div>
  );
}
