// ============================================================================
//  Timer-status — ÉN kilde for farge (BadgeVariant) OG ord (etikettKey).
//  (Del 7, mobil↔web-konsistens.)
//
//  Samme form som `noeytralEtikett` (perspektivEtikett.ts) — dokumentflytens
//  paritet-mekanisme. Fire timer-komponenter (web+mobil × sedel+rad) og
//  lønnseksporten leste før hver sin hardkodede tabell; de leser nå denne, så
//  farge og ord ikke kan drifte mellom flatene.
//
//  To vokabularer, ingen overlapp:
//   · sedel-status (DailySheet.status):  draft · sent · returned · accepted
//   · rad-status  (attestertStatus):     pending · attestert · returnert
//
//  Fargemapping (orkestrator-vedtak, belegg = dokumentflytens palett):
//   draft/utkast→default · sent/sendt→primary · returned/returnert→danger
//   (nærmeste slektning `dismissed`→danger; amber finnes IKKE i paletten) ·
//   accepted/attestert→success (huset: `approved`→success).
//
//  🔴 «Attestering ≠ Godkjenning» (CLAUDE.md, låst 2026-04-26): accepted heter
//  «Attestert» på BEGGE flater. Webs gamle «Godkjent» var den andre modulens
//  begrep på timer-flaten — rettet i `timer.statusType.accepted`.
// ============================================================================

import type { BadgeVariant } from "./perspektivEtikett";

const TIMER_STATUS: Record<string, { etikettKey: string; variant: BadgeVariant }> = {
  // Sedel-status (DailySheet.status)
  draft: { etikettKey: "timer.statusType.draft", variant: "default" },
  sent: { etikettKey: "timer.statusType.sent", variant: "primary" },
  returned: { etikettKey: "timer.statusType.returned", variant: "danger" },
  accepted: { etikettKey: "timer.statusType.accepted", variant: "success" },
  // Rad-status (attestertStatus) — deler radStatus.*-navnerommet på tvers av
  // flater (allerede felles) så sedel og rad viser samme ord for samme tilstand.
  pending: { etikettKey: "timer.attestering.radStatus.pending", variant: "default" },
  attestert: { etikettKey: "timer.attestering.radStatus.attestert", variant: "success" },
  returnert: { etikettKey: "timer.attestering.radStatus.returnert", variant: "danger" },
};

/**
 * Farge + i18n-nøkkel for en timer-status (sedel ELLER rad). SAMME fallback som
 * `noeytralEtikett`: ukjent status → status-strengen selv + `default` (skjul
 * aldri en verdi vi ikke kjenner — gjelder også `erstattet` og fremtidige).
 * Rad-badgene normaliserer null → "pending" FØR kallet (radens hvilende
 * tilstand), så tom rad-status gir «Venter», ikke rå streng.
 */
export function timerStatusEtikett(
  status: string,
): { etikettKey: string; variant: BadgeVariant } {
  const celle = TIMER_STATUS[status];
  return celle
    ? { etikettKey: celle.etikettKey, variant: celle.variant }
    : { etikettKey: status, variant: "default" };
}
