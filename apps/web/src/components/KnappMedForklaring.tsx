"use client";

import type { ReactElement } from "react";
import { Tooltip } from "@sitedoc/ui";

/**
 * Gir en disabled knapp en forklaring på HVORFOR den er sperret — så en tom
 * knapp aldri bare står der med et «stopptegn» og ingen grunn.
 *
 * 🔴 To fallgruver, løst ett sted:
 *  1. `title=` er forbudt (browserstyrt ~1 s forsinkelse — DeaktiverKnapp.tsx:9).
 *     Vi bruker `@sitedoc/ui` sin `Tooltip`, aldri `title=`.
 *  2. Musehendelse-fella: et `disabled` element fyrer ikke egne musehendelser.
 *     `Tooltip` legger imidlertid lytterne på sin egen wrapper-`<span>`, ikke på
 *     barnet — og et wrapper-span rundt en disabled knapp MOTTAR `mouseenter`/
 *     `mouseleave` i Chrome (målt 2026-09-17, ekte hover: enter=1, leave=1).
 *     Derfor er det NOK å wrappe knappen; `pointer-events:none` på barnet skal
 *     IKKE settes — det bryter tvert imot wrapperens hover (også målt).
 *
 * Vises KUN når `sperret` er sann (påkrevd input mangler). Er knappen disabled av
 * en annen grunn (f.eks. mutasjonen kjører), send `sperret={false}` — da er
 * spinneren/`loading` alt signalet, og ingen tooltip skal dukke opp.
 */
export function KnappMedForklaring({
  sperret,
  forklaring,
  children,
  wrapperKlasse,
}: {
  sperret: boolean;
  forklaring: string;
  children: ReactElement;
  /**
   * Valgfri wrapper-klasse for Tooltip-spanet. Default (`relative inline-flex`)
   * passer innholdsbredde-knapper. Full-bredde-knapper (`w-full`) sender
   * `"relative flex w-full"` så knappen ikke krymper når den er sperret.
   */
  wrapperKlasse?: string;
}) {
  if (!sperret) return children;
  return (
    <Tooltip tekst={forklaring} side="top" wrapperClassName={wrapperKlasse}>
      {children}
    </Tooltip>
  );
}
