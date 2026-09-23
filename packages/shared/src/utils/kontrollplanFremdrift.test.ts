import { describe, it, expect } from "vitest";
import {
  avledPunktFremdrift,
  avledPunktTilstand,
  tellGodkjente,
  isoUkeRef,
} from "./kontrollplanFremdrift";

/**
 * Levende-kobling-avledning (Kenneth-vedtak 2026-09-12). Et punkts fremdrift avledes fra en
 * LEVENDE koblet sjekkliste. En sjekkliste i papirkurven (`deletedAt` satt) teller ikke —
 * relasjonen resolves fortsatt fra serveren, men dokumentet er borte fra planen, så punktet
 * skal vises som ubrukt («planlagt»), ikke «Påbegynt»/«Godkjent» for et dokument som ikke er
 * der. `punkt.status` er pensjonert og settes kun til `pagar` ved kobling — uten levende
 * kobling er den alltid foreldet, og skal aldri lekke inn i visningen.
 */

const NAA = isoUkeRef(new Date("2026-09-12T00:00:00Z"));

describe("avledPunktFremdrift — levende kobling er kilden", () => {
  it("levende koblet sjekkliste (approved) → godkjent", () => {
    expect(avledPunktFremdrift({ status: "pagar", sjekkliste: { status: "approved", deletedAt: null } })).toBe(
      "godkjent",
    );
  });

  it("levende koblet sjekkliste (draft) → pagar", () => {
    expect(avledPunktFremdrift({ status: "pagar", sjekkliste: { status: "draft", deletedAt: null } })).toBe(
      "pagar",
    );
  });

  it("ingen kobling → legacy punkt.status bevares (gammel manuell data satt før koble-mekanikken)", () => {
    // Etter HARD sletting nullstiller papirkurv-routeren status → planlagt i samme
    // transaksjon, så et hardslettet dokument etterlater aldri et `pagar`-punkt her; denne
    // grenen dekker kun ekte legacy-data uten kobling.
    expect(avledPunktFremdrift({ status: "pagar", sjekkliste: null })).toBe("pagar");
    expect(avledPunktFremdrift({ status: "planlagt", sjekkliste: null })).toBe("planlagt");
  });

  it("REGRESJONSVAKT: koblet sjekkliste i papirkurven (deletedAt satt) → planlagt, ALDRI godkjent/pagar", () => {
    expect(
      avledPunktFremdrift({ status: "pagar", sjekkliste: { status: "closed", deletedAt: new Date() } }),
    ).toBe("planlagt");
    expect(
      avledPunktFremdrift({ status: "pagar", sjekkliste: { status: "draft", deletedAt: new Date() } }),
    ).toBe("planlagt");
  });
});

describe("avledPunktTilstand — papirkurv-koblet punkt vises som ubrukt", () => {
  it("sjekkliste i papirkurven → planlagt-tilstand (hul ring), ikke pabegynt (fylt)", () => {
    const t = avledPunktTilstand(
      {
        status: "pagar",
        sjekkliste: { status: "draft", deletedAt: new Date() },
        fristUke: null,
        fristAar: null,
        varselUkerFor: 2,
      },
      NAA,
    );
    expect(t.fylt).toBe(false);
    expect(t.tilstand).toBe("utenFrist");
  });
});

describe("tellGodkjente — slettet sjekkliste teller ikke som godkjent", () => {
  it("closed men i papirkurv → ikke godkjent", () => {
    const r = tellGodkjente([
      { status: "pagar", sjekkliste: { status: "closed", deletedAt: new Date() } },
      { status: "planlagt", sjekkliste: { status: "approved", deletedAt: null } },
    ]);
    expect(r.godkjent).toBe(1);
    expect(r.total).toBe(2);
  });
});
