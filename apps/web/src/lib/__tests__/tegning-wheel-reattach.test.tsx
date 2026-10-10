// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { useEffect, useRef } from "react";
import { render, cleanup, act } from "@testing-library/react";
import { klassifiserWheel } from "../tegningZoomGest";

// PROD-REGRESJON web (2026-10-11): touchpad-pinch i Chrome sendes som `wheel` med
// `ctrlKey=true`. Tegningsviseren fanger den med en `{passive:false}`-wheel-lytter og
// `preventDefault()` (ellers zoomer Chrome HELE siden). Lytteren festes i en useEffect i
// `tegninger/page.tsx`. Da en NY REVISJON lastes opp byttes DOM-noden som bærer
// `containerRef` (conversionStatus/fileType/fileUrl = `containerVariant` endres), men
// `tegningId`/`isLoading` er UENDRET fordi en revisjon deler tegning-id. Lå `containerVariant`
// ikke i effektens dep-array, re-festet ikke lytteren seg på den nye noden → pinch lekket til
// Chrome → pageZoom vokste pr. pinch («hele vinduet større enn skjermen», «hjul/touchpad
// virker ikke»). Denne testen låser kontrakten: lytteren MÅ følge node-byttet.
//
// jsdom gjør ingen layout, men honorerer addEventListener({passive:false}) + preventDefault,
// så defaultPrevented er en gyldig måling av at pinch ble fanget.

afterEach(cleanup);

// Harness som speiler gest-effekten i tegninger/page.tsx: en stabil forelder holder
// effekten; den ref-bærende noden byttes via `key` når `variant` endres (som når en ny
// revisjon remounter containeren). `inkluderVariant` velger mellom buggy og fikset dep-array.
function Viewer({ variant, inkluderVariant }: { variant: string; inkluderVariant: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tegningId = "T1"; // uendret på tvers av revisjoner — som i den ekte siden
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (klassifiserWheel(e) === "knip") e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, inkluderVariant ? [tegningId, variant] : [tegningId]);
  return <div ref={ref} key={variant} data-testid="cont" />;
}

function pinch(el: Element): boolean {
  const ev = new WheelEvent("wheel", { ctrlKey: true, deltaY: -40, cancelable: true, bubbles: true });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

describe("tegning-viser: wheel-lytter re-festes når revisjonen bytter container-node", () => {
  it("MED containerVariant i deps: ctrl+wheel fanges (defaultPrevented) også etter revisjonsbytte", () => {
    const { getByTestId, rerender } = render(<Viewer variant="rev-A" inkluderVariant />);
    expect(pinch(getByTestId("cont"))).toBe(true); // før bytte: lytter til stede

    // Ny revisjon → container-noden byttes (ny `key`).
    act(() => rerender(<Viewer variant="rev-B" inkluderVariant />));
    expect(pinch(getByTestId("cont"))).toBe(true); // ETTER bytte: lytteren fulgte med
  });

  it("UTEN containerVariant i deps (regresjonen): pinch lekker etter revisjonsbytte", () => {
    const { getByTestId, rerender } = render(<Viewer variant="rev-A" inkluderVariant={false} />);
    expect(pinch(getByTestId("cont"))).toBe(true); // før bytte: OK

    act(() => rerender(<Viewer variant="rev-B" inkluderVariant={false} />));
    // Den nye noden har INGEN lytter → Chrome ville zoomet hele siden. Dette er feilen
    // fiksen fjerner; testen dokumenterer hvorfor dep-en er nødvendig.
    expect(pinch(getByTestId("cont"))).toBe(false);
  });
});
