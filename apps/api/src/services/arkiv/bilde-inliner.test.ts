import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { inlineBilder, komprimerBilde } from "./bilde-inliner";

/** Lager et ekte PNG med alfakanal (transparent marg) — simulerer annotert bilde. */
async function lagAnnotertPng(): Promise<Buffer> {
  return sharp({
    create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.4 } },
  })
    .png()
    .toBuffer();
}

/**
 * L7-regresjon: en DWG-SVG med ett mega-path `d`-attributt over libxml2-grensa
 * (`XML_MAX_TEXT_LENGTH` ≈ 10 MB). Uten `{ unlimited: true }` kaster librsvg
 * «Resource limit exceeded … try XML_PARSE_HUGE» → arkiv-PDF med DWG feiler.
 */
function lagMegaPathSvg(dMb: number): Buffer {
  let d = "M 0 0";
  while (d.length < dMb * 1024 * 1024) d += " l 3.5 2.1";
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1500" width="2000" height="1500">' +
      '<rect width="2000" height="1500" fill="#ffffff"/>' +
      `<path d="${d}" fill="none" stroke="#000" stroke-width="1.5"/></svg>`,
  );
}

describe("komprimerBilde", () => {
  it("flater alfa mot hvit + gir JPEG (ingen alfakanal igjen)", async () => {
    const jpg = await komprimerBilde(await lagAnnotertPng());
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.hasAlpha).toBe(false);
  });

  it("L7: stor DWG-SVG (mega-path > 10 MB) komprimeres (librsvg-grensa løftet)", async () => {
    const svg = lagMegaPathSvg(11);
    // Negativkontroll: samme buffer UTEN unlimited skal faktisk feile — ellers måler
    // ikke testen noe (grensa må være reell for at fiksen skal bevises).
    await expect(sharp(svg).jpeg().toBuffer()).rejects.toThrow();
    // Fiksen: komprimerBilde åpner SVG med unlimited → lykkes.
    const jpg = await komprimerBilde(svg);
    expect((await sharp(jpg).metadata()).format).toBe("jpeg");
  });
});

describe("inlineBilder", () => {
  it("komprimerer + inliner som data:image/jpeg", async () => {
    const png = await lagAnnotertPng();
    const hent = vi.fn().mockResolvedValue(png);
    const r = await inlineBilder(hent, ["/uploads/a.png"]);
    expect(r.dataUrl.get("/uploads/a.png")).toMatch(/^data:image\/jpeg;base64,/);
    expect(r.manglende).toEqual([]);
  });

  it("henting feiler (null) → filnavn i manglende, aldri stille hull", async () => {
    const r = await inlineBilder(async () => null, ["/uploads/borte.png"]);
    expect(r.dataUrl.size).toBe(0);
    expect(r.manglende).toEqual(["/uploads/borte.png"]);
  });

  it("henting kaster → manglende", async () => {
    const r = await inlineBilder(async () => { throw new Error("404"); }, ["/uploads/x.png"]);
    expect(r.manglende).toEqual(["/uploads/x.png"]);
  });

  it("dedup: samme url flere ganger → hentes én gang", async () => {
    const png = await lagAnnotertPng();
    const hent = vi.fn().mockResolvedValue(png);
    await inlineBilder(hent, ["/uploads/a.png", "/uploads/a.png"]);
    expect(hent).toHaveBeenCalledTimes(1);
  });

  it("ugyldig bilde-bytes → manglende (komprimering kaster)", async () => {
    const r = await inlineBilder(async () => Buffer.from("ikke et bilde"), ["/uploads/rar.png"]);
    expect(r.manglende).toEqual(["/uploads/rar.png"]);
  });
});
