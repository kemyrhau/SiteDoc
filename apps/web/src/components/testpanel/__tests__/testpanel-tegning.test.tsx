// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Runde } from "../schema";
import { Testpanel } from "../Testpanel";

/** TILLEGG 4 (Kenneth 2026-11-27): tegneverktøy over SiteDoc, lagres ikke. */

const sti = vi.hoisted(() => ({ verdi: "/dashbord/timer" }));
vi.mock("next/navigation", () => ({ usePathname: () => sti.verdi }));

const RUNDE: Runde = {
  runde: "eksempel",
  hash: "e82c8dc9",
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

let fetchMock: Mock<(url: string, init?: RequestInit) => Promise<Response>>;
let sitedocKlikk: Mock<(e: Event) => void>;
let documentPointer: Mock<(e: Event) => void>;

beforeEach(() => {
  sti.verdi = "/dashbord/timer";
  fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ runde: RUNDE })));
  vi.stubGlobal("fetch", fetchMock);
  sitedocKlikk = vi.fn((_e: Event) => {});
  documentPointer = vi.fn((_e: Event) => {});
  document.addEventListener("pointerdown", documentPointer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.removeEventListener("pointerdown", documentPointer);
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-testpanel");
});

async function vis() {
  // En SiteDoc-knapp under overlegget.
  const knapp = document.createElement("button");
  knapp.textContent = "SiteDoc-knapp";
  knapp.addEventListener("click", sitedocKlikk);
  document.body.append(knapp);
  const r = render(<Testpanel />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByText("Reisevinduet");
  return { knapp, ...r };
}

const lag = () => screen.getByTestId("testpanel-tegning") as unknown as SVGSVGElement;
const tegnKnapp = () => screen.getByRole("button", { name: "Tegn" });

function dra(fra: [number, number], til: [number, number], via: [number, number][] = []) {
  fireEvent.pointerDown(lag(), { clientX: fra[0], clientY: fra[1], pointerId: 1 });
  for (const p of [...via, til]) fireEvent.pointerMove(lag(), { clientX: p[0], clientY: p[1], pointerId: 1 });
  fireEvent.pointerUp(lag(), { clientX: til[0], clientY: til[1], pointerId: 1 });
}

const figurer = () => lag().querySelectorAll("line, rect, ellipse, polyline");

describe("Testpanel — tegning", () => {
  it("Tegn på: overlegget fanger pekeren, og hendelser når ikke SiteDoc", async () => {
    await vis();
    fireEvent.click(tegnKnapp());
    expect(lag().style.pointerEvents).toBe("auto");
    expect(lag().style.position).toBe("fixed");
    fireEvent.pointerDown(lag(), { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.click(lag());
    expect(documentPointer).not.toHaveBeenCalled();
    expect(sitedocKlikk).not.toHaveBeenCalled();
  });

  it("Tegn av: tegningen står med pointer-events none, og SiteDoc kan klikkes", async () => {
    const { knapp } = await vis();
    fireEvent.click(tegnKnapp());
    dra([10, 10], [80, 60]);
    fireEvent.click(tegnKnapp());
    expect(lag().style.pointerEvents).toBe("none");
    expect(figurer()).toHaveLength(1);
    fireEvent.click(knapp);
    expect(sitedocKlikk).toHaveBeenCalledTimes(1);
  });

  it("rektangel, ellipse, pil og frihånd tegnes; et klikk uten å dra gir ingen figur", async () => {
    await vis();
    fireEvent.click(tegnKnapp());
    fireEvent.click(screen.getByRole("button", { name: "Rektangel" }));
    dra([10, 10], [80, 60]);
    fireEvent.click(screen.getByRole("button", { name: "Ellipse" }));
    dra([100, 100], [160, 140]);
    fireEvent.click(screen.getByRole("button", { name: "Pil" }));
    dra([5, 5], [50, 50]);
    fireEvent.click(screen.getByRole("button", { name: "Frihånd" }));
    dra([0, 0], [30, 30], [[10, 5], [20, 15]]);
    dra([200, 200], [200, 200]);
    expect(lag().querySelectorAll("rect")).toHaveLength(1);
    expect(lag().querySelectorAll("ellipse")).toHaveLength(1);
    expect(lag().querySelector("line")?.getAttribute("marker-end")).toContain("testpanel-pil");
    expect(lag().querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(4);
    expect(figurer()).toHaveLength(4);
  });

  it("farge velges; Angre fjerner siste figur; Tøm fjerner alt", async () => {
    await vis();
    fireEvent.click(tegnKnapp());
    fireEvent.click(screen.getByRole("button", { name: "Rektangel" }));
    dra([10, 10], [80, 60]);
    fireEvent.click(screen.getByRole("button", { name: "Blå" }));
    dra([100, 100], [160, 140]);
    expect(lag().querySelectorAll("rect")[1]?.getAttribute("stroke")).toBe("#2563eb");
    fireEvent.click(screen.getByRole("button", { name: "Angre" }));
    expect(figurer()).toHaveLength(1);
    expect(lag().querySelector("rect")?.getAttribute("stroke")).toBe("#dc2626");
    dra([1, 1], [40, 40]);
    fireEvent.click(screen.getByRole("button", { name: "Tøm" }));
    expect(screen.queryByTestId("testpanel-tegning")).not.toBeNull();
    expect(figurer()).toHaveLength(0);
  });

  it("Esc slår Tegn av; tegningen står", async () => {
    await vis();
    fireEvent.click(tegnKnapp());
    dra([10, 10], [80, 60]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(tegnKnapp().getAttribute("aria-pressed")).toBe("false");
    expect(lag().style.pointerEvents).toBe("none");
    expect(figurer()).toHaveLength(1);
  });

  it("stibytte tømmer tegningen", async () => {
    const { rerender } = await vis();
    fireEvent.click(tegnKnapp());
    dra([10, 10], [80, 60]);
    fireEvent.click(tegnKnapp());
    sti.verdi = "/dashbord/timer/mine";
    rerender(<Testpanel />);
    expect(screen.queryByTestId("testpanel-tegning")).toBeNull();
  });

  it("lagres ikke: ingen localStorage-skriving og ingen POST under en tegneøkt", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await vis();
    fireEvent.click(tegnKnapp());
    for (const v of ["Pil", "Linje", "Rektangel", "Ellipse", "Frihånd"]) {
      fireEvent.click(screen.getByRole("button", { name: v }));
      dra([10, 10], [80, 60], [[40, 30]]);
    }
    fireEvent.click(screen.getByRole("button", { name: "Angre" }));
    fireEvent.click(screen.getByRole("button", { name: "Tøm" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(setItem).not.toHaveBeenCalled();
    const metoder = fetchMock.mock.calls.map((k) => k[1]?.method);
    expect(metoder.filter((m) => m && m !== "GET")).toEqual([]);
  });
});
