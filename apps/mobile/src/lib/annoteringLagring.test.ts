import { describe, it, expect } from "vitest";
import type { AnnoteringsLag } from "@sitedoc/shared";
import { annoteringsApning, byggKameraAnnotering, byggMobilAnnotering, erstattetVedlegg } from "./annoteringLagring";
import type { Vedlegg } from "../hooks/useSjekklisteSkjema";

// Redigerbar annotering på mobil (Kenneth 2026-10-28): før sendte mobil `settBilde` uten lag og
// åpnet den innbrente JPEG-en — tidligere markeringer kunne ikke endres.

const LAG: AnnoteringsLag = { fabricVersion: "5.3.0", bredde: 390, hoyde: 520, objekter: [{ type: "circle" }] };
const server: Vedlegg = { id: "v", type: "bilde", url: "/uploads/privat/o.jpg", filnavn: "o.jpg" };

describe("Ferdig lagrer laget (som web)", () => {
  it("server-original: laget + originalUrl lagres, ingen lokal original å holde i køen", () => {
    const { felter, beholdLokalSti } = byggMobilAnnotering(server, "file:///doc/annotert_1.jpg", LAG);
    expect(felter).toEqual({ originalUrl: server.url, annotering: LAG });
    expect(beholdLokalSti).toBeUndefined();
    const ny = erstattetVedlegg(server, "file:///doc/annotert_1.jpg", "annotert_1.jpg", felter);
    expect(ny).toMatchObject({ url: "file:///doc/annotert_1.jpg", originalUrl: server.url, annotering: LAG });
  });

  it("offline: lokal original (ikke lastet opp) blir originalUrl og holdes i køen", () => {
    const lokal: Vedlegg = { ...server, url: "file:///doc/bilde_1.jpg" };
    const { felter, beholdLokalSti } = byggMobilAnnotering(lokal, "file:///doc/annotert_1.jpg", LAG);
    expect(felter.originalUrl).toBe("file:///doc/bilde_1.jpg");
    expect(beholdLokalSti).toBe("file:///doc/bilde_1.jpg");
  });

  it("re-annotering: originalUrl står fast, laget byttes", () => {
    const annotert: Vedlegg = { ...server, url: "/uploads/privat/a1.jpg", originalUrl: server.url, annotering: LAG };
    const nyttLag = { ...LAG, objekter: [] };
    const { felter } = byggMobilAnnotering(annotert, "file:///doc/annotert_2.jpg", nyttLag);
    expect(felter).toEqual({ originalUrl: server.url, annotering: nyttLag });
  });

  it("kamera-annotering (uten lag) fjerner et gammelt lag og bevarer server-originalen som før", () => {
    const annotert: Vedlegg = { ...server, url: "/uploads/privat/a1.jpg", originalUrl: server.url, annotering: LAG };
    const ny = erstattetVedlegg(annotert, "file:///doc/k.jpg", "k.jpg");
    expect(ny.annotering).toBeUndefined();
    expect(ny.originalUrl).toBe(server.url);
  });
});

describe("Gjenåpning gir objektene", () => {
  it("med lag: originalen åpnes med laget, i Flytt", () => {
    const annotert: Vedlegg = { ...server, url: "/uploads/privat/a1.jpg", originalUrl: server.url, annotering: LAG };
    expect(annoteringsApning(annotert)).toEqual({ kilde: server.url, lag: LAG, startVerktoy: "select" });
  });

  it("annotert før laget fantes (originalUrl uten lag): det innbrente bildet, tegn oppå", () => {
    const flatt: Vedlegg = { ...server, url: "/uploads/privat/innbrent.jpg", originalUrl: server.url };
    expect(annoteringsApning(flatt)).toEqual({ kilde: flatt.url, lag: undefined, startVerktoy: "arrow" });
  });

  it("offline før opplastingen er ferdig: den lokale originalen åpnes med laget", () => {
    const lokal: Vedlegg = { ...server, url: "file:///doc/annotert_1.jpg", originalUrl: "file:///doc/bilde_1.jpg", annotering: LAG };
    expect(annoteringsApning(lokal).kilde).toBe("file:///doc/bilde_1.jpg");
  });
});

describe("kamera-annotering lagrer laget (telefontest 2026-10-29, funn 1c)", () => {
  it("bilde tatt i økta (lokal original): laget + lokal original, originalen holdes i køen", () => {
    const lokal: Vedlegg = { ...server, url: "file:///doc/bilde_1.jpg" };
    const { felter, beholdLokalSti } = byggKameraAnnotering(lokal, "file:///doc/annotert_1.jpg", LAG);
    expect(felter).toEqual({ originalUrl: "file:///doc/bilde_1.jpg", annotering: LAG });
    expect(beholdLokalSti).toBe("file:///doc/bilde_1.jpg");
  });

  it("annotert på nytt i kameraet: originalen står fast og det nye laget lagres", () => {
    const annotert: Vedlegg = { ...server, url: "file:///doc/annotert_1.jpg", originalUrl: "file:///doc/bilde_1.jpg", annotering: LAG };
    const nyttLag = { ...LAG, objekter: [{ type: "rect" }] };
    const { felter } = byggKameraAnnotering(annotert, "file:///doc/annotert_2.jpg", nyttLag);
    expect(felter).toEqual({ originalUrl: "file:///doc/bilde_1.jpg", annotering: nyttLag });
  });

  it("vedlegget finnes ikke: lagres uten lag som før", () => {
    expect(byggKameraAnnotering(undefined, "file:///doc/annotert_1.jpg", LAG)).toEqual({ felter: undefined, beholdLokalSti: undefined });
  });
});
