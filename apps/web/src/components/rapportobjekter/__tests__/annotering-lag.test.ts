// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  annoteringsKilde,
  erAnnotert,
  byggAnnoteringsPatch,
  dataUrlTilBlob,
} from "../annotering-lag";
import type { Vedlegg } from "../typer";
import { type AnnoteringsLag } from "@sitedoc/shared";

const LAG: AnnoteringsLag = {
  fabricVersion: "5.3.0", // runtime `fabric.version` for den pinnede CDN-stien (ikke stien selv)
  bredde: 400,
  hoyde: 300,
  objekter: [{ type: "group", left: 10, top: 10, scaleX: 1, scaleY: 1 }],
};

const original: Vedlegg = {
  id: "v1",
  type: "bilde",
  url: "/uploads/privat/original.jpg?sig=abc",
  filnavn: "original.jpg",
};

describe("annotering: tre-artefakt-modellen (original bevart)", () => {
  it("TEST 1 — første annotering: originalUrl settes til dagens url, url blir den nye JPEG-en, laget lagres", () => {
    const patch = byggAnnoteringsPatch(original, "/uploads/privat/annotert.jpg?sig=def", LAG);
    expect(patch.url).toBe("/uploads/privat/annotert.jpg?sig=def");
    expect(patch.originalUrl).toBe(original.url); // originalen bevart
    expect(patch.annotering).toBe(LAG);
  });

  it("TEST 1 (re-annotering) — originalUrl er UENDRET, peker fortsatt på det ekte originalfotoet", () => {
    const alleredeAnnotert: Vedlegg = {
      ...original,
      url: "/uploads/privat/annotert.jpg?sig=def",
      originalUrl: original.url,
      annotering: LAG,
    };
    const nyttLag: AnnoteringsLag = { ...LAG, objekter: [...LAG.objekter, { type: "circle" }] };
    const patch = byggAnnoteringsPatch(alleredeAnnotert, "/uploads/privat/annotert2.jpg", nyttLag);
    expect(patch.url).toBe("/uploads/privat/annotert2.jpg");
    // 🔴 IKKE den forrige annoterte — det EKTE originalfotoet:
    expect(patch.originalUrl).toBe(original.url);
    expect(patch.annotering).toBe(nyttLag);
  });

  it("TEST 2 — gjenåpning skjer på ORIGINALEN, ikke den utflatede JPEG-en", () => {
    const annotert: Vedlegg = {
      ...original,
      url: "/uploads/privat/annotert.jpg",
      originalUrl: original.url,
      annotering: LAG,
    };
    expect(annoteringsKilde(annotert)).toBe(original.url);
    expect(erAnnotert(annotert)).toBe(true);
  });

  it("TEST 4 — bakover: mobil-/historisk-annotert uten lag åpner på url, har intet lag, er ikke redigerbart", () => {
    // Et bilde annotert PÅ MOBIL før denne runden: bare url, ingen originalUrl/annotering.
    const flatt: Vedlegg = { id: "v2", type: "bilde", url: "/uploads/privat/mobil.jpg", filnavn: "mobil.jpg" };
    expect(annoteringsKilde(flatt)).toBe(flatt.url); // faller til url (ingen originalUrl)
    expect(erAnnotert(flatt)).toBe(false); // ingen «kan redigeres»-indikator
  });

  it("TEST 4b — mobil-annotert med originalUrl men UTEN lag: web åpner det innbrente bildet, ikke originalen", () => {
    // Før 2026-10-28 åpnet web originalen her → markeringene forsvant uten lag å gjenskape dem.
    const flatt: Vedlegg = { ...original, url: "/uploads/privat/innbrent.jpg", originalUrl: original.url };
    expect(annoteringsKilde(flatt)).toBe(flatt.url);
    // Annoteres det, forblir det flatt: et lag tegnet på det innbrente bildet lagres ikke.
    expect(byggAnnoteringsPatch(flatt, "/uploads/privat/ny.jpg", LAG).annotering).toBeUndefined();
  });

  it("TEST 3 — dataUrlTilBlob bevarer JPEG-MIME (aldri PNG)", () => {
    const blob = dataUrlTilBlob("data:image/jpeg;base64," + btoa("ABC"));
    expect(blob.type).toBe("image/jpeg");
  });
});
