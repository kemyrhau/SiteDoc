import { describe, it, expect } from "vitest";
import { bekreftOpptak, kanAnnoteres, leggTilVentende } from "./kameraStripe";

// Telefontest 2026-10-29 (funn 4): miniatyrene i kameraet kom ca. 5 s etter opptaket — de ventet på
// komprimering, GPS og køen. Nå vises de straks og bekreftes når vedlegget er registrert.

describe("miniatyrstripa i kameraet", () => {
  it("opptaket vises straks, nyeste først, men kan ikke annoteres før det er registrert", () => {
    const en = leggTilVentende([], "k1", "file:///cam/1.jpg");
    const to = leggTilVentende(en, "k2", "file:///cam/2.jpg");
    expect(to.map((b) => b.nokkel)).toEqual(["k2", "k1"]);
    expect(to[0]).toMatchObject({ uri: "file:///cam/2.jpg", vedleggId: null, annotert: false });
    expect(kanAnnoteres(to[0]!)).toBe(false);
  });

  it("registrert: kobles til vedlegget og den komprimerte kopien, og kan annoteres", () => {
    const stripe = leggTilVentende(leggTilVentende([], "k1", "file:///cam/1.jpg"), "k2", "file:///cam/2.jpg");
    const ny = bekreftOpptak(stripe, "k1", { vedleggId: "v1", uri: "file:///cache/k1.jpg" });
    expect(ny[1]).toMatchObject({ vedleggId: "v1", uri: "file:///cache/k1.jpg", originalUri: "file:///cache/k1.jpg" });
    expect(kanAnnoteres(ny[1]!)).toBe(true);
    expect(ny[0]).toBe(stripe[0]);
  });

  it("registreringen feilet: miniatyren fjernes", () => {
    const stripe = leggTilVentende([], "k1", "file:///cam/1.jpg");
    expect(bekreftOpptak(stripe, "k1", null)).toEqual([]);
  });
});
