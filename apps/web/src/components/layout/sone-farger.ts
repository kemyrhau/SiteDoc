// Sonefarger — låst grammatikk (P1/vedtak del 5): amber = FIRMA, blå = PROSJEKT.
// Delt kilde så BÅDE det tonede sidehodet (gradient + 4px markør) og
// verktøylinje-varianten (kun 4px markør, ingen gradient) bruker samme
// fargeverdier. Ingen duplisert farge på tvers av komponenter.
//
// SONE_MARKOR gir kun kant-FARGEN (Tailwind arbitrary value); bredden (border-l-4)
// legges av forbrukeren. SONE_GRADIENT gir den svake sonetonen (mot hvit ved 85 %).

export type Sone = "firma" | "prosjekt";

export const SONE_MARKOR: Record<Sone, string> = {
  firma: "border-l-[#f5c97b]",
  prosjekt: "border-l-[#a9c4f5]",
};

export const SONE_GRADIENT: Record<Sone, string> = {
  firma: "bg-[linear-gradient(90deg,#fdf6ea_0%,#ffffff_85%)]",
  prosjekt: "bg-[linear-gradient(90deg,#eef4fd_0%,#ffffff_85%)]",
};
