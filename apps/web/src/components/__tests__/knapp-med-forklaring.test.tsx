// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { Button } from "@sitedoc/ui";
import { KnappMedForklaring } from "../KnappMedForklaring";

/**
 * Regresjonsvakt: en disabled knapp må FORKLARE seg — ellers står vi igjen med den
 * stumme «stopptegn»-knappen Kenneth ikke klarte å tyde (ordre 2026-09-17).
 *
 * Kjernekontrakten er `aria-describedby`: når knappen er sperret pga. manglende
 * input, skal den peke på en tooltip-node hvis tekst sier HVA som mangler. Fjerner
 * noen wrapperen, forsvinner koblingen og testen blir rød. Vi verifiserer også at
 * hover FAKTISK åpner tooltipen (den innebygde wrapper-spanen mottar hover selv når
 * barnet er disabled — målt i ekte Chrome), og at en knapp som IKKE er sperret pga.
 * manglende input (f.eks. `loading`) ikke får noen tooltip.
 */
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("KnappMedForklaring — disabled knapp forklarer seg", () => {
  it("sperret knapp kobles til en tooltip som sier hva som mangler", () => {
    render(
      <KnappMedForklaring sperret forklaring="Du må gi dokumentflyten et navn">
        <Button disabled>Opprett</Button>
      </KnappMedForklaring>,
    );
    const knapp = screen.getByRole("button", { name: "Opprett" }) as HTMLButtonElement;
    const tip = screen.getByRole("tooltip");

    // Knappen er faktisk disabled ...
    expect(knapp.disabled).toBe(true);
    // ... og den forklarer HVORFOR: aria-describedby → tooltip-node med årsaksteksten.
    expect(tip.textContent).toContain("Du må gi dokumentflyten et navn");
    expect(tip.id).toBeTruthy();
    expect(knapp.getAttribute("aria-describedby")).toContain(tip.id);
  });

  it("hover på wrapperen åpner tooltipen selv om knappen er disabled", () => {
    vi.useFakeTimers();
    render(
      <KnappMedForklaring sperret forklaring="Du må gi dokumentflyten et navn">
        <Button disabled>Opprett</Button>
      </KnappMedForklaring>,
    );
    const tip = screen.getByRole("tooltip");
    // Lukket i utgangspunktet.
    expect(tip.className).toContain("invisible");

    // Tooltip legger hover-lytterne på sin egen wrapper-<span> (foreldrenoden til knappen).
    const wrapper = screen.getByRole("button", { name: "Opprett" }).parentElement!;
    act(() => {
      fireEvent.mouseEnter(wrapper);
      vi.advanceTimersByTime(400); // forbi ~300 ms vis-forsinkelse
    });

    expect(tip.className).toContain("opacity-100");
    expect(tip.className).not.toContain("invisible");
  });

  it("ikke sperret (f.eks. loading) → ingen tooltip, spinneren er signalet", () => {
    render(
      <KnappMedForklaring sperret={false} forklaring="Du må gi dokumentflyten et navn">
        <Button disabled loading>Opprett</Button>
      </KnappMedForklaring>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect((screen.getByRole("button", { name: "Opprett" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
