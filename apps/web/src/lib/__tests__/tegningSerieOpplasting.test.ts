import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  lastOppSerie,
  grupperTegningerEtterFag,
  byggTegningRadEndring,
  nesteRevisjon,
  type OpplastetFil,
} from "../tegningSerieOpplasting";

const fil = (navn: string): OpplastetFil => ({
  fileUrl: `/uploads/${navn}`,
  fileName: navn,
  fileType: "pdf",
  fileSize: 1,
});

describe("lastOppSerie (spec-test 5): én feilet fil stopper ikke de andre", () => {
  it("fire klar, én feilet — alle fem forsøkt", async () => {
    const forsøkt: number[] = [];
    const res = await lastOppSerie(
      5,
      async (i) => {
        forsøkt.push(i);
        if (i === 2) throw new Error("konvertering feilet");
        return fil(`f${i}`);
      },
      { maksSamtidig: 2 },
    );

    expect(forsøkt.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    const klar = res.filter((r) => r.status === "klar");
    const feilet = res.filter((r) => r.status === "feilet");
    expect(klar).toHaveLength(4);
    expect(feilet).toHaveLength(1);
    expect(feilet[0]).toMatchObject({ indeks: 2, status: "feilet", feil: "konvertering feilet" });
  });

  it("respekterer maks samtidige", async () => {
    let aktive = 0;
    let maksSett = 0;
    await lastOppSerie(
      6,
      async () => {
        aktive++;
        maksSett = Math.max(maksSett, aktive);
        await Promise.resolve();
        aktive--;
        return fil("x");
      },
      { maksSamtidig: 3 },
    );
    expect(maksSett).toBeLessThanOrEqual(3);
  });

  it("onStatus kalles med laster → klar/feilet", async () => {
    const hendelser: string[] = [];
    await lastOppSerie(
      2,
      async (i) => {
        if (i === 1) throw new Error("x");
        return fil("ok");
      },
      { onStatus: (i, s) => hendelser.push(`${i}:${s}`) },
    );
    expect(hendelser).toContain("0:laster");
    expect(hendelser).toContain("0:klar");
    expect(hendelser).toContain("1:feilet");
  });
});

describe("grupperTegningerEtterFag (R6)", () => {
  it("grupperer på fag, «Uten fag» sist, sortert på nummer i gruppa", () => {
    const grupper = grupperTegningerEtterFag([
      { id: "1", name: "B", discipline: "RIB", drawingNumber: "B-20-102" },
      { id: "2", name: "A", discipline: "ARK", drawingNumber: "A-20-101" },
      { id: "3", name: "Uten", discipline: null, drawingNumber: null },
      { id: "4", name: "A2", discipline: "ARK", drawingNumber: "A-20-100" },
    ]);
    expect(grupper.map((g) => g.fag)).toEqual(["ARK", "RIB", null]);
    // ARK sortert på nummer: A-20-100 før A-20-101
    expect(grupper[0]!.tegninger.map((t) => t.id)).toEqual(["4", "2"]);
    expect(grupper[2]!.fag).toBeNull();
  });
});

describe("byggTegningRadEndring (spec-test 6): kun endrede felt", () => {
  it("sender bare feltet brukeren endret", () => {
    const original = { name: "Plan", drawingNumber: "", discipline: "ARK", drawingType: "", floor: "", originator: "", scale: "" };
    const redigert = { name: "Plan", drawingNumber: "A-20-101", discipline: "ARK", drawingType: "", floor: "", originator: "", scale: "" };
    const endring = byggTegningRadEndring("id-1", original, redigert);
    expect(Object.keys(endring).sort()).toEqual(["drawingNumber", "id"]);
    expect(endring.drawingNumber).toBe("A-20-101");
  });

  it("urørt rad → kun id", () => {
    const felt = { name: "Plan", drawingNumber: "A-1", discipline: "ARK", drawingType: "plan", floor: "1", originator: "", scale: "" };
    expect(byggTegningRadEndring("id-1", felt, felt)).toEqual({ id: "id-1" });
  });

  it("blank = blank regnes ikke som endring (null ↔ \"\")", () => {
    const endring = byggTegningRadEndring(
      "id-1",
      { name: "Plan", floor: null as unknown as string },
      { name: "Plan", drawingNumber: "", discipline: "", drawingType: "", floor: "", originator: "", scale: "" },
    );
    expect(endring).toEqual({ id: "id-1" });
  });

  it("tømming av et satt fritekstfelt sendes som \"\"", () => {
    const endring = byggTegningRadEndring(
      "id-1",
      { name: "Plan", floor: "2" },
      { name: "Plan", drawingNumber: "", discipline: "", drawingType: "", floor: "", originator: "", scale: "" },
    );
    expect(endring).toEqual({ id: "id-1", floor: "" });
  });
});

describe("nesteRevisjon (R8)", () => {
  it("bokstav → neste bokstav", () => {
    expect(nesteRevisjon("A")).toBe("B");
    expect(nesteRevisjon("b")).toBe("C");
  });
  it("tall-suffiks → +1", () => {
    expect(nesteRevisjon("R1")).toBe("R2");
    expect(nesteRevisjon("Rev9")).toBe("REV10");
  });
  it("tom → B (fra default A)", () => {
    expect(nesteRevisjon("")).toBe("B");
    expect(nesteRevisjon(null)).toBe("B");
  });
});

// Kildefil-vakter (spec-test 1 + 7) — leses fra disk, kjøres fra apps/web.
const byggeplasserSrc = readFileSync(
  join(process.cwd(), "src/app/dashbord/oppsett/byggeplasser/page.tsx"),
  "utf-8",
);

describe("spec-test 1: filfeltet støtter flervalg", () => {
  it("fil-input har multiple", () => {
    expect(byggeplasserSrc).toMatch(/type="file"[\s\S]{0,200}multiple/);
  });
});

describe("spec-test 7: ingen «mangler målestokk»-banner (R7)", () => {
  it("ingen manglerMalestokk-nøkkel/tekst i opplastingssiden", () => {
    expect(byggeplasserSrc.toLowerCase()).not.toContain("mangler målestokk");
    expect(byggeplasserSrc).not.toMatch(/manglerM[aå]lestokk/i);
  });
});
