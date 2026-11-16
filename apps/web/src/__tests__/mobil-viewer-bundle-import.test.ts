/**
 * ORDRE 3D-mobil 5: mobil-viewer importerer ikke barrelen `@sitedoc/shared` (zod, nb.json
 * m.m. i side-bundlen), bare subpathen `@sitedoc/shared/tred`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mappe = resolve(__dirname, "../app/mobil-viewer");
const filer = readdirSync(mappe).filter((f) => /\.tsx?$/.test(f));
const barrelImport = /from\s+["']@sitedoc\/shared["']/;

describe("mobil-viewer: ingen barrel-import fra @sitedoc/shared", () => {
  it("finner kildefilene", () => {
    expect(filer).toContain("page.tsx");
  });

  it.each(filer)("%s importerer ikke fra barrelen", (f) => {
    expect(readFileSync(join(mappe, f), "utf-8")).not.toMatch(barrelImport);
  });

  it("shared eksporterer subpathen ./tred", () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../../../packages/shared/package.json"), "utf-8")) as {
      exports: Record<string, string>;
    };
    expect(pkg.exports["./tred"]).toBe("./src/tred/index.ts");
  });
});
