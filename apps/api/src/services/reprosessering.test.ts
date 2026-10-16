import { describe, it, expect, vi } from "vitest";
import {
  erStrandet,
  utenAktivtKjørendeWhere,
  STRANDET_MS,
  lagLivstegn,
  LIVSTEGN_THROTTLE_MS,
} from "./reprosessering";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 1: et dokument som henger i `processing`
 * etter prosess-crash ga «pågår» for alltid (knapp evig deaktivert) og ble hoppet
 * over av reprosesseringen. `erStrandet` skiller ferskt (kjører) fra strandet
 * (crashet), og `utenAktivtKjørendeWhere` slipper strandede inn igjen.
 */

const NAA = 1_000_000_000_000; // fast "nå" for determinisme

describe("erStrandet", () => {
  it("ferskt processing (nettopp oppdatert) → ikke strandet", () => {
    expect(erStrandet("processing", new Date(NAA - 1000), NAA)).toBe(false);
  });

  it("gammelt processing (> 15 min uten fremdrift) → strandet", () => {
    expect(erStrandet("processing", new Date(NAA - STRANDET_MS - 1000), NAA)).toBe(true);
  });

  it("gammelt pending → strandet (køen tok det aldri)", () => {
    expect(erStrandet("pending", new Date(NAA - STRANDET_MS - 1), NAA)).toBe(true);
  });

  it("nøyaktig på grensen (15 min) → strandet (>=)", () => {
    expect(erStrandet("processing", new Date(NAA - STRANDET_MS), NAA)).toBe(true);
  });

  it("completed er aldri strandet, uansett alder", () => {
    expect(erStrandet("completed", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });

  it("failed er aldri strandet", () => {
    expect(erStrandet("failed", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });

  it("unsupported er aldri strandet", () => {
    expect(erStrandet("unsupported", new Date(NAA - STRANDET_MS * 10), NAA)).toBe(false);
  });
});

describe("utenAktivtKjørendeWhere", () => {
  it("inkluderer strandede, ekskluderer ferske pending/processing og unsupported", () => {
    const w = utenAktivtKjørendeWhere({ projectId: "p1" }, NAA);
    // Beholder kalleren sitt filter + isActive
    expect(w.projectId).toBe("p1");
    expect(w.isActive).toBe(true);
    // To grener: ferdig-tilstander ELLER strandede (gamle) pending/processing
    expect(Array.isArray(w.OR)).toBe(true);
    const grener = w.OR as Array<Record<string, unknown>>;
    const ferdigGren = grener.find((g) => "processingState" in g && (g.processingState as { notIn?: string[] }).notIn);
    expect((ferdigGren!.processingState as { notIn: string[] }).notIn).toEqual([
      "pending",
      "processing",
      "unsupported",
    ]);
    const strandetGren = grener.find((g) => (g.processingState as { in?: string[] })?.in);
    expect((strandetGren!.processingState as { in: string[] }).in).toEqual(["pending", "processing"]);
    // Strandet-grensa er NAA - STRANDET_MS
    expect((strandetGren!.updatedAt as { lt: Date }).lt.getTime()).toBe(NAA - STRANDET_MS);
  });
});

/**
 * RETUR 2 2026-10-15 (Kontrollør) punkt 1: uten livstegn stod `updated_at` stille
 * gjennom hele OCR-fasen, så en lovlig lang OCR ble feilklassifisert som strandet.
 * `lagLivstegn` bumper `updated_at` throttlet (maks hvert LIVSTEGN_THROTTLE_MS) så
 * en levende jobb aldri ser strandet ut, mens throttlingen hindrer DB-spam.
 */
describe("lagLivstegn", () => {
  function lagSpionPrisma() {
    const kall: Array<{ sql: string; verdier: unknown[] }> = [];
    const $executeRaw = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      kall.push({ sql: strings.join("?"), verdier: values });
      return Promise.resolve(1);
    });
    return { prisma: { $executeRaw }, kall };
  }

  it("første kall skriver livstegn; nytt kall innen throttle-vinduet skrives IKKE", async () => {
    const { prisma, kall } = lagSpionPrisma();
    let naa = 1_000_000;
    const livstegn = lagLivstegn(prisma, "dok-1", () => naa);

    await livstegn();
    expect(kall).toHaveLength(1);

    naa += LIVSTEGN_THROTTLE_MS - 1; // like under vinduet
    await livstegn();
    expect(kall).toHaveLength(1); // throttlet bort
  });

  it("etter throttle-vinduet skrives nytt livstegn", async () => {
    const { prisma, kall } = lagSpionPrisma();
    let naa = 1_000_000;
    const livstegn = lagLivstegn(prisma, "dok-1", () => naa);

    await livstegn();
    naa += LIVSTEGN_THROTTLE_MS; // nøyaktig på vinduet (>= skriver)
    await livstegn();
    expect(kall).toHaveLength(2);
  });

  it("gjerder på processing_state='processing' og riktig id — gjenopplives aldri completed", async () => {
    const { prisma, kall } = lagSpionPrisma();
    const livstegn = lagLivstegn(prisma, "dok-42", () => 1_000_000);
    await livstegn();
    expect(kall[0]!.sql).toContain("processing_state = 'processing'");
    expect(kall[0]!.sql).toContain("SET updated_at = now()");
    expect(kall[0]!.verdier).toEqual(["dok-42"]);
  });

  it("svelger DB-feil — et tapt livstegn velter aldri prosesseringen", async () => {
    const $executeRaw = vi.fn(() => Promise.reject(new Error("DB nede")));
    const livstegn = lagLivstegn({ $executeRaw }, "dok-1", () => 1_000_000);
    await expect(livstegn()).resolves.toBeUndefined();
  });
});
