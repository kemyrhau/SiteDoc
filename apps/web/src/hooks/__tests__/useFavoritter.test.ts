// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFavoritter } from "../useFavoritter";

const KEY = "sitedoc_favoritter_u1";

// jsdom-miljøet her leverer `window`, men et `localStorage` uten Storage-metoder.
// Injiser en enkel in-memory-mock (hooken bruker den globale `localStorage`).
beforeEach(() => {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    configurable: true,
    writable: true,
  });
});

describe("useFavoritter — mount-race (cowork-målt 2026-08-21)", () => {
  it("toggle med tom state mens storage har innhold → innholdet overlever", () => {
    // Mount uten innhold → state = [] (load-effekten laster ingenting).
    const { result } = renderHook(() => useFavoritter("u1"));
    expect(result.current.favoritter).toEqual([]);

    // Racen: storage får innhold mens DENNE instansens state fortsatt er []
    // (async userId / remount før load-effekten rakk å kjøre).
    localStorage.setItem(KEY, JSON.stringify(["A"]));

    // Toggle av "B" mens state=[]. Fiksen leser storage FØR mutasjon:
    // "A" skal overleve, "B" legges til. Gammel kode (forrige=[]) ga ["B"].
    act(() => result.current.toggleFavoritt("B"));

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["A", "B"]);
  });

  it("toggle fjerner en eksisterende favoritt uten å røre de andre", () => {
    localStorage.setItem(KEY, JSON.stringify(["A", "B", "C"]));
    const { result } = renderHook(() => useFavoritter("u1"));

    act(() => result.current.toggleFavoritt("B"));

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["A", "C"]);
  });

  it("append + fjern via to toggles gir tom liste igjen", () => {
    const { result } = renderHook(() => useFavoritter("u1"));
    act(() => result.current.toggleFavoritt("X"));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(["X"]);
    act(() => result.current.toggleFavoritt("X"));
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
  });

  it("uten userId → toggle er no-op (ingen skriving)", () => {
    const { result } = renderHook(() => useFavoritter(undefined));
    act(() => result.current.toggleFavoritt("A"));
    expect(localStorage.getItem("sitedoc_favoritter_undefined")).toBeNull();
    expect(result.current.favoritter).toEqual([]);
  });

  it("egen nokkelPrefix lagres separat (byggeplass-favoritter)", () => {
    const { result } = renderHook(() =>
      useFavoritter("u1", "sitedoc_favoritter_byggeplass"),
    );
    act(() => result.current.toggleFavoritt("bp1"));
    expect(
      JSON.parse(localStorage.getItem("sitedoc_favoritter_byggeplass_u1")!),
    ).toEqual(["bp1"]);
    // Prosjekt-favoritt-nøkkelen er urørt.
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
