import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { Tooltip } from "@sitedoc/ui";

/**
 * Regresjonsvakt for Tooltip v2 (tooltip-hjelpetekst-veileder.md § 2):
 * flerlinje-tekst må bryte (ingen `whitespace-nowrap`), tittel-linjen skal
 * rendres, tooltip-noden er alltid montert med `role="tooltip"`, og trigger må
 * kobles til tooltipen via `aria-describedby` for skjermlesere/tastatur.
 *
 * Verifiserer FAKTISK render-utfall (renderToString, node env) — ikke bare
 * kompilering. Interaktiv atferd (hover-delay, focus-visible, touch) er DOM-
 * hendelser og dekkes ikke her.
 */
describe("Tooltip v2 — struktur og a11y-kobling", () => {
  it("rendrer tittel + brødtekst, med bryting og max-width (aldri nowrap)", () => {
    const html = renderToString(
      <Tooltip tittel="Send → Mottatt" tekst="Flytter dokumentet ett ledd fram.">
        <button>Send</button>
      </Tooltip>,
    );
    expect(html).toContain("Send → Mottatt");
    expect(html).toContain("Flytter dokumentet ett ledd fram.");
    expect(html).toContain("max-w-[280px]");
    expect(html).toContain("break-words");
    expect(html).not.toContain("whitespace-nowrap");
  });

  it("tooltip-noden har role=tooltip og trigger får aria-describedby til samme id", () => {
    const html = renderToString(
      <Tooltip tekst="Etikett">
        <button>Ikon</button>
      </Tooltip>,
    );
    // Hent tooltip-id fra role="tooltip"-elementet …
    const tooltipId = html.match(/id="([^"]+)"[^>]*role="tooltip"/)?.[1];
    expect(tooltipId).toBeTruthy();
    // … og bekreft at triggeren peker på den.
    expect(html).toContain(`aria-describedby="${tooltipId}"`);
  });

  it("bevarer triggerens eksisterende aria-describedby og slår sammen med tooltip-id", () => {
    const html = renderToString(
      <Tooltip tekst="Etikett">
        <button aria-describedby="ekstern-hjelp">Ikon</button>
      </Tooltip>,
    );
    expect(html).toMatch(/aria-describedby="ekstern-hjelp [^"]+"/);
  });

  it("uten tittel rendres kun brødtekst (ingen tom fet linje)", () => {
    const html = renderToString(
      <Tooltip tekst="Bare brødtekst">
        <span>ord</span>
      </Tooltip>,
    );
    expect(html).toContain("Bare brødtekst");
    expect(html).not.toContain("font-semibold");
  });
});
