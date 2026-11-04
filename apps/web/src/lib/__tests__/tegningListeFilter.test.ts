import { describe, it, expect } from "vitest";
import {
  filtrerTegningerPaaMetadata,
  tegningFilterAlternativer,
  tegningMetaTekst,
  visTegningFilter,
  TOMT_TEGNING_FILTER,
} from "../tegningListeFilter";

const tegninger = [
  { id: "a", status: "godkjent", fileType: "svg", originalFileUrl: "/uploads/a.dwg", geoReference: { p: 1 } },
  { id: "b", status: "utkast", fileType: "png", originalFileUrl: "/uploads/b.pdf", geoReference: null },
  { id: "c", status: "godkjent", fileType: "png", originalFileUrl: null, geoReference: null },
];
const ider = (r: { id: string }[]) => r.map((x) => x.id);

describe("tegningslista B-5 — filter", () => {
  it("tomt filter slipper alt gjennom", () => {
    expect(ider(filtrerTegningerPaaMetadata(tegninger, TOMT_TEGNING_FILTER))).toEqual(["a", "b", "c"]);
  });

  it("status", () => {
    expect(ider(filtrerTegningerPaaMetadata(tegninger, { ...TOMT_TEGNING_FILTER, status: "godkjent" }))).toEqual(["a", "c"]);
  });

  it("kildeformat bruker originalens endelse, ikke konvertert fileType", () => {
    expect(ider(filtrerTegningerPaaMetadata(tegninger, { ...TOMT_TEGNING_FILTER, kildeformat: "dwg" }))).toEqual(["a"]);
    expect(ider(filtrerTegningerPaaMetadata(tegninger, { ...TOMT_TEGNING_FILTER, kildeformat: "png" }))).toEqual(["c"]);
  });

  it("georeferert ja/nei", () => {
    expect(ider(filtrerTegningerPaaMetadata(tegninger, { ...TOMT_TEGNING_FILTER, georef: "ja" }))).toEqual(["a"]);
    expect(ider(filtrerTegningerPaaMetadata(tegninger, { ...TOMT_TEGNING_FILTER, georef: "nei" }))).toEqual(["b", "c"]);
  });
});

describe("tegningslista B-5 — alternativer", () => {
  it("status i fast rekkefølge, formater sortert, georef når begge finnes", () => {
    const alt = tegningFilterAlternativer(tegninger);
    expect(alt.status).toEqual(["utkast", "godkjent"]);
    expect(alt.kildeformat).toEqual(["dwg", "pdf", "png"]);
    expect(alt.georef).toBe(true);
  });

  it("eldre API uten status/original → status skjules, georef skjules når alle er like", () => {
    const gamle = [{ fileType: "png" }, { fileType: "png" }];
    const alt = tegningFilterAlternativer(gamle);
    expect(alt.status).toEqual([]);
    expect(visTegningFilter(alt.status, "")).toBe(false);
    expect(visTegningFilter(alt.kildeformat, "")).toBe(false);
    expect(alt.georef).toBe(false);
  });

  it("et satt filter vises selv med færre enn to valg", () => {
    expect(visTegningFilter(["godkjent"], "godkjent")).toBe(true);
  });
});

describe("tegningMetaTekst", () => {
  // Stub: nøkkel + interpolerte verdier, så testen ser hva som sendes til t().
  const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}(${Object.values(o).join(",")})` : k);

  it("setter sammen rev, status, kildeformat og utgitt-dato i fast rekkefølge", () => {
    const tekst = tegningMetaTekst(
      { revision: "C", status: "godkjent", originalFileUrl: "/uploads/a.dwg", fileType: "svg", issuedAt: "2026-11-03T12:00:00Z" },
      t,
      "nb",
    );
    expect(tekst).toBe("tegninger.rev(C) · tegninger.statusGodkjent · DWG · tegninger.utgittDato(3.11.2026)");
  });

  it("datoen følger UI-språket, ikke hardkodet nb-NO", () => {
    const tg = { issuedAt: "2026-11-03T12:00:00Z" };
    expect(tegningMetaTekst(tg, t, "en-US")).toBe("tegninger.utgittDato(11/3/2026)");
    expect(tegningMetaTekst(tg, t, "nb")).toBe("tegninger.utgittDato(3.11.2026)");
  });

  it("tomme felt og ugyldig dato utelates", () => {
    expect(tegningMetaTekst({ issuedAt: "tull" }, t, "nb")).toBe("");
  });
});
