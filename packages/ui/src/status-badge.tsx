import { Badge } from "./badge";
import { useTranslation } from "react-i18next";

const STATUS_I18N: Record<string, string> = {
  draft: "status.utkast",
  sent: "status.sendt",
  received: "status.mottatt",
  in_progress: "status.underArbeid",
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
  in_progress: "warning",
  responded: "warning",
  approved: "success",
  rejected: "danger",
  closed: "default",
  cancelled: "danger",
  active: "success",
  archived: "default",
  completed: "success",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  lestAvMottakerVed?: Date | string | null;
}

export function StatusBadge({ status, className, lestAvMottakerVed }: StatusBadgeProps) {
  const { t } = useTranslation();

  // «sent» + mottaker har lest → vis «Lest» med tooltip
  if (status === "sent" && lestAvMottakerVed != null) {
    const dato = new Date(lestAvMottakerVed).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <Badge variant="primary" className={className} title={dato}>
        {t("status.lest")}
      </Badge>
    );
  }

  const variant = statusVariant[status] ?? "default";
  const i18nKey = STATUS_I18N[status];
  const label = i18nKey ? t(i18nKey) : status;
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
