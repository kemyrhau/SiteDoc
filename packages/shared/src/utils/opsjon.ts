/**
 * Normalisering av valg-opsjoner (`config.options`) for felttypene `list_single`/
 * `list_multi` og trafikklys — delt kilde for web-utfylling, mobil-utfylling og
 * grense-resolveren.
 *
 * `config.options` kan være enkle strenger (`"Ja"`) eller objekter
 * (`{value: "green", label: "Godkjent"}`). Denne normaliseren gir ALLTID
 * `{ value, label }` slik at flatene — og resolverens variant-matching — har ETT
 * sannhetsbegrep om hva en opsjon er. Matchet resolveren med én normalisering mens
 * en flate viste opsjonene med en annen, ville grensen løses mot en verdi brukeren
 * ikke ser (stille feil i et dokument byggherren mottar) — derfor én kilde.
 *
 * Historikk: fantes tidligere i fire uavhengige kopier (web `typer.ts`, de to
 * mobil-komponentene, PDF `hjelpere.ts`). Trukket hit 2026-09-06. `packages/pdf`
 * beholder sin tvilling (null-avhengighetsregelen) — voktet av paritetstest i
 * `apps/web/src/__tests__/pdf-shared-tvilling-paritet.test.ts`.
 */
export function normaliserOpsjon(opsjon: unknown): { value: string; label: string } {
  if (typeof opsjon === "string") return { value: opsjon, label: opsjon };
  if (typeof opsjon === "object" && opsjon !== null) {
    const obj = opsjon as Record<string, unknown>;
    const value = typeof obj.value === "string" ? obj.value : String(obj.value ?? "");
    const label = typeof obj.label === "string" ? obj.label : value;
    return { value, label };
  }
  return { value: String(opsjon), label: String(opsjon) };
}
