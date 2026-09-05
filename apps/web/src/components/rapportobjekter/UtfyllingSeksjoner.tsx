"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, AlertTriangle } from "lucide-react";
import { grupperMedOverskrift, beregnSeksjonUtfylling } from "@sitedoc/shared";
import type { RapportObjekt } from "./typer";

/**
 * Per-felt utfyllingsoppslag fra siden: er feltet synlig (betinget synlighet) og har det en
 * reell verdi? `null` → feltet skal ikke telles i det hele tatt (repeater-barn). Sidene har
 * allerede `erSynlig` + `hentFeltVerdi` i scope, og typefiltreringen («hva er et kontrollpunkt»)
 * eier `beregnSeksjonUtfylling` i `@sitedoc/shared` — se den for detaljer.
 */
export type FeltStatusOppslag = (
  objekt: RapportObjekt,
) => { synlig: boolean; harVerdi: boolean } | null;

/**
 * Kollapsbare heading-seksjoner i sjekkliste-/oppgave-utfylling (fase M-3a del 2,
 * pkt 2). Grupperer den flate objektlista på rot-headings (delt logikk i
 * `@sitedoc/shared`), UTEN datamodell-endring. Felter før første heading vises
 * ugruppert. `render` gjenbruker sidens eksisterende per-objekt-rendring.
 *
 * Print-trygt: kollapset kropp mountes fortsatt (`hidden print:flex`) så
 * «Skriv ut» / leseModus aldri mister skjult innhold.
 *
 * Utfyllingsstatus (Kenneth-gatet 05.09): headeren viser «X av Y utfylt» med ✓/⚠ per seksjon.
 * En kollapset seksjon kan ellers bli glemt og la uutfylte kontrollpunkter stå i et dokument
 * som ser ferdig ut. Telleren gjelder KUN feltverdi (kommentar/vedlegg er tilbehør, teller ikke)
 * og vises også i leseModus/print — det er dokumentinformasjon, ikke redigeringshjelp.
 */
export function UtfyllingSeksjoner({
  objekter,
  render,
  feltStatus,
}: {
  objekter: RapportObjekt[];
  render: (objekt: RapportObjekt) => ReactNode;
  feltStatus: FeltStatusOppslag;
}) {
  const { t } = useTranslation();
  const seksjoner = grupperMedOverskrift(objekter);
  const [kollapsede, setKollapsede] = useState<Set<string>>(new Set());

  // Ingen rot-headings → behold ren flat visning uten seksjons-krom.
  if (!seksjoner.some((s) => s.overskrift !== null)) {
    return <div className="flex flex-col gap-3">{objekter.map(render)}</div>;
  }

  function veksle(id: string) {
    setKollapsede((forrige) => {
      const neste = new Set(forrige);
      if (neste.has(id)) neste.delete(id);
      else neste.add(id);
      return neste;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {seksjoner.map((seksjon, i) => {
        if (!seksjon.overskrift) {
          return (
            <div key={`ledende-${i}`} className="flex flex-col gap-3">
              {seksjon.felter.map(render)}
            </div>
          );
        }
        const id = seksjon.overskrift.id;
        const kollapset = kollapsede.has(id);
        const status = beregnSeksjonUtfylling(seksjon.felter, feltStatus);
        return (
          <div key={id} className="overflow-hidden rounded-lg border border-gray-200 print-no-break">
            <button
              type="button"
              onClick={() => veksle(id)}
              className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 print:bg-white"
            >
              <span className="text-base font-semibold text-gray-900">
                {seksjon.overskrift.label}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {status.tilstand !== "tom" && (
                  <SeksjonStatusMerke status={status} t={t} />
                )}
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-gray-500 transition-transform print:hidden ${
                    kollapset ? "-rotate-90" : ""
                  }`}
                />
              </span>
            </button>
            <div
              className={`flex-col gap-3 px-4 py-3 ${kollapset ? "hidden print:flex" : "flex"}`}
            >
              {seksjon.felter.map(render)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Høyrestilt «X av Y utfylt» + ✓/⚠. ⚠ KUN ved urørt — delvis bærer signalet i tallet alene. */
function SeksjonStatusMerke({
  status,
  t,
}: {
  status: { utfylt: number; totalt: number; tilstand: "urort" | "delvis" | "komplett" | "tom" };
  t: (nokkel: string, opts?: Record<string, unknown>) => string;
}) {
  const { utfylt, totalt, tilstand } = status;
  if (tilstand === "komplett") {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-emerald-700">
        {t("seksjonsstatus.utfylt", { utfylt, totalt })}
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
      </span>
    );
  }
  if (tilstand === "urort") {
    return (
      <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
        {t("seksjonsstatus.urort", { utfylt, totalt })}
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="text-sm font-medium text-gray-600">
      {t("seksjonsstatus.utfylt", { utfylt, totalt })}
    </span>
  );
}
