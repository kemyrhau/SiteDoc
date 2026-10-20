/**
 * RETUR 2 rekonverter (Kontrollør/Kenneth 2026-10-16, feil 2): tegningsviseren blokkerte
 * HELE visningen (spinner/tom flate) hver gang `conversionStatus` var pending/converting —
 * uansett om dette var en FØRSTEGANGSKONVERTERING (ingen fil å vise, spinner er riktig)
 * eller en REKONVERTERING av en tegning som allerede har et gyldig render fra forrige
 * gang («Oppdater alle tegninger»/«Oppdater visning»). I det siste tilfellet lar
 * `kjorRekonvertering` `fileUrl`/`fileType` stå urørt til den lykkes — gammel visning
 * skal derfor fortsette å vises (med en diskret «Oppdaterer visning …»), ikke erstattes.
 *
 * `erBilde`/`brukDxfViewer` er nøyaktig de to måtene en tegning FAKTISK kan vises på
 * (se side-komponentens render-gate) — «gyldig gammel visning» er derfor «en av disse to
 * er allerede sann», uavhengig av om en rekonvertering pågår.
 */
export interface TegningVisningTilstand {
  /** Konvertering pågår (fersk pending/converting, ikke strandet). */
  erDwgKonvertering: boolean;
  /** `fileUrl`/`fileType` peker på et ALLEREDE vellykket render (ikke en rå original). */
  harGyldigGammelVisning: boolean;
  /** Blokker visningen (spinner/tom flate) — KUN når konvertering pågår OG det ikke
   * finnes noe å vise i mellomtiden. */
  visBlokkerendeKonvertering: boolean;
}

export function tegningVisningTilstand(input: {
  conversionStatus: string | null | undefined;
  erBilde: boolean;
  brukDxfViewer: boolean;
}): TegningVisningTilstand {
  const erDwgKonvertering = input.conversionStatus === "pending" || input.conversionStatus === "converting";
  const harGyldigGammelVisning = input.erBilde || input.brukDxfViewer;
  return {
    erDwgKonvertering,
    harGyldigGammelVisning,
    visBlokkerendeKonvertering: erDwgKonvertering && !harGyldigGammelVisning,
  };
}
