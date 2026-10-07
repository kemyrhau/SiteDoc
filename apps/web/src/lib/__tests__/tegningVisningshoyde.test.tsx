// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { useLayoutEffect, useRef } from "react";
import { render, cleanup, act } from "@testing-library/react";
import { settVisningshøyde, tilgjengeligHøyde } from "../tegningVisningshoyde";

// Regresjonsvakt for tegnings-zoomens ROTÅRSAK (feltfunn 24.09 + Kenneth 2026-10-07):
// zoomen traff ikke musepekeren vertikalt og «havnet midt på toppen», OG verktøylinja
// forsvant ved scroll. Begge skyldtes at scroll-containeren manglet en DEFINIT høyde
// (den delte `<main>` er display:block → `flex-1` nedover er inert). Uten definit
// høyde får containeren ingen vertikal overflyt, så musehjul-zoomens `scrollTop`-
// korreksjon blir en no-op. Målt i ekte nettleser: feil −63 px vertikalt FØR, ±0,2 px
// ETTER. Formelen i zoom-scroll.ts var hele tiden korrekt (dx traff); feilen lå i
// containment. jsdom gjør ingen layout, så rektanglene måles via mock — i tråd med
// ordrens «jsdom med målte rektangler».

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("tilgjengeligHøyde", () => {
  it("er avstanden fra container-topp til bunnen av vinduet", () => {
    expect(tilgjengeligHøyde(90, 1192)).toBe(1102);
  });
  it("klippes aldri til negativt (container utenfor skjerm)", () => {
    expect(tilgjengeligHøyde(1300, 1192)).toBe(0);
  });
});

describe("settVisningshøyde", () => {
  it("gir en flex-1-container en definit, vindusforankret høyde og overstyrer flex", () => {
    const el = document.createElement("div");
    el.className = "flex-1 overflow-auto"; // slik containeren er i dag
    // Måling: toppen ligger 90 px ned (toppbar + verktøylinje + header).
    el.getBoundingClientRect = () => ({ top: 90, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} });

    // FØR fiksen: ingen definit høyde → containeren arver den inerte flex-1 og får
    // aldri vertikal overflyt. Dette er tilstanden som brøt zoomen.
    expect(el.style.height).toBe("");

    const satt = settVisningshøyde(el, 1192);

    // ETTER fiksen: definit høyde = 1192 − 90, og flex nøytralisert så høyden gjelder.
    expect(satt).toBe(1102);
    expect(el.style.height).toBe("1102px");
    // `flex: none` nøytraliserer flex-1 (grow 0) → den eksplisitte høyden gjelder.
    // (jsdom serialiserer kortformen til langform "0 0 auto".)
    expect(el.style.flexGrow).toBe("0");
  });
});

// Mount-test: verifiserer at den SAMME delte funksjonen settes i en useLayoutEffect
// på mount (slik tegninger/page.tsx gjør) og at containeren ender med definit høyde.
// Uten fiksen (ingen slik effekt) ville høyden forblitt "".
function Visning({ innerHeight }: { innerHeight: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.getBoundingClientRect = () =>
      ({ top: 90, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
    settVisningshøyde(el, innerHeight);
  }, [innerHeight]);
  return (
    <div className="flex flex-1 flex-col">
      <div data-testid="container" ref={ref} className="flex-1 overflow-auto" />
    </div>
  );
}

describe("visnings-container i React-mount", () => {
  beforeEach(() => {
    // jsdom har ingen ResizeObserver; effekten i page.tsx bruker den, men her holder
    // mount-målingen. Stub for å speile miljøet uten å feile hvis den tas i bruk.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("får definit høyde ved mount", () => {
    let utils: ReturnType<typeof render>;
    act(() => {
      utils = render(<Visning innerHeight={1192} />);
    });
    const container = utils!.getByTestId("container");
    expect(container.style.height).toBe("1102px");
    expect(container.style.flexGrow).toBe("0");
  });
});
