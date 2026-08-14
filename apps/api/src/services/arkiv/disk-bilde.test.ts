import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock disk-laget: diskSti ekko-mappes så vi kan se HVA den fikk, og readFile
// styres per test. `felles` mockes fordi den ellers drar inn UPLOADS_DIR-oppsett.
const readFileMock = vi.fn();
vi.mock("fs/promises", () => ({ readFile: (p: string) => readFileMock(p) }));
vi.mock("../eksport/felles", () => ({
  diskSti: (u: string) => "/disk/" + u.replace(/^\/uploads\//, ""),
  UPLOADS_DIR: "/disk",
}));

import { hentBildeBytesFraDisk } from "./disk-bilde";

describe("hentBildeBytesFraDisk", () => {
  beforeEach(() => readFileMock.mockReset());

  it("stripper signert query (?exp=&sig=) FØR disk-oppslag", async () => {
    readFileMock.mockResolvedValue(Buffer.from("bilde"));
    const ut = await hentBildeBytesFraDisk(
      "/uploads/privat/abc.jpg?exp=1786710672468&sig=Y_tnH0Qy8PY0",
    );
    expect(ut).toEqual(Buffer.from("bilde"));
    // Filnavnet må være rent — aldri `abc.jpg?exp=…&sig=…` (rot til bug 2).
    expect(readFileMock).toHaveBeenCalledWith("/disk/privat/abc.jpg");
  });

  it("håndterer ren sti uten query uendret", async () => {
    readFileMock.mockResolvedValue(Buffer.from("x"));
    await hentBildeBytesFraDisk("/uploads/privat/def.jpg");
    expect(readFileMock).toHaveBeenCalledWith("/disk/privat/def.jpg");
  });

  it("returnerer null for tom/ugyldig url uten å røre disk", async () => {
    expect(await hentBildeBytesFraDisk("")).toBeNull();
    expect(readFileMock).not.toHaveBeenCalled();
  });
});
