import { describe, it, expect, vi } from "vitest";
import { koblePunktTilSjekkliste } from "./kontrollplanKobling";

/**
 * ORDRE 29 #4 — «Start» fra et kontrollpunkt arver punktets tegning OG område. Før gikk området
 * tapt, og et punkt med område uten tegning ga en sjekkliste uten lokasjon.
 */

const SJEKKLISTE = "sjekkliste-1";

function lagTx(punkt: {
  drawingId?: string | null;
  drawing?: { byggeplassId: string | null } | null;
  omradeId?: string | null;
  omrade?: { byggeplassId: string } | null;
}) {
  const checklistUpdate = vi.fn().mockResolvedValue({});
  const tx = {
    kontrollplanPunkt: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "punkt-1",
        sjekklisteMalId: "mal-1",
        sjekklisteId: null,
        status: "planlagt",
        drawingId: null,
        drawing: null,
        omradeId: null,
        omrade: null,
        kontrollplan: { projectId: "p1" },
        ...punkt,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    checklist: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: SJEKKLISTE,
        templateId: "mal-1",
        kontrollplanPunkt: null,
        template: { projectId: "p1" },
      }),
      update: checklistUpdate,
    },
    kontrollplanHistorikk: { create: vi.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { tx, checklistUpdate };
}

const start = (tx: unknown) =>
  koblePunktTilSjekkliste(tx as never, { punktId: "punkt-1", sjekklisteId: SJEKKLISTE, brukerId: "u1", kilde: "startet" });

describe("ORDRE 29 #4: koblePunktTilSjekkliste arver område", () => {
  it("🔴 punkt med område uten tegning → sjekklista får området, omfang «omrade» og områdets byggeplass", async () => {
    const { tx, checklistUpdate } = lagTx({ omradeId: "omr-1", omrade: { byggeplassId: "bp-2" } });
    await start(tx);
    expect(checklistUpdate).toHaveBeenCalledWith({
      where: { id: SJEKKLISTE },
      data: { omradeId: "omr-1", lokasjonOmfang: "omrade", byggeplassId: "bp-2" },
    });
  });

  it("🔴 punkt med tegning og område → tegning + område, tegningens byggeplass vinner, omfang urørt", async () => {
    const { tx, checklistUpdate } = lagTx({
      drawingId: "d-1",
      drawing: { byggeplassId: "bp-1" },
      omradeId: "omr-1",
      omrade: { byggeplassId: "bp-2" },
    });
    await start(tx);
    expect(checklistUpdate).toHaveBeenCalledWith({
      where: { id: SJEKKLISTE },
      data: { drawingId: "d-1", omradeId: "omr-1", byggeplassId: "bp-1" },
    });
  });

  it("punkt med bare tegning → som før (tegning + tegningens byggeplass)", async () => {
    const { tx, checklistUpdate } = lagTx({ drawingId: "d-1", drawing: { byggeplassId: "bp-1" } });
    await start(tx);
    expect(checklistUpdate).toHaveBeenCalledWith({
      where: { id: SJEKKLISTE },
      data: { drawingId: "d-1", byggeplassId: "bp-1" },
    });
  });

  it("punkt uten tegning og område → sjekklista røres ikke", async () => {
    const { tx, checklistUpdate } = lagTx({});
    await start(tx);
    expect(checklistUpdate).not.toHaveBeenCalled();
  });

  it("«koblet» rører aldri en eksisterende sjekklistes lokasjon", async () => {
    const { tx, checklistUpdate } = lagTx({ omradeId: "omr-1", omrade: { byggeplassId: "bp-2" } });
    await koblePunktTilSjekkliste(tx, { punktId: "punkt-1", sjekklisteId: SJEKKLISTE, brukerId: "u1", kilde: "koblet" });
    expect(checklistUpdate).not.toHaveBeenCalled();
  });
});
