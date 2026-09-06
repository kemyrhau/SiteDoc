import { describe, it, expect } from "vitest";
import {
  lesSignaturVerdi,
  formaterSignaturLinje,
  formaterSignaturTidspunkt,
  signaturTidspunktNaa,
} from "./signaturVerdi";

const DATA_URL = "data:image/png;base64,AAAA";

describe("lesSignaturVerdi", () => {
  it("legacy: rå data-URL-streng → objekt med null-snapshot", () => {
    expect(lesSignaturVerdi(DATA_URL)).toEqual({
      dataUrl: DATA_URL,
      brukerId: null,
      navn: null,
      tidspunkt: null,
    });
  });

  it("nytt format: objekt med snapshot leses gjennom", () => {
    const v = { dataUrl: DATA_URL, brukerId: "u1", navn: "Kari Nordmann", tidspunkt: "2026-09-05T14:32:07+02:00" };
    expect(lesSignaturVerdi(v)).toEqual(v);
  });

  it("objekt med manglende/ugyldige snapshot-felt normaliseres til null", () => {
    const v = { dataUrl: DATA_URL, brukerId: 42, navn: undefined };
    expect(lesSignaturVerdi(v)).toEqual({ dataUrl: DATA_URL, brukerId: null, navn: null, tidspunkt: null });
  });

  it("tomt/ugyldig → null (tom streng, ikke-data-streng, objekt uten dataUrl, array)", () => {
    expect(lesSignaturVerdi("")).toBeNull();
    expect(lesSignaturVerdi("noe annet")).toBeNull();
    expect(lesSignaturVerdi(null)).toBeNull();
    expect(lesSignaturVerdi(undefined)).toBeNull();
    expect(lesSignaturVerdi({})).toBeNull();
    expect(lesSignaturVerdi({ dataUrl: "ikke-data" })).toBeNull();
    expect(lesSignaturVerdi([DATA_URL])).toBeNull();
  });
});

describe("formaterSignaturLinje", () => {
  it("legacy (tidspunkt null) → ingen linje (krav 3: ikke «Ukjent»)", () => {
    expect(formaterSignaturLinje(lesSignaturVerdi(DATA_URL)!)).toBeNull();
  });

  it("nytt: «navn · dd.mm.åååå kl. hh:mm»", () => {
    const sig = { dataUrl: DATA_URL, brukerId: "u1", navn: "Kari Nordmann", tidspunkt: "2026-09-05T14:32:07+02:00" };
    expect(formaterSignaturLinje(sig)).toBe("Kari Nordmann · 05.09.2026 kl. 14:32");
  });

  it("nytt uten navn → «Ukjent» (krav 4, psi-mønster)", () => {
    const sig = { dataUrl: DATA_URL, brukerId: "u1", navn: null, tidspunkt: "2026-09-05T09:05:00+02:00" };
    expect(formaterSignaturLinje(sig)).toBe("Ukjent · 05.09.2026 kl. 09:05");
  });
});

describe("formaterSignaturTidspunkt", () => {
  it("parser veggklokken direkte fra ISO-strengen (ingen tidssone-konvertering)", () => {
    // Samme minutt uansett offset — string-parse, ikke Date.
    expect(formaterSignaturTidspunkt("2026-01-02T03:04:05+01:00")).toBe("02.01.2026 kl. 03:04");
    expect(formaterSignaturTidspunkt("2026-01-02T03:04:05Z")).toBe("02.01.2026 kl. 03:04");
  });

  it("null/ugyldig → null", () => {
    expect(formaterSignaturTidspunkt(null)).toBeNull();
    expect(formaterSignaturTidspunkt("tull")).toBeNull();
  });
});

describe("signaturTidspunktNaa", () => {
  it("gir lokal ISO med offset som formatereren kan lese tilbake til samme veggklokke", () => {
    // Fast dato uten UTC-konvertering: 14:32 lokal skal formateres som 14:32.
    const d = new Date(2026, 8, 5, 14, 32, 7); // lokal 5. sep 2026 14:32:07
    const iso = signaturTidspunktNaa(d);
    expect(iso).toMatch(/^2026-09-05T14:32:07[+-]\d{2}:\d{2}$/);
    expect(formaterSignaturTidspunkt(iso)).toBe("05.09.2026 kl. 14:32");
  });
});
