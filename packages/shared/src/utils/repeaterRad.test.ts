import { describe, it, expect } from "vitest";
import { feltKartFraRad, settVedleggUrlIDokument, settOriginalUrlIDokument, flatUtOriginaler } from "./repeaterRad";

describe("feltKartFraRad", () => {
  it("pakker ut `felter` fra produksjonsformen", () => {
    const rad = { _radId: "r1", felter: { b: { verdi: 1 } } };
    expect(feltKartFraRad(rad)).toEqual({ b: { verdi: 1 } });
  });
  it("returnerer raden selv for flat/rå form", () => {
    const rad = { b: { verdi: 1 } };
    expect(feltKartFraRad(rad)).toEqual({ b: { verdi: 1 } });
  });
  it("tåler null/undefined", () => {
    expect(feltKartFraRad(null)).toEqual({});
    expect(feltKartFraRad(undefined)).toEqual({});
  });
});

describe("settVedleggUrlIDokument", () => {
  it("oppdaterer topp-nivå-vedlegg på vedleggId", () => {
    const fv = { a: { verdi: null, vedlegg: [{ id: "v1", url: "file:///x.jpg" }] } };
    const ut = settVedleggUrlIDokument(fv, "v1", "/uploads/x.jpg");
    expect(ut.a.vedlegg[0]!.url).toBe("/uploads/x.jpg");
  });

  // 🔴 Kjernetesten: repeater-vedlegg i produksjonsformen { _radId, felter }.
  // Den gamle callbacken (Object.keys(rad) → flat) traff ALDRI dette → «Kunne ikke laste».
  it("oppdaterer repeater-vedlegg i { _radId, felter }-form", () => {
    const fv = {
      rep: {
        verdi: [
          { _radId: "r1", felter: { bilde: { vedlegg: [{ id: "v1", url: "file:///a.jpg" }] } } },
          { _radId: "r2", felter: { bilde: { vedlegg: [{ id: "v2", url: "file:///b.jpg" }] } } },
        ],
      },
    };
    const ut = settVedleggUrlIDokument(fv, "v2", "/uploads/privat/b.jpg");
    expect(ut.rep.verdi[0]!.felter.bilde.vedlegg[0]!.url).toBe("file:///a.jpg"); // urørt
    expect(ut.rep.verdi[1]!.felter.bilde.vedlegg[0]!.url).toBe("/uploads/privat/b.jpg"); // oppdatert
    // `_radId` bevart.
    expect(ut.rep.verdi[1]!._radId).toBe("r2");
  });

  it("oppdaterer repeater-vedlegg i flat/rå form", () => {
    const fv = { rep: { verdi: [{ bilde: { vedlegg: [{ id: "v1", url: "file:///a.jpg" }] } }] } };
    const ut = settVedleggUrlIDokument(fv, "v1", "/uploads/a.jpg");
    expect((ut.rep.verdi[0] as { bilde: { vedlegg: Array<{ url: string }> } }).bilde.vedlegg[0]!.url).toBe("/uploads/a.jpg");
  });

  it("returnerer SAMME referanse når vedleggId ikke finnes", () => {
    const fv = { a: { verdi: null, vedlegg: [{ id: "v1", url: "x" }] } };
    expect(settVedleggUrlIDokument(fv, "ukjent", "y")).toBe(fv);
  });
});

describe("settOriginalUrlIDokument", () => {
  const lokal = "file:///doc/o.jpg";
  it("bytter lokal originalUrl til server-URL — topp-nivå og repeater-rad, url urørt", () => {
    const fv = {
      a: { verdi: null, vedlegg: [{ id: "v1", url: "file:///doc/a.jpg", originalUrl: lokal }] },
      r: { verdi: [{ _radId: "x", felter: { b: { vedlegg: [{ id: "v2", url: "u", originalUrl: lokal }] } } }] },
    };
    const ut = settOriginalUrlIDokument(fv, "v1", lokal, "/uploads/privat/o.jpg");
    expect(ut.a.vedlegg[0]).toEqual({ id: "v1", url: "file:///doc/a.jpg", originalUrl: "/uploads/privat/o.jpg" });
    const ut2 = settOriginalUrlIDokument(fv, "v2", lokal, "/uploads/privat/o.jpg") as typeof fv;
    expect((ut2.r.verdi[0]!.felter.b.vedlegg[0] as { originalUrl: string }).originalUrl).toBe("/uploads/privat/o.jpg");
  });

  it("annen originalUrl enn lokalstien: urørt (samme referanse)", () => {
    const fv = { a: { vedlegg: [{ id: "v1", url: "u", originalUrl: "/uploads/privat/o.jpg" }] } };
    expect(settOriginalUrlIDokument(fv, "v1", lokal, "/uploads/privat/x.jpg")).toBe(fv);
  });
});

describe("flatUtOriginaler (RETUR M1)", () => {
  const LAG = { fabricVersion: "5.3.0", bredde: 390, hoyde: 520, objekter: [] };
  it("fjerner originalUrl + annotering der originalen ikke kan bli oppe — topp-nivå og repeater, url beholdes", () => {
    const fv = {
      a: { vedlegg: [{ id: "v1", url: "file:///a.jpg", originalUrl: "file:///o.jpg", annotering: LAG }] },
      r: { verdi: [{ _radId: "x", felter: { b: { vedlegg: [{ id: "v2", url: "u", originalUrl: "file:///o.jpg", annotering: LAG }] } } }] },
    };
    const ut = flatUtOriginaler(fv, (u) => u === "file:///o.jpg");
    expect(ut.a.vedlegg[0]).toEqual({ id: "v1", url: "file:///a.jpg" });
    expect(ut.r.verdi[0]!.felter.b.vedlegg[0]).toEqual({ id: "v2", url: "u" });
  });

  it("annen original: urørt (samme referanse)", () => {
    const fv = { a: { vedlegg: [{ id: "v1", url: "u", originalUrl: "/uploads/privat/o.jpg", annotering: LAG }] } };
    expect(flatUtOriginaler(fv, (u) => u === "file:///o.jpg")).toBe(fv);
  });
});
