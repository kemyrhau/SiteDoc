import { describe, it, expect } from "vitest";
import { resolverNyNavigasjon } from "./nyNavigasjon";

// Beviser presedens-kjeden: aktiv ?nyNav-URL > konto > persistert lokal > env-default > av.
describe("resolverNyNavigasjon — presedens", () => {
  it("konto=true vinner over lokal og env (ingen query)", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: true, lokal: false, envDefault: false }),
    ).toBe(true);
  });

  it("konto=false vinner over lokal=true og env=true (ingen query)", () => {
    // Uten konto-dominans ville en pilot-arbeider ikke kunne bli holdt på gammel nav.
    expect(
      resolverNyNavigasjon({ query: null, konto: false, lokal: true, envDefault: true }),
    ).toBe(false);
  });

  it("konto=null → faller til persistert lokal (true)", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: true, envDefault: false }),
    ).toBe(true);
  });

  it("konto=null → faller til persistert lokal (false), env ignoreres", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: false, envDefault: true }),
    ).toBe(false);
  });

  it("konto=null + lokal=null → env-default (true, redesign-stack)", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: null, envDefault: true }),
    ).toBe(true);
  });

  it("alt usatt (query/konto/lokal=null, env=false) → av", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: null, envDefault: false }),
    ).toBe(false);
  });
});

// Valg B: aktiv ?nyNav-URL er flyktig demo/dev-override — øverst i kjeden.
describe("resolverNyNavigasjon — flyktig query-override (valg B)", () => {
  it("query=false overstyrer konto=true (kunderunde: vis gammel nav for tildelt bruker)", () => {
    expect(
      resolverNyNavigasjon({ query: false, konto: true, lokal: true, envDefault: true }),
    ).toBe(false);
  });

  it("query=true overstyrer konto=false", () => {
    expect(
      resolverNyNavigasjon({ query: true, konto: false, lokal: false, envDefault: false }),
    ).toBe(true);
  });

  it("query fjernet (null) → tilbake til konto-styrt (query persisterer ikke)", () => {
    // Samme konto/lokal som over, men uten query: konto styrer igjen. Dette speiler
    // hook-kontrakten om at ?nyNav aldri skrives til cache/konto.
    expect(
      resolverNyNavigasjon({ query: null, konto: true, lokal: true, envDefault: false }),
    ).toBe(true);
    expect(
      resolverNyNavigasjon({ query: null, konto: false, lokal: true, envDefault: false }),
    ).toBe(false);
  });
});

// Beviser delt-enhet-scenariet: samme enhet, samme stale lokale cache, men bruker byttes.
// Nav skal følge den innloggede brukerens konto — ikke forrige brukers lokale verdi.
describe("resolverNyNavigasjon — delt enhet (brukerbytte, samme lokal cache)", () => {
  const staleLokalCache = true; // f.eks. forrige bruker (pilot-admin) skrudde på

  it("bruker A (konto=true) på delt enhet → ny nav", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: true, lokal: staleLokalCache, envDefault: false }),
    ).toBe(true);
  });

  it("bruker B logger inn på SAMME enhet (konto=false) → gammel nav, tross stale lokal=true", () => {
    // Kjernen: konto-dominansen gjør at nav bytter ved brukerbytte uten at den lokale
    // cachen (forrige bruker) forurenser bruker B.
    expect(
      resolverNyNavigasjon({ query: null, konto: false, lokal: staleLokalCache, envDefault: false }),
    ).toBe(false);
  });

  it("anti-blink boot: lokal boot-verdi taper mot konto-svar når det kommer (krav 1b)", () => {
    // Ved boot vises lokal (siste-bruker) mens konto=null (query ikke ferdig).
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: true, envDefault: false }),
    ).toBe(true);
    // Når konto-svaret kommer (false) MÅ det overstyre boot-verdien (true) umiddelbart.
    expect(
      resolverNyNavigasjon({ query: null, konto: false, lokal: true, envDefault: false }),
    ).toBe(false);
  });

  it("bruker C (ikke tildelt, konto=null) → persistert lokal styrer bevisst", () => {
    // Når konto=null er lokal den bevisste kilden. Hooken nullstiller/nøkler cache per
    // userId ved brukerbytte, så C starter uten A/B sin cache i praksis.
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: staleLokalCache, envDefault: false }),
    ).toBe(true);
  });
});

// Stale-lokal-guard (2026-07-09): `lokal` honoreres kun når `lokalTillatt` (rolle).
// Fikser lock-in for ikke-admin med gammel lokal="1" fra pre-Plan-2 `?nyNav=1`-persist.
describe("resolverNyNavigasjon — stale-lokal-guard (lokalTillatt)", () => {
  it("lokalTillatt=false + konto=null + lokal=true → IGNORER lokal, fall til env (av)", () => {
    // Kjernen i fiksen: ikke-admin (lokalTillatt=false) med stale lokal="1" og ingen
    // konto låses IKKE inne — faller til env-default (false = gammel nav).
    expect(
      resolverNyNavigasjon({
        query: null,
        konto: null,
        lokal: true,
        lokalTillatt: false,
        envDefault: false,
      }),
    ).toBe(false);
  });

  it("lokalTillatt=true + konto=null + lokal=true → honorer lokal (admin beholder egen toggle)", () => {
    // Admin med konto=null + lokal="1" fra egen toggle skal fortsatt få ny nav.
    expect(
      resolverNyNavigasjon({
        query: null,
        konto: null,
        lokal: true,
        lokalTillatt: true,
        envDefault: false,
      }),
    ).toBe(true);
  });

  it("lokalTillatt=false rører IKKE konto — konto=true vinner uansett", () => {
    // Guarden er kun for lokal-leddet: en pilot-bruker (konto=true) beholder ny nav
    // selv om lokalTillatt=false.
    expect(
      resolverNyNavigasjon({
        query: null,
        konto: true,
        lokal: null,
        lokalTillatt: false,
        envDefault: false,
      }),
    ).toBe(true);
  });

  it("lokalTillatt=false rører IKKE flyktig query — query=true vinner", () => {
    expect(
      resolverNyNavigasjon({
        query: true,
        konto: null,
        lokal: false,
        lokalTillatt: false,
        envDefault: false,
      }),
    ).toBe(true);
  });

  it("lokalTillatt utelatt → default true (bakoverkompat, honorer lokal som før)", () => {
    expect(
      resolverNyNavigasjon({ query: null, konto: null, lokal: true, envDefault: false }),
    ).toBe(true);
  });
});
