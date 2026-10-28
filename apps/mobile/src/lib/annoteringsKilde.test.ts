import { describe, it, expect, vi } from "vitest";
import {
  velgAnnoteringsKilde,
  lastAnnoteringsbilde,
  bildeMimeFraBase64,
  type AnnoteringsbildeDeps,
} from "./annoteringsKilde";

/**
 * RETUR svart gjenåpning (Kenneth på telefon, test-OTA a34c1f3d, 2026-10-28): et lagret annotert
 * bilde åpnet seg som et helt svart lerret. Etter opplasting bærer vedlegget den RÅ server-URL-en
 * (`/uploads/…` uten signatur, lokalfila er slettet); `/uploads/` er signatur-KUN → 401. Gammel kode
 * lastet ned uten å se på status og sendte 401-kroppen som `data:image/jpeg` → svart.
 *
 * Rød før fiksen: modulen fantes ikke (logikken lå inline i BildeAnnotering uten statussjekk).
 */

const API = "https://api-test.sitedoc.no";
const NAA = 1_800_000_000_000;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]).toString("base64");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
const HEIC = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]).toString("base64");
const FEILSVAR_401 = Buffer.from('{"error":"Ugyldig eller utløpt fil-signatur"}').toString("base64");

function deps(over: Partial<AnnoteringsbildeDeps> & { innhold?: string } = {}): AnnoteringsbildeDeps & { lastNed: ReturnType<typeof vi.fn> } {
  return {
    apiUrl: API,
    cacheDir: "file:///cache/",
    naa: NAA,
    finnes: vi.fn(async () => true),
    lesBase64: vi.fn(async () => over.innhold ?? JPEG),
    ...over,
    lastNed: vi.fn(over.lastNed ?? (async () => ({ status: 200 }))),
  } as AnnoteringsbildeDeps & { lastNed: ReturnType<typeof vi.fn> };
}

describe("gjenåpning etter opplasting — rå server-URL gir aldri et svart lerret", () => {
  it("rå /uploads/-URL (rett etter opplasting) → trengerSignatur, INGEN naken nedlasting", async () => {
    const d = deps();
    const r = await lastAnnoteringsbilde("/uploads/privat/annotert_1.jpg", d);
    expect(r).toEqual({ ok: false, grunn: "trengerSignatur" });
    expect(d.lastNed).not.toHaveBeenCalled();
  });

  it("utløpt signatur → trengerSignatur", () => {
    expect(velgAnnoteringsKilde(`/uploads/privat/a.jpg?exp=${NAA - 1}&sig=abc`, API, NAA)).toEqual({ type: "trengerSignatur" });
  });

  it("gyldig signert URL → lastes ned fra api-verten", async () => {
    const url = `/uploads/privat/a.jpg?exp=${NAA + 60_000}&sig=abc`;
    const d = deps();
    const r = await lastAnnoteringsbilde(url, d);
    expect(d.lastNed).toHaveBeenCalledWith(`${API}${url}`, expect.stringMatching(/^file:\/\/\/cache\/annoterings_kilde_/));
    expect(r).toEqual({ ok: true, dataUrl: `data:image/jpeg;base64,${JPEG}` });
  });

  it("server svarer 401 → navngitt feil, aldri et «bilde»", async () => {
    const d = deps({ lastNed: async () => ({ status: 401 }), innhold: FEILSVAR_401 });
    const r = await lastAnnoteringsbilde(`/uploads/a.jpg?exp=${NAA + 60_000}&sig=x`, d);
    expect(r).toEqual({ ok: false, grunn: "nedlastingFeilet", status: 401 });
  });

  it("200 med et ikke-bilde (feilside) → ikkeBilde", async () => {
    const d = deps({ innhold: FEILSVAR_401 });
    const r = await lastAnnoteringsbilde(`/uploads/a.jpg?exp=${NAA + 60_000}&sig=x`, d);
    expect(r).toEqual({ ok: false, grunn: "ikkeBilde" });
  });

  it("lokal fil (opplasting i kø) → leses direkte", async () => {
    const d = deps();
    const r = await lastAnnoteringsbilde("file:///docs/sitedoc-bilder/annotert_1.jpg", d);
    expect(r.ok).toBe(true);
    expect(d.lastNed).not.toHaveBeenCalled();
  });

  it("lokal fil som er slettet → lokalMangler (ikke et tomt lerret)", async () => {
    const d = deps({ finnes: async () => false });
    expect(await lastAnnoteringsbilde("file:///docs/sitedoc-bilder/borte.jpg", d)).toEqual({ ok: false, grunn: "lokalMangler" });
  });
});

describe("bildeMimeFraBase64 — magiske byte", () => {
  it("kjenner JPEG/PNG/HEIC og avviser JSON-feilsvar", () => {
    expect(bildeMimeFraBase64(JPEG)).toBe("image/jpeg");
    expect(bildeMimeFraBase64(PNG)).toBe("image/png");
    expect(bildeMimeFraBase64(HEIC)).toBe("image/heic");
    expect(bildeMimeFraBase64(FEILSVAR_401)).toBeNull();
    expect(bildeMimeFraBase64("")).toBeNull();
  });
});
