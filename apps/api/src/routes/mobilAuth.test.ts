import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import type { JWTPayload } from "jose";
import { validerMicrosoftClaims } from "./mobilAuth";

/**
 * Sikkerhet (2026-09-07): to uavhengige vakter i Microsoft-innloggingen.
 *
 * 1. iss/tid — flertenant-åpningen aksepterer tokens fra kundens EGEN tenant, så
 *    iss kan ikke pinnes; den valideres i stedet mot tokenets eget `tid`. Uten
 *    denne testen var flertenant-argumentet en påstand (api-tallet sto på 319).
 * 2. UPN som eneste identitets-e-post — `mail`/`email`-claimet er tenant-admin-
 *    styrt. En fremmed gratis-tenant satte `mail` til en eksisterende brukers
 *    adresse; e-postoppslaget bandt så den fremmede oid-en til offerets konto
 *    (full overtakelse ved account.create). Identitet tas nå KUN fra
 *    preferred_username (UPN, verifisert domene), aldri fra `mail`.
 */

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const GYLDIG_ISS = `https://login.microsoftonline.com/${TID}/v2.0`;

function claims(overrides: Partial<JWTPayload> = {}): JWTPayload {
  return {
    iss: GYLDIG_ISS,
    tid: TID,
    oid: "11111111-2222-3333-4444-555555555555",
    preferred_username: "ola@markussen.no",
    name: "Ola Nordmann",
    ...overrides,
  } as JWTPayload;
}

function kastetKode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof TRPCError ? err.code : "IKKE_TRPC";
  }
  return undefined;
}

describe("validerMicrosoftClaims — iss/tid-vakt (flertenant)", () => {
  it("gyldig iss == well-formed v2-issuer for tid → passerer", () => {
    const info = validerMicrosoftClaims(claims());
    expect(info.providerAccountId).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("🔴 iss matcher IKKE tid (fremmed/forfalsket issuer) → avvises UNAUTHORIZED", () => {
    const feilIss = claims({
      iss: "https://login.microsoftonline.com/99999999-9999-9999-9999-999999999999/v2.0",
    });
    expect(kastetKode(() => validerMicrosoftClaims(feilIss))).toBe("UNAUTHORIZED");
  });

  it("manglende tid → avvises (kan ikke utlede forventet issuer)", () => {
    const utenTid = claims({ tid: undefined });
    expect(kastetKode(() => validerMicrosoftClaims(utenTid))).toBe("UNAUTHORIZED");
  });

  it("iss uten v2.0-suffiks (v1-issuer) → avvises", () => {
    const v1 = claims({ iss: `https://sts.windows.net/${TID}/` });
    expect(kastetKode(() => validerMicrosoftClaims(v1))).toBe("UNAUTHORIZED");
  });
});

describe("validerMicrosoftClaims — UPN er eneste identitets-e-post", () => {
  it("🔴 e-post velges fra preferred_username (UPN), ALDRI fra mail-claimet", () => {
    // Angrepets kjerne: fremmed tenant setter `mail` til offerets adresse.
    // Identiteten skal følge UPN-en (angriperens egen), ikke det forfalskede mail.
    const info = validerMicrosoftClaims(
      claims({
        email: "offer@sitedoc.no", // tenant-styrt mail — forsøkt forfalsket
        preferred_username: "angriper@fremmedtenant.onmicrosoft.com",
      }),
    );
    expect(info.email).toBe("angriper@fremmedtenant.onmicrosoft.com");
    expect(info.email).not.toBe("offer@sitedoc.no");
  });

  it("manglende preferred_username (UPN) → avvises, selv om mail finnes", () => {
    const utenUpn = claims({ preferred_username: undefined, email: "x@y.no" });
    expect(kastetKode(() => validerMicrosoftClaims(utenUpn))).toBe("UNAUTHORIZED");
  });

  it("manglende oid → avvises", () => {
    const utenOid = claims({ oid: undefined });
    expect(kastetKode(() => validerMicrosoftClaims(utenOid))).toBe("UNAUTHORIZED");
  });

  it("happy path → { email: UPN, providerAccountId: oid, image: null }", () => {
    const info = validerMicrosoftClaims(claims());
    expect(info).toEqual({
      email: "ola@markussen.no",
      name: "Ola Nordmann",
      image: null,
      providerAccountId: "11111111-2222-3333-4444-555555555555",
    });
  });

  it("mail brukes som VISNINGS-fallback for navn når name mangler (aldri som identitet)", () => {
    const info = validerMicrosoftClaims(
      claims({ name: undefined, email: "visning@markussen.no" }),
    );
    expect(info.name).toBe("visning@markussen.no");
    expect(info.email).toBe("ola@markussen.no"); // identitet fortsatt UPN
  });
});
