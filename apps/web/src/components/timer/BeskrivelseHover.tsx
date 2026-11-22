"use client";

import type { ReactElement } from "react";
import { Tooltip } from "@sitedoc/ui";

/** Del 3 (w10a A6, plan § 4.9): tekstene på jobbens timerader, hver én gang, etter klokkeslett. */
export function jobbensBeskrivelser(rader: readonly { fraTid: string | null; beskrivelse?: string | null }[]): string[] {
  const sortert = [...rader].sort((a, b) => (a.fraTid ?? "").localeCompare(b.fraTid ?? ""));
  return [...new Set(sortert.map((r) => r.beskrivelse?.trim() ?? "").filter(Boolean))];
}

/**
 * O6 (§ 8.22 punkt 2): beskrivelsene («Hva gjorde du?») på et lukket kort eller en jobbrad,
 * vist i en hover-boks (Tooltip v2), så de kan leses uten å åpne kortet. Teksten er den samme
 * som står i kortet; ingenting nytt hentes. Ingen beskrivelse → ingen hover (Tooltip `deaktivert`,
 * så triggeren ikke monteres på nytt når kortet åpnes og lukkes).
 * Berøring: Tooltip v2 viser boksen ved trykk og lukker ved trykk utenfor.
 */
export function BeskrivelseHover({
  beskrivelser,
  children,
  wrapperClassName = "relative flex w-full",
}: {
  beskrivelser: readonly string[];
  children: ReactElement;
  wrapperClassName?: string;
}) {
  return (
    <Tooltip
      tekst=""
      deaktivert={beskrivelser.length === 0}
      side="bottom"
      maxBreddeKlasse="max-w-[360px]"
      wrapperClassName={wrapperClassName}
      innhold={
        <span data-beskrivelse-hover="" className="block space-y-1">
          {beskrivelser.map((b, i) => (
            <span key={i} className="block whitespace-pre-wrap">
              {b}
            </span>
          ))}
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}
