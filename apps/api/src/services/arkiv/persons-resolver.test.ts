import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@sitedoc/db";
import type { RapportObjekt, FeltVerdi } from "@sitedoc/pdf";
import { resolverPersonnavn } from "./persons-resolver";

const obj = (id: string, type: string): RapportObjekt => ({
  id,
  type,
  label: id,
  required: false,
  config: {},
  sortOrder: 0,
  parentId: null,
});

const U1 = "74730685-c6dd-451b-aec6-ea401ec566a2";
const U2 = "11111111-2222-3333-4444-555555555555";

function fakePrisma(users: { id: string; name: string | null }[]): PrismaClient {
  return {
    user: { findMany: vi.fn().mockResolvedValue(users) },
  } as unknown as PrismaClient;
}

describe("resolverPersonnavn", () => {
  it("bytter UUID-er mot navn i persons-felt (ingen rå nøkkel når ut)", async () => {
    const data: Record<string, FeltVerdi> = { p: { verdi: [U1, U2], kommentar: "", vedlegg: [] } };
    const ut = await resolverPersonnavn(fakePrisma([{ id: U1, name: "Kari Hansen" }, { id: U2, name: "Ola Nordmann" }]), data, [obj("p", "persons")]);
    expect(ut.p!.verdi).toEqual(["Kari Hansen", "Ola Nordmann"]);
    expect(JSON.stringify(ut)).not.toContain(U1);
  });

  it("uoppløst UUID (slettet bruker) → «Ukjent bruker», ALDRI rå UUID", async () => {
    const data: Record<string, FeltVerdi> = { p: { verdi: [U1], kommentar: "", vedlegg: [] } };
    const ut = await resolverPersonnavn(fakePrisma([]), data, [obj("p", "persons")]);
    expect(ut.p!.verdi).toEqual(["Ukjent bruker"]);
    expect(JSON.stringify(ut)).not.toContain(U1);
  });

  it("ikke-UUID-verdier (allerede navn) beholdes", async () => {
    const data: Record<string, FeltVerdi> = { p: { verdi: ["Per Ekstern", U1], kommentar: "", vedlegg: [] } };
    const ut = await resolverPersonnavn(fakePrisma([{ id: U1, name: "Kari" }]), data, [obj("p", "persons")]);
    expect(ut.p!.verdi).toEqual(["Per Ekstern", "Kari"]);
  });

  it("ingen persons-felt → data uendret, ingen DB-kall", async () => {
    const prisma = fakePrisma([]);
    const data: Record<string, FeltVerdi> = { t: { verdi: "tekst", kommentar: "", vedlegg: [] } };
    const ut = await resolverPersonnavn(prisma, data, [obj("t", "text_field")]);
    expect(ut).toBe(data);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
