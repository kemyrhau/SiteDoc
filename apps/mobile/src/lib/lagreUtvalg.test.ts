import { describe, it, expect } from "vitest";
import { lagreUtvalg } from "./lagreUtvalg";
import type { FeltVerdi } from "../hooks/useSjekklisteSkjema";

// ORDRE 5 (2026-10-29): `feltVerdier` på mobil kan bære signerte `/uploads/`-URL-er (init fra den
// signerte `hentMedId`-responsen, og en forgiftet `originalUrl` fra annoteringen før fiksen). Serveren
// avviser dem (BAD_REQUEST). Lagringen renser dem, så rader som alt er forgiftet i SQLite leges.

const SIG = "?exp=1761780000000&sig=abc123";
const fv = (vedlegg: FeltVerdi["vedlegg"], kommentar = ""): FeltVerdi => ({ verdi: null, kommentar, vedlegg });

describe("lagreUtvalg", () => {
  it("forgiftet feltVerdier gir rene data — både url og originalUrl", () => {
    const data = {
      a: fv([{ id: "v1", type: "bilde", url: `/uploads/privat/a.jpg${SIG}`, filnavn: "a.jpg", originalUrl: `/uploads/privat/o.jpg${SIG}` }], "ny"),
    };
    const { data: rene, sendes } = lagreUtvalg(data, {});
    expect(JSON.stringify(rene)).not.toContain("sig=");
    expect(JSON.stringify(sendes)).not.toContain("sig=");
    expect(sendes.a!.vedlegg[0]).toMatchObject({ url: "/uploads/privat/a.jpg", originalUrl: "/uploads/privat/o.jpg" });
  });

  it("signert mot rå basis er ingen endring — bare ekte endringer sendes", () => {
    const basis = { a: fv([{ id: "v1", type: "bilde", url: `/uploads/privat/a.jpg${SIG}`, filnavn: "a.jpg" }]) };
    const data = {
      a: fv([{ id: "v1", type: "bilde", url: "/uploads/privat/a.jpg", filnavn: "a.jpg" }]),
      b: fv([], "endret"),
    };
    expect(Object.keys(lagreUtvalg(data, basis).sendes)).toEqual(["b"]);
  });

  it("felt med lokalt vedlegg holdes utenfor serveren, men står i data", () => {
    const data = { a: fv([{ id: "v1", type: "bilde", url: "file:///doc/a.jpg", filnavn: "a.jpg" }]) };
    const { data: rene, sendes } = lagreUtvalg(data, {});
    expect(sendes).toEqual({});
    expect(rene.a!.vedlegg[0]!.url).toBe("file:///doc/a.jpg");
  });

  it("andre URL-er og verdier røres ikke", () => {
    const data = { a: { verdi: "https://x.no/b?sig=1", kommentar: "", vedlegg: [] } };
    expect(lagreUtvalg(data, {}).sendes.a!.verdi).toBe("https://x.no/b?sig=1");
  });
});
