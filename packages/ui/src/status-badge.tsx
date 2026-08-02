import { Badge } from "./badge";
import { useTranslation } from "react-i18next";

const STATUS_I18N: Record<string, string> = {
  draft: "status.utkast",
  sent: "status.sendt",
  received: "status.mottatt",
  // Runde-2 (2026-08-02, Q1=A): `in_progress` er kollapset — vises som «Mottatt» (received), også i
  // tidslinjeloggen (rå DocumentTransfer.toStatus). Ingen «Under arbeid» noe sted; loggen bruker
  // samme avledningsvokabular som statusen. «Venter på»-nyansen leveres seer-relativt av chippen.
  in_progress: "status.mottatt",
  responded: "status.besvart",
  approved: "status.godkjent",
  rejected: "status.avvist",
  closed: "status.lukket",
  cancelled: "status.avbrutt",
  active: "status.aktiv",
  archived: "status.arkivert",
  completed: "status.ferdig",
};

const statusVariant: Record<string, "default" | "primary" | "success" | "warning" | "danger"> = {
  draft: "default",
  sent: "primary",
  received: "primary",
  in_progress: "primary", // Runde-2: kollapset til received-farge (samme «Mottatt»-vokabular)
  responded: "warning",
  approved: "success",
  rejected: "danger",
  closed: "default",
  cancelled: "danger",
  active: "success",
  archived: "default",
  completed: "success",
};

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger";

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

  const variant = statusVariant[status] ?? "default";
  const i18nKey = STATUS_I18N[status];
  const label = i18nKey ? t(i18nKey) : status;
  return (
    <Badge variant={variant} className={className} data-testid="status-badge" data-status={status}>
      {label}
    </Badge>
  );
}
