// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markering, finnMarkert } from "../Markering";
import type { Runde } from "../schema";
import { Testpanel } from "../Testpanel";

/** RETUR 2 (Kenneth 2026-11-27): markering før klikk, agentNaa, pause og forbedring underveis. */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-testpanel");
});

function side() {
  const knapp = document.createElement("button");
  knapp.textContent = " Lagre  reise ";
  knapp.id = "lagre";
  const skjult = document.createElement("div");
  skjult.hidden = true;
  skjult.innerHTML = "<button>Skjult</button>";
  document.body.append(knapp, skjult);
  return knapp;
}

describe("finnMarkert", () => {
  it("finner på synlig tekst (normalisert mellomrom), aria-label og selektor", () => {
    const knapp = side();
    expect(finnMarkert({ tekst: "Lagre reise" })).toBe(knapp);
    knapp.setAttribute("aria-label", "Lagre");
    expect(finnMarkert({ tekst: "Lagre" })).toBe(knapp);
    expect(finnMarkert({ selektor: "#lagre" })).toBe(knapp);
  });
  it("hopper over skjulte elementer og ugyldig selektor", () => {
    side();
    expect(finnMarkert({ tekst: "Skjult" })).toBeNull();
    expect(finnMarkert({ selektor: "##ugyldig" })).toBeNull();
  });
});

describe("Markering", () => {
  it("tegnes over elementet uten å fange klikk, og fjernes når feltet tømmes", () => {
    side();
    const { rerender } = render(<Markering markering={{ tekst: "Lagre reise" }} />);
    const ramme = screen.getByTestId("testpanel-markering");
    expect(ramme.style.position).toBe("fixed");
    expect(ramme.style.pointerEvents).toBe("none");
    rerender(<Markering markering={null} />);
    expect(screen.queryByTestId("testpanel-markering")).toBeNull();
  });
  it("viser «Fant ikke» når elementet mangler", () => {
    render(<Markering markering={{ tekst: "Finnes ikke" }} />);
    expect(screen.getByTestId("testpanel-markering-mangler").textContent).toContain("Finnes ikke");
  });
});

function runde(over: Partial<Runde> = {}): Runde {
  return {
    runde: "eksempel",
    hash: "e82c8dc9",
    agentNaa: "går til Timer → Mine timer",
    steg: [
      {
        nr: 1,
        hvaTestes: "Reisevinduet",
        handling: "Klikk Reise",
        forventet: "Vinduet vises",
        agentSa: null,
        agentVurdering: null,
        status: "venter_agent",
        kenneth: null,
        markering: { tekst: "Lagre reise" },
      },
    ],
    ...over,
  };
}

async function vis(r: Runde) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ runde: r })));
  vi.stubGlobal("fetch", fetchMock);
  render(<Testpanel />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByText("Reisevinduet");
  return fetchMock;
}

const postBodyer = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls
    .map((k) => (k as unknown[])[1] as RequestInit | undefined)
    .filter((i) => i?.method === "POST")
    .map((i) => JSON.parse(i!.body as string) as unknown);

describe("Testpanel — RETUR 2", () => {
  it("viser agentNaa og tegner markeringen fra steget", async () => {
    side();
    await vis(runde());
    expect(screen.getByText("Agenten: går til Timer → Mine timer")).toBeTruthy();
    expect(screen.getByTestId("testpanel-markering")).toBeTruthy();
  });

  it("forbedring kan lagres mens agenten kjører; vurdering og Neste er låst", async () => {
    const f = await vis(runde());
    const knapp = () => screen.getByRole("button", { name: "Lagre forbedring" }) as HTMLButtonElement;
    expect(knapp().disabled).toBe(true);
    const felt = screen.getByLabelText("Forbedring") as HTMLTextAreaElement;
    expect(felt.disabled).toBe(false);
    fireEvent.change(felt, { target: { value: "Større knapp" } });
    expect(knapp().disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Godkjent" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Neste" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(knapp());
    });
    expect(postBodyer(f)).toEqual([{ type: "forbedring", nr: 1, tekst: "Større knapp" }]);
    expect(felt.value).toBe("");
  });

  it("Pause sender pause: true; i pause vises «Fortsett» og banneret", async () => {
    const f = await vis(runde());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    });
    expect(postBodyer(f)).toEqual([{ type: "pause", pause: true }]);
    cleanup();
    await vis(runde({ pause: true }));
    expect(screen.getByRole("button", { name: "Fortsett" })).toBeTruthy();
    expect(screen.getByText("Pause — agenten venter")).toBeTruthy();
  });
});
