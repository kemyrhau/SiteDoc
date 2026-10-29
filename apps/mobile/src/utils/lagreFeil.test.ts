import { describe, it, expect } from "vitest";
import { avvisningsVarsel, klassifiserLagreFeil } from "./lagreFeil";

/**
 * RETUR 75282ec4, gate-punkt b: en godkjent-lås-avvisning (`FORBIDDEN`) skal IKKE
 * gi ny auto-retry; en nett-/transientfeil skal retries som før. Klassifiseringen
 * er beslutningen begge lagre-hooks forgrener på: `permanent` → avansér basis, vis
 * ÉN melding, ingen retry; `transient` → `lokalt_lagret`, retry neste online-tick.
 */
describe("klassifiserLagreFeil", () => {
  it("FORBIDDEN (godkjent-lås) → permanent — ingen ny retry", () => {
    expect(klassifiserLagreFeil({ data: { code: "FORBIDDEN", httpStatus: 403 } })).toBe(
      "permanent",
    );
  });

  it("BAD_REQUEST (ugyldig input) → permanent", () => {
    expect(klassifiserLagreFeil({ data: { code: "BAD_REQUEST", httpStatus: 400 } })).toBe(
      "permanent",
    );
  });

  it("httpStatus 403 uten kode → permanent", () => {
    expect(klassifiserLagreFeil({ data: { httpStatus: 403 } })).toBe("permanent");
  });

  it("httpStatus 400 uten kode → permanent", () => {
    expect(klassifiserLagreFeil({ data: { httpStatus: 400 } })).toBe("permanent");
  });

  it("UNAUTHORIZED (401) → transient — token-rotasjon er passiv, data står trygt", () => {
    expect(klassifiserLagreFeil({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(
      "transient",
    );
  });

  it("5xx (serverfeil) → transient — retry som før", () => {
    expect(
      klassifiserLagreFeil({ data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } }),
    ).toBe("transient");
  });

  it("nettverksfeil uten .data → transient", () => {
    expect(klassifiserLagreFeil(new TypeError("Network request failed"))).toBe(
      "transient",
    );
  });

  it("null/undefined → transient (ingen informasjon = anta forbigående)", () => {
    expect(klassifiserLagreFeil(null)).toBe("transient");
    expect(klassifiserLagreFeil(undefined)).toBe("transient");
  });
});

// ORDRE 6 (Kenneth 2026-10-29, funksjonsendring): KD11 hadde status Mottatt, men viste «Rapporten er
// godkjent». Godkjent-teksten gjelder bare avsluttet rapport; andre permanente avvisninger får en
// nøytral tekst.
describe("avvisningsVarsel", () => {
  it.each(["approved", "closed", "cancelled"])("terminal status %s → godkjent-teksten", (status) => {
    expect(avvisningsVarsel(status)).toBe("godkjentLaast.varsel.tekst");
  });

  it.each(["draft", "sent", "received", "in_progress", "responded", "dismissed", undefined])(
    "ikke-terminal status %s → nøytral avvisningstekst",
    (status) => {
      expect(avvisningsVarsel(status)).toBe("lagreAvvist.varsel.tekst");
    },
  );

  it("både BAD_REQUEST og FORBIDDEN er permanente, så teksten avgjøres av status alene", () => {
    for (const code of ["BAD_REQUEST", "FORBIDDEN"]) {
      expect(klassifiserLagreFeil({ data: { code } })).toBe("permanent");
    }
    expect(avvisningsVarsel("received")).toBe("lagreAvvist.varsel.tekst");
  });
});
