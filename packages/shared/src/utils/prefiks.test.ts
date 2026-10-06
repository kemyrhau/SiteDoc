import { describe, it, expect } from "vitest";
import { prefiksFraReferanse } from "./prefiks";

describe("prefiksFraReferanse", () => {
  it("bar kode → hele koden", () => {
    expect(prefiksFraReferanse("KA7")).toBe("KA7");
    expect(prefiksFraReferanse("JH2")).toBe("JH2");
    expect(prefiksFraReferanse("KB2")).toBe("KB2");
  });

  it("🔴 PUNKTUM bevares — KC3.1 og UO2.1 (finnes i dataene nå)", () => {
    expect(prefiksFraReferanse("KC3.1")).toBe("KC3.1");
    expect(prefiksFraReferanse("UO2.1")).toBe("UO2.1");
  });

  it("splitter på mellomrom — første token", () => {
    expect(prefiksFraReferanse("NS 3420")).toBe("NS");
    expect(prefiksFraReferanse("KD1 Belegg av stein")).toBe("KD1");
  });

  it("splitter på skråstrek — første token", () => {
    expect(prefiksFraReferanse("KB6/2")).toBe("KB6");
    expect(prefiksFraReferanse("A/B/C")).toBe("A");
  });

  it("tom / whitespace / ledende skilletegn → null (aldri tom streng)", () => {
    expect(prefiksFraReferanse("")).toBeNull();
    expect(prefiksFraReferanse("   ")).toBeNull();
    expect(prefiksFraReferanse(" KA7")).toBeNull(); // ledende mellomrom → tomt første-token
    expect(prefiksFraReferanse("/KA7")).toBeNull();
  });
});
