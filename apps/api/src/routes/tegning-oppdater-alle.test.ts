import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * «Oppdater alle tegninger» (2026-10-16, orkestrator-ordre): admin-gatet batch som
 * rekonverterer alle DWG/DXF-hovedtegninger i prosjektet fra lagret original.
 * Tegninger uten original (PDF, eller DWG/DXF fra før revisjonsoriginal 10.10)
 * telles i `manglerOriginal` i stedet for å feile (DoD-krav 5). Fremdrift er
 * utledet av `conversionStatus` (2a-mønster, ingen migrering, ingen in-memory-
 * status) — dekkes av `tegning-rekonverter-status.test.ts`, ikke her.
 *
 * RETUR 6 (orkestrator 2026-10-16, DB-som-kø): denne mutasjonen gjør BARE den
 * atomiske markeringen til `pending` og returnerer — den starter ALDRI
 * `konverterDwg` direkte lenger (målt: et nettleser-klikk kjører denne mutasjonen
 * in-process i web-containeren, som aldri har hatt DWG-motoren tilgjengelig).
 * Selve konverteringen kjøres av arbeideren (`tegningKonverteringPoll`,
 * `tegning-konvertering-arbeider.test.ts`), ikke her.
 */

const h = vi.hoisted(() => ({
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  konverterDwg: vi.fn(),
}));

vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektIkkeFrosset: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: h.verifiserAdmin,
  byggTilgangsFilter: vi.fn().mockResolvedValue(null),
}));

vi.mock("../services/dwgKonvertering", () => ({
  // Skal ALDRI kalles av mutasjonen selv lenger (se modul-kommentar) — aldri
  // resolve i tilfelle den likevel blir kalt, så en regresjon vises som en hengende
  // test i stedet for et falskt grønt resultat.
  konverterDwg: (...a: unknown[]) => {
    h.konverterDwg(...a);
    return new Promise(() => {});
  },
  hentKonverteringKapasitet: vi.fn(),
  roterProsentMarkor: vi.fn(),
}));

import { tegningRouter } from "./tegning";

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function lagTegning(
  id: string,
  overstyring: Partial<{
    originalFileUrl: string | null;
    conversionStatus: string | null;
    alderMin: number;
  }> = {},
) {
  return {
    id,
    projectId: PROSJEKT,
    name: `Tegning ${id}`,
    byggeplassId: null,
    originalFileUrl: "originalFileUrl" in overstyring ? overstyring.originalFileUrl! : "/uploads/original.dwg",
    conversionStatus: overstyring.conversionStatus ?? "done",
    updatedAt: new Date(Date.now() - (overstyring.alderMin ?? 0) * 60 * 1000),
  };
}

/**
 * `opptakFeilerFor`: id-er som skal MISTE kappløpet (simulerer en rad som har rørt seg
 * siden `findMany`-snapshotet — en raskere konkurrerende kjøring har allerede tatt/
 * fullført den). Disse id-ene får `{ count: 0 }` fra sitt `updateMany`-kall; resten `{ count: 1 }`
 * (RETUR 5-vakta: `where: { id, updatedAt }`, se `oppdaterAlleTegninger`).
 */
function lagCtx(tegninger: ReturnType<typeof lagTegning>[], opptakFeilerFor: string[] = []) {
  const updateManyKall: Array<{ where: { id: string; updatedAt?: Date }; data: Record<string, unknown> }> = [];
  const prisma = {
    drawing: {
      findMany: vi.fn().mockResolvedValue(tegninger),
      updateMany: vi.fn(async (arg: { where: { id: string; updatedAt?: Date }; data: Record<string, unknown> }) => {
        updateManyKall.push(arg);
        return { count: opptakFeilerFor.includes(arg.where.id) ? 0 : 1 };
      }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const ctx = { userId: "user-1", prisma } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  return { ctx, updateManyKall };
}

describe("oppdaterAlleTegninger", () => {
  beforeEach(() => {
    h.konverterDwg.mockReset();
    h.verifiserAdmin.mockReset().mockResolvedValue(undefined);
  });

  it("ikke-admin avvises før noe leses/skrives", async () => {
    h.verifiserAdmin.mockRejectedValueOnce(new Error("Kun administratorer kan utføre denne handlingen"));
    const { ctx } = lagCtx([lagTegning("t1")]);
    await expect(
      tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT }),
    ).rejects.toThrow();
    expect(ctx.prisma.drawing.findMany).not.toHaveBeenCalled();
  });

  it("skiller manglerOriginal fra startbare, hopper over fersk pågår, starter resten", async () => {
    const tegninger = [
      lagTegning("t-ok-1"),
      lagTegning("t-ok-2"),
      lagTegning("t-mangler-original", { originalFileUrl: null }),
      lagTegning("t-pdf-original", { originalFileUrl: "/uploads/original.pdf" }),
      lagTegning("t-pagar-fersk", { conversionStatus: "converting", alderMin: 1 }),
    ];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    // t-pdf-original har originalFileUrl (ikke null) som ikke er .dwg/.dxf: verken
    // startbar eller manglerOriginal — PDF er utenfor scope, telles ingen steder her.
    expect(res).toEqual({ startet: 2, manglerOriginal: 1 });
    // RETUR 5: ett `updateMany`-kall PR. RAD (betinget på id+updatedAt), ikke ett bulk-kall.
    expect(updateManyKall).toHaveLength(2);
    const idsSatt = updateManyKall.map((k) => k.where.id);
    expect(idsSatt.sort()).toEqual(["t-ok-1", "t-ok-2"]);
    for (const kall of updateManyKall) {
      expect(kall.data).toEqual({ conversionStatus: "pending", conversionError: null });
      expect(kall.where.updatedAt).toBeInstanceOf(Date);
    }

    // RETUR 6: mutasjonen markerer BARE — den starter aldri konverteringen selv.
    expect(h.konverterDwg).not.toHaveBeenCalled();
  });

  it("strandet pågår (eldre enn grensen) regnes IKKE som pågår → startes på nytt", async () => {
    const tegninger = [lagTegning("t-strandet", { conversionStatus: "converting", alderMin: 11 })];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    expect(res).toEqual({ startet: 1, manglerOriginal: 0 });
    expect(updateManyKall).toHaveLength(1);
  });

  it("RETUR 5 — kappløp: en rad som fullføres (annen kjøring) mellom lesing og merking skrives ALDRI tilbake til pending, og får ingen ny jobb", async () => {
    const tegninger = [
      lagTegning("t-vinner"),
      // Simulerer: en raskere konkurrerende kjøring (et annet «oppdater alle»-kall,
      // eller «prøv igjen») har ALLEREDE tatt/fullført denne raden mellom vår
      // `findMany`-lesing og vårt `updateMany` — raden har en annen `updatedAt` i DB nå
      // enn snapshotet vi leste, så vårt betingede skriv treffer 0 rader.
      lagTegning("t-tapte-kapplopet"),
    ];
    const { ctx, updateManyKall } = lagCtx(tegninger, ["t-tapte-kapplopet"]);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    // Kun raden som faktisk ble tatt opp telles som startet — IKKE begge startbare.
    // Uten vakta (bulk `updateMany` på id-liste, ingen `updatedAt`-sjekk) ville dette
    // vært `{ startet: 2, ... }` og en ny, konkurrerende jobb startet for
    // "t-tapte-kapplopet" — nøyaktig kappløpet RETUR 5 målte (konvertering fullført i
    // loggen, status likevel stående på pending etterpå).
    expect(res).toEqual({ startet: 1, manglerOriginal: 0 });
    expect(updateManyKall.map((k) => k.where.id).sort()).toEqual(["t-tapte-kapplopet", "t-vinner"]);
    // Begge forsøkes merket (betinget) — men kun t-vinners betingede skriv traff (count 1).
    // At bare ÉN rad telles i `startet` ovenfor beviser at taperen aldri fikk en ny jobb i
    // køen (selve kø-kjøringen er dekket av `konverterDwg`-sjekken i testen over — delt
    // semafor-singleton i denne fila er allerede varig oppbrukt fra den testen, derfor
    // asserteres ikke `h.konverterDwg` her).
  });

  it("ingen startbare → ingen DB-skriving, startet=0", async () => {
    const tegninger = [lagTegning("t-pagar", { conversionStatus: "pending", alderMin: 1 })];
    const { ctx, updateManyKall } = lagCtx(tegninger);

    const res = await tegningRouter.createCaller(ctx).oppdaterAlleTegninger({ projectId: PROSJEKT });

    expect(res).toEqual({ startet: 0, manglerOriginal: 0 });
    expect(updateManyKall).toHaveLength(0);
  });
});
