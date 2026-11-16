import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { erTreDVisning, prosjektLayoutRotKlasse } from "../tredLayout";

/**
 * W1 — 3D-lerretet skal fylle `main` på 3d-visning og tegning-3d, mens alle
 * andre prosjektsider beholder innholdshøyde (scroll-fiksen fra `cebe06f1`).
 */
describe("erTreDVisning", () => {
  it("gjenkjenner de to 3D-sidene", () => {
    expect(erTreDVisning("/dashbord/abc/3d-visning")).toBe(true);
    expect(erTreDVisning("/dashbord/abc/tegning-3d")).toBe(true);
  });

  it("andre sider og manglende sti er ikke 3D", () => {
    expect(erTreDVisning("/dashbord/abc/tegninger")).toBe(false);
    expect(erTreDVisning("/dashbord/abc/sjekklister")).toBe(false);
    expect(erTreDVisning(null)).toBe(false);
    expect(erTreDVisning(undefined)).toBe(false);
  });
});

describe("prosjektLayoutRotKlasse", () => {
  it("3D-sider får full høyde", () => {
    expect(prosjektLayoutRotKlasse(true).split(" ")).toContain("h-full");
  });

  it("andre sider får ikke full høyde (main scroller som før)", () => {
    expect(prosjektLayoutRotKlasse(false).split(" ")).not.toContain("h-full");
  });

  it("beholder flex-kolonne og overflow-hidden i begge tilfeller", () => {
    for (const er3D of [true, false]) {
      const klasser = prosjektLayoutRotKlasse(er3D).split(" ");
      expect(klasser).toEqual(expect.arrayContaining(["flex", "flex-1", "flex-col", "overflow-hidden"]));
    }
  });
});

describe("kobling i layout-filene", () => {
  const prosjektLayout = readFileSync(
    resolve(__dirname, "../../app/dashbord/[prosjektId]/layout.tsx"),
    "utf8",
  );
  const dashbordLayout = readFileSync(resolve(__dirname, "../../app/dashbord/layout.tsx"), "utf8");

  it("prosjekt-layoutens rot bruker hjelperen", () => {
    expect(prosjektLayout).toContain("className={prosjektLayoutRotKlasse(er3DVisning)}");
    expect(prosjektLayout).toContain("erTreDVisning(pathname)");
  });

  it("dashbord-layoutens <main> er uendret (blokk med egen scroll)", () => {
    expect(dashbordLayout).toContain('<main className="flex-1 overflow-y-auto">{children}</main>');
  });
});
