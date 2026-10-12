import { farligCss, svgHarC1Format } from "@sitedoc/shared";

/**
 * Tilpasser en (allerede DOMPurify-sanert) tegnings-SVG for inline-visning.
 *
 * XSS-VERN (orkestrator-ordre 2026-10-11, pkt. 1 + 4):
 * - Hvorvidt dette er en ezdxf-SVG (som skal BEHOLDE sin egen dempet-strek-`<style>`)
 *   avgjøres av KALLEREN fra serverens markør (`konverteringRapport.markor.motor`),
 *   IKKE av et `data-motor`-attributt i fila. En opplastet/forfalsket SVG kan bære
 *   `data-motor="ezdxf"`, men får aldri server-markøren — så den behandles som «egen»
 *   og får `<style>` strippet.
 *
 * C1-GATE (RETUR 2, 2026-10-12): markøren ALENE er ikke nok. En ezdxf-SVG konvertert FØR
 * C1 (Rev. F) har `motor: "ezdxf"`, men bærer rå inline `stroke-width` (~173 viewBox-
 * enheter) uten `data-lw-base`/`--lw`. Beholdt vi stilen bare fordi markøren sa «ezdxf»,
 * ble de 173 enhetene vist rått (svarte bjelker). Derfor kreves BÅDE markør-motor OG
 * C1-format (`svgHarC1Format`). Mangler C1 → «egen»-behandling (strip + inject), aldri rå
 * strek. Riktig varig løsning for slike filer er re-konvertering med dagens kode.
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
  // C1-gate: behold ezdxf-stilen KUN når markøren sier ezdxf OG SVG-en faktisk bærer
  // C1-formatet. En gammel ezdxf-SVG uten C1 (Rev. F) faller til egen-behandling.
  const behandleSomEzdxf = erEzdxfMotor && svgHarC1Format(sanertSvg);

  // Fjern faste width/height (behold øvrige attributter: data-motor, data-lw-base, viewBox)
  let tilpasset = sanertSvg.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    const uten = attrs
      .replace(/\s*width="[^"]*"/g, "")
      .replace(/\s*height="[^"]*"/g, "");
    return `<svg${uten} width="100%" height="auto" style="display:block">`;
  });

  if (!behandleSomEzdxf) {
    // egen-motor, gammel ezdxf uten C1, eller ukjent/forfalsket: strip <style> og injiser
    // fast zoom-bevisst strek. Den injiserte regelen har !important og overstyrer en rå
    // inline `stroke-width`-attributt (f.eks. 173 fra en pre-C1 ezdxf-SVG).
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
