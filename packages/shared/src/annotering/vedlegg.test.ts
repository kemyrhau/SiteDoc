import { describe, it, expect } from "vitest";
import { annoteringsKilde, byggAnnoteringsPatch, erAnnotert } from "./vedlegg";
import type { AnnoteringsLag } from "./lag";

const LAG: AnnoteringsLag = { fabricVersion: "5.3.0", bredde: 390, hoyde: 520, objekter: [{ type: "circle" }] };

describe("annoteringsKilde — laget og basisbildet hører sammen", () => {
  it("med lag: åpner originalen", () => {
    expect(annoteringsKilde({ url: "/uploads/privat/a2.jpg", originalUrl: "/uploads/privat/o.jpg", annotering: LAG })).toBe(
      "/uploads/privat/o.jpg",
    );
  });

  it("med lag, uten originalUrl: åpner url", () => {
    expect(annoteringsKilde({ url: "/uploads/privat/o.jpg", annotering: LAG })).toBe("/uploads/privat/o.jpg");
  });

  it("🔴 originalUrl UTEN lag (mobil-annotert før laget fantes): åpner det innbrente bildet, ikke originalen", () => {
    // Før åpnet web originalen her → de innbrente markeringene forsvant uten lag å gjenskape dem.
    const v = { url: "/uploads/privat/innbrent.jpg", originalUrl: "/uploads/privat/o.jpg" };
    expect(annoteringsKilde(v)).toBe(v.url);
    expect(erAnnotert(v)).toBe(false);
  });
});

describe("byggAnnoteringsPatch", () => {
  it("første annotering: originalUrl = dagens url, laget lagres", () => {
    expect(byggAnnoteringsPatch({ url: "/uploads/privat/o.jpg" }, "/uploads/privat/a.jpg", LAG)).toEqual({
      url: "/uploads/privat/a.jpg",
      originalUrl: "/uploads/privat/o.jpg",
      annotering: LAG,
    });
  });

  it("re-annotering: originalUrl uendret, nytt lag", () => {
    const p = byggAnnoteringsPatch(
      { url: "/uploads/privat/a.jpg", originalUrl: "/uploads/privat/o.jpg", annotering: LAG },
      "file:///doc/a2.jpg",
      LAG,
    );
    expect(p.originalUrl).toBe("/uploads/privat/o.jpg");
    expect(p.annotering).toBe(LAG);
  });

  it("lokal original (ikke lastet opp ennå): originalUrl er lokalstien, laget lagres", () => {
    const p = byggAnnoteringsPatch({ url: "file:///doc/o.jpg" }, "file:///doc/a.jpg", LAG);
    expect(p).toEqual({ url: "file:///doc/a.jpg", originalUrl: "file:///doc/o.jpg", annotering: LAG });
  });

  it("innbrent bilde med egen originalUrl: INGEN lag (det ville lagt seg på feil bilde ved gjenåpning)", () => {
    const p = byggAnnoteringsPatch(
      { url: "/uploads/privat/innbrent.jpg", originalUrl: "/uploads/privat/o.jpg" },
      "/uploads/privat/ny.jpg",
      LAG,
    );
    expect(p.originalUrl).toBe("/uploads/privat/o.jpg");
    expect(p.annotering).toBeUndefined();
  });
});
