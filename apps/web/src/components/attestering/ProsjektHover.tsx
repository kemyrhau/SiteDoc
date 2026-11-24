"use client";

import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@sitedoc/ui";

/** Det hoveren viser om én jobb (A2, plan § 4.17 punkt 5). */
export interface ProsjektHoverJobb {
  nokkel: string;
  prosjekt: string;
  prosjektnummer: string;
  byggeplass: string | null;
  underprosjekt: string | null;
  /** «Hva gjorde du?» — jobbens tekster, hver én gang, etter klokkeslett. */
  beskrivelser: readonly string[];
}

/**
 * A2 (plan § 4.17 punkt 5): hover på prosjektnavnet i dags- og jobbraden. Nummer og navn,
 * byggeplass, underprosjekt og «Hva gjorde du?»; et felt uten verdi står ikke. Flere jobber
 * (teksten «N jobber» i dagsraden): én blokk pr. jobb. Erstatter hoveren på hele raden (O6).
 */
export function ProsjektHover({ jobber, children }: { jobber: readonly ProsjektHoverJobb[]; children: ReactElement }) {
  const { t } = useTranslation();
  const felt = (etikett: string, verdi: string) => (
    <span className="block">
      <span className="text-gray-300">{etikett}: </span>
      {verdi}
    </span>
  );
  return (
    <Tooltip
      tekst=""
      deaktivert={jobber.length === 0}
      side="bottom"
      delayMs={150}
      maxBreddeKlasse="max-w-[360px]"
      wrapperClassName="relative block min-w-0"
      innhold={
        <span data-prosjekt-hover="" className="block space-y-2">
          {jobber.map((j) => (
            <span key={j.nokkel} data-prosjekt-hover-jobb="" className="block space-y-0.5">
              <span className="block font-semibold">{[j.prosjektnummer, j.prosjekt].filter(Boolean).join(" · ")}</span>
              {j.byggeplass && felt(t("timer.felt.byggeplass"), j.byggeplass)}
              {j.underprosjekt && felt(t("timer.felt.underprosjekt"), j.underprosjekt)}
              {j.beskrivelser.length > 0 && (
                <span className="block">
                  <span className="text-gray-300">{t("timer.felt.radBeskrivelse")} </span>
                  {j.beskrivelser.map((b, i) => (
                    <span key={i} data-beskrivelse="" className="block whitespace-pre-wrap">
                      {b}
                    </span>
                  ))}
                </span>
              )}
            </span>
          ))}
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}
