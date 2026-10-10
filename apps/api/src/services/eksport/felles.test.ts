import { describe, it, expect } from "vitest";
import { resolve, sep } from "path";
import { diskSti, UPLOADS_DIR } from "./felles";

const ROT = resolve(UPLOADS_DIR);

describe("diskSti — herdet mot path traversal", () => {
  it("vanlig fil resolver innenfor uploads-roten", () => {
    const d = diskSti("/uploads/abc-123.dwg");
    expect(d).toBe(`${ROT}${sep}abc-123.dwg`);
  });

  it("privat-undermappe resolver innenfor roten", () => {
    const d = diskSti("/uploads/privat/uuid.pdf");
    expect(d.startsWith(ROT + sep)).toBe(true);
  });

  it("stripper query-signatur før reversering", () => {
    const d = diskSti("/uploads/uuid.dwg?exp=1&sig=zz");
    expect(d).toBe(`${ROT}${sep}uuid.dwg`);
  });

  it("KASTER på `..`-traversal (negativkontroll)", () => {
    expect(() => diskSti("/uploads/../../../etc/passwd")).toThrow();
  });

  it("KASTER på prosentkodet traversal", () => {
    expect(() => diskSti("/uploads/%2e%2e/%2e%2e/etc/passwd")).toThrow();
  });

  it("KASTER på absolutt sti som bryter ut av roten", () => {
    expect(() => diskSti("/uploads//etc/passwd")).toThrow();
  });
});
