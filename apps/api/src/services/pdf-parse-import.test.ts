import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Prod 2026-10-13: PDF-prosessering i Mapper feilet med
 * «ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'».
 * pdf-parse@1 sin index.js kjører en debug-blokk når `module.parent` mangler (bundlet i Next).
 * Vakt: ingen kode skal importere pakkens rot, bare `pdf-parse/lib/pdf-parse.js`.
 */
describe("pdf-parse importeres uten debug-indeksen", () => {
  it("ftd-prosessering bruker lib-stien", () => {
    const kilde = readFileSync(join(__dirname, "ftd-prosessering.ts"), "utf8");
    expect(kilde).not.toMatch(/require\(["']pdf-parse["']\)/);
    expect(kilde).toMatch(/require\(["']pdf-parse\/lib\/pdf-parse\.js["']\)/);
  });

  it("lib-stien tolker en ekte PDF", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ numpages: number }>;
    const pdf = readFileSync(join(__dirname, "..", "..", "..", "..", "docs", "redesign", "underlag-grensekrav-pdf-2026-09-06.pdf"));
    const res = await pdfParse(pdf);
    expect(res.numpages).toBeGreaterThan(0);
  });
});
