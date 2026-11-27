// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@sitedoc/ui";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finnMarkert } from "../Markering";
import type { Runde } from "../schema";
import { Testpanel } from "../Testpanel";

/**
 * RETUR testpanel-modal (Kenneth 2026-11-27: «modalen deaktiverte testpanelet»).
 * `Modal` bruker native `showModal()`: alt utenfor dialogen blir inert (målt i Chromium).
 * Panelet må derfor ligge INNI det øverste åpne vinduet. jsdom har ikke inert/top layer,
 * så testene måler plasseringen og at vinduet ikke lukkes av panelet.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/dashbord/timer/mine" }));

// jsdom har ikke <dialog>.showModal (Modal i @sitedoc/ui bruker den).
const dialogProto = HTMLDialogElement.prototype as unknown as { showModal?: () => void; close?: () => void };
dialogProto.showModal = function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
dialogProto.close = function (this: HTMLDialogElement) {
  this.removeAttribute("open");
};

const RUNDE: Runde = {
  runde: "modal",
  hash: "e80497c1",
  steg: [
    {
      nr: 1,
      hvaTestes: "Reisevinduet",
      handling: "Klikk Reise",
      forventet: "Vinduet vises",
      agentSa: "Vinduet vises",
      agentVurdering: "godkjent",
      status: "venter_kenneth",
      kenneth: null,
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ runde: RUNDE }))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-testpanel");
});

let åpneUtenfra: (v: boolean) => void = () => {};
let åpneIndre: (v: boolean) => void = () => {};

function Side({ onClose }: { onClose: () => void }) {
  const [åpen, setÅpen] = useState(false);
  const [indre, setIndre] = useState(false);
  åpneUtenfra = setÅpen;
  åpneIndre = setIndre;
  return (
    <>
      <button type="button">Annet sted</button>
      <Modal
        open={åpen}
        onClose={() => {
          setÅpen(false);
          onClose();
        }}
        title="Reise"
        lukkVedBackdropKlikk
      >
        <button type="button">Annet sted</button>
        <Modal open={indre} onClose={() => setIndre(false)} title="Indre">
          <p>indre</p>
        </Modal>
      </Modal>
    </>
  );
}

async function vis() {
  const onClose = vi.fn();
  render(
    <>
      <Side onClose={onClose} />
      <Testpanel />
    </>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByText("Reisevinduet");
  return { onClose };
}

async function settÅpen(fn: (v: boolean) => void, v: boolean) {
  await act(async () => {
    fn(v);
    await Promise.resolve();
  });
  // MutationObserver-tilbakekall kjøres som mikrooppgave.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const panel = () => screen.getByTestId("testpanel");
const dialoger = () => Array.from(document.querySelectorAll("dialog"));

describe("Testpanel — SiteDoc-vindu åpent", () => {
  it("panelet flytter inn i det åpne vinduet og tilbake når det lukkes", async () => {
    await vis();
    expect(panel().closest("dialog")).toBeNull();
    await settÅpen(åpneUtenfra, true);
    expect(panel().closest("dialog")).toBe(dialoger()[0]);
    await settÅpen(åpneUtenfra, false);
    expect(panel().closest("dialog")).toBeNull();
  });

  it("nestede vinduer: panelet ligger i det sist åpnede", async () => {
    await vis();
    await settÅpen(åpneUtenfra, true);
    await settÅpen(åpneIndre, true);
    expect(panel().closest("dialog")).toBe(dialoger()[1]);
    await settÅpen(åpneIndre, false);
    expect(panel().closest("dialog")).toBe(dialoger()[0]);
  });

  it("merknad og tegning står gjennom åpning og lukking av vinduet", async () => {
    await vis();
    fireEvent.change(screen.getByLabelText("Merknad"), { target: { value: "skrevet før" } });
    fireEvent.click(screen.getByRole("button", { name: "Tegn" }));
    const lag = () => screen.getByTestId("testpanel-tegning");
    fireEvent.pointerDown(lag(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(lag(), { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(lag(), { clientX: 80, clientY: 60, pointerId: 1 });
    await settÅpen(åpneUtenfra, true);
    expect(lag().closest("dialog")).toBe(dialoger()[0]);
    expect((screen.getByLabelText("Merknad") as HTMLTextAreaElement).value).toBe("skrevet før");
    expect(lag().querySelectorAll("line")).toHaveLength(1);
    await settÅpen(åpneUtenfra, false);
    expect((screen.getByLabelText("Merknad") as HTMLTextAreaElement).value).toBe("skrevet før");
    expect(lag().querySelectorAll("line")).toHaveLength(1);
  });

  it("klikk i panelet virker og lukker ikke vinduet", async () => {
    const { onClose } = await vis();
    await settÅpen(åpneUtenfra, true);
    const godkjent = screen.getByRole("button", { name: "Godkjent" });
    fireEvent.click(godkjent);
    expect(godkjent.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Tegn" }));
    expect(screen.getByRole("button", { name: "Tegn" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Tegn" }));
    fireEvent.change(screen.getByLabelText("Merknad"), { target: { value: "ok" } });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialoger()[0]?.hasAttribute("open")).toBe(true);
  });

  it("Esc i et panelfelt med vindu åpent lukker ikke vinduet (preventDefault)", async () => {
    await vis();
    await settÅpen(åpneUtenfra, true);
    const hendelse = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    screen.getByLabelText("Merknad").dispatchEvent(hendelse);
    expect(hendelse.defaultPrevented).toBe(true);
  });

  it("Esc i panelet uten vindu åpent røres ikke", async () => {
    await vis();
    const hendelse = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    screen.getByLabelText("Merknad").dispatchEvent(hendelse);
    expect(hendelse.defaultPrevented).toBe(false);
  });
});

describe("Testpanel — handling i fet tekst", () => {
  it("handling rendres fet; hvaTestes og forventet er ikke fete", async () => {
    await vis();
    const handling = screen.getByTestId("testpanel-handling");
    expect(handling.textContent).toBe("Klikk Reise");
    expect(handling.className).toContain("font-bold");
    expect(screen.getByText("Reisevinduet").closest(".font-bold")).toBeNull();
  });
});

describe("finnMarkert — vindu åpent", () => {
  it("samme tekst bak og inni vinduet: treffet inni vinduet velges", () => {
    document.body.innerHTML =
      '<button id="bak">Annet sted</button><dialog open><button id="inni">Annet sted</button></dialog>';
    expect(finnMarkert({ tekst: "Annet sted" })?.id).toBe("inni");
    expect(finnMarkert({ selektor: "button" })?.id).toBe("inni");
  });

  it("uten åpent vindu: første treff i dokumentet, som før", () => {
    document.body.innerHTML =
      '<button id="bak">Annet sted</button><dialog><button id="inni">Annet sted</button></dialog>';
    expect(finnMarkert({ tekst: "Annet sted" })?.id).toBe("bak");
  });
});
