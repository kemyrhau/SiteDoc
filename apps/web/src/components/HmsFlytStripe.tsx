"use client";

// HMS-flyt-stripe (Spor 2 / 5c): fast 3-stegs livsløp for HMS-saker —
// Meldt → Hos {behandler-ledd} → Lukket. Erstatter den generelle FlytIndikatoren
// på HMS-detaljen (som ble skjult i F1b fordi null-medlem-melderboksen viste «?»).
//
// Samme perspektiv-vokabular som HMS-lista («Hos …»). Rent visning: aktivt steg
// utledes av status, ingen ball-logikk her (den bor i hms-hos.ts for lista).

import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

interface HmsFlytStripeProps {
  status: string;
  /** Behandler-leddets visningsnavn (siste flyt-ledd). Fallback: «HMS-ansvarlige». */
  behandlerNavn?: string | null;
}

type StegTilstand = "ferdig" | "aktiv" | "kommende";

export function HmsFlytStripe({ status, behandlerNavn }: HmsFlytStripeProps) {
  const { t } = useTranslation();

  const erUtkast = status === "draft";
  const erLukket = status === "closed" || status === "approved" || status === "cancelled";
  // Åpen behandling = sendt, ikke terminal (received/responded).
  const erÅpen = !erUtkast && !erLukket;

  const steg: { nøkkel: string; etikett: string; tilstand: StegTilstand }[] = [
    {
      nøkkel: "meldt",
      etikett: t("hms.stripe.meldt"),
      tilstand: erUtkast ? "aktiv" : "ferdig",
    },
    {
      nøkkel: "behandler",
      etikett: t("hms.hos", { navn: behandlerNavn || t("hms.segment.behandler") }),
      tilstand: erÅpen ? "aktiv" : erLukket ? "ferdig" : "kommende",
    },
    {
      nøkkel: "lukket",
      etikett: t("hms.stripe.lukket"),
      tilstand: erLukket ? "aktiv" : "kommende",
    },
  ];

  return (
    <div className="flex items-center gap-1.5" aria-label={t("hms.stripe.ariaLabel")}>
      {steg.map((s, i) => (
        <div key={s.nøkkel} className="flex items-center gap-1.5">
          {i > 0 && <div className="h-px w-4 shrink-0 bg-gray-300 sm:w-6" />}
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium " +
              (s.tilstand === "aktiv"
                ? "bg-sitedoc-primary text-white"
                : s.tilstand === "ferdig"
                  ? "bg-blue-50 text-sitedoc-primary"
                  : "bg-gray-100 text-gray-400")
            }
          >
            {s.tilstand === "ferdig" && <Check size={12} className="shrink-0" />}
            {s.etikett}
          </span>
        </div>
      ))}
    </div>
  );
}
