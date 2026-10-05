// LAG 2-C D1 (RETUR 1 avvik 1) — hvilken merke-etikett en reise-rad får. Ren
// funksjon (ingen React/trpc) så den kan unit-testes uten å rendre komponenten.
//
// 🔴 En rad UTEN retning skal ALDRI vise «Reise ut» (attestanten får se en retning
// raden ikke har). Treffer backfill-rader (reiseRetning=null) og manuelle rader
// (valg A, spec § 3 B4: reiseKilde="manuell", reiseRetning=null).

/** i18n-nøkkelen for reise-radens merke. Prioritet: manuell → retning → nøytral. */
export function reiseMerkeNokkel(rad: {
  reiseKilde?: "matrise" | "manuell" | null;
  reiseRetning?: "ut" | "retur" | null;
}): string {
  if (rad.reiseKilde === "manuell") return "timer.attestering.reise.merkeManuell";
  if (rad.reiseRetning === "ut") return "timer.attestering.reise.merkeUt";
  if (rad.reiseRetning === "retur") return "timer.attestering.reise.merkeRetur";
  return "timer.attestering.reise.merke"; // nøytralt — ingen påstått retning
}
