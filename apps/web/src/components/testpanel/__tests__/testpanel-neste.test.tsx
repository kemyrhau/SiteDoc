// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Runde } from "../schema";
import { Testpanel } from "../Testpanel";

/** (c) i komponenten: Neste-knappens låsing, og «Agenten kjører steget …» låser feltene. */

function runde(status: "venter_agent" | "venter_kenneth"): Runde {
  return {
    runde: "eksempel",
    hash: "99aa02d4",
    steg: [
      {
        nr: 1,
        hvaTestes: "Reisevinduet åpnes",
        handling: "Klikk Reise",
        forventet: "Vinduet vises",
        agentSa: status === "venter_kenneth" ? "Vinduet vises" : null,
        agentVurdering: status === "venter_kenneth" ? "godkjent" : null,
        status,
        kenneth: null,
      },
    ],
  };
}

async function vis(status: "venter_agent" | "venter_kenneth") {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ runde: runde(status) })));
  vi.stubGlobal("fetch", fetchMock);
  render(<Testpanel />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByText("Reisevinduet åpnes");
  return fetchMock;
}

const neste = () => screen.getByRole("button", { name: "Neste" });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-testpanel");
});

describe("Testpanel — Neste", () => {
  it("låst uten vurdering", async () => {
    await vis("venter_kenneth");
    expect((neste() as HTMLButtonElement).disabled).toBe(true);
  });

  it("låst ved Avvik uten merknad, åpnes når merknad fylles ut", async () => {
    await vis("venter_kenneth");
    fireEvent.click(screen.getByRole("button", { name: "Avvik" }));
    expect((neste() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Merknad"), { target: { value: "   " } });
    expect((neste() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Merknad"), { target: { value: "Feil tekst" } });
    expect((neste() as HTMLButtonElement).disabled).toBe(false);
  });

  it("åpen ved Godkjent med tom forbedring", async () => {
    await vis("venter_kenneth");
    fireEvent.click(screen.getByRole("button", { name: "Godkjent" }));
    expect((screen.getByLabelText("Forbedring") as HTMLTextAreaElement).value).toBe("");
    expect((neste() as HTMLButtonElement).disabled).toBe(false);
  });

  it("mens agenten kjører: tekst vises og alt er låst", async () => {
    await vis("venter_agent");
    expect(screen.getByText("Agenten kjører steget …")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Godkjent" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Merknad") as HTMLButtonElement).disabled).toBe(true);
    expect((neste() as HTMLButtonElement).disabled).toBe(true);
  });

  it("Neste sender svaret som POST", async () => {
    const fetchMock = await vis("venter_kenneth");
    fireEvent.click(screen.getByRole("button", { name: "Godkjent" }));
    fireEvent.change(screen.getByLabelText("Forbedring"), { target: { value: "Større knapp" } });
    await act(async () => {
      fireEvent.click(neste());
    });
    const postKall = fetchMock.mock.calls.find(
      (k) => (k as unknown[])[1] && ((k as unknown[])[1] as RequestInit).method === "POST",
    ) as unknown[] | undefined;
    expect(postKall).toBeDefined();
    expect(JSON.parse((postKall![1] as RequestInit).body as string)).toEqual({
      nr: 1,
      vurdering: "godkjent",
      merknad: "",
      forbedring: "Større knapp",
    });
  });

  it("setter bunnmarg-attributtet på <html> mens montert", async () => {
    await vis("venter_kenneth");
    expect(document.documentElement.hasAttribute("data-testpanel")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--testpanel-h")).toBe("260px");
    cleanup();
    expect(document.documentElement.hasAttribute("data-testpanel")).toBe(false);
  });
});
