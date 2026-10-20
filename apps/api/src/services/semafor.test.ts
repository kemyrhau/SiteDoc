import { describe, it, expect } from "vitest";
import { Semafor } from "./semafor";

/**
 * Trukket ut av embedding-service.ts (NorBERT-køen) 2026-10-16 for gjenbruk i
 * tegningskøen («Oppdater alle tegninger», maks 2 samtidig). Testene dekker
 * samtidighetsgrensen og FIFO-rekkefølgen — selve atferden begge brukssteder er
 * til for.
 */

function vent(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Semafor", () => {
  it("lar inntil maks kall kjøre samtidig", async () => {
    const sem = new Semafor(2);
    let samtidig = 0;
    let maksSett = 0;

    const kjor = async () => {
      samtidig++;
      maksSett = Math.max(maksSett, samtidig);
      await vent(10);
      samtidig--;
    };

    await Promise.all([sem.kjør(kjor), sem.kjør(kjor), sem.kjør(kjor), sem.kjør(kjor)]);
    expect(maksSett).toBe(2);
  });

  it("iFlukt reflekterer antall kall som holder en slot nå", async () => {
    const sem = new Semafor(1);
    expect(sem.iFlukt).toBe(0);
    const ferdig = sem.kjør(() => vent(20));
    // Synkron del av kjør() har ikke kjørt ennå — gi mikrotasken et puff.
    await Promise.resolve();
    expect(sem.iFlukt).toBe(1);
    await ferdig;
    expect(sem.iFlukt).toBe(0);
  });

  it("4. kall venter til en slot frigis (FIFO), kjører ikke før det", async () => {
    const sem = new Semafor(1);
    const rekkefølge: number[] = [];
    const lagKall = (n: number) => sem.kjør(async () => {
      rekkefølge.push(n);
      await vent(5);
    });

    const p1 = lagKall(1);
    const p2 = lagKall(2);
    const p3 = lagKall(3);
    await Promise.all([p1, p2, p3]);
    expect(rekkefølge).toEqual([1, 2, 3]);
  });

  it("en kastet fn frigir slotten likevel (finally)", async () => {
    const sem = new Semafor(1);
    await expect(sem.kjør(() => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(sem.iFlukt).toBe(0);
    // Neste kall skal kunne ta slotten med én gang (ikke låst av den kastede).
    let kjørte = false;
    await sem.kjør(async () => { kjørte = true; });
    expect(kjørte).toBe(true);
  });

  it("nullstill() frigir okkuperte slots (test-isolasjon: en jobb som aldri resolver blokkerer ikke neste test)", async () => {
    const sem = new Semafor(1);
    // En jobb som aldri resolver holder slotten for alltid (som de bevisste
    // «aldri resolve»-konverteringene i tegning-arbeider-testene).
    void sem.kjør(() => new Promise<void>(() => {}));
    await Promise.resolve();
    expect(sem.iFlukt).toBe(1);

    sem.nullstill();
    expect(sem.iFlukt).toBe(0);

    // Etter nullstill skal en ny jobb kunne ta slotten umiddelbart.
    let kjørte = false;
    await sem.kjør(async () => { kjørte = true; });
    expect(kjørte).toBe(true);
  });
});
