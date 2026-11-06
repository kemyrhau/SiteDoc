import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const HER = dirname(fileURLToPath(import.meta.url));

// TILLEGG 2026-11-06 til ORDRE 24: sjekklisten har IKKE oppgavens utkast-lås. Den som kan
// redigere sjekklisten (`!leseModus` — også mottaker med redigeringsrett) kan sette punktet,
// trykke «Bruk min posisjon» og lagre. Harnessen rendrer ikke RN, så regelen voktes på
// kildenivå: alle `tegningBunnfelt`-kall i sjekkliste sender `!leseModus`, aldri status.
const kilde = readFileSync(join(HER, "../../app/sjekkliste/[id].tsx"), "utf8");
const kall = kilde.match(/tegningBunnfelt\(\{[^}]*\}\)/g) ?? [];

describe("sjekkliste: plassering følger !leseModus, ikke utkast-status", () => {
  it("tegningBunnfelt kalles minst én gang", () => {
    expect(kall.length).toBeGreaterThan(0);
  });
  it("hvert kall sender kanRedigerePunkt: !leseModus og nevner ikke status/draft", () => {
    for (const k of kall) {
      expect(k).toContain("kanRedigerePunkt: !leseModus");
      expect(k).not.toMatch(/status|draft/);
    }
  });
});

// ORDRE 25: sjekkliste i lesemodus (sendt/mottatt uten redigeringsrett, offline, HMS uten
// ballen) åpner tegningen read-only — som oppgave. Modalen åpnes, men trykk og Lagre
// finnes kun i `bunnfelt.visning === "lagre"`-grenen; ellers låsetekst.
describe("sjekkliste: lesemodus åpner tegningen read-only (ORDRE 25)", () => {
  const onAapne = kilde.slice(kilde.indexOf("onAapne={"), kilde.indexOf("onBekreftForslag="));

  it("lesemodus lukker ikke lokasjonslinjen — onAapne har en lesegren som åpner modalen", () => {
    expect(onAapne).not.toMatch(/onAapne=\{leseModus \? undefined/);
    const lesegren = onAapne.slice(0, onAapne.indexOf(": () => {"));
    expect(lesegren).toContain("setVisLokasjonModal(true)");
    // Ingen tegning → ikke trykkbar (ingen tom modal)
    expect(lesegren).toMatch(/drawing\?\.fileUrl[\s\S]*: undefined\)/);
    // Lesegrenen åpner aldri tegningsvelgeren
    expect(lesegren).not.toContain("setVisLokByttTegning(true)");
  });

  it("trykk på tegningen er kun aktivt når bunnfeltet sier «lagre»", () => {
    expect(kilde).toMatch(/onTrykk=\{\s*bunnfelt\.visning === "lagre"\s*\?[\s\S]*?: undefined\s*\}/);
  });

  it("Lagre ligger i lagre-grenen; ellers låsetekst med egen sjekkliste-nøkkel", () => {
    const fra = kilde.indexOf('{bunnfelt.visning === "lagre" ? (');
    expect(fra).toBeGreaterThan(0);
    const del = kilde.slice(fra);
    const elseGren = del.indexOf(") : (");
    expect(del.slice(0, elseGren)).toContain("oppdaterMutasjon.mutate");
    const laas = del.slice(elseGren, elseGren + 600);
    expect(laas).not.toContain("oppdaterMutasjon");
    expect(laas).toContain("sjekkliste.punktIngenRedigeringstilgang");
    expect(laas).toContain("oppgave.punktLaastOffline");
    // Ikke oppgavens «kun i utkast»-tekst — sjekkliste har ingen utkast-lås (TILLEGG)
    expect(laas).not.toContain("oppgave.punktLaastSendt");
  });
});
