import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  opprettMalHvisMangler,
  type BibliotekMalSeed,
  type FeltDef,
  KA7_MAL,
  KB2_MAL,
  KB4_MAL,
} from "./seed-bibliotek";

/**
 * Vakt mot at seeden igjen begynner å OVERSKRIVE en eksisterende bibliotekmal
 * (CLAUDE.md «Stille tomhet er forbudt», krav (c)). Testen bekrefter IKKE at seeden
 * kjørte — den FEILER hvis create-only-regelen fjernes:
 *  - finnes malen fra før → ingen create, ingen update, status «finnes».
 * Reintroduseres upsert (update på eksisterende rad), slår `update`-forventningen til.
 *
 * Vei C del 1: seeden skriver nå BibliotekMalObjekt-RADER (inkl. heading-rad pr. fase) og
 * TOM `malInnhold`. Testen låser begge: rader skrives, malInnhold er tom.
 */

const malSeed: BibliotekMalSeed = {
  navn: "KA7 – Forberedende arbeider ved gjenbruk av materialer",
  referanse: "KA7",
  beskrivelse: "Rengjøring og sortering av gjenbruksmaterialer.",
  prioritet: 1,
  verifisert: false,
  malInnhold: [{ label: "Type materiale", type: "list_single", fase: "FØR", sortOrder: 1 }],
};

function lagFakeDb(finnesFraFor: boolean) {
  const findFirst = vi.fn().mockResolvedValue(finnesFraFor ? { id: "eksisterende-id" } : null);
  const create = vi.fn().mockResolvedValue({ id: "ny-id" });
  // `update` finnes på ekte PrismaClient — tas med her nettopp for å kunne bevise at
  // den ALDRI kalles på en eksisterende rad. Kaller en fremtidig regresjon update, feiler testen.
  const update = vi.fn().mockResolvedValue({ id: "eksisterende-id" });
  const objektCreate = vi.fn().mockResolvedValue({ id: "obj-id" });
  const db = {
    bibliotekMal: { findFirst, create, update },
    bibliotekMalObjekt: { create: objektCreate },
  } as unknown as Pick<PrismaClient, "bibliotekMal" | "bibliotekMalObjekt">;
  return { db, findFirst, create, update, objektCreate };
}

describe("opprettMalHvisMangler — kun opprett, aldri oppdater", () => {
  it("rører ALDRI en mal som finnes fra før (ingen create, ingen update, ingen rader)", async () => {
    const { db, findFirst, create, update, objektCreate } = lagFakeDb(true);

    const status = await opprettMalHvisMangler(db, "kap-id", malSeed);

    expect(status).toBe("finnes");
    expect(findFirst).toHaveBeenCalledWith({
      where: { kapittelId: "kap-id", referanse: "KA7" },
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(objektCreate).not.toHaveBeenCalled();
  });

  it("oppretter malen med TOM malInnhold og skriver rader (heading + felt)", async () => {
    const { db, create, update, objektCreate } = lagFakeDb(false);

    const status = await opprettMalHvisMangler(db, "kap-id", malSeed);

    expect(status).toBe("opprettet");
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();

    const malArg = create.mock.calls[0]![0] as {
      data: { referanse: string; kapittelId: string; malInnhold: unknown };
    };
    expect(malArg.data.referanse).toBe("KA7");
    expect(malArg.data.kapittelId).toBe("kap-id");
    // Frossen kolonne — innholdet bor i radene, ikke her (Krav 4).
    expect(malArg.data.malInnhold).toEqual([]);

    // 1 felt med fase FØR → 1 heading-rad + 1 feltrad.
    expect(objektCreate).toHaveBeenCalledTimes(2);
    const typer = objektCreate.mock.calls.map(
      (c) => (c[0] as { data: { type: string } }).data.type,
    );
    expect(typer).toEqual(["heading", "list_single"]);
    // Heading-raden har tom config.
    const headingData = objektCreate.mock.calls[0]![0] as { data: { config: unknown } };
    expect(headingData.data.config).toEqual({});
  });
});

/**
 * MK C fase 2 — de tre gatede trafikklys→list_single-konverteringene (design-gatet 2026-09-26).
 * Krav (c) «stille tomhet forbudt»: testen FEILER hvis en av de tre feltene fortsatt er
 * `traffic_light`, mangler opsjoner, eller har feil opsjoner. Rød FØR konverteringen, grønn etter.
 *
 * Scope er nøyaktig disse tre — bevisst avgrenset (fersk fase-1-måling 2026-09-25). Ute av scope:
 * FD3/FB4 (venter §7b-revisjon), KB2 «Fall minst 2 %» + KD1 «Fall mot avrenning» (§1-migrering).
 * Huskonvensjonen (kommentar-krav ved gul/rød) er skilt ut til egen design-ordre — ikke testet her.
 */
describe("MK C fase 2 — tre trafikklys konvertert til list_single", () => {
  const KONVERTERINGER: { mal: { referanse: string; felter: FeltDef[] }; label: string; opsjoner: string[] }[] = [
    {
      mal: KA7_MAL,
      label: "Dokumentasjon på opprinnelse",
      opsjoner: ["Foreligger – komplett", "Delvis – suppleres", "Mangler"],
    },
    {
      mal: KB2_MAL,
      label: "Varedeklarasjon kontrollert",
      opsjoner: ["Foreligger – pH og renhet OK", "Avvik – dokumentert", "Mangler"],
    },
    {
      mal: KB4_MAL,
      label: "Klippet jevnlig frem til overtakelse",
      opsjoner: ["Utført", "Ikke relevant (grasbakke/eng)", "Ikke utført"],
    },
  ];

  for (const { mal, label, opsjoner } of KONVERTERINGER) {
    it(`${mal.referanse} «${label}» er list_single med de gatede opsjonene`, () => {
      const felt = mal.felter.find((f) => f.label === label);
      expect(felt, `fant ikke feltet «${label}» i ${mal.referanse}`).toBeDefined();
      expect(felt!.type).toBe("list_single");
      expect(felt!.config?.options).toEqual(opsjoner);
    });
  }
});
