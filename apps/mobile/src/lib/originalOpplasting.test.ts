import { describe, it, expect } from "vitest";
import { harLokaltVedlegg, type AnnoteringsLag } from "@sitedoc/shared";
import {
  anvendOpplasting,
  erLevendeOppforing,
  flatUtForeldreloseOriginaler,
  kanSletteForeldetFil,
} from "./originalOpplasting";

// RETUR M1 (Kontrollør, gate 777f85f7): feltet holdes unna serveren til originalen er oppe. Feilet
// originalen hardt, eller ble lokalfila slettet uten at noen tok server-URL-en, nådde HELE feltet
// (annotert bilde + kommentar) aldri serveren — før reddet annoteringen et slikt vedlegg.

const LAG: AnnoteringsLag = { fabricVersion: "5.3.0", bredde: 390, hoyde: 520, objekter: [{ type: "circle" }] };
const ORIGINAL = "file:///doc/sitedoc-bilder/bilde_1.jpg";
const felt = () => ({
  f1: {
    verdi: null,
    kommentar: "Riss i hjørnet",
    vedlegg: [{ id: "v", type: "bilde", url: "/uploads/privat/annotert.jpg", filnavn: "annotert_1.jpg", originalUrl: ORIGINAL, annotering: LAG }],
  },
});

describe("lokalfila til en foreldet original slettes ikke før noen har tatt URL-en", () => {
  it("SQLite vet ikke (ingen rad) og skjermen er lukket → behold fila", () => {
    expect(kanSletteForeldetFil("ukjent", false)).toBe(false);
  });
  it("SQLite tok den, eller en montert skjerm tok den → slett", () => {
    expect(kanSletteForeldetFil("endret", false)).toBe(true);
    expect(kanSletteForeldetFil("ukjent", true)).toBe(true);
  });
  it("SQLite refererer sikkert ikke fila (vanlig foreldet kamera-original) → slett som før", () => {
    expect(kanSletteForeldetFil("uendret", false)).toBe(true);
  });
});

describe("en original som aldri kommer opp flater ut vedlegget, så feltet når serveren", () => {
  it("ingen levende oppføring (fil manglet / gitt opp / borte) → originalUrl + annotering fjernes, url og kommentar står", () => {
    const før = felt();
    expect(harLokaltVedlegg(før.f1)).toBe(true); // holdes unna serveren
    const { feltVerdier, tapte } = flatUtForeldreloseOriginaler(før, new Set());
    expect(tapte).toEqual([ORIGINAL]);
    expect(feltVerdier.f1.vedlegg[0]).toEqual({ id: "v", type: "bilde", url: "/uploads/privat/annotert.jpg", filnavn: "annotert_1.jpg" });
    expect(feltVerdier.f1.kommentar).toBe("Riss i hjørnet");
    expect(harLokaltVedlegg(feltVerdier.f1)).toBe(false); // når serveren igjen
  });

  it("originalen ligger fortsatt i køen → urørt", () => {
    const før = felt();
    const ut = flatUtForeldreloseOriginaler(før, new Set([ORIGINAL]));
    expect(ut.feltVerdier).toBe(før);
    expect(ut.tapte).toEqual([]);
  });

  it("server-original → urørt", () => {
    const før = { f1: { vedlegg: [{ id: "v", url: "/uploads/privat/a.jpg", originalUrl: "/uploads/privat/o.jpg", annotering: LAG }] } };
    expect(flatUtForeldreloseOriginaler(før, new Set()).feltVerdier).toBe(før);
  });

  it("levende = venter, laster_opp eller feilet under taket; feilet på taket er gitt opp", () => {
    expect(erLevendeOppforing("venter", 0, 5)).toBe(true);
    expect(erLevendeOppforing("laster_opp", 0, 5)).toBe(true);
    expect(erLevendeOppforing("feilet", 4, 5)).toBe(true);
    expect(erLevendeOppforing("feilet", 5, 5)).toBe(false);
    expect(erLevendeOppforing("fullfort", 0, 5)).toBe(false);
  });

  it("originalTapt-hendelsen flater ut på en montert skjerm (samme regel som SQLite)", () => {
    const ut = anvendOpplasting(felt(), "", "", { lokalSti: ORIGINAL, hendelse: "originalTapt" });
    expect(ut.f1.vedlegg[0]).not.toHaveProperty("originalUrl");
    expect(ut.f1.vedlegg[0]).not.toHaveProperty("annotering");
  });
});

describe("anvendOpplasting", () => {
  const lokalFelt = () => ({
    f1: { vedlegg: [{ id: "v", url: "file:///doc/annotert_1.jpg", originalUrl: ORIGINAL, annotering: LAG }] },
  });
  it("original: bare originalUrl byttes, aldri url", () => {
    const ut = anvendOpplasting(lokalFelt(), "v", "/uploads/privat/o.jpg", { lokalSti: ORIGINAL, hendelse: "original" });
    expect(ut.f1.vedlegg[0]).toMatchObject({ url: "file:///doc/annotert_1.jpg", originalUrl: "/uploads/privat/o.jpg" });
  });
  it("uten hendelse: url byttes som før", () => {
    const ut = anvendOpplasting(lokalFelt(), "v", "/uploads/privat/a.jpg");
    expect(ut.f1.vedlegg[0]!.url).toBe("/uploads/privat/a.jpg");
  });
});
