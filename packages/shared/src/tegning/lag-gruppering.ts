// F2 (spec § 3): gruppering av laginventaret til bruk i lagpanelet — delt mellom
// web (`LagPanel.tsx`) og mobil (`TegningLagPanel.tsx`), så de to flatene garantert
// viser samme gruppe-inndeling. Flyttet ut av web (RETUR F1+F2 web r2, 2026-10-17 —
// "flytt byggGrupper med Andre-sammenslåingen til @sitedoc/shared FØR RN-panelet")
// FØR mobil-panelet ble bygget, slik at ingen andre implementasjon kunne drifte fra
// denne.

import type { RegisterVerdenLagInfo } from "./objektmodell";

export interface LagGruppe {
  navn: string;
  gruppeNavn: string;
  lag: RegisterVerdenLagInfo[];
  antallTotal: number;
}

// RETUR F1+F2 web r2 (Kenneth): "Andre" sto i FEM separate grupper (878/82/
// 852/858/uten kode) fordi de har ulik rå `gruppe`-kode, selv om alle viser
// samme gruppeNavn. Slå dem sammen under ÉN nøkkel uansett rå kode.
export const ANDRE_GRUPPENAVN = "Andre";

export function byggLagGrupper(laginventar: RegisterVerdenLagInfo[]): LagGruppe[] {
  const map = new Map<string, RegisterVerdenLagInfo[]>();
  for (const li of laginventar) {
    const noekkel = li.gruppeNavn === ANDRE_GRUPPENAVN ? ANDRE_GRUPPENAVN : li.gruppe;
    const liste = map.get(noekkel) ?? [];
    liste.push(li);
    map.set(noekkel, liste);
  }
  return Array.from(map.entries())
    .map(([navn, lag]) => ({
      navn,
      gruppeNavn: lag[0]?.gruppeNavn ?? navn,
      lag,
      antallTotal: lag.reduce((s, l) => s + l.antall, 0),
    }))
    .sort((a, b) => b.antallTotal - a.antallTotal);
}
