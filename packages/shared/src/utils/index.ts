/**
 * Generer et unikt prosjektnummer med prefiks og sekvensielt nummer.
 * Format: SF-YYYYMMDD-XXXX (f.eks. SF-20260228-0001)
 */
export function generateProjectNumber(sequentialNumber: number): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(sequentialNumber).padStart(4, "0");
  return `SF-${date}-${seq}`;
}

/**
 * Sjekk om en dokumentstatus-overgang er gyldig.
 */
export function isValidStatusTransition(
  current: string,
  next: string,
): boolean {
  const validTransitions: Record<string, string[]> = {
    draft: ["sent"],
    sent: ["received"],
    received: ["in_progress"],
    in_progress: ["responded"],
    responded: ["approved", "rejected"],
    approved: ["closed"],
    rejected: ["in_progress", "closed"],
    closed: [],
  };

  return validTransitions[current]?.includes(next) ?? false;
}
