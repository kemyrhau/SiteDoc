/**
 * Auto-utskrift som venter på at bildene faktisk er lastet.
 *
 * Rotårsak den erstatter: auto-print fyrte `window.print()` på en flat frist
 * (500 ms) så snart tRPC-dataene var lastet — men bildene var ikke med i den
 * ventingen. Et stort bilde (f.eks. 3,4 MB) rekker ikke over nettet på et halvt
 * sekund, så `<img>` var tom da PDF-en ble frosset → svart/tomt felt. Andre
 * forsøk traff nettleser-cachen og kom med. Målt i BEF-001, 2026-08-13.
 *
 * Denne venter til hvert `<img>` er `complete` med `naturalWidth > 0`. Det er
 * ikke en lengre timeout (som bare bytter én vilkårlig frist mot en annen), men
 * en faktisk lastesjekk. Et bilde som feiler teller som ferdig, så et dødt bilde
 * ikke henger utskriften. `maxVentMs` er et sikkerhetsnett så utskriften aldri
 * blir hengende evig.
 *
 * @returns avbryt-funksjon for React-cleanup (hindrer print etter unmount).
 */
export function skrivUtNaarBilderErKlare(maxVentMs = 15_000): () => void {
  let avbrutt = false;
  let sikkerhetsnett: ReturnType<typeof setTimeout> | null = null;

  const ikkeKlare = Array.from(document.images).filter(
    (img) => !(img.complete && img.naturalWidth > 0),
  );

  const ventPaaEtt = (img: HTMLImageElement) =>
    new Promise<void>((resolve) => {
      const ferdig = () => {
        img.removeEventListener("load", ferdig);
        img.removeEventListener("error", ferdig);
        resolve();
      };
      img.addEventListener("load", ferdig, { once: true });
      img.addEventListener("error", ferdig, { once: true });
    });

  const sikkerhetsnettFerdig = new Promise<void>((resolve) => {
    sikkerhetsnett = setTimeout(resolve, maxVentMs);
  });

  Promise.race([Promise.all(ikkeKlare.map(ventPaaEtt)), sikkerhetsnettFerdig]).then(() => {
    if (sikkerhetsnett) clearTimeout(sikkerhetsnett);
    if (!avbrutt) window.print();
  });

  return () => {
    avbrutt = true;
    if (sikkerhetsnett) clearTimeout(sikkerhetsnett);
  };
}
