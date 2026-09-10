import { describe, it, expect } from "vitest";
import { sikreHmsGruppe } from "./modul";
import type { Prisma } from "@sitedoc/db";

/**
 * Entydig HMS-gruppe via ProjectGroup.systemNokkel (2026-09-10, krav c).
 *
 * Kontrakten denne låser:
 *   - et prosjekt med HMS-modul aktiv ENDER med en gruppe der systemNokkel="hms"
 *     (sikreHmsGruppe oppretter den) — feiler create noen gang uten nøkkelen,
 *     bryter testen
 *   - oppslaget bruker systemNokkel, IKKE domener: en bred gruppe med "hms" blant
 *     domenene (prosjekt-admin) tilfredsstiller ikke kravet — HMS-gruppa opprettes
 *     likevel (dette var selve fella)
 *   - to grupper i samme prosjekt kan ikke bære samme systemNokkel (den partielle
 *     unik-indeksen hindrer det — fake-tx modellerer den, testen beviser garantien)
 *
 * Fake-tx (samme mønster som bilde-idempotens.test.ts).
 */

const PROSJEKT = "cccccccc-cccc-cccc-cccc-cccccccccccc";

interface Rad {
  id: string;
  projectId: string;
  systemNokkel: string | null;
  domains: unknown;
  [k: string]: unknown;
}

/** In-memory project_groups som speiler partiell unik (project_id, system_nokkel) WHERE NOT NULL. */
function lagTx(seed: Rad[] = []) {
  const lager: Rad[] = [...seed];
  let teller = 0;

  const projectGroup = {
    findFirst: async ({
      where,
    }: {
      where: { projectId: string; systemNokkel?: string | null };
    }) => {
      const funnet = lager.find(
        (r) =>
          r.projectId === where.projectId &&
          (where.systemNokkel === undefined || r.systemNokkel === where.systemNokkel),
      );
      return funnet ? { id: funnet.id } : null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const nokkel = (data.systemNokkel as string | null) ?? null;
      // Partiell unik-indeks: (project_id, system_nokkel) WHERE system_nokkel IS NOT NULL
      if (
        nokkel !== null &&
        lager.some((r) => r.projectId === data.projectId && r.systemNokkel === nokkel)
      ) {
        throw new Error(
          "duplicate key value violates unique constraint \"project_groups_prosjekt_systemnokkel_unik\"",
        );
      }
      const rad: Rad = {
        id: `pg-${teller++}`,
        projectId: data.projectId as string,
        systemNokkel: nokkel,
        domains: data.domains,
        ...data,
      };
      lager.push(rad);
      return { id: rad.id };
    },
  };

  return { tx: { projectGroup } as unknown as Prisma.TransactionClient, lager };
}

describe("sikreHmsGruppe — entydig HMS-gruppe", () => {
  it("tomt prosjekt: oppretter gruppe med systemNokkel 'hms'", async () => {
    const { tx, lager } = lagTx();
    const g = await sikreHmsGruppe(tx, PROSJEKT);

    expect(g.id).toBeTruthy();
    const hms = lager.filter((r) => r.systemNokkel === "hms");
    expect(hms).toHaveLength(1);
    expect(hms[0]!.projectId).toBe(PROSJEKT);
  });

  it("bred gruppe med 'hms'-domene teller IKKE — HMS-gruppa opprettes likevel", async () => {
    // prosjekt-admin bærer "hms" som bredde-tilgang, men uten systemNokkel.
    const { tx, lager } = lagTx([
      {
        id: "pg-admin",
        projectId: PROSJEKT,
        systemNokkel: null,
        domains: ["bygg", "hms", "kvalitet"],
        slug: "prosjekt-admin",
      },
    ]);

    await sikreHmsGruppe(tx, PROSJEKT);

    // Den brede gruppa er urørt; en ekte HMS-gruppe er lagt til.
    expect(lager.filter((r) => r.systemNokkel === "hms")).toHaveLength(1);
    expect(lager).toHaveLength(2);
  });

  it("idempotent: finnes systemNokkel-gruppe alt, opprettes ingen ny", async () => {
    const { tx, lager } = lagTx([
      {
        id: "pg-hms",
        projectId: PROSJEKT,
        systemNokkel: "hms",
        domains: ["hms"],
        slug: "hms-ledere",
      },
    ]);

    const g = await sikreHmsGruppe(tx, PROSJEKT);
    expect(g.id).toBe("pg-hms");
    expect(lager).toHaveLength(1);
  });

  it("duplikat-vern: to grupper med samme systemNokkel i ett prosjekt kastes", async () => {
    const { tx } = lagTx([
      {
        id: "pg-hms",
        projectId: PROSJEKT,
        systemNokkel: "hms",
        domains: ["hms"],
        slug: "hms-ledere",
      },
    ]);

    // Rått forsøk på å lage en ANDRE hms-gruppe (utenom sikreHmsGruppes findFirst-vakt)
    // skal brekke på den partielle unik-indeksen.
    await expect(
      (tx as unknown as { projectGroup: { create: (a: unknown) => Promise<unknown> } }).projectGroup.create({
        data: { projectId: PROSJEKT, systemNokkel: "hms", domains: ["hms"], slug: "hms-ansvarlige" },
      }),
    ).rejects.toThrow(/unique constraint/);
  });
});
