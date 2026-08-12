import { describe, it, expect } from "vitest";
import {
  aggregerLagring,
  dbVolumEstimatBytes,
  manglerStorrelsePerModell,
  formaterBytes,
  DB_SNITT_BYTES,
  LAGRING_MODELLER,
  type LagringRad,
  type LagringModell,
} from "./lagring";

// Fabrikk: en rad er «målt» (file_size satt) med mindre annet oppgis.
function rad(
  modell: LagringModell,
  projectId: string | null,
  bytes: number,
  maaltStorrelse = true,
): LagringRad {
  return { modell, projectId, bytes, maaltStorrelse };
}

describe("formaterBytes", () => {
  it("formaterer med norsk desimalkomma per enhet", () => {
    expect(formaterBytes(0)).toBe("0 B");
    expect(formaterBytes(512)).toBe("512 B");
    expect(formaterBytes(1536)).toBe("1,5 KB");
    expect(formaterBytes(11 * 1024 * 1024)).toBe("11,0 MB");
    expect(formaterBytes(2 * 1024 * 1024 * 1024)).toBe("2,00 GB");
  });
});

describe("aggregerLagring — per prosjekt/modell + foreldreløs-bøtte", () => {
  it("summerer per prosjekt og per modell", () => {
    const agg = aggregerLagring([
      rad("images", "p1", 100),
      rad("images", "p1", 200),
      rad("drawings", "p1", 50),
      rad("images", "p2", 10),
    ]);
    const p1 = agg.find((a) => a.projectId === "p1")!;
    expect(p1.perModell.images).toEqual({ bytes: 300, antall: 2 });
    expect(p1.perModell.drawings).toEqual({ bytes: 50, antall: 1 });
    expect(p1.totalBytes).toBe(350);
    expect(p1.totalAntall).toBe(3);
    expect(agg.find((a) => a.projectId === "p2")!.totalBytes).toBe(10);
  });

  it("foreldreløse (projectId=null) samles i egen bøtte, ikke under et prosjekt", () => {
    const agg = aggregerLagring([
      rad("images", "p1", 100),
      rad("images", null, 500),
      rad("images", null, 300),
    ]);
    const foreldrelos = agg.find((a) => a.projectId === null)!;
    expect(foreldrelos.totalBytes).toBe(800);
    expect(foreldrelos.totalAntall).toBe(2);
    expect(agg.find((a) => a.projectId === "p1")!.totalBytes).toBe(100);
  });

  it("null/negativ bytes teller som 0 bytes men fortsatt +1 antall (drift-sikring)", () => {
    const p1 = aggregerLagring([
      rad("drawings", "p1", 0),
      rad("drawings", "p1", -5),
    ]).find((a) => a.projectId === "p1")!;
    expect(p1.perModell.drawings).toEqual({ bytes: 0, antall: 2 });
  });

  it("tom input → tomt aggregat", () => {
    expect(aggregerLagring([])).toEqual([]);
  });
});

describe("manglerStorrelsePerModell — dekningsgrad", () => {
  it("teller kun umålte rader (maaltStorrelse=false), per modell", () => {
    const m = manglerStorrelsePerModell([
      rad("drawings", "p1", 0, false), // umålt DWG-layout
      rad("drawings", "p1", 100, true), // målt
      rad("drawings", "p2", 0, false), // umålt
      rad("images", "p1", 50, true), // målt (Image er alltid NOT NULL)
    ]);
    expect(m.drawings).toBe(2);
    expect(m.images).toBe(0);
    expect(m.point_clouds).toBe(0);
  });

  it("alt målt → alle modeller 0", () => {
    const m = manglerStorrelsePerModell([rad("images", "p1", 1), rad("drawings", "p1", 1)]);
    expect(Object.values(m).every((n) => n === 0)).toBe(true);
  });
});

describe("dbVolumEstimatBytes — sekundærtall", () => {
  it("Σ antall × DB_SNITT_BYTES per modell", () => {
    expect(
      dbVolumEstimatBytes([
        rad("images", "p1", 1),
        rad("images", null, 1),
        rad("ftd_documents", "p1", 1),
      ]),
    ).toBe(DB_SNITT_BYTES.images * 2 + DB_SNITT_BYTES.ftd_documents);
  });

  it("alle fem modeller har en snitt-verdi", () => {
    for (const md of LAGRING_MODELLER) {
      expect(DB_SNITT_BYTES[md]).toBeGreaterThan(0);
    }
  });
});
