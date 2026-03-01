import { Badge } from "./badge";

const statusKonfig: Record<string, { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }> = {
  draft: { label: "Utkast", variant: "default" },
  sent: { label: "Sendt", variant: "primary" },
  received: { label: "Mottatt", variant: "primary" },
  in_progress: { label: "Under arbeid", variant: "warning" },
  responded: { label: "Besvart", variant: "warning" },
  approved: { label: "Godkjent", variant: "success" },
  rejected: { label: "Avvist", variant: "danger" },
  closed: { label: "Lukket", variant: "default" },
  active: { label: "Aktiv", variant: "success" },
  archived: { label: "Arkivert", variant: "default" },
  completed: { label: "Fullført", variant: "success" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusKonfig[status] ?? { label: status, variant: "default" as const };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
