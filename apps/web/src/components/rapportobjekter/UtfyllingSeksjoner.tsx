"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, AlertTriangle } from "lucide-react";
import {
  grupperMedOverskrift,
  beregnSeksjonUtfylling,
  kanSlasSammen,
  nesteKollapsTilstand,
  type SeksjonTilstand,
} from "@sitedoc/shared";
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

  // Utfyllingstilstand per overskrifts-seksjon — grunnlaget for både badgen og
  // auto-kollapsen (Krav 1). Foldbarhet styres av grense-objektets config-flagg.
  const overskriftSeksjoner = seksjoner
    .filter((s) => s.overskrift !== null)
    .map((s) => ({
      id: s.overskrift!.id,
      tilstand: beregnSeksjonUtfylling(s.felter, feltStatus).tilstand,
      kanFoldes: kanSlasSammen(s.overskrift!.config),
    }));

  // Auto-kollaps (Krav 1): kantutløst på overgang til `komplett`. Ren logikk i
  // `@sitedoc/shared` (delt m/mobil); komponenten holder bare forrige tilstand
  // (ref) og `kollapsede` (state). Effekten kjører KUN når en tilstand faktisk
  // endrer seg — nøkkelen serialiserer (id, tilstand, kanFoldes).
  const forrigeTilstandRef = useRef<Map<string, SeksjonTilstand>>(new Map());
  const tilstandNøkkel = overskriftSeksjoner
    .map((s) => `${s.id}:${s.tilstand}:${s.kanFoldes ? 1 : 0}`)
    .join("|");
  useEffect(() => {
    setKollapsede((forrige) =>
      nesteKollapsTilstand(overskriftSeksjoner, forrigeTilstandRef.current, forrige),
    );
    forrigeTilstandRef.current = new Map(overskriftSeksjoner.map((s) => [s.id, s.tilstand]));
    // Kun tilstandsnøkkelen — `overskriftSeksjoner` gjenskapes hver render, men
    // effekten skal bare reagere på reelle tilstandsendringer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilstandNøkkel]);

  // Ingen rot-grenser → behold ren flat visning uten seksjons-krom.
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
        const kanFoldes = kanSlasSammen(seksjon.overskrift.config);
        const kollapset = kanFoldes && kollapsede.has(id);
        const status = beregnSeksjonUtfylling(seksjon.felter, feltStatus);
        const innhold = (
          <>
            <span className="text-base font-semibold text-gray-900">
              {seksjon.overskrift.label}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {status.tilstand !== "tom" && <SeksjonStatusMerke status={status} t={t} />}
              {kanFoldes && (
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-gray-500 transition-transform print:hidden ${
                    kollapset ? "-rotate-90" : ""
                  }`}
                />
              )}
            </span>
          </>
        );
        return (
          <div key={id} className="overflow-hidden rounded-lg border border-gray-200 print-no-break">
            {/* Ikke-foldbar (Kenneth fjernet haken): seksjon uten chevron, alltid åpen. */}
            {kanFoldes ? (
              <button
                type="button"
                onClick={() => veksle(id)}
                className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 print:bg-white"
              >
                {innhold}
              </button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left print:bg-white">
                {innhold}
              </div>
            )}
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
