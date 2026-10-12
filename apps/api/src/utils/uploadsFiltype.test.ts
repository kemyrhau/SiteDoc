import { describe, it, expect } from "vitest";
import {
  erTillattOpplasting,
  trengerSandboxCsp,
  UPLOADS_SANDBOX_CSP,
  ALLOWLIST_ENDELSER,
} from "./uploadsFiltype";

/**
 * 🔴 SIKKERHET 8c-2: lagret XSS via opplastet SVG. Allowlist ved opplasting +
 * sandbox-CSP ved servering.
 */
describe("opplasting-allowlist (8c-2)", () => {
  it("SVG avvises (rød først — var lovlig under den gamle blokklista)", () => {
    expect(erTillattOpplasting(".svg")).toBe(false);
    expect(erTillattOpplasting("tegning.svg")).toBe(false);
    expect(erTillattOpplasting("TEGNING.SVG")).toBe(false);
  });

  it("andre aktive/markup-typer avvises", () => {
    for (const e of [".html", ".htm", ".js", ".mjs", ".svgz", ".xhtml", ".php", ".exe", ".sh"]) {
      expect(erTillattOpplasting(e)).toBe(false);
    }
  });

  it("tom/ukjent endelse avvises", () => {
    expect(erTillattOpplasting("")).toBe(false);
    expect(erTillattOpplasting("filuten")).toBe(false);
    expect(erTillattOpplasting(".")).toBe(false);
  });

  it("lovlige opplastinger slipper gjennom (tegning/dokument/bilde/3D/import)", () => {
    const lovlige = [
      "a.pdf", "a.dwg", "a.dxf", "a.ifc",
      "a.png", "a.jpg", "a.jpeg", "a.heic", "a.webp", "a.gif", "a.tif", "a.tiff",
      "a.doc", "a.docx", "a.xls", "a.xlsx", "a.csv",
      "a.xml", "a.landxml", "a.gab", "a.ga1",
      "a.las", "a.laz", "a.e57", "a.ply",
      "a.zip",
    ];
    for (const f of lovlige) expect(erTillattOpplasting(f)).toBe(true);
  });

  it("allowlist inneholder ikke svg/html/js", () => {
    for (const e of [".svg", ".html", ".js", ".xhtml"]) {
      expect(ALLOWLIST_ENDELSER.has(e)).toBe(false);
    }
  });
});

describe("servering sandbox-CSP (8c-2)", () => {
  it("CSP-en er en ekte sandbox uten script-tillatelse", () => {
    expect(UPLOADS_SANDBOX_CSP).toContain("sandbox;");
    expect(UPLOADS_SANDBOX_CSP).toContain("default-src 'none'");
    expect(UPLOADS_SANDBOX_CSP).not.toContain("allow-scripts");
    // Beholder inline-style (konverterte SVG-ers strektykkelse).
    expect(UPLOADS_SANDBOX_CSP).toContain("style-src 'unsafe-inline'");
  });

  it("/uploads/x.svg får sandbox-CSP", () => {
    expect(trengerSandboxCsp("/uploads/x.svg")).toBe(true);
    expect(trengerSandboxCsp("/path/to/abc123.svg")).toBe(true);
  });

  it("XML/CSV/LandXML/ukjent får sandbox-CSP (ikke bilde/PDF/binær)", () => {
    for (const p of ["a.xml", "a.landxml", "a.csv", "a.html", "a.ukjentending", "noext"]) {
      expect(trengerSandboxCsp(p)).toBe(true);
    }
  });

  it("bilde/PDF/kjent binær får IKKE sandbox-CSP (inline-visning uberørt)", () => {
    for (const p of ["a.png", "a.jpg", "a.jpeg", "a.webp", "a.gif", "a.pdf", "a.dwg", "a.ifc", "a.las", "a.docx", "a.xlsx", "a.zip"]) {
      expect(trengerSandboxCsp(p)).toBe(false);
    }
  });
});
