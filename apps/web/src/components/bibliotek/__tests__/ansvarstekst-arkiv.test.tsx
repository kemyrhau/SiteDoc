import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Ansvarstekst-vakt (ordre ansvarstekst-arkiv, fabel 2026-10-07, DoD § 3). De to faste
 * linjene er et JURIDISK vern — legger ansvaret på kunden én gang sentralt. Uten en test
 * kan de fjernes stille. Vakten er kildenivå (grep-vakt) fordi flatene ikke kan rendres
 * isolert: `SitedocArkivFane` kaller trpc direkte, og `ArkivListe`/`ArkivRadElement` er
 * modul-lokale i `HentFraArkivModal`. Fabel operasjonaliserte selv alle fire som grep/
 * kildegrep; samme form som `standardtittel-uten-kode.test.ts` i denne mappa.
 */

const here = dirname(fileURLToPath(import.meta.url));
const sitedocFane = readFileSync(
  resolve(here, "../../../app/dashbord/firma/innstillinger/malforvaltning/_components/SitedocArkivFane.tsx"),
  "utf-8",
);
const hentModal = readFileSync(resolve(here, "../HentFraArkivModal.tsx"), "utf-8");
const i18nDir = resolve(here, "../../../../../../packages/shared/src/i18n");

describe("ansvarstekst i SiteDoc-arkivet og hent-dialogen", () => {
  it("1. SitedocArkivFane viser ansvarKilde som fast linje — ingen state/klikk som kan skjule den", () => {
    expect(sitedocFane).toContain('t("maler.arkiv.ansvarKilde")');
    // Linjen som bærer nøkkelen skal være en ren <p>, ikke en knapp/lukkbar boks.
    const linje = sitedocFane
      .split("\n")
      .find((l) => l.includes('t("maler.arkiv.ansvarKilde")'))!;
    expect(linje).toContain("<p");
    expect(linje).not.toMatch(/onClick|useState|localStorage/);
    // Hele fanen skal ikke ha noen faktisk lukk-mekanisme (persistens) for linjen.
    // (Ordet kan stå i en kommentar; vi fanger kun ekte bruk: `localStorage.getItem` o.l.)
    expect(sitedocFane).not.toMatch(/localStorage\s*\./);
  });

  it("2. ArkivListe rendrer topplinje når satt; begge linjene kun i sitedoc-grenen", () => {
    // Ny prop finnes og rendres betinget (ingenting når ikke satt).
    expect(hentModal).toContain("topplinje?: ReactNode");
    expect(hentModal).toContain("{topplinje &&");
    // ansvarFirma forekommer nøyaktig én gang, og den gangen ligger etter at
    // sitedoc-grenen åpner — firma-grenen (lenger opp) kan dermed ikke bære den.
    const treff = hentModal.match(/ansvarFirma/g) ?? [];
    expect(treff).toHaveLength(1);
    const idxSitedoc = hentModal.indexOf('aktivFane === "sitedoc"');
    const idxAnsvarFirma = hentModal.indexOf("ansvarFirma");
    expect(idxSitedoc).toBeGreaterThan(-1);
    expect(idxAnsvarFirma).toBeGreaterThan(idxSitedoc);
  });

  it("3. Hent-knappen er uendret — direkte onHent, ingen avkrysning eller bekreftelse", () => {
    expect(hentModal).toContain("onClick={r.onHent}");
    expect(hentModal).not.toContain("confirm(");
    expect(hentModal).not.toContain('type="checkbox"');
  });

  it("4. i18n: alle 15 språk har begge nøkler; ingen ingenSitedocForklart sier «kun NS 3420-K»", () => {
    const filer = readdirSync(i18nDir).filter((f) => f.endsWith(".json"));
    expect(filer.length).toBe(15);
    for (const f of filer) {
      const d = JSON.parse(readFileSync(resolve(i18nDir, f), "utf-8")) as Record<string, string>;
      expect(d["maler.arkiv.ansvarKilde"], `${f} mangler ansvarKilde`).toBeTruthy();
      expect(d["maler.arkiv.ansvarFirma"], `${f} mangler ansvarFirma`).toBeTruthy();
      const forklart = d["maler.arkiv.ingenSitedocForklart"] ?? "";
      expect(forklart, `${f} ingenSitedocForklart sier fortsatt «kun … 3420-K»`).not.toMatch(
        /(kun|only)[\s\S]*3420-K/i,
      );
    }
  });
});
