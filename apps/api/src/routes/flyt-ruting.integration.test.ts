import { describe, it, expect, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";
import {
  seedScenario,
  teardown,
  settLeddKlassifisering,
  type FlytScenario,
} from "../test-harness/seed";

/**
 * Flytmodell Fase 5a — server-e2e for Kenneths 31.07-sekvens (DISTINKTE personer per ledд).
 *
 * Kjører gjennom det EKTE `endreStatus`-tRPC-laget (ruting + authz `retningsrettigheter`
 * + fakta-skriving + `avledStatus`), ikke ren-funksjon. Lukker verifiseringsgrensen
 * Fase 3 flagget («full tRPC-e2e mot DB IKKE kjørt»). Regresjonsnett for pilot-fiksen.
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). Commit-seed → teardown (flagg A).
 *
 * EMPIRISK FUNN (dokumentert i denne testen — se `received→sent`-blokken): forover-flytting
 * forbi Ledd 1→2 skjer via VIDERESEND (paatvers), IKKE gjentatt «Send» — §8A fjernet
 * `received→sent`. «Send» (nesteLedd) fyrer i praksis kun ved draft→sent. Selve pilot-fiksen
 * (Besvar→utfører, Godkjenn krever ball) er bevist grønn uansett.
 */

// Alle seedede scenarier ryddes samlet i afterAll (commit-seed → teardown, flagg A).
const opprydding: FlytScenario[] = [];
async function nyttScenario(): Promise<FlytScenario> {
  const s = await seedScenario();
  opprydding.push(s);
  return s;
}
afterAll(async () => {
  for (const s of opprydding) await teardown(s);
});

/** Les dokument-fakta (det ruting/avledStatus faktisk skrev). */
async function faktaFor(checklistId: string) {
  return prisma.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    select: {
      status: true, aktivPosisjon: true, retning: true, terminal: true,
      sendt: true, recipientUserId: true, recipientGroupId: true,
    },
  });
}

/** Kjør endreStatus og returner TRPCError-koden hvis den kaster (ellers null). */
async function feilkode(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof TRPCError ? e.code : "UKJENT";
  }
}

describe("Fase 5a: server-e2e posisjons-ruting (distinkte personer)", () => {
  it("Send (draft→sent) treffer bestiller — INGEN hopp (nesteLedd 1→2)", async () => {
    const s = await nyttScenario();
    // A (oppretter, Ledд 1) sender. Posisjonsmodell: nesteLedd(1)=2 = bestiller B.
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({
      id: s.checklistId, nyStatus: "sent",
    });
    const f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(2);                 // ballen ett ledд fram (ikke hopp til siste)
    expect(f.recipientUserId).toBe(s.B_bestiller);   // treffer bestiller, ikke godkjenner
    expect(f.retning).toBe("frem");
    expect(f.status).toBe("received");               // avledet (sent→received, Q1-kollaps)
    expect(f.sendt).toBe(true);
  });

  it("received→sent er BLOKKERT (§8A) — forover forbi Ledd 2 går IKKE via «Send»", async () => {
    const s = await nyttScenario();
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" });
    // B har ballen (pos 2, status received). «Send» videre = received→sent = ugyldig overgang.
    const kode = await feilkode(() =>
      createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" }),
    );
    expect(kode).toBe("BAD_REQUEST"); // isValidStatusTransition avviser (dokumentert §8A-konsekvens)
  });

  it("Besvar fra godkjenner(4) går til utfører(3) — retur bakover, IKKE til vilkårlig avsender", async () => {
    const s = await nyttScenario();
    // Fram til godkjenner via Videresend (forover-flytting; «sent» er blokkert fra received).
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" }); // →2 (B)
    await createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "forwarded", recipientUserId: s.C_utforer }); // →3 (C)
    await createTestCaller(s.C_utforer).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "forwarded", recipientUserId: s.D_godkjenner }); // →4 (D)

    const før = await faktaFor(s.checklistId);
    expect(før.aktivPosisjon).toBe(4);
    expect(før.recipientUserId).toBe(s.D_godkjenner);

    // Godkjenner besvarer (retur for utbedring): forrigeBallLedd(4)=3 = utfører C.
    await createTestCaller(s.D_godkjenner).sjekkliste.endreStatus({
      id: s.checklistId, nyStatus: "responded", kommentar: "Utbedre punkt 3",
    });
    const etter = await faktaFor(s.checklistId);
    expect(etter.aktivPosisjon).toBe(3);                 // ett ledд bakover
    expect(etter.recipientUserId).toBe(s.C_utforer);     // utfører — IKKE bestiller/registrator (pilot-bug)
    expect(etter.retning).toBe("tilbake");
    expect(etter.status).toBe("responded");              // avledet (retning=tilbake)
  });

  it("Godkjenn krever ball: ikke-ball-holder → FORBIDDEN, ball-holder → godkjent (terminal)", async () => {
    const s = await nyttScenario();
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" });
    await createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "forwarded", recipientUserId: s.C_utforer });
    await createTestCaller(s.C_utforer).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "forwarded", recipientUserId: s.D_godkjenner });
    // Ball @4 (D). Utfører C (Ledд 3, ikke ball) prøver Godkjenn → authz nekter.
    const negativ = await feilkode(() =>
      createTestCaller(s.C_utforer).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "approved" }),
    );
    expect(negativ).toBe("FORBIDDEN");

    // Godkjenner D (har ballen) godkjenner → terminal.
    await createTestCaller(s.D_godkjenner).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "approved" });
    const f = await faktaFor(s.checklistId);
    expect(f.terminal).toBe("godkjent");
    expect(f.status).toBe("approved");
  });

  it("Authz-negativ: flyt-medlem uten ballen får FORBIDDEN på forover-handling", async () => {
    const s = await nyttScenario();
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" }); // ball @2 (B)
    // C (utfører, Ledд 3) er flyt-medlem men har IKKE ballen (den er @2). Besvar/Send → FORBIDDEN.
    const kode = await feilkode(() =>
      createTestCaller(s.C_utforer).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "responded", kommentar: "x" }),
    );
    expect(kode).toBe("FORBIDDEN"); // retningsrettigheter: kun ball-holder handler
  });

  it("Orienteres-hopp: Besvar hopper over orienteres-ledд bakover", async () => {
    const s = await nyttScenario();
    // Gjør Ledд 2 (bestiller) til orienteres. Ledд: [1 utfor, 2 orienteres, 3 utfor, 4 kontroll].
    await settLeddKlassifisering(s.dokumentflytId, 2, "orienteres");
    // Fram til Ledд 3 (utfører) via Videresend.
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" });
    await createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "forwarded", recipientUserId: s.C_utforer });
    const før = await faktaFor(s.checklistId);
    expect(før.aktivPosisjon).toBe(3);

    // C besvarer: forrigeBallLedd(3) skal HOPPE orienteres(2) → Ledд 1 (A).
    await createTestCaller(s.C_utforer).sjekkliste.endreStatus({
      id: s.checklistId, nyStatus: "responded", kommentar: "retur",
    });
    const etter = await faktaFor(s.checklistId);
    expect(etter.aktivPosisjon).toBe(1);              // hoppet over orienteres-ledд 2
    expect(etter.recipientUserId).toBe(s.A_registrator);
    expect(etter.retning).toBe("tilbake");
  });

  it("Bakoverkompat: nyStatus-input gir korrekte fakta + avledet status (Trekk tilbake → draft)", async () => {
    const s = await nyttScenario();
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "sent" }); // ball @2 (B)
    // received→draft (Trekk tilbake, F2). beregnRuting: draft → effektivStatus="draft" → sendt=false,
    // terminal=null, ingen posisjon-endring. avledStatus(!sendt) = "draft" (deterministisk).
    await createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "draft" });
    const f = await faktaFor(s.checklistId);
    expect(f.terminal).toBeNull();
    expect(f.sendt).toBe(false);      // Trekk tilbake nullstiller sendt-fakta
    expect(f.status).toBe("draft");   // avledet fra (!sendt) — bakoverkompat status-cache korrekt
  });
});
