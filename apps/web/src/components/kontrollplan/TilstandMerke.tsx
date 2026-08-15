"use client";

import { useTranslation } from "react-i18next";
import { OVER_FRIST_KANT, type TilstandVisning } from "@/lib/kontrollplanFremdrift";

/**
 * Print-sikkert tilstandsmerke for et kontrollpunkt (Leveranse 2).
 *
 * To akser, aldri slått sammen:
 *  - Form: fylt sirkel = arbeid startet · ring = ikke startet. Formen bærer «startet»-
 *    aksen UTEN farge, så tilstanden kan leses i sort/hvitt (sluttrapporten printes).
 *  - Farge: haster det (rød/amber/blå/grønn/grå). Skjerm-signal.
 *  - M1: rød kant (overFrist) = ortogonal hastesignal-modifikator; blått fyll + rød kant
 *    = startet OG forfalt. Kanten er form (ikke bevegelse) → print- og reduced-motion-trygg.
 * Etiketten skiller også «Uten frist» fra «Planlagt» (samme grå/ring, ulik tekst).
 */
export function TilstandMerke({ visning }: { visning: TilstandVisning }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5" title={t(visning.labelKey)}>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{
          backgroundColor: visning.fylt ? visning.farge : "transparent",
          border: `2px solid ${visning.overFrist ? OVER_FRIST_KANT : visning.farge}`,
        }}
      />
      <span className="text-xs font-medium text-gray-700">{t(visning.labelKey)}</span>
    </span>
  );
}
