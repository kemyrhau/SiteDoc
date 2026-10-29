import { describe, it, expect } from "vitest";
import { miniatyrKilde } from "./miniatyrKilde";

// Telefontest 2026-10-29 (funn 1): et bilde tatt og annotert i samme økt viste «Kunne ikke laste» i
// skjemaet — miniatyren hentet den rå `originalUrl` (401) i stedet for det annoterte bildet.

const API = "https://api-test.sitedoc.no";
const RESERVE = "file:///doc/sitedoc-bilder/annotert_1.jpg";

describe("miniatyrKilde", () => {
  it("annotert i rå-vinduet: viser det annoterte bildet, aldri originalen", () => {
    const v = { url: "/uploads/privat/annotert.jpg", originalUrl: "/uploads/privat/original.jpg" };
    expect(miniatyrKilde(v, API, RESERVE)).toBe(`${API}/uploads/privat/annotert.jpg`);
  });

  it("annotert med lokal original i rå-vinduet: det annoterte bildet", () => {
    const v = { url: "/uploads/privat/annotert.jpg", originalUrl: "file:///doc/bilde_1.jpg" };
    expect(miniatyrKilde(v, API, RESERVE)).toBe(`${API}/uploads/privat/annotert.jpg`);
  });

  it("uten annotering i rå-vinduet: lokalfila som før", () => {
    expect(miniatyrKilde({ url: "/uploads/privat/b.jpg" }, API, RESERVE)).toBe(RESERVE);
  });

  it("lokal url vises direkte, signert server-url får api-prefiks", () => {
    expect(miniatyrKilde({ url: "file:///doc/b.jpg" }, API, RESERVE)).toBe("file:///doc/b.jpg");
    const signert = "/uploads/privat/b.jpg?exp=1&sig=x";
    expect(miniatyrKilde({ url: signert, originalUrl: "/uploads/privat/o.jpg" }, API, RESERVE)).toBe(`${API}${signert}`);
  });
});
