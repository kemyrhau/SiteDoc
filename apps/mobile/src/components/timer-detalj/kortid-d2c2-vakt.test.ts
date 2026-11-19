import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Kort-id d2c-2 (spec § 12.2 R24, § 12.6): kildevakter for koblingen maskin →
// timerad på telefonen. Feiler når en del av kjeden faller ut.

const her = dirname(fileURLToPath(import.meta.url));
const les = (...del: string[]) => readFileSync(join(her, ...del), "utf-8");
const flat = (s: string) => s.replace(/\s+/g, " ");

const MASKIN = les("MaskinSeksjon.tsx");
const PK = les("prosjektkort/ProsjektkortDagsoversikt.tsx");
const SPLITT = les("SplittRadModal.tsx");
const TIMER = les("TimerSeksjon.tsx");
const GRUPPE = les("ProsjektGruppe.tsx");
const DAGSKORT = les("../../../app/timer/[id].tsx");

describe("Kort-id d2c-2: maskin koblet til timerad", () => {
  it("negativkontroll: kildene er lest", () => {
    for (const k of [MASKIN, PK, SPLITT, TIMER, GRUPPE, DAGSKORT]) expect(k.length).toBeGreaterThan(500);
  });

  it("🔴 maskinvinduet bruker den delte regelen og sender koblingen ut", () => {
    expect(MASKIN).toContain("timeradSperre(valgtEquipment?.utleieEnhet ?? null, valgtTimeradId, arbeidsrader)");
    expect(flat(MASKIN)).toContain("fraTid, tilTid, valgtTimeradId, );");
  });

  it("🔴 dagskort-modus: maskinvinduet får ingen kortArbeidsrader (bøtta leses fra SQLite)", () => {
    const tagger = [...MASKIN.matchAll(/<MaskinRadModal[\s\S]*?\/>/g), ...GRUPPE.matchAll(/<MaskinRadModal[\s\S]*?\/>/g)].map(
      (m) => m[0],
    );
    expect(tagger.length).toBeGreaterThan(0);
    for (const tagg of tagger) expect(tagg).not.toContain("kortArbeidsrader");
    expect(MASKIN).toContain("arbeidsraderIBotteLokalt(");
  });

  it("🔴 dagskort-modus: MaskinSeksjon skriver koblingen ved ny og endret maskin", () => {
    const f = flat(MASKIN);
    expect(f).toContain("dagsseddelId: sheetId, sheetTimerId, projectId: radProjectId,");
    expect(f).toContain(".set({ sheetTimerId, projectId: radProjectId,");
  });

  it("🔴 prosjektkort: kortets arbeidsrader, slett-bekreftelse med maskinene og flytt til timerad", () => {
    expect(PK).toContain("kortArbeidsrader={arbeidsraderPaaKort(kortForRad(maskinModal))}");
    expect(PK).toContain("maskinerSomKreverRadenLokalt(db(), redigert.id)");
    expect(PK).toContain("fjernTimerRadMedMaskiner(");
    expect(PK).toContain('t("timer.fjernTimerRad.maskiner"');
    expect(PK).toContain('t("timer.maskinTimerad.flyttIngenArbeidsrad")');
    expect(PK).toContain("flyttMaskinMedVakt(flytt.rad.id, maal, kandidater[0]!.id)");
  });

  it("🔴 splitt arver koblingen", () => {
    expect(SPLITT).toContain("sheetTimerId: o.sheetTimerId ?? null,");
  });

  it("🔴 timerad som bærer maskin som krever den, kan ikke bli reise", () => {
    expect(TIMER).toContain('t("timer.maskinTimerad.reiseSperre"');
    expect(TIMER).toMatch(/erReiseRad \|\| erReiseLonnsartLokalt\(organizationId, valgtLonnsartId\)\)\) \{\s*const krever/);
  });
});
