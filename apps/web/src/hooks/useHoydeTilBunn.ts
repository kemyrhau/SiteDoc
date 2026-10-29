"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * Plass fra elementets topp ned til bunnen av nærmeste `main` (F3, relay 29.10).
 *
 * Søkesiden ligger i `main` (blokk, `overflow-y-auto`) via en prosjekt-layout som får auto-høyde,
 * så `h-full` på siden løser til ingenting: siden vokste til innholdets høyde (målt 174 892 px) og
 * `main` rullet søkefeltet ut av syne. Siden måler derfor selv hvor høy den kan være.
 *
 * `elementTopp` er elementets viewport-topp; har `main` allerede rullet, er elementet skjøvet opp
 * like mye, derfor legges `mainScrollTop` til.
 */
export function beregnHoydeTilBunn(mainBunn: number, elementTopp: number, mainScrollTop: number): number {
  return Math.max(0, Math.round(mainBunn - elementTopp - mainScrollTop));
}

/** Gir `ref` + `style` (høyde) for en side som skal fylle `main` nøyaktig, uten å rulle den. */
export function useHoydeTilBunn<T extends HTMLElement>(): { ref: RefObject<T>; style: CSSProperties | undefined } {
  const ref = useRef<T>(null);
  const [høyde, setHøyde] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    const main = el?.closest("main");
    if (!el || !main) return;

    const mål = () => {
      setHøyde(beregnHoydeTilBunn(main.getBoundingClientRect().bottom, el.getBoundingClientRect().top, main.scrollTop));
    };
    mål();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mål) : null;
    observer?.observe(main);
    window.addEventListener("resize", mål);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", mål);
    };
  }, []);

  return { ref, style: høyde == null ? undefined : { height: høyde } };
}
