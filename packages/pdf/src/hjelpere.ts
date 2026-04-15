/**
 * Delte hjelpefunksjoner for PDF-generering.
 * Null avhengigheter — kun TypeScript-strenger.
 */

/** HTML-escape for sikker innbygging i HTML-strenger */
export function esc(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Normaliser opsjon — støtter både "streng" og {value,label}-format */
export function normaliserOpsjon(raw: unknown): { value: string; label: string } {
  if (typeof raw === "string") return { value: raw, label: raw };
  if (raw && typeof raw === "object" && "value" in raw) {
    const o = raw as { value: string; label?: string };
    return { value: o.value, label: o.label ?? o.value };
  }
  return { value: String(raw), label: String(raw) };
}

/** Formater dato på norsk (f.eks. "3. april 2026") */
export function formaterDato(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/** Formater dato+tid på norsk (f.eks. "3. apr. 2026, 14:30") */
export function formaterDatoTid(v: unknown): string {
  if (typeof v !== "string") return "";
  try {
    return new Date(v).toLocaleString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

/** Formater dato+tid kort (f.eks. "03.04.2026 14:30") */
export function formaterDatoTidKort(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(String(v)).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(v);
  }
}

/** Formater dato kort (f.eks. "03.04.2026") */
export function formaterDatoKort(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(String(v)).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/** Gjør relativ bilde-URL om til full URL basert på bildeBaseUrl */
export function fullBildeUrl(url: string, bildeBaseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return `${bildeBaseUrl}${url}`;
  if (url.startsWith("/")) return `${bildeBaseUrl}${url}`;
  return url;
}

/** Formater sjekkliste/oppgave-nummer med prefiks (f.eks. "SJK-001") */
export function formaterNummer(nummer: number | null | undefined, prefix: string | null | undefined): string | null {
  if (nummer == null) return null;
  const pad = String(nummer).padStart(3, "0");
  return prefix ? `${prefix}-${pad}` : pad;
}
