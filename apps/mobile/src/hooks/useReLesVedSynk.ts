import { useEffect, useRef } from "react";

/**
 * FUNN 2026-10-06: timer-skjermene (detalj + dag-lista + «Mine timer») leste
 * lokal-DB BARE i `useFocusEffect`. Fullførte en bakgrunnssynk mens skjermen alt
 * var i fokus, oppdaterte ikke `syncStatus` seg på skjermen → «Venter» ble
 * stående selv etter at serveren hadde mottatt dataene.
 *
 * Denne hooken kjører `reLes` hver gang provideren signaliserer at en synk er
 * ferdig. Signalet er `useTimerSync().sistSynkronisert` — et tidsstempel som
 * bumpes etter HVER fullførte `triggerSync` (både 30s-intervallet og «Prøv igjen
 * nå»-knappen), så dette ene signalet dekker begge veier.
 *
 * To bevisste valg:
 *  - **Hopp over første kjøring.** `useFocusEffect` leste alt ved mount, og
 *    synken kan ha fullført før skjermen ble montert (`sistSynkronisert` er da
 *    alt satt) — uten dette ville hooken lese en ekstra, overflødig gang.
 *  - **`reLes` via ref, IKKE i deps.** Kallstedene sender ofte en inline-closure
 *    (ny identitet hver render). Lå den i deps, ville effekten fyre hver render.
 *    Vi leser alltid den ferskeste `reLes` fra ref-en, men fyrer KUN når
 *    `sistSynkronisert` endrer seg.
 */
export function useReLesVedSynk(
  sistSynkronisert: number | null,
  reLes: () => void,
): void {
  const reLesRef = useRef(reLes);
  reLesRef.current = reLes;
  const harKjort = useRef(false);
  useEffect(() => {
    if (!harKjort.current) {
      harKjort.current = true;
      return;
    }
    reLesRef.current();
  }, [sistSynkronisert]);
}
