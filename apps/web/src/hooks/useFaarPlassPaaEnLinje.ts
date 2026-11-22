"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O8 (§ 8.22 punkt 3): får et sett elementer plass på én linje i flaten de står i?
 *
 * `plassRef` er flaten (bredden er tilgjengelig plass), `maalRef` er en usynlig kopi av
 * innholdet lagt på én linje (`w-max`). Svaret følger breddeendring (ResizeObserver på
 * begge). Flaten må ha en bredde som ikke avhenger av hva som vises i den (f.eks.
 * `basis-0 flex-1 min-w-0`) — da gir bytte mellom visningene ingen ny måling, og grensen
 * flimrer ikke.
 *
 * null = kan ikke måles (ingen ResizeObserver, eller bredde 0 som i jsdom): kalleren faller
 * tilbake på sin gamle regel.
 *
 * `nokkel` = innholdet; endres det, måles det på nytt.
 */
export function useFaarPlassPaaEnLinje<P extends HTMLElement = HTMLDivElement, M extends HTMLElement = HTMLDivElement>(
  nokkel: string,
) {
  const plassRef = useRef<P | null>(null);
  const maalRef = useRef<M | null>(null);
  const [faarPlass, setFaarPlass] = useState<boolean | null>(null);

  useEffect(() => {
    const plass = plassRef.current;
    const maal = maalRef.current;
    if (!plass || !maal || typeof ResizeObserver === "undefined") {
      setFaarPlass(null);
      return;
    }
    const mal = () => {
      const tilgjengelig = plass.clientWidth;
      setFaarPlass(tilgjengelig > 0 ? maal.offsetWidth <= tilgjengelig : null);
    };
    const obs = new ResizeObserver(mal);
    obs.observe(plass);
    obs.observe(maal);
    mal();
    return () => obs.disconnect();
  }, [nokkel]);

  return { plassRef, maalRef, faarPlass };
}
