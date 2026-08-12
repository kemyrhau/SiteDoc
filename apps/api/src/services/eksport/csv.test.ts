import { describe, it, expect, vi } from "vitest";
import { byggTimerCsv, byggUtleggCsv } from "./csv";

/**
 * Format-kontrakt for CSV-rådata: UTF-8 BOM, `;`-delimiter, norsk desimalkomma,
 * RFC-4180-quoting av felt med `;`/`"`/linjeskift, og brukernavn-join fra kjerne-db.
 */

function timerPrisma(navn: string) {
  return {
    user: { findMany: vi.fn().mockResolvedValue([{ id: "u1", name: navn, email: null }]) },
  } as never;
}

describe("byggTimerCsv", () => {
  it("BOM + header + norsk komma + quoting av beskrivelse med semikolon", async () => {
    const prismaTimer = {
      sheetTimer: {
        findMany: vi.fn().mockResolvedValue([
          {
            timer: { toString: () => "8.00" },
            fraTid: "07:00",
            tilTid: "15:00",
            beskrivelse: "Graving; sprenging",
            attestertStatus: "attestert",
            sheet: { dato: new Date("2026-02-03T00:00:00Z"), userId: "u1" },
            lonnsart: { navn: "Timelønn" },
            aktivitet: { navn: "Anleggsarbeid" },
          },
        ]),
      },
    } as never;

    const csv = await byggTimerCsv(timerPrisma("Ola Nordmann"), prismaTimer, "p1");

    expect(csv.startsWith("﻿")).toBe(true); // BOM
    const linjer = csv.replace("﻿", "").trim().split("\r\n");
    expect(linjer[0]).toBe("Dato;Ansatt;Lønnsart;Aktivitet;Timer;Fra;Til;Beskrivelse;Attestert");
    expect(linjer[1]).toBe(
      '2026-02-03;Ola Nordmann;Timelønn;Anleggsarbeid;8,00;07:00;15:00;"Graving; sprenging";attestert',
    );
  });
});

describe("byggUtleggCsv", () => {
  it("beløp + mva med norsk komma, ordning-stempel med", async () => {
    const prismaTimer = {
      sheetUtlegg: {
        findMany: vi.fn().mockResolvedValue([
          {
            belop: { toString: () => "1250.50" },
            mvaSats: { toString: () => "25.00" },
            kommentar: "Drivstoff",
            ordningVedFoering: "utlegg",
            sheet: { dato: new Date("2026-02-04T00:00:00Z"), userId: "u1" },
            expenseCategory: { navn: "Drivstoff" },
          },
        ]),
      },
    } as never;

    const csv = await byggUtleggCsv(timerPrisma("Kari"), prismaTimer, "p1");
    const linjer = csv.replace("﻿", "").trim().split("\r\n");
    expect(linjer[0]).toBe("Dato;Ansatt;Kategori;Beløp;MVA-sats;Ordning;Kommentar");
    expect(linjer[1]).toBe("2026-02-04;Kari;Drivstoff;1250,50;25,00;utlegg;Drivstoff");
  });

  it("faller tilbake til userId/email når navn mangler", async () => {
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: "u1", name: null, email: "k@a.no" }]) },
    } as never;
    const prismaTimer = {
      sheetUtlegg: {
        findMany: vi.fn().mockResolvedValue([
          {
            belop: { toString: () => "10.00" },
            mvaSats: null,
            kommentar: null,
            ordningVedFoering: "fakturert",
            sheet: { dato: new Date("2026-02-05T00:00:00Z"), userId: "u1" },
            expenseCategory: { navn: "Annet" },
          },
        ]),
      },
    } as never;
    const csv = await byggUtleggCsv(prisma, prismaTimer, "p1");
    expect(csv).toContain(";k@a.no;");
  });
});
