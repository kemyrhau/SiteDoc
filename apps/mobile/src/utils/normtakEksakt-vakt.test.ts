import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

/**
 * U12-vakt (ORDRE (33) SVAR pkt 2): B10-taket på telefonen leser bare datoens eksakte
 * norm (`kunEksakt`). En framtidig dato utenfor cachen gir ukjent norm og intet tak —
 * aldri en annen dags norm. Overtidsforslaget (V21) og dagsforslaget beholder fallbacken.
 */
const les = (rel: string) => readFileSync(path.resolve(__dirname, rel), "utf8");
const OVERSIKT = les("../components/timer-detalj/prosjektkort/ProsjektkortDagsoversikt.tsx");
const SEKSJON = les("../components/timer-detalj/TimerSeksjon.tsx");
const HOOK = les("../components/timer-detalj/prosjektkort/useProsjektkortSedel.ts");
const KORT = les("../../app/timer/[id]/kort/[projectId].tsx");

describe("U12 — B10 bruker kun eksakt norm", () => {
  it("bruddForDag i dagsoversikten får normtakTimer, ikke normTimer", () => {
    const blokk = OVERSIKT.slice(OVERSIKT.indexOf("bruddForDag({"), OVERSIKT.indexOf("bruddForDag({") + 200);
    expect(blokk).toContain("dagsnorm: normtakTimer");
  });
  it("restForRad i rad-vinduet får normtakDagsnorm, ikke dagsnormTimer", () => {
    const blokk = SEKSJON.slice(SEKSJON.indexOf("restForRad({"), SEKSJON.indexOf("restForRad({") + 120);
    expect(blokk).toContain("dagsnorm: normtakDagsnorm");
  });
  it("normtak-kildene kaller hentDagsnormLokalt med kunEksakt", () => {
    expect(HOOK).toContain('normtakTimer = normSvar?.normStatus === "server" ? normSvar.dagsnorm : null');
    expect(KORT).toMatch(/normtakTimer = useMemo[\s\S]{0,200}kunEksakt: true/);
  });
});
