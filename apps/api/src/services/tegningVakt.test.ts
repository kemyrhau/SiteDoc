import { describe, it, expect, vi } from "vitest";
import { verifiserByggeplassIProsjekt, verifiserOmradeIProsjekt, verifiserTegningIProsjekt } from "./tegningVakt";

/**
 * verifiserTegningIProsjekt (ORDRE 20) — sjekker tegningens EGEN `projectId`, ikke byggeplassens.
 * Løse tegninger (uten byggeplass) i eget prosjekt er lovlige; fremmed prosjekt og ukjent
 * tegning avvises.
 */

const PROSJEKT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff";

function lagDb(drawing: { projectId: string } | null) {
  const findUnique = vi.fn().mockResolvedValue(drawing);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: { drawing: { findUnique } } as any, findUnique };
}

describe("verifiserTegningIProsjekt", () => {
  it("tegning i samme prosjekt (løs eller med byggeplass) → OK, slår opp drawing.projectId", async () => {
    const { db, findUnique } = lagDb({ projectId: PROSJEKT });
    await expect(verifiserTegningIProsjekt(db, "t1", PROSJEKT)).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "t1" }, select: { projectId: true } });
  });

  it("tegning i fremmed prosjekt → BAD_REQUEST", async () => {
    const { db } = lagDb({ projectId: FREMMED });
    await expect(verifiserTegningIProsjekt(db, "t1", PROSJEKT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tegningen hører til et annet prosjekt.",
    });
  });

  it("ukjent tegning → BAD_REQUEST", async () => {
    const { db } = lagDb(null);
    await expect(verifiserTegningIProsjekt(db, "t1", PROSJEKT)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("verifiserByggeplassIProsjekt (ORDRE 21)", () => {
  function lagByggeplassDb(byggeplass: { projectId: string } | null) {
    const findUnique = vi.fn().mockResolvedValue(byggeplass);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { db: { byggeplass: { findUnique } } as any, findUnique };
  }

  it("byggeplass i samme prosjekt → OK, slår opp byggeplass.projectId", async () => {
    const { db, findUnique } = lagByggeplassDb({ projectId: PROSJEKT });
    await expect(verifiserByggeplassIProsjekt(db, "b1", PROSJEKT)).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "b1" }, select: { projectId: true } });
  });

  it("byggeplass i fremmed prosjekt → BAD_REQUEST", async () => {
    const { db } = lagByggeplassDb({ projectId: FREMMED });
    await expect(verifiserByggeplassIProsjekt(db, "b1", PROSJEKT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Byggeplassen hører til et annet prosjekt.",
    });
  });

  it("ukjent byggeplass → BAD_REQUEST", async () => {
    const { db } = lagByggeplassDb(null);
    await expect(verifiserByggeplassIProsjekt(db, "b1", PROSJEKT)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("verifiserOmradeIProsjekt (ORDRE 29 #13)", () => {
  function lagOmradeDb(omrade: { projectId: string; byggeplassId: string } | null) {
    const findUnique = vi.fn().mockResolvedValue(omrade);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { db: { omrade: { findUnique } } as any, findUnique };
  }

  it("område i samme prosjekt → OK, slår opp omrade.projectId + byggeplassId", async () => {
    const { db, findUnique } = lagOmradeDb({ projectId: PROSJEKT, byggeplassId: "b1" });
    await expect(verifiserOmradeIProsjekt(db, "o1", PROSJEKT)).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "o1" },
      select: { projectId: true, byggeplassId: true },
    });
  });

  it("område i fremmed prosjekt → BAD_REQUEST", async () => {
    const { db } = lagOmradeDb({ projectId: FREMMED, byggeplassId: "b1" });
    await expect(verifiserOmradeIProsjekt(db, "o1", PROSJEKT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Området hører til et annet prosjekt.",
    });
  });

  it("ukjent område → BAD_REQUEST", async () => {
    const { db } = lagOmradeDb(null);
    await expect(verifiserOmradeIProsjekt(db, "o1", PROSJEKT)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("med byggeplass: område på annen byggeplass → BAD_REQUEST, samme byggeplass → OK", async () => {
    const { db } = lagOmradeDb({ projectId: PROSJEKT, byggeplassId: "b2" });
    await expect(verifiserOmradeIProsjekt(db, "o1", PROSJEKT, "b1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Området hører til en annen byggeplass.",
    });
    await expect(verifiserOmradeIProsjekt(db, "o1", PROSJEKT, "b2")).resolves.toBeUndefined();
  });
});
