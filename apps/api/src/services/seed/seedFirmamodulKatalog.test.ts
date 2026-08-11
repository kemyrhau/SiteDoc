import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Kontrakt for den generiske seed-dispatchen (steg 3, 2026-08-11). Deterministisk,
 * mocket prismaTimer + prisma. Beviser:
 *  - timer uten policy + tom katalog → seeder alle datatyper, feil=[] (hoppet ikke logges her)
 *  - én feilende datatype blokkerer IKKE resten (feil samles per datatype)
 *  - maskin + varelager → ingen seed-kall, feil=[] (bevisst hook-løse)
 *
 * egen_katalog-policy-respekten er dekket i guardene selv; her fokuserer vi på
 * dispatch-orkestreringen (feil-isolasjon + no-op-modulene).
 */

const timer = vi.hoisted(() => ({
  lonnsart: { count: vi.fn(), createMany: vi.fn() },
  aktivitet: { count: vi.fn(), createMany: vi.fn() },
  tillegg: { count: vi.fn(), createMany: vi.fn() },
  expenseCategory: { count: vi.fn(), createMany: vi.fn() },
}));
const kjerne = vi.hoisted(() => ({
  organizationSeedPolicy: { findUnique: vi.fn() },
  project: { count: vi.fn(), create: vi.fn() },
}));

vi.mock("@sitedoc/db-timer", () => ({ prismaTimer: timer }));
vi.mock("@sitedoc/db", () => ({ prisma: kjerne }));
vi.mock("@sitedoc/shared", () => ({ generateProjectNumber: () => "SD-TEST-0001" }));

import { seedFirmamodulKatalog } from "./index";

describe("seedFirmamodulKatalog — generisk dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ingen egen_katalog-policy → guardene slipper gjennom til telling.
    kjerne.organizationSeedPolicy.findUnique.mockResolvedValue(null);
    // Tom katalog overalt → seed kjører.
    timer.lonnsart.count.mockResolvedValue(0);
    timer.aktivitet.count.mockResolvedValue(0);
    timer.tillegg.count.mockResolvedValue(0);
    timer.expenseCategory.count.mockResolvedValue(0);
    timer.lonnsart.createMany.mockResolvedValue({ count: 16 });
    timer.aktivitet.createMany.mockResolvedValue({ count: 3 });
    timer.tillegg.createMany.mockResolvedValue({ count: 3 });
    timer.expenseCategory.createMany.mockResolvedValue({ count: 5 });
    kjerne.project.count.mockResolvedValue(0);
    kjerne.project.create.mockResolvedValue({});
  });

  it("timer, tom katalog, ingen policy → seeder alt, feil=[]", async () => {
    const r = await seedFirmamodulKatalog("timer", "org-1");
    expect(r.slug).toBe("timer");
    expect(r.feil).toEqual([]);
    expect(timer.lonnsart.createMany).toHaveBeenCalledOnce();
    expect(timer.aktivitet.createMany).toHaveBeenCalledOnce();
    expect(timer.tillegg.createMany).toHaveBeenCalledOnce();
    expect(timer.expenseCategory.createMany).toHaveBeenCalledOnce();
    expect(kjerne.project.create).toHaveBeenCalled();
  });

  it("én feilende datatype blokkerer ikke resten", async () => {
    timer.lonnsart.createMany.mockRejectedValue(new Error("DB nede"));

    const r = await seedFirmamodulKatalog("timer", "org-1");

    // lonnsart feilet, men aktivitet/tillegg/expense seedes fortsatt.
    expect(r.feil).toHaveLength(1);
    expect(r.feil[0]!.datatype).toBe("lonnsart");
    expect(r.feil[0]!.melding).toContain("DB nede");
    expect(timer.aktivitet.createMany).toHaveBeenCalledOnce();
    expect(timer.tillegg.createMany).toHaveBeenCalledOnce();
    expect(timer.expenseCategory.createMany).toHaveBeenCalledOnce();
  });

  it("maskin → ingen seed-kall, feil=[]", async () => {
    const r = await seedFirmamodulKatalog("maskin", "org-1");
    expect(r).toEqual({ slug: "maskin", feil: [] });
    expect(timer.lonnsart.count).not.toHaveBeenCalled();
    expect(timer.expenseCategory.count).not.toHaveBeenCalled();
    expect(kjerne.project.create).not.toHaveBeenCalled();
  });

  it("varelager → ingen seed-kall, feil=[]", async () => {
    const r = await seedFirmamodulKatalog("varelager", "org-1");
    expect(r).toEqual({ slug: "varelager", feil: [] });
    expect(timer.lonnsart.count).not.toHaveBeenCalled();
    expect(kjerne.project.create).not.toHaveBeenCalled();
  });
});
