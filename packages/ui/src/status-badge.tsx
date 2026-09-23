import { Badge } from "./badge";
import { useTranslation } from "react-i18next";
import { noeytralEtikett } from "@sitedoc/shared";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

/**
 * Statuser UTENFOR dokumentflyt-modellen — `noeytralEtikett` dekker dem ikke, så
 * de bærer sin egen etikett + variant her. Dokumentstatusene (draft/sent/received/
 * in_progress/responded/approved/dismissed/closed/cancelled) utledes derimot fra
 * `noeytralEtikett`, så web og mobil ikke kan drifte (designnotat-statusfarger-
 * paritet § 8; Runde-2-«Mottatt» for `in_progress` er overstyrt — nå «Under arbeid»
 * for alle, `responded` er blå i lista). `rejected` er legacy (F3 merget inn i
 * `in_progress`; `dismissed` er kanonisk «Avvist») men beholdes defensivt.
 */
const IKKE_FLYT: Record<string, { i18n: string; variant: BadgeVariant }> = {
  active: { i18n: "status.aktiv", variant: "success" },
  archived: { i18n: "status.arkivert", variant: "default" },
  completed: { i18n: "status.ferdig", variant: "success" },
  rejected: { i18n: "status.avvist", variant: "danger" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  lestAvMottakerVed?: Date | string | null;
  /**
   * Perspektiv-avhengig etikett + farge, ferdig utledet av kallstedet via
   * `perspektivEtikett` (@sitedoc/shared). Valg B (A-3b): logikken bor i shared
   * — komponenten er presentasjonell. Når satt, overstyrer det det flate
   * status-oppslaget. `etikettKey` er en i18n-nøkkel; komponenten kaller `t()`.
   */
  perspektiv?: { etikettKey: string; variant: BadgeVariant };
}

export function StatusBadge({ status, className, lestAvMottakerVed, perspektiv }: StatusBadgeProps) {
  const { t } = useTranslation();

  // «sent» + mottaker har lest → «Lest» med tooltip. Dette er kontekst-frøet
  // A-3b utvider, ikke kobler fra: det fyrer FØR perspektiv-grenen fordi
  // perspektivEtikett aldri får lest-tidspunktet inn. «Lest som perspektiv-
  // tilstand» er rutet til fabel som egen designsak — ikke lagt inn her.
  if (status === "sent" && lestAvMottakerVed != null) {
    const dato = new Date(lestAvMottakerVed).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <Badge variant="primary" className={className} title={dato} data-testid="status-badge" data-status={status}>
        {t("status.lest")}
      </Badge>
    );
  }

  // A-3b: perspektiv-avhengig etikett (kallstedet har kalt perspektivEtikett).
  if (perspektiv) {
    return (
      <Badge variant={perspektiv.variant} className={className} data-testid="status-badge" data-status={status}>
        {t(perspektiv.etikettKey)}
      </Badge>
    );
  }

  const egen = IKKE_FLYT[status];
  const { etikettKey, variant } = egen
    ? { etikettKey: egen.i18n, variant: egen.variant }
    : noeytralEtikett(status);
  return (
    <Badge variant={variant} className={className} data-testid="status-badge" data-status={status}>
      {t(etikettKey)}
    </Badge>
  );
}
