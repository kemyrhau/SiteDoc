import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hentKodeversjon, byggKonverteringMarkor, anvendDwgResultat } from "./tegning";
import type { DwgKonverteringsResultat } from "../services/dwgKonvertering";

/**
 * Konverteringsmarkør (2026-10-11): BEVISER at en konvertering faktisk kjørte, med hvilken
 * kode/motor. Markøren skrives der koden kjører — web-containeren for nettleser-opplasting
 * (`NEXT_PUBLIC_BUILD_SHA`), api-containeren for mobil (`GIT_SHA`).
 *
 * 🔴 Test (c) «stille tomhet forbudt»: en konvertering i prod/test skal ALDRI gi en tom
 * `kodeversjon`. Disse testene FEILER hvis sha-en kan skjule seg som tom streng.
 */

const lagret = {
  GIT_SHA: process.env.GIT_SHA,
  NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
  NODE_ENV: process.env.NODE_ENV,
};

beforeEach(() => {
  delete process.env.GIT_SHA;
  delete process.env.NEXT_PUBLIC_BUILD_SHA;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.GIT_SHA = lagret.GIT_SHA;
  process.env.NEXT_PUBLIC_BUILD_SHA = lagret.NEXT_PUBLIC_BUILD_SHA;
  process.env.NODE_ENV = lagret.NODE_ENV;
});

describe("hentKodeversjon — build-sha der koden kjører", () => {
  it("leser GIT_SHA (api-container)", () => {
    process.env.GIT_SHA = "2034396e";
    expect(hentKodeversjon()).toBe("2034396e");
  });

  it("faller tilbake til NEXT_PUBLIC_BUILD_SHA (web-container) når GIT_SHA mangler", () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = "ba70fa4a";
    expect(hentKodeversjon()).toBe("ba70fa4a");
  });

  it("prod/test uten sha → «ukjent» + logget feil, ALDRI tom streng (stille tomhet)", () => {
    process.env.NODE_ENV = "production";
    const feil = vi.spyOn(console, "error").mockImplementation(() => {});
    const v = hentKodeversjon();
    expect(v).toBe("ukjent");
    expect(v).not.toBe("");
    expect(feil).toHaveBeenCalledOnce();
  });

  it("lokal dev uten sha → «dev»", () => {
    process.env.NODE_ENV = "development";
    expect(hentKodeversjon()).toBe("dev");
  });
});

describe("byggKonverteringMarkor — kodeversjon aldri tom (test c)", () => {
  it("test-miljø (sha satt) gir ikke-tom kodeversjon + riktig motor", () => {
    process.env.GIT_SHA = "2034396e";
    const m = byggKonverteringMarkor("egen");
    expect(m.kodeversjon).toBeTruthy();
    expect(m.kodeversjon).not.toBe("");
    expect(m.motor).toBe("egen");
    expect(() => new Date(m.konvertertTid).toISOString()).not.toThrow();
  });

  it("selv uten sha i prod er kodeversjon ikke-tom (ukjent, ikke «»)", () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(byggKonverteringMarkor("pdf").kodeversjon).not.toBe("");
  });
});

// L8: DWG layout-barn (paper space) fikk ingen markør før og viste derfor «Konvertert
// før versjonsmerking» selv ferske — den falske infoen markøren skal hindre. Denne
// testen FEILER hvis et nyopprettet layout-barn mangler markøren (stille tomhet).
//
// Stram markør (2026-10-11): markøren bærer motoren som FAKTISK tegnet (fra resultatet),
// ikke env-flagget DWG_MOTOR. Ved ezdxf→egen-fallback: motor="egen" + fallbackFra="ezdxf".
describe("anvendDwgResultat — layout-barn får konverteringsmarkør (L8)", () => {
  function resultatMedLayout(
    motor: "egen" | "ezdxf" = "egen",
    fallbackFra: "egen" | "ezdxf" | null = null,
    fallbackAarsak: string | null = null,
  ): DwgKonverteringsResultat {
    return {
      mmPrPiksel: 10, scale: "1:100", scaleKilde: "dwg", imageWidth: 2000, imageHeight: 1500,
      visningUrl: "/uploads/hoved.svg", mobilVisningUrl: null, visningFilType: "svg",
      koordinatSystem: null, geoReferanse: null, feil: null,
      autoRotasjon: null, startutsnitt: null, rapport: null,
      motor, fallbackFra, fallbackAarsak,
      dxfViewerFileUrl: null, registerWorldUrl: null,
      layouts: [{
        navn: "Plan 1:100", tabOrder: 1, visningUrl: "/uploads/layout.svg", visningFilType: "svg",
        mmPrPiksel: 10, scale: "1:100", scaleKilde: "dwg", imageWidth: 2000, imageHeight: 1500,
      }],
    };
  }

  function fakePrisma() {
    const opprettet: Record<string, unknown>[] = [];
    const tomListe = { findMany: vi.fn(async () => []), update: vi.fn() };
    const tx = {
      drawing: { update: vi.fn() },
      task: tomListe, checklist: tomListe, kontrollplanPunkt: tomListe, omrade: tomListe,
    };
    const prisma = {
      drawing: {
        update: vi.fn(),
        findUnique: vi.fn(async () => ({ autoRotasjon: null })),
        findMany: vi.fn(async () => []), // ingen eksisterende layout-barn
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { opprettet.push(data); }),
      },
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<void>) => { await fn(tx); }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    return { prisma, opprettet };
  }

  const TEGNING = { id: "d1", name: "Plan 06", projectId: "p1", byggeplassId: null };

  it("nytt layout-barn får markør med den FAKTISKE motoren (ezdxf) fra resultatet", async () => {
    process.env.GIT_SHA = "2034396e";
    const { prisma, opprettet } = fakePrisma();
    await anvendDwgResultat(prisma, TEGNING, resultatMedLayout("ezdxf"), "/uploads/orig.dwg");
    expect(opprettet).toHaveLength(1);
    const rapport = opprettet[0]!.konverteringRapport as { markor?: { motor?: string; kodeversjon?: string } };
    // Kjernen: layout-barnet har en markør (ikke tomt → «Konvertert før versjonsmerking»).
    expect(rapport?.markor).toBeTruthy();
    expect(rapport.markor!.motor).toBe("ezdxf");
    expect(rapport.markor!.kodeversjon).toBe("2034396e");
  });

  it("markøren følger egen-motoren når resultatet rapporterer egen", async () => {
    process.env.GIT_SHA = "2034396e";
    const { prisma, opprettet } = fakePrisma();
    await anvendDwgResultat(prisma, TEGNING, resultatMedLayout("egen"), "/uploads/orig.dwg");
    const rapport = opprettet[0]!.konverteringRapport as { markor?: { motor?: string } };
    expect(rapport.markor!.motor).toBe("egen");
  });

  // 🔴 Kjernen i stram-markør: DWG_MOTOR=ezdxf, men ezdxf falt tilbake til egen. Markøren
  // skal da si motor="egen" + fallbackFra="ezdxf" — ALDRI "ezdxf" (en markør som lyver om
  // motoren er nettopp feilklassen den skal hindre). Gjelder både hovedtegning og layout-barn.
  it("ezdxf→egen-fallback: markøren viser egen + fallbackFra=ezdxf, ikke ezdxf", async () => {
    process.env.GIT_SHA = "2034396e";
    const { prisma, opprettet } = fakePrisma();
    const resultat = resultatMedLayout("egen", "ezdxf", "ezdxf-render feilet");
    await anvendDwgResultat(prisma, TEGNING, resultat, "/uploads/orig.dwg");
    const rapport = opprettet[0]!.konverteringRapport as {
      markor?: { motor?: string; fallbackFra?: string; fallbackAarsak?: string };
    };
    expect(rapport.markor!.motor).toBe("egen");
    expect(rapport.markor!.motor).not.toBe("ezdxf");
    expect(rapport.markor!.fallbackFra).toBe("ezdxf");
    expect(rapport.markor!.fallbackAarsak).toBe("ezdxf-render feilet");
  });
});
