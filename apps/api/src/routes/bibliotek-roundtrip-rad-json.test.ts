import { describe, it, expect, vi } from "vitest";

/**
 * Round-trip FØR/ETTER (ordre bibliotekmal-objekttabell, Krav 3): lån av samme sentralmal
 * fra den GAMLE malInnhold-veien (generering) og fra den NYE rad-veien (verbatim kopi av
 * materialiserte rader) skal gi samme firmamal — felt for felt.
 *
 * Med Design B (fabels avviksgodkjenning 2026-09-14) er «samme» presisert:
 *  - FELTRADER: byte-identiske på type/label/sortOrder/config.
 *  - HEADING-RADER: samme type/label/sortOrder, men config går fra { zone: "datafelter" }
 *    (gammel generering) til {} (rad-veien, Krav 2-B). Det er den ENESTE tilsiktede
 *    forskjellen, og testen låser den eksplisitt — driver den videre er en regresjon.
 *
 * Beviset er ikke-sirkulært: `byggFirmamalObjekterFraBibliotek` (firmamal.ts, gammel
 * generering) og `byggBibliotekRader` (@sitedoc/shared, ny) er UAVHENGIGE implementasjoner
 * av samme gruppering. `kopierObjektTre` kjøres på radene for å bevise at kopien er verbatim.
 */

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn(),
  verifiserAdmin: vi.fn(),
  erFirmaAdminForProsjekt: vi.fn(),
  autoriserMalTilgang: vi.fn(),
}));
vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { byggBibliotekRader } from "@sitedoc/shared";
import { kopierObjektTre, type KildeObjekt } from "./objektkopi";
import { byggFirmamalObjekterFraBibliotek } from "./firmamal";

type Opprettet = { type: string; label: string; sortOrder: number; config: unknown };

const MAL_INNHOLD = [
  { label: "Type materiale", type: "list_single", zone: "datafelter", fase: "FØR", config: { options: ["A", "B"] }, sortOrder: 0 },
  { label: "Dybde", type: "decimal", zone: "datafelter", fase: "FØR", config: { unit: "mm" }, sortOrder: 1 },
  { label: "Fritt notat", type: "text_field", zone: "topptekst", fase: "UNDER", config: { multiline: true }, sortOrder: 2 },
  { label: "Resultat", type: "traffic_light", zone: "datafelter", fase: "ETTER", config: {}, sortOrder: 3 },
];

/** Kjør den gamle JSON-genereringen og samle det som ville blitt opprettet. */
async function viaJsonVeien(): Promise<Opprettet[]> {
  const samlet: Opprettet[] = [];
  await byggFirmamalObjekterFraBibliotek(async (data) => {
    samlet.push(data as Opprettet);
    return { id: `j${samlet.length}` };
  }, MAL_INNHOLD);
  return samlet;
}

/** Materialisér rader (= migreringen), og KOPIER dem verbatim (= rad-lånevegen). */
async function viaRadVeien(): Promise<Opprettet[]> {
  const rader: KildeObjekt[] = byggBibliotekRader(MAL_INNHOLD).map((r, i) => ({
    id: `kilde-${i}`,
    parentId: r.parentId,
    type: r.type,
    label: r.label,
    config: r.config as KildeObjekt["config"],
    translations: r.translations as KildeObjekt["translations"],
    sortOrder: r.sortOrder,
    required: r.required,
  }));
  const samlet: Opprettet[] = [];
  await kopierObjektTre(
    rader,
    async (data) => {
      samlet.push({ type: data.type, label: data.label, sortOrder: data.sortOrder, config: data.config });
      return { id: `r${samlet.length}` };
    },
    async () => undefined,
  );
  return samlet;
}

describe("round-trip: rad-veien vs JSON-veien", () => {
  it("gir samme antall objekter i samme rekkefølge (type + label + sortOrder)", async () => {
    const json = await viaJsonVeien();
    const rad = await viaRadVeien();
    expect(rad.length).toBe(json.length);
    expect(rad.map((o) => `${o.type}:${o.label}:${o.sortOrder}`)).toEqual(
      json.map((o) => `${o.type}:${o.label}:${o.sortOrder}`),
    );
  });

  it("FELTRADER er byte-identiske på config", async () => {
    const json = await viaJsonVeien();
    const rad = await viaRadVeien();
    for (let i = 0; i < json.length; i++) {
      if (json[i]!.type === "heading") continue;
      expect(rad[i]!.config).toEqual(json[i]!.config);
    }
  });

  it("HEADING-RADER: config går fra { zone: 'datafelter' } til {} (eneste tilsiktede forskjell)", async () => {
    const json = await viaJsonVeien();
    const rad = await viaRadVeien();
    const headingIdx = json.map((o, i) => (o.type === "heading" ? i : -1)).filter((i) => i >= 0);
    expect(headingIdx.length).toBe(3); // FØR, UNDER, ETTER
    for (const i of headingIdx) {
      expect(json[i]!.config).toEqual({ zone: "datafelter" });
      expect(rad[i]!.config).toEqual({});
    }
  });
});
