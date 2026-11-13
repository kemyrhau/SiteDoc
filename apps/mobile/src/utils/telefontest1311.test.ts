import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { naaStedLinje } from "./paagaarSted";

// ORDRE telefontest 13.11 (orkestrator 2026-11-13): funn 3, 4 og 9.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const utenKommentarer = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const BEKREFT = utenKommentarer(les("../../app/timer/bekreft-dag.tsx"));
const KORT = utenKommentarer(les("../components/StartSluttDagKort.tsx"));
const OVERSIKT = utenKommentarer(
  les("../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx"),
);

/** Kilden matcher; mutanten endrer kilden og matcher IKKE (negativkontroll). */
function vakt(kilde: string, re: RegExp, mutasjon: [string | RegExp, string]) {
  expect(kilde).toMatch(re);
  const mutert = kilde.replace(mutasjon[0], mutasjon[1]);
  expect(mutert).not.toBe(kilde);
  expect(mutert).not.toMatch(re);
}

describe("funn 3 — manuell Bekreft dag henter dagens norm før forslaget", () => {
  // Effekten: kun manuell modus, henter for valgt dato, regner på nytt når svaret er lagret.
  const HENT =
    /if \(!manuell \|\| !orgId\) return;[\s\S]{0,80}hentOgCacheArbeidstidSvar\(normUtils\.client, orgId, manuellDato\)\.then\(\(ok\) => \{\s*if \(ok && !avbrutt\) settNormNonce\(/;

  it("🔴 henter svaret for manuellDato og bumper nonce ved suksess", () => {
    vakt(BEKREFT, HENT, ["hentOgCacheArbeidstidSvar(normUtils.client, orgId, manuellDato)", "Promise.resolve(false)"]);
  });

  it("🔴 henter for den VALGTE datoen, ikke i dag", () => {
    vakt(BEKREFT, HENT, ["normUtils.client, orgId, manuellDato)", "normUtils.client, orgId, lokalIsoDato(new Date()))"]);
  });

  it("🔴 effekten kjører på nytt når datoen byttes", () => {
    const re = /\}, \[manuell, orgId, manuellDato, normUtils\.client\]\);/;
    vakt(BEKREFT, re, ["}, [manuell, orgId, manuellDato, normUtils.client]);", "}, [manuell, orgId, normUtils.client]);"]);
  });

  it("🔴 forslaget regnes på nytt når svaret er cachet (normNonce i beregnet-deps)", () => {
    const re = /\}, \[manuell, manuellDato, normNonce, dag, bruker\?\.id,/;
    vakt(BEKREFT, re, ["}, [manuell, manuellDato, normNonce, dag,", "}, [manuell, manuellDato, dag,"]);
  });

  it("GPS-veien er urørt: henting skjer fortsatt i forberedSluttDag, ikke i skjermen", () => {
    expect(BEKREFT.split("hentOgCacheArbeidstidSvar(").length - 1).toBe(1);
  });
});

describe("funn 4 — «+ Nytt prosjektkort» er blå og litt større", () => {
  it("🔴 lenken bruker app-blå og text-base", () => {
    const re =
      /<Pressable onPress=\{onNyttKort\}[^>]*>\s*<Text className="text-base font-medium text-sitedoc-primary">\{t\("timer\.prosjektkort\.nyttKort"\)\}/;
    vakt(OVERSIKT, re, ['text-base font-medium text-sitedoc-primary">{t("timer.prosjektkort.nyttKort")}', 'text-sm text-gray-700">{t("timer.prosjektkort.nyttKort")}']);
  });
});

describe("funn 9 — pågår-kortet viser alltid hvor brukeren står", () => {
  const besok = (rekkefolge: number, byggeplassId: string | null, byggeplassNavn: string | null) => ({
    rekkefolge,
    byggeplassId,
    byggeplassNavn,
  });

  it("🔴 første besøk uten oppmøtested → «Nå»-linjen vises", () => {
    expect(naaStedLinje({ oppmotestedNavn: null, siste: besok(1, "b1", "Hovedgata 5") })).toBe("besok");
  });

  it("🔴 første besøk utenfor byggeplass → «Nå»-linjen vises (stedNavn gir «Utenfor …»)", () => {
    expect(naaStedLinje({ oppmotestedNavn: null, siste: besok(1, null, null) })).toBe("besok");
    expect(naaStedLinje({ oppmotestedNavn: "Verkstedet", siste: besok(1, null, null) })).toBe("besok");
  });

  it("intet besøk lest → «Utenfor byggeplass»", () => {
    expect(naaStedLinje({ oppmotestedNavn: null, siste: null })).toBe("utenfor");
  });

  it("🔴 oppmøtested og første besøk samme sted → ingen dobbel linje", () => {
    expect(naaStedLinje({ oppmotestedNavn: "Hovedgata 5", siste: besok(1, "b1", "Hovedgata 5") })).toBe(null);
    expect(naaStedLinje({ oppmotestedNavn: " hovedgata 5", siste: besok(1, "b1", "Hovedgata 5 ") })).toBe(null);
  });

  it("første besøk annet sted enn oppmøtested → begge linjer", () => {
    expect(naaStedLinje({ oppmotestedNavn: "Verkstedet", siste: besok(1, "b1", "Hovedgata 5") })).toBe("besok");
  });

  it("senere besøk vises alltid, også ved samme navn som oppmøtested", () => {
    expect(naaStedLinje({ oppmotestedNavn: "Hovedgata 5", siste: besok(2, "b1", "Hovedgata 5") })).toBe("besok");
  });

  it("🔴 kortet bruker naaStedLinje, ikke det gamle `rekkefolge > 1`-filteret", () => {
    const re =
      /const naaLinje = naaStedLinje\(\{ oppmotestedNavn: aktivDag\.oppmotestedNavn, siste \}\);[\s\S]*\{naaLinje === "besok" && siste \?[\s\S]*?t\("timer\.besok\.naa"[\s\S]*?: naaLinje === "utenfor" \?[\s\S]*?t\("timer\.besok\.utenfor"\)/;
    vakt(KORT, re, ['{naaLinje === "besok" && siste ?', "{siste && siste.rekkefolge > 1 ?"]);
    expect(KORT).not.toContain("siste.rekkefolge > 1");
  });
});
