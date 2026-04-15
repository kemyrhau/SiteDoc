/**
 * Delte konstanter for PDF-generering.
 */

export const STATUS_TEKST: Record<string, string> = {
  draft: "Utkast",
  sent: "Sendt",
  submitted: "Innsendt",
  received: "Mottatt",
  in_progress: "Under behandling",
  responded: "Besvart",
  completed: "Ferdig",
  approved: "Godkjent",
  rejected: "Avvist",
  closed: "Lukket",
  cancelled: "Avbrutt",
};

export const STATUS_FARGE: Record<string, string> = {
  draft: "background:#e5e7eb;color:#374151;",
  sent: "background:#dbeafe;color:#1e40af;",
  submitted: "background:#dbeafe;color:#1e40af;",
  received: "background:#dbeafe;color:#1e40af;",
  in_progress: "background:#fef3c7;color:#92400e;",
  responded: "background:#dbeafe;color:#1e40af;",
  completed: "background:#d1fae5;color:#065f46;",
  approved: "background:#d1fae5;color:#065f46;",
  rejected: "background:#fee2e2;color:#991b1b;",
  closed: "background:#e5e7eb;color:#374151;",
  cancelled: "background:#f3f4f6;color:#6b7280;",
};

export const TRAFIKKLYS: Record<string, { label: string; farge: string }> = {
  green: { label: "Godkjent", farge: "#10b981" },
  yellow: { label: "Anmerkning", farge: "#f59e0b" },
  red: { label: "Avvik", farge: "#ef4444" },
  gray: { label: "Ikke relevant", farge: "#9ca3af" },
};

export const PRIORITETS_TEKST: Record<string, string> = {
  low: "Lav",
  medium: "Medium",
  high: "Høy",
  critical: "Kritisk",
};
