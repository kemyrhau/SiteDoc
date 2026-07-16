"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { grupperMedOverskrift } from "@sitedoc/shared";
import type { RapportObjekt } from "./typer";

/**
 * Kollapsbare heading-seksjoner i sjekkliste-/oppgave-utfylling (fase M-3a del 2,
 * pkt 2). Grupperer den flate objektlista på rot-headings (delt logikk i
 * `@sitedoc/shared`), UTEN datamodell-endring. Felter før første heading vises
 * ugruppert. `render` gjenbruker sidens eksisterende per-objekt-rendring.
 *
 * Print-trygt: kollapset kropp mountes fortsatt (`hidden print:flex`) så
 * «Skriv ut» / leseModus aldri mister skjult innhold.
 */
export function UtfyllingSeksjoner({
  objekter,
  render,
}: {
  objekter: RapportObjekt[];
  render: (objekt: RapportObjekt) => ReactNode;
}) {
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
        return (
          <div key={id} className="overflow-hidden rounded-lg border border-gray-200 print-no-break">
            <button
              type="button"
              onClick={() => veksle(id)}
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 print:bg-white"
            >
              <span className="text-base font-semibold text-gray-900">
                {seksjon.overskrift.label}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-gray-500 transition-transform print:hidden ${
                  kollapset ? "-rotate-90" : ""
                }`}
              />
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
