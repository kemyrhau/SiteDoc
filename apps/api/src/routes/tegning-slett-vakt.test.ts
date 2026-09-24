import { describe, it, expect, vi } from "vitest";

/**
 * Slettevakt på `tegning.slett` (speiler `omrade.slett` — Kenneth-vedtak: «blokkér hvis feltet
 * inneholder data fra før, og bare admin»). Uten vakt lager slette-knappen fella vi nettopp
 * fjernet for områder: alle referanse-FK-ene er `onDelete: SetNull`, så en sletting etterlater
 * markører som peker på en tegning som ikke finnes.
 *
 * En tegning refereres BÅDE hardt og mykt:
 *   - FK (drawing_id): tasks, checklists, kontrollplan_punkter · FK (tegning_id): omrader
 *   - myk JSON: rapportobjektet TegningPosisjon lagrer `drawingId` i Checklist.data/Task.data
 *     (shared `TegningPosisjonVerdi`) uten FK — samme myke referanse omrade-vakten måtte telle.
 * `$queryRaw` slår FK OR myk sammen per entitet (distinkt, ingen dobbelttelling); denne
 * enhetstesten låser vakt-LOGIKKEN. At den ekte SQL-en faktisk finner den myke referansen
 * hører hjemme i en integrasjonstest (mønster: `omrade-slett-nullfelle.integration.test.ts`).
 *
 * `verifiserAdmin` mockes → admin-gaten passerer her; den ekte gaten testes for seg i api-suiten.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
}));

import { tegningRouter } from "./tegning";

const TEGNING = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type Bruk = { oppgaver: number; sjekklister: number; kontrollpunkter: number; omrader: number };

function lagCtx(bruk: Bruk, del: ReturnType<typeof vi.fn>) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      drawing: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ projectId: PROSJEKT }),
        delete: del,
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          oppgaver: BigInt(bruk.oppgaver),
          sjekklister: BigInt(bruk.sjekklister),
          kontrollpunkter: BigInt(bruk.kontrollpunkter),
          omrader: BigInt(bruk.omrader),
        },
      ]),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const INGEN: Bruk = { oppgaver: 0, sjekklister: 0, kontrollpunkter: 0, omrader: 0 };

describe("tegning.slett — slettevakt", () => {
  it("RØD FØRST: tegning brukt av 2 oppgaver → BAD_REQUEST med tallet, IKKE slettet", async () => {
    const del = vi.fn();
    const caller = tegningRouter.createCaller(lagCtx({ ...INGEN, oppgaver: 2 }, del));

    await expect(caller.slett({ id: TEGNING })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Tegningen brukes av 2 oppgaver og kan ikke slettes. Flytt markørene til en annen tegning, eller fjern det som bruker den, først.",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("entall: 1 sjekkliste → «1 sjekkliste» (ikke «1 sjekklister»)", async () => {
    const del = vi.fn();
    const caller = tegningRouter.createCaller(lagCtx({ ...INGEN, sjekklister: 1 }, del));
    await expect(caller.slett({ id: TEGNING })).rejects.toThrow(
      /Tegningen brukes av 1 sjekkliste og kan ikke slettes/,
    );
    expect(del).not.toHaveBeenCalled();
  });

  it("kontrollplanpunkt-referanse blokkerer og navngis", async () => {
    const del = vi.fn();
    const caller = tegningRouter.createCaller(lagCtx({ ...INGEN, kontrollpunkter: 3 }, del));
    await expect(caller.slett({ id: TEGNING })).rejects.toThrow(
      /Tegningen brukes av 3 kontrollplanpunkter og kan ikke slettes/,
    );
  });

  it("område-referanse (tegning_id) blokkerer og navngis i entall", async () => {
    const del = vi.fn();
    const caller = tegningRouter.createCaller(lagCtx({ ...INGEN, omrader: 1 }, del));
    await expect(caller.slett({ id: TEGNING })).rejects.toThrow(
      /Tegningen brukes av 1 område og kan ikke slettes/,
    );
  });

  it("flere veier > 0 → meldingen navngir alle tallene i rekkefølge", async () => {
    const del = vi.fn();
    const caller = tegningRouter.createCaller(
      lagCtx({ oppgaver: 2, sjekklister: 1, kontrollpunkter: 0, omrader: 4 }, del),
    );
    await expect(caller.slett({ id: TEGNING })).rejects.toThrow(
      /2 oppgaver, 1 sjekkliste, 4 områder og kan ikke slettes/,
    );
  });

  it("ubrukt tegning (alle 0) → slettes fritt — dekker de seks feilede tegningene (aldri konvertert, 0 markører)", async () => {
    const del = vi.fn().mockResolvedValue({ id: TEGNING });
    const caller = tegningRouter.createCaller(lagCtx(INGEN, del));

    await caller.slett({ id: TEGNING });
    expect(del).toHaveBeenCalledWith({ where: { id: TEGNING } });
  });
});
