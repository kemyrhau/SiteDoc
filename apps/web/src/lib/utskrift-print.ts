/**
 * Auto-utskrift som venter på at innholdet faktisk er lastet.
 *
 * Rotårsak den erstatter: auto-print fyrte `window.print()` på en flat frist
 * (500 ms) så snart tRPC-dataene var lastet — men bildene var ikke med i den
 * ventingen. Et stort bilde (f.eks. 3,4 MB) rekker ikke over nettet på et halvt
 * sekund, så `<img>` var tom da PDF-en ble frosset → svart/tomt felt. Andre
 * forsøk traff nettleser-cachen og kom med. Målt i BEF-001, 2026-08-13.
 *
 * Venter på TO ting før print:
 *  1. Hvert `<img>` er `complete` med `naturalWidth > 0` (faktisk lastesjekk,
 *     ikke en lengre timeout). Et bilde som feiler teller som ferdig, så et dødt
 *     bilde ikke henger utskriften.
 *  2. Ingen element bærer `[data-utskrift-venter]`. Innhold som rendres asynkront
 *     UTENFOR et `<img>` (tegningsutsnitt via pdfjs/canvas → data-URL) er usynlig
 *     for `document.images` mens det genereres. Slike komponenter setter merket
 *     mens de laster og fjerner det når innholdet er på plass (funn BEF-001
 *     oppgave-utskrift 2026-08-13: «Laster tegning…» sto igjen i ferdig PDF).
 *
 * En `MutationObserver` re-evaluerer ved DOM-endringer (merke fjernet, nye `<img>`
 * lagt til), og load/error-lyttere fanger bilder som fullfører. `maxVentMs` er et
 * sikkerhetsnett så utskriften aldri blir hengende evig på et dødt element.
 *
 * @returns avbryt-funksjon for React-cleanup (hindrer print etter unmount).
 */
export function skrivUtNaarBilderErKlare(maxVentMs = 15_000): () => void {
  let avbrutt = false;
  let ferdig = false;
  let sikkerhetsnett: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;
  const lyttedePaa = new WeakSet<HTMLImageElement>();

  const alleBilderKlare = () =>
    Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0);
  const ingenVenter = () =>
    document.querySelectorAll("[data-utskrift-venter]").length === 0;
  const erKlar = () => ingenVenter() && alleBilderKlare();

  // Fest load/error-lyttere på bilder som ennå ikke er ferdige (også de som
  // dukker opp senere, når et merke fjernes og et data-URL-<img> rendres).
  const festBildelyttere = () => {
    for (const img of Array.from(document.images)) {
      if (img.complete && img.naturalWidth > 0) continue;
      if (lyttedePaa.has(img)) continue;
      lyttedePaa.add(img);
      const paaFerdig = () => {
        img.removeEventListener("load", paaFerdig);
        img.removeEventListener("error", paaFerdig);
        sjekk();
      };
      img.addEventListener("load", paaFerdig, { once: true });
      img.addEventListener("error", paaFerdig, { once: true });
    }
  };

  const fullfor = () => {
    if (ferdig) return;
    ferdig = true;
    if (sikkerhetsnett) clearTimeout(sikkerhetsnett);
    observer?.disconnect();
    if (!avbrutt) window.print();
  };

  const sjekk = () => {
    if (avbrutt || ferdig) return;
    festBildelyttere();
    if (erKlar()) fullfor();
  };

  observer = new MutationObserver(sjekk);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-utskrift-venter"],
  });

  sikkerhetsnett = setTimeout(fullfor, maxVentMs);

  // Førstegangs-sjekk: alt kan allerede være klart (cache, ingen tegninger).
  sjekk();

  return () => {
    avbrutt = true;
    if (sikkerhetsnett) clearTimeout(sikkerhetsnett);
    observer?.disconnect();
  };
}
