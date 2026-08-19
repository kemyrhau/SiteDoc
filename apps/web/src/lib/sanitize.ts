import DOMPurify from "dompurify";

/**
 * SSR-GJENNOMSLIPP — LES FØR DU FLYTTER NOE TIL SERVER.
 *
 * Begge funksjonene returnerer input UENDRET når `typeof window === "undefined"`
 * (DOMPurify krever en DOM og har ingen på serveren). Det er trygt i dag KUN
 * fordi alle kallstedene er `"use client"`-sider som henter det upålitelige
 * innholdet klient-side (tRPC/`fetch` i `useEffect`): under SSR er variabelen
 * tom, og selve saniteringen skjer ved hydrering der `window` finnes.
 *
 * Denne tryggheten er en FORUTSETNING som kan brytes STILLE: gjør noen en av
 * disse sidene (eller en ny bruker av `rensHtml`/`rensSvg`) til en server-
 * komponent, eller SSR-er ferdig innhold, forsvinner saniteringen uten at noe
 * feiler eller advarer — usanitert opplastet innhold havner rett i initial-HTML.
 * Skal det skje, må gjennomslippet erstattes med server-side sanitering
 * (f.eks. `isomorphic-dompurify`/jsdom) FØR flyttingen.
 */

/**
 * Saniterer HTML fra opplastede og maskinoversatte dokumenter før den settes
 * inn i DOM via `dangerouslySetInnerHTML`. Fjerner `<script>`, event-handlere
 * (`onclick` osv.) og `javascript:`-URL-er, men beholder vanlig tekst-
 * formatering, `<mark>`-highlight og tabeller. Se SSR-notatet over.
 */
export function rensHtml(skitten: string): string {
  if (typeof window === "undefined") return skitten;
  return DOMPurify.sanitize(skitten);
}

/**
 * Saniterer opplastet/konvertert SVG (DWG→SVG) med SVG-profil. Beholder
 * tegneelementer (path/line/polygon/…), `data-*`-attributter og geometri, men
 * fjerner `<script>`, `<foreignObject>` og event-handlere.
 *
 * Saniteres ved kilde (rett etter fetch), FØR sidenes egne, betrodde
 * transformasjoner injiserer zoom-bevisst `<style>`. Å sanitere på nytt ved
 * render ville risikert å fjerne den injiserte stilen. Se SSR-notatet over.
 */
export function rensSvg(skitten: string): string {
  if (typeof window === "undefined") return skitten;
  return DOMPurify.sanitize(skitten, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
