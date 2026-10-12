/**
 * XSS-vern for ezdxf-SVG (orkestrator-ordre 2026-10-11).
 *
 * BAKGRUNN: ezdxf-visningen beholder SVG-ens egen `<style>` (web) og injiserer
 * markupen rått via `innerHTML` i en WebView (mobil). DOMPurify (web) saniterer
 * IKKE CSS, og mobil har ingen DOMPurify i det hele tatt. I dag er markupen trygg
 * (render.py `html.escape`-er tekst/lag og skriver en fast `<style>` uten CSS-
 * funksjoner), men det finnes ingen sperre hvis render.py endres, en ny motor
 * innføres, eller noen klarer å servere en forfalsket SVG.
 *
 * `farligCss` er den delte, rene sperren mot aktive CSS-konstruksjoner. Web
 * importerer den direkte; mobil speiler den i WebView-JS-en (kan ikke importeres
 * inn i en inline-`<script>`), på samme måte som strek-skaleringsmatematikken.
 * Endres mønstrene her, må mobil-speilet i `TegningsVisning` oppdateres i takt.
 */

/**
 * Sann når CSS-teksten inneholder en aktiv konstruksjon som kan laste ressurser
 * eller kjøre kode: `url(...)` (ekstern henting / `data:`-smugling), `@import`
 * (ekstern henting), `expression(...)` (gammel IE-JS) eller `behavior:` (IE
 * HTC-binding). Brukes til å avvise/strippe en `<style>` før den stoles på.
 *
 * Ren funksjon (ingen DOM) — kan enhetstestes i node og speiles i WebView-JS.
 */
export function farligCss(css: string): boolean {
  return /url\s*\(|@import|expression\s*\(|behavior\s*:/i.test(css);
}

/** Elementer ezdxf-render.py faktisk emitterer — allowliste for mobil-validatoren. */
export const EZDXF_TILLATTE_TAGGER = [
  "svg", "g", "path", "line", "polyline", "polygon",
  "circle", "ellipse", "rect", "text", "tspan", "style",
] as const;

/**
 * Allowlist-validering av tegnings-SVG FØR den settes inn via `innerHTML`
 * (mobil-WebView; der finnes ingen DOMPurify, så dette er primærvernet). Sann KUN
 * når markupen, PARSET som SVG, bare bruker ezdxf-render.py sine egne elementer og
 * ikke bærer aktive konstruksjoner:
 *
 * - avviser alle tagger utenfor {@link EZDXF_TILLATTE_TAGGER} (bl.a. `script`,
 *   `foreignObject`, `iframe`, `image`, `a`, `use`)
 * - avviser event-handler-attributter (navn som starter med `on`)
 * - avviser `href`/`xlink:href` (kan bære `javascript:`/`data:`)
 * - avviser farlig CSS i `<style>` OG i `style="..."` (`url(`, `@import`,
 *   `expression`, `behavior`)
 *
 * PARSES med DOMParser (ikke regex) slik at et attributt-VERDI som tilfeldigvis
 * inneholder «onload=» eller «<svg» (f.eks. et ondsinnet lagnavn som render.py
 * har html-escapet inn i `data-layer`) ikke forveksles med en ekte tag/handler.
 * Returnerer `false` når DOM mangler (node) — kalleren skal da falle tilbake til
 * `<img>`, som ikke kjører skript i SVG. SPEILET i WebView-JS-en i `TegningsVisning`
 * (kan ikke importeres inn i en inline-`<script>`); endres logikken her, oppdater
 * speilet i takt.
 */
export function svgMarkupErTrygg(markup: string): boolean {
  // Strukturell typing av det lille DOM-utsnittet vi bruker — shared bygges uten
  // DOM-lib (plattform-nøytral pakke), så vi kan ikke referere globalt `Document` etc.
  type Attr = { name: string; value: string };
  type El = {
    nodeName: string;
    attributes: ArrayLike<Attr>;
    textContent: string | null;
    getElementsByTagName(tag: string): ArrayLike<El>;
  };
  type Dok = { documentElement: El | null };
  type ParserCtor = new () => { parseFromString(s: string, type: string): Dok };

  const Parser = (globalThis as { DOMParser?: ParserCtor }).DOMParser;
  if (!Parser) return false;
  let doc: Dok;
  try {
    doc = new Parser().parseFromString(markup, "image/svg+xml");
  } catch {
    return false;
  }
  const root = doc.documentElement;
  // Parse-feil gir et <parsererror>-rot; alt annet enn <svg> som rot avvises.
  if (!root || root.nodeName.toLowerCase() !== "svg") return false;
  const tillatt = new Set<string>(EZDXF_TILLATTE_TAGGER);
  const alle = root.getElementsByTagName("*");
  const noder: El[] = [root];
  for (let i = 0; i < alle.length; i++) noder.push(alle[i]!);
  for (const el of noder) {
    const tag = el.nodeName.toLowerCase();
    if (!tillatt.has(tag)) return false;
    const attrs = el.attributes;
    for (let j = 0; j < attrs.length; j++) {
      const navn = attrs[j]!.name.toLowerCase();
      if (navn.startsWith("on")) return false;
      if (navn === "href" || navn === "xlink:href") return false;
      if (navn === "style" && farligCss(attrs[j]!.value)) return false;
    }
    if (tag === "style" && farligCss(el.textContent ?? "")) return false;
  }
  return true;
}
