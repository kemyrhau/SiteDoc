import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * POST 2026-11-15 (14) punkt 2 (ii-a) — ikke ansatt i valgt firma → ingen ny
 * registrering fra NOEN inngang. Selve sjekken testes rent; inngangene
 * («+» i prosjektkort-modus, «+» i dagskort-modus/Start-slutt-kortets ny rad,
 * Start dag) testes som koblingstester: de kaller sjekken og avbryter på false
 * FØR noe skrives eller GPS fanges. Bekreft dag (og GPS-utkastet, som bare
 * skrives i bekreft-dag) er testet i `dagsforslagAnvend.lag2.test.ts` (erAnsatt=false).
 */

const alert = vi.hoisted(() => vi.fn());
const lagret = vi.hoisted(() => ({ status: null as boolean | null }));
vi.mock("react-native", () => ({ Alert: { alert } }));
vi.mock("../kontekst/FirmaKontekst", () => ({
  hentLagretAnsattStatus: async () => lagret.status,
}));

import { sjekkAnsattForNyRegistrering } from "./ansattSjekk";

const t = ((k: string, o?: { firma?: string }) => (o?.firma ? `${k}:${o.firma}` : k)) as never;
const sjekk = (erAnsattIValgtFirma: boolean | null, orgId: string | null = "org1") =>
  sjekkAnsattForNyRegistrering({ erAnsattIValgtFirma, orgId, firmaNavn: "Firma B", t });

beforeEach(() => {
  alert.mockClear();
  lagret.status = null;
});

describe("sjekkAnsattForNyRegistrering", () => {
  it("🔴 ikke ansatt → false + eksisterende tekst timer.ikkeAnsatt", async () => {
    expect(await sjekk(false)).toBe(false);
    expect(alert).toHaveBeenCalledWith("timer.kildeManglet.tittel", "timer.ikkeAnsatt:Firma B");
  });

  it("ansatt → true, ingen melding", async () => {
    expect(await sjekk(true)).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("ukjent i kontekst → sist lagrede svar avgjør", async () => {
    lagret.status = false;
    expect(await sjekk(null)).toBe(false);
    lagret.status = null;
    expect(await sjekk(null)).toBe(true);
  });
});

/** Kilden kaller sjekken og returnerer på false før `etter` (skriving/GPS). */
function sperrerFor(kilde: string, etter: string): boolean {
  const kall = kilde.indexOf("await sjekkAnsattForNyRegistrering(");
  if (kall < 0) return false;
  const retur = kilde.slice(kall).search(/if \(!ansatt\)\s*(\{[^}]*)?return/);
  const skriv = kilde.indexOf(etter, kall);
  return retur >= 0 && skriv > kall + retur;
}

const innganger: Array<[string, string]> = [
  ["../components/DagsseddelListe.tsx", "router.push"],
  ["../components/timer-detalj/NyTimerRadFlyt.tsx", "lagreNyTimerRad("],
  ["../hooks/useArbeidsdag.ts", "await fangGps()"],
];

describe("(ii-a) alle «ny registrering»-innganger sperrer ikke-ansatt", () => {
  it.each(innganger)("%s kaller sjekken før %s", (fil, etter) => {
    const kilde = fs.readFileSync(path.join(__dirname, fil), "utf8");
    expect(kilde.includes(etter), `${fil} mangler ${etter}`).toBe(true);
    expect(sperrerFor(kilde, etter)).toBe(true);
  });

  it("negativkontroll: kilde uten sjekken slår ut", () => {
    const kilde = fs.readFileSync(path.join(__dirname, "../hooks/useArbeidsdag.ts"), "utf8");
    const uten = kilde.replace("await sjekkAnsattForNyRegistrering(", "await ikkeSjekk(");
    expect(sperrerFor(uten, "await fangGps()")).toBe(false);
  });
});
