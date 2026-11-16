import { describe, it, expect } from "vitest";
import { vedleggKilde } from "./vedleggKilde";

/**
 * Telefontest A funn 2: lokalfila vises bare så lenge kvitteringen ikke er bekreftet
 * (`serverUrl` mangler). Når serveren har den, vises den signerte server-URL-en — lokalfila
 * er da slettet og en død `lokalSti` skal ikke vinne.
 */
describe("vedleggKilde", () => {
  it("uten serverUrl: lokal fil, ingen signering", () => {
    expect(vedleggKilde({ lokalSti: "file:///a.jpg", serverUrl: null })).toEqual({ lokal: "file:///a.jpg", signer: false });
  });

  it("med serverUrl: signert URL vinner selv om lokalSti står igjen", () => {
    expect(vedleggKilde({ lokalSti: "file:///a.jpg", serverUrl: "/uploads/privat/a.jpg" })).toEqual({ lokal: null, signer: true });
  });

  it("verken lokal eller server: ingenting å vise", () => {
    expect(vedleggKilde({ lokalSti: null, serverUrl: null })).toEqual({ lokal: null, signer: false });
  });
});
