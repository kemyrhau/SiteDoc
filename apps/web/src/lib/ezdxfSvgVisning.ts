import { farligCss } from "@sitedoc/shared";

/**
 * Tilpasser en (allerede DOMPurify-sanert) tegnings-SVG for inline-visning.
 *
 * XSS-VERN (orkestrator-ordre 2026-10-11, pkt. 1 + 4):
 * - Hvorvidt dette er en ezdxf-SVG (som skal BEHOLDE sin egen dempet-strek-`<style>`)
 *   avgjøres av KALLEREN fra serverens markør (`konverteringRapport.markor.motor`),
 *   IKKE av et `data-motor`-attributt i fila. En opplastet/forfalsket SVG kan bære
 *   `data-motor="ezdxf"`, men får aldri server-markøren — så den behandles som «egen»
 *   og får `<style>` strippet.
 * - For en ekte ezdxf-SVG kjøres den beholdte `<style>` gjennom `farligCss` (DOMPurify
 *   saniterer ikke CSS): inneholder den `url(`/`@import`/`expression`/`behavior`, strippes
 *   den (defense-in-depth mot drift i render.py eller en forfalsket fil med markør).
 *
 * Returnerer den tilpassede markupen + `erEzdxf` (så viseren vet om den skal sette
 * `--strek-*`-variablene pr. zoom).
 */
export function tilpassEzdxfSvg(
  sanertSvg: string,
  erEzdxfMotor: boolean,
): { svg: string; erEzdxf: boolean } {
  // Fjern faste width/height (behold øvrige attributter: data-motor, data-lw-base, viewBox)
  let tilpasset = sanertSvg.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    const uten = attrs
      .replace(/\s*width="[^"]*"/g, "")
      .replace(/\s*height="[^"]*"/g, "");
    return `<svg${uten} width="100%" height="auto" style="display:block">`;
  });

  if (!erEzdxfMotor) {
    // egen-motor (eller ukjent/forfalsket): strip <style> og injiser fast zoom-bevisst strek.
    tilpasset = tilpasset.replace(/<style>[^<]*<\/style>/g, "");
    tilpasset = tilpasset.replace(
      /(<svg[^>]*>)/,
      `$1\n<style>line,polyline,circle,path,ellipse,polygon{stroke-width:calc(1.5 / var(--svg-zoom, 1)) !important}</style>`,
    );
    return { svg: tilpasset, erEzdxf: false };
  }

  // ezdxf: behold SVG-ens egen dempet-clamp-<style> — men avvis aktive CSS-konstruksjoner.
  tilpasset = tilpasset.replace(/<style>([^<]*)<\/style>/g, (match, css: string) =>
    farligCss(css) ? "" : match,
  );
  return { svg: tilpasset, erEzdxf: true };
}
