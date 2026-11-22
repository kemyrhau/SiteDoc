import { describe, it, expect, vi } from "vitest";

/**
 * RETUR O12 vilkår 1 (gate trinn 2): en reise ført som arbeidstid (`erReise: false`,
 * `arbeidReiseRetning` satt) står i kortet også med et annet underprosjekt (vedtak-timer-web
 * § Reisevinduet pkt 3/16). Den er ingen jobbrad — kortets nøkkel og «jobbens første
 * arbeidsrad» avgjøres uten den (`JOBBRAD`).
 *
 * Kort-id-tjenesten er globalt mocket i enhetstestene (`test-harness/kortIdEnhetsmock.ts`);
 * her brukes den ekte (`vi.importActual`). Rå SQL (`kortIdPaaAnnenSedel`) mockes til «ingen
 * annen sedel». Den falske `sheetTimer` filtrerer på `where` og sorterer på `orderBy` — ellers
 * ville et filter i spørringen ikke målt noe.
 */

vi.mock("@sitedoc/db", () => ({
  prisma: { byggeplass: { findUnique: vi.fn(async () => null), findFirst: vi.fn(), findMany: vi.fn(async () => []) } },
}));
vi.mock("@sitedoc/db-maskin", () => ({ prismaMaskin: {} }));
vi.mock("@sitedoc/db-varelager", () => ({ prismaVarelager: {} }));

import { jobbStedForMaskin } from "./dagsseddel";

type KortIdModul = typeof import("../../services/timer/kortId");
const ekte = () => vi.importActual<KortIdModul>("../../services/timer/kortId");

const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const KORT = "kort-a";
const ECO_A = "eco-a";
const ECO_B = "eco-b";

type Rad = {
  id: string;
  sheetId: string;
  kortId: string | null;
  projectId: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  erReise: boolean;
  arbeidReiseRetning: string | null;
  fraTid: string | null;
  createdAt: Date;
};

const rad = (r: Partial<Rad> & Pick<Rad, "id">): Rad => ({
  sheetId: SHEET,
  kortId: KORT,
  projectId: PROSJEKT,
  byggeplassId: null,
  externalCostObjectId: ECO_A,
  erReise: false,
  arbeidReiseRetning: null,
  fraTid: "07:00",
  createdAt: new Date("2026-11-22T07:00:00Z"),
  ...r,
});

/** Jobbrad (underprosjekt A) kl. 07–15. */
const JOBB = rad({ id: "jobb", fraTid: "07:00" });
/** «Til byggeplass» ført som arbeidstid kl. 06:30, underprosjekt B — står først i kortet. */
const ARBEIDSREISE = rad({ id: "reise", fraTid: "06:30", externalCostObjectId: ECO_B, arbeidReiseRetning: "til" });

function matcher(r: Rad, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const verdi = (r as unknown as Record<string, unknown>)[k];
    if (v && typeof v === "object" && "not" in (v as object)) return verdi !== (v as { not: unknown }).not;
    return verdi === v;
  });
}

function lagTx(rader: Rad[]) {
  const finn = (a: { where: Record<string, unknown>; orderBy?: Record<string, "asc">[] }) => {
    const treff = rader.filter((r) => matcher(r, a.where));
    for (const o of [...(a.orderBy ?? [])].reverse()) {
      const k = Object.keys(o)[0] as keyof Rad;
      treff.sort((x, y) => String(x[k]).localeCompare(String(y[k])));
    }
    return treff;
  };
  return {
    sheetTimer: {
      findMany: vi.fn(async (a: { where: Record<string, unknown>; orderBy?: Record<string, "asc">[] }) => finn(a)),
      findFirst: vi.fn(async (a: { where: Record<string, unknown>; orderBy?: Record<string, "asc">[] }) => finn(a)[0] ?? null),
      findUnique: vi.fn(async () => null),
    },
    sheetTillegg: { findMany: vi.fn(async () => []) },
    sheetUtlegg: { findMany: vi.fn(async () => []) },
    dailySheet: {
      findUniqueOrThrow: vi.fn(async () => ({ id: SHEET, userId: "u", dato: new Date("2026-11-22T00:00:00Z"), byggeplassId: null })),
    },
    // `kortIdPaaAnnenSedel`: kortet står ikke på en annen sedel.
    $queryRawUnsafe: vi.fn(async () => []),
  };
}

const KONTEKST = { sheetId: SHEET, userId: "u", dato: "2026-11-22", byggeplass: null };
const NY_A = { projectId: PROSJEKT, byggeplassId: null, externalCostObjectId: ECO_A };

describe("validerOppgittKortId (tillegg, utlegg, maskin tilfoy) — arbeidstid-reise avgjør ikke kortet", () => {
  it("nytt tillegg med jobbens underprosjekt godtas når kortet har en arbeidstid-reise med annet underprosjekt", async () => {
    const { validerOppgittKortId } = await ekte();
    const tx = lagTx([JOBB, ARBEIDSREISE]);
    await expect(validerOppgittKortId(tx as never, KONTEKST, KORT, NY_A)).resolves.toBeUndefined();
  });

  it("negativkontroll: en jobbrad med annet underprosjekt sperrer fortsatt", async () => {
    const { validerOppgittKortId } = await ekte();
    const tx = lagTx([JOBB, rad({ id: "jobb-b", externalCostObjectId: ECO_B })]);
    await expect(validerOppgittKortId(tx as never, KONTEKST, KORT, NY_A)).rejects.toThrow("kortUlikeRader");
  });
});

describe("vareKortIdForSkriving — arbeidstid-reise avgjør ikke kortet", () => {
  it("vare med jobbens underprosjekt får kortet selv om reiseraden står først", async () => {
    const { vareKortIdForSkriving } = await ekte();
    const tx = lagTx([ARBEIDSREISE, JOBB]);
    await expect(
      vareKortIdForSkriving(tx as never, { dagsseddelId: SHEET, sheetTimerId: null, oppgittKortId: KORT, ny: NY_A }),
    ).resolves.toBe(KORT);
  });

  it("negativkontroll: vare med reisens underprosjekt avvises (jobben avgjør)", async () => {
    const { vareKortIdForSkriving } = await ekte();
    const tx = lagTx([ARBEIDSREISE, JOBB]);
    await expect(
      vareKortIdForSkriving(tx as never, {
        dagsseddelId: SHEET,
        sheetTimerId: null,
        oppgittKortId: KORT,
        ny: { ...NY_A, externalCostObjectId: ECO_B },
      }),
    ).rejects.toThrow("kortUlikeRader");
  });
});

describe("jobbStedForMaskin — maskinen får jobbens sted, ikke reisens", () => {
  it("første rad etter fraTid er «Til byggeplass»-reisen; maskinen får jobbradens underprosjekt", async () => {
    const tx = lagTx([ARBEIDSREISE, JOBB]);
    await expect(jobbStedForMaskin(tx as never, { sheetId: SHEET, projectId: PROSJEKT, kortId: KORT })).resolves.toEqual({
      byggeplassId: null,
      externalCostObjectId: ECO_A,
    });
  });

  it("maskin koblet til reiseraden får jobbens sted", async () => {
    const tx = lagTx([ARBEIDSREISE, JOBB]);
    await expect(
      jobbStedForMaskin(tx as never, { sheetId: SHEET, projectId: PROSJEKT, kortId: KORT, sheetTimerId: "reise" }),
    ).resolves.toEqual({ byggeplassId: null, externalCostObjectId: ECO_A });
  });
});
