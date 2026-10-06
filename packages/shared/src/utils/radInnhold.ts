/**
 * V19.9 (versjonssjekk pr. rad) — innholds-sammenligning av én timer-rad.
 *
 * Klassifiseringen (`klassifiserSyncRader`, api) avgjør «ukjent versjon» (eldre app,
 * felt mangler) på INNHOLD: likt → skriv (idempotent), ulikt → avvik. Delt, ren kilde
 * så serveren og eventuelle fremtidige lesere har ÉN definisjon av «samme rad».
 *
 * Innholdet er de payload-SKRIVBARE feltene (V19.9.4) — IKKE reise-sporet
 * (server-utledet, lag 2) og IKKE `attestert*`. En serverrad (`SheetTimer`, Decimal
 * `timer`) og en payload-rad (number `timer`) normaliseres til samme kanoniske form:
 *  - strengfelt: `null`/`undefined`/`""` → `null` (de tre er samme «ingen verdi»)
 *  - `timer`: Decimal/streng/number → tall (tapsfri via `Number`)
 *  - `pauseMin`: `null`/`undefined` → `0` (NOT NULL DEFAULT 0 på serveren)
 */

/** Minste felles form for en timer-rad slik innholds-sammenligningen trenger den. */
export interface RadInnhold {
  projectId?: string | null;
  byggeplassId?: string | null;
  lonnsartId?: string | null;
  aktivitetId?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
  // Decimal (Prisma) har `toString`; number fra payload. Begge tåles.
  timer?: number | string | { toString(): string } | null;
  fraTid?: string | null;
  tilTid?: string | null;
  beskrivelse?: string | null;
  pauseMin?: number | null;
}

/** `null`/`undefined`/`""` → `null`; ellers verdien. */
function normStreng(v: string | null | undefined): string | null {
  return v == null || v === "" ? null : v;
}

/** Decimal/streng/number → tall. `null`/`undefined` → `null`. */
function normTall(
  v: number | string | { toString(): string } | null | undefined,
): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isNaN(n) ? null : n;
}

/**
 * Er innholdet (V19.9.4-feltene) likt på serverraden og payload-raden?
 * Begge sider normaliseres FØR sammenligning (så `""` ≡ `null`, Decimal ≡ number).
 */
export function radInnholdLikt(server: RadInnhold, payload: RadInnhold): boolean {
  return (
    normStreng(server.projectId) === normStreng(payload.projectId) &&
    normStreng(server.byggeplassId) === normStreng(payload.byggeplassId) &&
    normStreng(server.lonnsartId) === normStreng(payload.lonnsartId) &&
    normStreng(server.aktivitetId) === normStreng(payload.aktivitetId) &&
    normStreng(server.externalCostObjectId) ===
      normStreng(payload.externalCostObjectId) &&
    normStreng(server.vehicleId) === normStreng(payload.vehicleId) &&
    normTall(server.timer) === normTall(payload.timer) &&
    normStreng(server.fraTid) === normStreng(payload.fraTid) &&
    normStreng(server.tilTid) === normStreng(payload.tilTid) &&
    normStreng(server.beskrivelse) === normStreng(payload.beskrivelse) &&
    (server.pauseMin ?? 0) === (payload.pauseMin ?? 0)
  );
}
