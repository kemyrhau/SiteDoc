"use client";

/**
 * Flyt-posisjon i dokument-headeren (evolusjon 2026-07-26, fabel-design).
 *
 * Kompakt ledd-rad som viser HVOR i flyten dokumentet står — ikke bare hvem som
 * har ballen. Rendres DYNAMISK fra dokumentets faktiske flyt (`byggLedd` grupperer
 * medlemmer på `steg`): 2 bokser i en 2-ledds flyt, 4 i en 4-ledds. Aldri hardkodet.
 *
 * - Passert ledd: hvit boks, ✓, dempet.
 * - Aktivt ledd (ballen): fylt blå boks, ● + ball-holderens navn.
 * - Kommende ledd: stiplet ramme, dempet.
 * - Rolle-etikett i caps over navnet i hver boks.
 * - Siste-ledd: deaktivert «Send →» + hover + fotnote med de reelle utveiene
 *   (svar på Kenneths test-observasjon: Send går ikke, men hvorfor?).
 * - 5+ ledd: fjerne ledd kollapses til «+N»-pille (aktivt ± 1 vises).
 * - Medlems-hover: boksen viser ETT navn, hover ramser opp alle medlemmene.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { hentStatusHandlinger } from "@sitedoc/shared";
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

interface FlytIndikatorProps {
  medlemmer: FlytMedlem[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  status: string;
  bestillerUserId?: string;
  /** Kompakt modus: vis kun aktiv boks + naboer, ekspandér ved tap. */
  kompakt?: boolean;
  /**
   * Detalj-header (variant C): vis deaktivert «Send →» + utveier-fotnote ved siste ledd.
   * Utelates i liste-/tabellceller for å holde radene lave (kun ledd-raden der).
   */
  visUtveier?: boolean;
}

/** i18n-nøkkel for en rolle-etikett; tom streng hvis ukjent rolle. */
function rolleNoekkel(rolle: string): string | null {
  const kjent = new Set(["registrator", "bestiller", "utforer", "godkjenner"]);
  return kjent.has(rolle) ? `dokumentflyt.${rolle}` : null;
}

function forkort(tekst: string, maks: number): string {
  return tekst.length > maks ? tekst.slice(0, maks - 1) + "…" : tekst;
}

/** Hent flyt-tekst for filtrering/sortering i tabeller. */
export function hentFlytLedd(
  medlemmer: FlytMedlem[],
  recipientUserId?: string | null,
  recipientGroupId?: string | null,
  status?: string,
  bestillerUserId?: string,
): string {
  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return "";
  const aktivtIndex = finnAktivtIndex(ledd, status ?? "", recipientUserId, recipientGroupId, bestillerUserId);
  if (aktivtIndex === -1) return "";
  return ledd[aktivtIndex]?.aktivNavn ?? "";
}

export function FlytIndikator({ medlemmer, recipientUserId, recipientGroupId, status, bestillerUserId, kompakt, visUtveier }: FlytIndikatorProps) {
  const { t } = useTranslation();
  const [ekspandert, setEkspandert] = useState(false);

  if (!medlemmer || medlemmer.length === 0) {
    return <span className="text-gray-300">—</span>;
  }

  const ledd = byggLedd(medlemmer);
  if (ledd.length === 0) return <span className="text-gray-300">—</span>;

  const aktivtIndex = finnAktivtIndex(ledd, status, recipientUserId, recipientGroupId, bestillerUserId);

  // Kollaps: kompakt (mobil) fra >3 ledd, ellers variant D-terskel (5+). Aktiv ± 1 vises.
  const kollapsTerskel = kompakt ? 3 : 4;
  const skalKollapse = !ekspandert && ledd.length > kollapsTerskel;
  const visbareLedd = skalKollapse
    ? filtrerNaboer(ledd, aktivtIndex)
    : ledd.map((l, i) => ({ ledd: l, originalIndex: i }));

  const skjulteLedd = skalKollapse
    ? ledd.filter((_, i) => !visbareLedd.some((v) => v.originalIndex === i))
    : [];

  // Siste-ledd (variant C): dokumentet står på ytterste ledd og kan ikke sendes videre.
  // Kun i detalj-header (visUtveier) — utelates i liste-/tabellceller. Krever FLERE
  // ledd: en enkelt-ledds flyt har ingen «neste mottaker» å mangle.
  const erSisteBoks = visUtveier && aktivtIndex >= 0 && ledd.length > 1 && aktivtIndex === ledd.length - 1;

  // Reelle utveier fra denne statusen (statusmaskin-lovlige), minus fram-sending
  // (sent/forwarded finnes ikke ved siste ledd — det er nettopp derfor Send er av).
  const utveier = erSisteBoks
    ? [
        ...new Map(
          hentStatusHandlinger(status)
            .filter((h) => h.nyStatus !== "sent" && h.nyStatus !== "forwarded")
            .map((h) => [h.tekstNoekkel, t(h.tekstNoekkel)]),
        ).values(),
      ]
    : [];

  const boksHover = (l: Ledd): string =>
    l.medlemmer
      .map((m) => {
        const rn = rolleNoekkel(m.rolle);
        return rn ? `${m.navn} (${t(rn)})` : m.navn;
      })
      .join(" · ");

  return (
    <div className="flex flex-col gap-1 text-[11px] leading-none">
      <div
        className={`flex items-center gap-0.5 whitespace-nowrap overflow-hidden ${kompakt ? "cursor-pointer" : "cursor-default"}`}
        onClick={kompakt ? () => setEkspandert((e) => !e) : undefined}
        title={kompakt && skalKollapse ? t("flytindikator.visHele") : undefined}
      >
        {visbareLedd.map((item, visIdx) => {
          const erAktiv = item.originalIndex === aktivtIndex;
          const erPassert = aktivtIndex === -1 || item.originalIndex < aktivtIndex;
          const visningstekst = erAktiv ? item.ledd.aktivNavn : item.ledd.navn;
          const rn = rolleNoekkel(item.ledd.rolle);

          const boks = (
            <span
              className={`inline-flex flex-col gap-0.5 rounded px-1.5 py-1 ${
                erAktiv
                  ? "bg-sitedoc-primary text-white font-medium"
                  : erPassert
                    ? "border border-gray-200 bg-white text-gray-400"
                    : "border border-dashed border-gray-300 bg-white text-gray-400"
              }`}
            >
              {rn && (
                <span className={`text-[9px] uppercase tracking-wide leading-none ${erAktiv ? "text-blue-100" : "text-gray-400"}`}>
                  {t(rn)}
                </span>
              )}
              <span className="flex items-center gap-0.5 leading-none">
                {erAktiv && <span>●</span>}
                {erPassert && <span className="text-gray-400">✓</span>}
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

        {/* Siste-ledd: deaktivert «Send →» — forklarer hvorfor dokumentet ikke går videre. */}
        {erSisteBoks && (
          <span className="flex items-center gap-0.5">
            <span className="text-gray-300">→</span>
            <Tooltip tekst={t("flytindikator.sisteLeddHover")} side="top">
              <span className="inline-flex cursor-not-allowed items-center gap-0.5 rounded border border-dashed border-gray-200 px-1.5 py-1 text-gray-300">
                {t("handling.send")} →
              </span>
            </Tooltip>
          </span>
        )}
      </div>

      {/* Fotnote: de reelle utveiene ved siste ledd. */}
      {erSisteBoks && utveier.length > 0 && (
        <span className="text-[10px] text-gray-400">
          {t("flytindikator.utveier")} {utveier.join(" · ")}
        </span>
      )}
    </div>
  );
}
