/**
 * HM1 tillegg A (Kenneth 2026-11-23): hvilke maler «Meld HMS» tilbyr — web
 * (`hms/page.tsx`) og mobil (`HmsMalVelger.tsx`) bruker samme regel.
 *
 * `domain === "hms"` er HMS-markøren, ikke `category`. Standardmodulen lager
 * HMS-avvik/RUH som `category: "oppgave"` og SJA som `category: "sjekkliste"`;
 * eldre maler og «Ny HMS-mal» har `category: "hms"`. Begge skal kunne meldes.
 * Dokumenttypen avgjøres av subdomain (avvik/ruh → oppgave, sja → sjekkliste).
 */
export type MeldHmsSubdomain = "avvik" | "sja" | "ruh";

export function erMeldbarHmsMal(mal: {
  domain?: string | null;
  subdomain?: string | null;
}): boolean {
  return (
    mal.domain === "hms" &&
    (mal.subdomain === "avvik" || mal.subdomain === "sja" || mal.subdomain === "ruh")
  );
}
