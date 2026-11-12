import { describe, it, expect, vi } from "vitest";

/**
 * R17 (RETUR radform 2026-11-12): `gyldigVareRad` kobler en vare til en timerad
 * bare når raden finnes på SAMME dagsseddel og SAMME prosjekt. Ellers lagres
 * null — aldri en kobling på tvers av sedler eller prosjekter.
 */

vi.mock("@sitedoc/db", () => ({ prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn(),
  aktivtProsjektmedlemWhere: vi.fn(),
  aktivtMedlemWhere: { periodeSlutt: null },
  verifiserOrganisasjonTilgang: vi.fn(),
  erFirmaAdmin: vi.fn(),
  verifiserProsjekterTilhørerFirma: vi.fn(),
}));
vi.mock("../services/varelager/moduleGate", () => ({
  krevVarelagerAktivert: vi.fn(),
  erVarelagerAktivert: vi.fn(),
  VarelagerModulIkkeAktivertError: class extends Error {},
}));

import { gyldigVareRad } from "./vareforbruk";

const RAD = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SEDEL = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ANNEN_SEDEL = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PROSJEKT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ANNET_PROSJEKT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function timerDb(rader: Record<string, { sheetId: string; projectId: string }>) {
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) => rader[where.id] ?? null);
  return { sheetTimer: { findUnique } } as unknown as Parameters<typeof gyldigVareRad>[0];
}

describe("R17: gyldigVareRad", () => {
  const db = timerDb({ [RAD]: { sheetId: SEDEL, projectId: PROSJEKT } });

  it("negativkontroll: rad på samme sedel og prosjekt → kobles", async () => {
    expect(await gyldigVareRad(db, RAD, SEDEL, PROSJEKT)).toBe(RAD);
  });

  it("rad på annen sedel → null", async () => {
    expect(await gyldigVareRad(db, RAD, ANNEN_SEDEL, PROSJEKT)).toBeNull();
  });

  it("rad på annet prosjekt → null", async () => {
    expect(await gyldigVareRad(db, RAD, SEDEL, ANNET_PROSJEKT)).toBeNull();
  });

  it("ukjent rad, manglende rad-id eller manglende sedel → null", async () => {
    expect(await gyldigVareRad(db, "ffffffff-ffff-ffff-ffff-ffffffffffff", SEDEL, PROSJEKT)).toBeNull();
    expect(await gyldigVareRad(db, null, SEDEL, PROSJEKT)).toBeNull();
    expect(await gyldigVareRad(db, RAD, null, PROSJEKT)).toBeNull();
  });
});
