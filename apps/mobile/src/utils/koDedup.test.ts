import { describe, it, expect } from "vitest";
import {
  oppforingerAaKansellere,
  skalSkriveVedleggUrl,
  type KoOppforingRef,
} from "./koDedup";

/**
 * Kappløp-vern (Kenneth/orkestrator 2026-10-22): annoterer brukeren et kamerabilde før
 * originalen er ferdig opplastet, deler de to oppføringene `vedleggId`. Den NYESTE
 * (annoteringen) skal alltid vinne — originalen skal aldri overskrive den.
 */
describe("oppforingerAaKansellere — originalen kanselleres når annoteringen legges i kø", () => {
  const original: KoOppforingRef = { id: "a", vedleggId: "V", status: "venter", opprettet: 100 };

  it("kansellerer en ventende original for samme vedlegg", () => {
    expect(oppforingerAaKansellere("V", [original])).toEqual(["a"]);
  });

  it("kansellerer også en feilet (men ikke-fullført) original", () => {
    const feilet: KoOppforingRef = { ...original, status: "feilet" };
    expect(oppforingerAaKansellere("V", [feilet])).toEqual(["a"]);
  });

  it("rører IKKE en pågående opplasting (laster_opp) — den kan ikke stoppes trygt", () => {
    const pagaar: KoOppforingRef = { ...original, status: "laster_opp" };
    expect(oppforingerAaKansellere("V", [pagaar])).toEqual([]);
  });

  it("redigerbar annotering: originalen laget er tegnet på (beholdLokalSti) kanselleres IKKE — en tidligere annotering gjør", () => {
    const orig: KoOppforingRef = { ...original, lokalSti: "file:///o.jpg" };
    const forrigeAnnotering: KoOppforingRef = { id: "b", vedleggId: "V", status: "venter", opprettet: 200, lokalSti: "file:///a1.jpg" };
    expect(oppforingerAaKansellere("V", [orig, forrigeAnnotering], "file:///o.jpg")).toEqual(["b"]);
  });

  it("rører IKKE en alt fullført oppføring", () => {
    const fullfort: KoOppforingRef = { ...original, status: "fullfort" };
    expect(oppforingerAaKansellere("V", [fullfort])).toEqual([]);
  });

  it("rører IKKE oppføringer for ANDRE vedlegg", () => {
    const annen: KoOppforingRef = { id: "b", vedleggId: "ANNET", status: "venter", opprettet: 100 };
    expect(oppforingerAaKansellere("V", [original, annen])).toEqual(["a"]);
  });
});

describe("skalSkriveVedleggUrl — nyeste oppføring for vedlegget vinner", () => {
  const original: KoOppforingRef = { id: "a", vedleggId: "V", status: "laster_opp", opprettet: 100 };
  const annotert: KoOppforingRef = { id: "b", vedleggId: "V", status: "venter", opprettet: 200 };

  it("originalen (eldre) skriver IKKE når en nyere annotering finnes — selv om den venter", () => {
    expect(skalSkriveVedleggUrl(original, [original, annotert])).toBe(false);
  });

  it("originalen skriver IKKE selv om den nyere annoteringen alt er fullført", () => {
    const annotertFullfort: KoOppforingRef = { ...annotert, status: "fullfort" };
    expect(skalSkriveVedleggUrl(original, [original, annotertFullfort])).toBe(false);
  });

  it("annoteringen (nyeste) skriver — den er den som skal vinne", () => {
    expect(skalSkriveVedleggUrl(annotert, [original, annotert])).toBe(true);
  });

  it("en enslig original (ingen annotering ennå) skriver som normalt", () => {
    expect(skalSkriveVedleggUrl(original, [original])).toBe(true);
  });

  it("annen vedleggId påvirker ikke avgjørelsen", () => {
    const annen: KoOppforingRef = { id: "c", vedleggId: "ANNET", status: "venter", opprettet: 999 };
    expect(skalSkriveVedleggUrl(original, [original, annen])).toBe(true);
  });
});
