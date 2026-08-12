import { describe, it, expect, vi } from "vitest";
import { byggEksportArkiv } from "./arkiv";

/**
 * Kontrakt for arkiv-byggeren (fase 1). Verifiserer manifest-konvolutten uten
 * å bygge en ekte zip — spionerer på archive.append. Beviser:
 *  - manifest.json + LES-MEG.txt legges i arkivet
 *  - manifestet binder prosjekt + firma-metadata korrekt
 *  - avgrensninger[] sier eksplisitt hva som bevisst mangler (punktsky, v2, fase 1)
 *  - manglende projectId → kaster (ingen tom/villedende pakke)
 */

function fakePrisma(prosjekt: unknown) {
  return { project: { findUnique: vi.fn().mockResolvedValue(prosjekt) } } as never;
}

const PROSJEKT = {
  id: "p1",
  projectNumber: "998",
  name: "Instinniforbotn",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  primaryOrganization: { id: "o1", name: "A.Markussen AS", organizationNumber: "123456789" },
};

describe("byggEksportArkiv — manifest-konvolutt (fase 1)", () => {
  it("legger manifest.json + LES-MEG.txt og binder metadata", async () => {
    const append = vi.fn();
    const archive = { append } as never;

    const statistikk = await byggEksportArkiv(
      fakePrisma(PROSJEKT),
      { id: "j1", projectId: "p1", bestiltAvUserId: "u1" },
      archive,
    );

    const navn = append.mock.calls.map((c) => c[1].name);
    expect(navn).toContain("manifest.json");
    expect(navn).toContain("LES-MEG.txt");

    const manifestKall = append.mock.calls.find((c) => c[1].name === "manifest.json");
    const manifest = JSON.parse(manifestKall![0] as string);
    expect(manifest.eksportVersjon).toBe("1.0");
    expect(manifest.kilde.eksportId).toBe("j1");
    expect(manifest.prosjekt.prosjektnummer).toBe("998");
    expect(manifest.firma.orgnr).toBe("123456789");
    expect(manifest.innhold).toEqual([]); // fylles i fase 2
    expect(manifest.avgrensninger.join(" ")).toContain("Punktskyer");
    expect(statistikk).toEqual({ antallDokumenter: 0, antallFiler: 0, samletStorrelseBytes: 0 });
  });

  it("firma=null når prosjektet mangler primærorganisasjon", async () => {
    const append = vi.fn();
    await byggEksportArkiv(
      fakePrisma({ ...PROSJEKT, primaryOrganization: null }),
      { id: "j2", projectId: "p1", bestiltAvUserId: "u1" },
      { append } as never,
    );
    const manifest = JSON.parse(
      append.mock.calls.find((c) => c[1].name === "manifest.json")![0] as string,
    );
    expect(manifest.firma).toBeNull();
  });

  it("kaster hvis projectId mangler (ingen villedende pakke)", async () => {
    await expect(
      byggEksportArkiv(fakePrisma(PROSJEKT), { id: "j3", projectId: null, bestiltAvUserId: "u1" }, {
        append: vi.fn(),
      } as never),
    ).rejects.toThrow(/projectId/);
  });

  it("kaster hvis prosjektet ikke finnes", async () => {
    await expect(
      byggEksportArkiv(fakePrisma(null), { id: "j4", projectId: "p1", bestiltAvUserId: "u1" }, {
        append: vi.fn(),
      } as never),
    ).rejects.toThrow(/finnes ikke/);
  });
});
