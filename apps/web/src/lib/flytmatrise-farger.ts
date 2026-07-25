// Flyt-rettighetsmatrise — cellefarger (Kloss 2c, config-design § 2 / fabel-cellespec).
//
// Egen kilde så kontrast-paletten (mørkere grønn, varm grå, amber, hengelås-bg)
// ikke spres som hardkodet hex i JSX. Speiler sone-farger.ts-mønsteret.
// Kontrast-krav: fylt «på» bruker #059669 (mørkere enn success-#10b981) og
// «av» er en tom ramme (#a8a49b) — form skiller, ikke bare farge.

export const CELLE = {
  /** Standard/overstyrt på — fylt boks, hvit hake, mørkere grønn (kontrast). */
  paa: "bg-[#059669] text-white",
  /** Standard/overstyrt av — tom ramme (ikke strek/dash). */
  av: "border border-[#a8a49b] bg-white",
  /** Overstyrt — amber prikk øverst til høyre. */
  overstyrtPrikk: "bg-[#d97706]",
  /** Auto — grå fylt boks med «A», ikke klikkbar. */
  auto: "bg-[#e5e1d8] text-[#6b6558]",
  /** Låst — hengelås på lys bakgrunn. */
  laastBg: "bg-[#f1efe9]",
  laastIkon: "text-[#a8a49b]",
  /** Hover på redigerbar celle — blå ramme. */
  hover: "hover:ring-2 hover:ring-sitedoc-primary",
} as const;
