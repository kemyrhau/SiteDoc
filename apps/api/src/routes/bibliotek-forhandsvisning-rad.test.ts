import { describe, it, expect, vi } from "vitest";

/**
 * `bibliotek.hentMalInnhold` (forhåndsvisning «inspiser før lån») mot RAD-veien
 * (ordre bibliotekmal-objekttabell TILLEGG 1, Krav 4/punkt 1). Forhåndsvisningen leste
 * før den frosne malInnhold-JSON-en mens lånet leste radene — fra første radendring i
 * del 2 ville de divergert. Nå leser begge samme rader.
 *
 * Beviset (utvidet round-trip): forhåndsvisningens feltliste = lånets ikke-heading-objekter,
 * samme labels/typer i samme rekkefølge. I tillegg låses fase-rekonstruksjonen (fase lever
 * som heading-rader nå).
 */

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { byggBibliotekRader } from "@sitedoc/shared";
import { kopierObjektTre, type KildeObjekt } from "./objektkopi";
import { bibliotekRouter } from "./bibliotek";

const BIB = "bib-mal-1";
const MAL_INNHOLD = [
  { label: "Type materiale", type: "list_single", zone: "datafelter", fase: "FØR", config: { options: ["A"] }, sortOrder: 0 },
  { label: "Dybde", type: "decimal", zone: "datafelter", fase: "FØR", config: { unit: "mm" }, sortOrder: 1 },
  { label: "Notat", type: "text_field", zone: "datafelter", fase: "UNDER", config: {}, sortOrder: 2 },
  { label: "Resultat", type: "traffic_light", zone: "datafelter", fase: "ETTER", config: {}, sortOrder: 3 },
];

// Radene slik migreringen ville lagt dem (byggBibliotekRader = fasiten), med db-id-er.
const RADER: KildeObjekt[] = byggBibliotekRader(MAL_INNHOLD).map((r, i) => ({
  id: `rad-${i}`,
  parentId: r.parentId,
  type: r.type,
  label: r.label,
  config: r.config as KildeObjekt["config"],
  translations: r.translations as KildeObjekt["translations"],
  sortOrder: r.sortOrder,
  required: r.required,
}));

function lagCaller() {
  const prisma = {
    bibliotekMal: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: BIB, navn: "KB4", referanse: "KB4" }),
    },
    bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue(RADER) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return bibliotekRouter.createCaller({ userId: "user-1", prisma } as any);
}

describe("bibliotek.hentMalInnhold — rad-veien (forhåndsvisning == lån)", () => {
  it("gir samme feltliste (label:type) i samme rekkefølge som lånet, uten heading-rader", async () => {
    const forhandsvisning = await lagCaller().hentMalInnhold({ bibliotekMalId: BIB });

    // Lånets objekt-tre, ikke-heading (kopierObjektTre kopierer radene verbatim).
    const laanObjekter: { type: string; label: string }[] = [];
    await kopierObjektTre(
      RADER,
      async (data) => {
        laanObjekter.push({ type: data.type, label: data.label });
        return { id: `o${laanObjekter.length}` };
      },
      async () => undefined,
    );
    const laanFelter = laanObjekter.filter((o) => o.type !== "heading");

    expect(forhandsvisning.felter.map((f) => `${f.type}:${f.label}`)).toEqual(
      laanFelter.map((o) => `${o.type}:${o.label}`),
    );
  });

  it("rekonstruerer fase fra heading-radene (FØR/UNDER/ETTER)", async () => {
    const { felter } = await lagCaller().hentMalInnhold({ bibliotekMalId: BIB });
    expect(felter).toEqual([
      { label: "Type materiale", type: "list_single", fase: "FØR" },
      { label: "Dybde", type: "decimal", fase: "FØR" },
      { label: "Notat", type: "text_field", fase: "UNDER" },
      { label: "Resultat", type: "traffic_light", fase: "ETTER" },
    ]);
  });

  it("returnerer INGEN heading-rader (negativ kontroll)", async () => {
    const { felter } = await lagCaller().hentMalInnhold({ bibliotekMalId: BIB });
    expect(felter.some((f) => f.type === "heading")).toBe(false);
  });
});
