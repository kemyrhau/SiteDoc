"use client";

import { useEffect } from "react";
import { useToppbarFiltreKontekst } from "@/kontekst/toppbar-filtre-kontekst";

/**
 * Side-side deklarasjon av hvilke toppbar-filtre ruten faktisk bruker.
 *
 * Eksempel — side som ikke bruker byggeplass-filter:
 *
 *   useToppbarFiltre({ byggeplass: false });
 *
 * Default for hvert filter er true (aktivt). Sider trenger kun erklære
 * filtre som IKKE brukes. Ved unmount tilbakestilles filtre til aktiv
 * state slik at neste rute starter med ren tilstand.
 */
interface ToppbarFiltreOptions {
  /** Default true. Sett false hvis siden ikke bruker byggeplass som filter. */
  byggeplass?: boolean;
}

export function useToppbarFiltre(options: ToppbarFiltreOptions = {}) {
  const { settByggeplassAktiv } = useToppbarFiltreKontekst();
  const byggeplass = options.byggeplass ?? true;

  useEffect(() => {
    settByggeplassAktiv(byggeplass);
    return () => {
      settByggeplassAktiv(true);
    };
  }, [byggeplass, settByggeplassAktiv]);
}
