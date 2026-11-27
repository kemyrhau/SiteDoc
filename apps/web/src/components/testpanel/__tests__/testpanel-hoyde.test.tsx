// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Runde } from "../schema";
import { Testpanel } from "../Testpanel";

/**
 * Testpanel-høyde (Kenneth 2026-11-27: «modalen er så lang at den ligger bak testpanelet»).
 * Et modalt vindu ligger i top layer og sentreres mot hele viewporten (UA: inset 0,
 * max-height calc(100% - 2em - 6px)). Mens panelet er montert må vinduet holde seg over
 * panelet og rulle inni. jsdom har ikke layout, så testen måler regelen; selve plasseringen
 * er målt i Chromium (lokal-dev.md § Testpanel).
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/dashbord/timer/mine" }));

const RUNDE: Runde = { runde: "hoyde", hash: "e80497c1", steg: [] };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ runde: RUNDE }))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-testpanel");
});

/** Deklarasjonene i regelen for `html[data-testpanel] dialog:modal`, uten mellomrom. */
function dialogRegel(css: string): string | null {
  const m = /html\[data-testpanel\]\s+dialog:modal\s*\{([^}]*)\}/.exec(css);
  return m ? (m[1] ?? "").replace(/\s+/g, "") : null;
}

describe("Kenneth: «modalen er så lang at den ligger bak testpanelet»", () => {
  it("høyt SiteDoc-vindu holdes over panelet og ruller inni (bottom + max-height fra --testpanel-h)", async () => {
    render(<Testpanel />);
    const panel = await screen.findByTestId("testpanel");
    const css = Array.from(panel.querySelectorAll("style")).map((s) => s.textContent ?? "").join("\n");
    const regel = dialogRegel(css);
    expect(regel).not.toBeNull();
    expect(regel).toContain("bottom:var(--testpanel-h)");
    expect(regel).toContain("max-height:calc(100vh-var(--testpanel-h)-2em-6px)");
    expect(document.documentElement.hasAttribute("data-testpanel")).toBe(true);
  });
});
