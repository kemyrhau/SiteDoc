import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { kortModusVisning } from "../../lib/prosjektkortMobil";

/**
 * Vakt (16c, 2026-11-06): på prosjektkortet skal prosjektet være låst i
 * timer-rad-dialogen. Låsen lå bare i prosjekt/byggeplass-velgeren, mens
 * prosjektfeltet i dialogen fortsatt var en nedtrekk med chevron. Ren
 * kildeskanning (ingen render-infrastruktur i mobil-testene).
 */
function utenKommentarer(kilde: string): string {
  return kilde.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const les = (navn: string) => utenKommentarer(readFileSync(join(__dirname, navn), "utf8"));

describe("prosjektlås i timer-rad-dialogen (16c)", () => {
  it("kortmodus låser prosjektet, dagskortet gjør det ikke", () => {
    expect(kortModusVisning(true).prosjektLaast).toBe(true);
    expect(kortModusVisning(false).prosjektLaast).toBe(false);
  });

  it("TimerRadModal sender låsen til prosjektfeltet", () => {
    const kilde = les("TimerSeksjon.tsx");
    const start = kilde.indexOf("function TimerRadModal(");
    const slutt = kilde.indexOf("\nfunction ", start + 1);
    const modal = kilde.slice(start, slutt === -1 ? undefined : slutt);
    const felt = modal.match(/<ProsjektFelt\b[\s\S]*?\/>/g) ?? [];
    expect(felt.length).toBeGreaterThan(0);
    for (const f of felt) expect(f).toMatch(/laast=\{kortVisning\.prosjektLaast\}/);
  });

  it("ProsjektFelt videresender låsen til VelgerFelt", () => {
    const kilde = les("ProsjektVelger.tsx");
    const start = kilde.indexOf("export function ProsjektFelt(");
    expect(start).toBeGreaterThan(-1);
    expect(kilde.slice(start).match(/<VelgerFelt\b[\s\S]*?\/>/)?.[0]).toMatch(/laast=\{laast\}/);
  });

  it("låst VelgerFelt har verken trykk eller chevron", () => {
    const kilde = les("VelgerFelt.tsx");
    const gren = kilde.match(/if \(laast\) \{([\s\S]*?)\n {2}\}/)?.[1] ?? "";
    expect(gren).toMatch(/return/);
    expect(gren).not.toMatch(/Pressable|onPress|ChevronDown/);
  });
});
