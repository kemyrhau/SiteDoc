// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Tooltip } from "@sitedoc/ui";

/**
 * Regresjonsvakt for Tooltip v2 (tooltip-hjelpetekst-veileder.md § 2):
 * flerlinje-tekst må bryte (ingen `whitespace-nowrap`), tittel-linjen skal
 * rendres, tooltip-noden har `role="tooltip"`, og trigger må kobles til tooltipen
 * via `aria-describedby` for skjermlesere/tastatur.
 *
 * Runde-2 (#10a/R4): tooltip-noden PORTALES til document.body (fixed) for å unngå
 * overflow-klipp fra scroll-containere. Testen kjører derfor på klient (jsdom) og
 * spør document.body — ikke SSR (portalen finnes ikke i statisk markup).
 */
afterEach(cleanup);

describe("Tooltip v2 — struktur og a11y-kobling (portalet)", () => {
  it("rendrer tittel + brødtekst, med bryting og max-width (aldri nowrap)", () => {
    render(
      <Tooltip tittel="Send → Mottatt" tekst="Flytter dokumentet ett ledd fram.">
        <button>Send</button>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Send → Mottatt");
    expect(tip.textContent).toContain("Flytter dokumentet ett ledd fram.");
    expect(tip.className).toContain("max-w-[280px]");
    expect(tip.className).toContain("break-words");
    expect(tip.className).not.toContain("whitespace-nowrap");
  });

  it("tooltip-noden har role=tooltip og trigger får aria-describedby til samme id", () => {
    render(
      <Tooltip tekst="Etikett">
        <button>Ikon</button>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip");
    const trigger = screen.getByText("Ikon");
    expect(tip.id).toBeTruthy();
    expect(trigger.getAttribute("aria-describedby")).toContain(tip.id);
  });

  it("bevarer triggerens eksisterende aria-describedby og slår sammen med tooltip-id", () => {
    render(
      <Tooltip tekst="Etikett">
        <button aria-describedby="ekstern-hjelp">Ikon</button>
      </Tooltip>,
    );
    const trigger = screen.getByText("Ikon");
    expect(trigger.getAttribute("aria-describedby")).toMatch(/ekstern-hjelp .+/);
  });

  it("uten tittel rendres kun brødtekst (ingen tom fet linje)", () => {
    render(
      <Tooltip tekst="Bare brødtekst">
        <span>ord</span>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("Bare brødtekst");
    expect(tip.querySelector(".font-semibold")).toBeNull();
  });

  it("rikt `innhold` rendres UNDER brødteksten inne i hover-boksen (oversatt variant)", () => {
    render(
      <Tooltip
        tekst="Vekstjordlag over 50 cm deles i to lag."
        innhold={<span className="oversatt-variant italic">Growth soil layer over 50 cm.</span>}
      >
        <span>ⓘ</span>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip");
    // Både brødtekst og det rike tilleggsinnholdet ligger i SAMME tooltip-node.
    expect(tip.textContent).toContain("Vekstjordlag over 50 cm deles i to lag.");
    expect(tip.querySelector(".oversatt-variant")?.textContent).toBe("Growth soil layer over 50 cm.");
  });

  it("uten `innhold` rendres ingen tilleggsblokk — de eksisterende kallstedene er uendret", () => {
    render(
      <Tooltip tekst="Kort etikett">
        <span>ⓘ</span>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Kort etikett");
  });

  it("`maxBreddeKlasse` overstyrer default 280px kun når satt; default beholdes ellers", () => {
    const { rerender } = render(
      <Tooltip tekst="Lang hjelpetekst" maxBreddeKlasse="max-w-[400px]">
        <span>ⓘ</span>
      </Tooltip>,
    );
    let tip = screen.getByRole("tooltip");
    expect(tip.className).toContain("max-w-[400px]");
    expect(tip.className).not.toContain("max-w-[280px]");

    // Uten overstyring faller den tilbake til default — de korte tooltipsene er urørt.
    rerender(
      <Tooltip tekst="Kort etikett">
        <span>ⓘ</span>
      </Tooltip>,
    );
    tip = screen.getByRole("tooltip");
    expect(tip.className).toContain("max-w-[280px]");
  });
});
