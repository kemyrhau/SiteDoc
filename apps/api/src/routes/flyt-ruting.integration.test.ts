import { describe, it, expect, afterAll } from "vitest";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";
import {
  seedScenario,
  teardown,
  settLeddKlassifisering,
  seedBestillerSist,
  teardownBestillerSist,
  type FlytScenario,
  type BestillerSistScenario,
} from "../test-harness/seed";

/**
 * Flytmodell Fase 5a (+ 3.6-utvidelse) — server-e2e for Kenneths 31.07-sekvens
 * (DISTINKTE personer per ledд).
 *
 * Kjører gjennom det EKTE `endreStatus`-tRPC-laget (ruting + authz `retningsrettigheter`
 * + fakta-skriving + `avledStatus`), ikke ren-funksjon. Lukker verifiseringsgrensen
 * Fase 3 flagget («full tRPC-e2e mot DB IKKE kjørt»). Regresjonsnett for pilot-fiksen.
 *
 * Mål-DB: localhost-sandkasse (verifisert ikke test/prod). Commit-seed → teardown (flagg A).
 *
 * Fase 3.6 (2026-08-01): `received→sent` gjeninnført → «Send → = neste ledд» virker fra
 * ETHVERT ledд. Send-kjeden 1→2→3→4 kjøres nå direkte via «Send» (ikke Videresend) — det
 * beviser fabel-løsning 1. Selve pilot-fiksen (Besvar→utfører, Godkjenn krever ball) står.
 */

// Alle seedede scenarier ryddes samlet i afterAll (commit-seed → teardown, flagg A).
const opprydding: FlytScenario[] = [];
const oppryddingBS: BestillerSistScenario[] = [];
async function nyttScenario(): Promise<FlytScenario> {
  const s = await seedScenario();
  opprydding.push(s);
  return s;
}
afterAll(async () => {
  for (const s of opprydding) await teardown(s);
  for (const s of oppryddingBS) await teardownBestillerSist(s);
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

/** Send (nyStatus="sent") som `userId` — forover via nesteLedд. */
function send(userId: string, checklistId: string) {
  return createTestCaller(userId).sjekkliste.endreStatus({ id: checklistId, nyStatus: "sent" });
}

describe("Fase 5a: server-e2e posisjons-ruting (distinkte personer)", () => {
  it("Send (draft→sent) treffer bestiller — INGEN hopp (nesteLedd 1→2)", async () => {
    const s = await nyttScenario();
    // A (oppretter, Ledд 1) sender. Posisjonsmodell: nesteLedd(1)=2 = bestiller B.
    await send(s.A_registrator, s.checklistId);
    const f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(2);                 // ballen ett ledд fram (ikke hopp til siste)
    expect(f.recipientUserId).toBe(s.B_bestiller);   // treffer bestiller, ikke godkjenner
    expect(f.retning).toBe("frem");
    expect(f.status).toBe("received");               // avledet (sent→received, Q1-kollaps)
    expect(f.sendt).toBe(true);
  });

  it("Fase 3.6: Send-kjede 2→3→4 via «Send» fra received (Tolkning A, tidligere BAD_REQUEST)", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId);       // 1→2 (B)
    // Send fra bestiller(2) → utfører(3). Tidligere BLOKKERT (received→sent); nå GRØNT (Fase 3.6).
    await send(s.B_bestiller, s.checklistId);
    let f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(3);
    expect(f.recipientUserId).toBe(s.C_utforer);      // treffer utfører, ikke hopp

    // Send fra utfører(3) → godkjenner(4) (Tolkning A: utfører-submit = Send forover).
    await send(s.C_utforer, s.checklistId);
    f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(4);
    expect(f.recipientUserId).toBe(s.D_godkjenner);
    expect(f.status).toBe("received");
  });

  it("Besvar fra godkjenner(4) går til utfører(3) — retur bakover, IKKE til vilkårlig avsender", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId); // →2
    await send(s.B_bestiller, s.checklistId);   // →3
    await send(s.C_utforer, s.checklistId);     // →4

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

  it("bevis-03 (pilot-fiks B): ledд på Besvart Sender FRAMOVER (responded→sent → nesteLedд), ikke blokkert", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId); // →2
    await send(s.B_bestiller, s.checklistId);   // →3
    await send(s.C_utforer, s.checklistId);     // →4
    // Godkjenner(4) besvarer → utfører(3): status responded, ballen @3.
    await createTestCaller(s.D_godkjenner).sjekkliste.endreStatus({
      id: s.checklistId, nyStatus: "responded", kommentar: "utbedre",
    });
    const påBesvart = await faktaFor(s.checklistId);
    expect(påBesvart.aktivPosisjon).toBe(3);
    expect(påBesvart.status).toBe("responded");
    // Utfører(3) Sender framover fra Besvart (responded→sent). Tidligere BLOKKERT (§8A) → primær
    // ble feilaktig «Godkjenn». Pilot-fiks B: nå GRØNT (nesteLedд 3→4), primær ville vært «Send».
    await send(s.C_utforer, s.checklistId);
    const etter = await faktaFor(s.checklistId);
    expect(etter.aktivPosisjon).toBe(4);              // Send framover, IKKE terminal/Godkjenn
    expect(etter.recipientUserId).toBe(s.D_godkjenner);
    expect(etter.status).toBe("received");            // «Hos 4», ikke approved
  });

  it("Godkjenn krever ball: ikke-ball-holder → FORBIDDEN, ball-holder → godkjent (terminal)", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId); // →2
    await send(s.B_bestiller, s.checklistId);   // →3
    await send(s.C_utforer, s.checklistId);     // →4 (D har ballen)
    // Utfører C (Ledд 3, ikke ball) prøver Godkjenn → authz nekter.
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
    await send(s.A_registrator, s.checklistId); // ball @2 (B)
    // C (utfører, Ledд 3) er flyt-medlem men har IKKE ballen (den er @2). Send fra C → FORBIDDEN.
    const kode = await feilkode(() => send(s.C_utforer, s.checklistId));
    expect(kode).toBe("FORBIDDEN"); // retningsrettigheter: kun ball-holder handler
  });

  it("Orienteres-hopp: Besvar hopper over orienteres-ledд bakover", async () => {
    const s = await nyttScenario();
    // Gjør Ledд 2 (bestiller) til orienteres. Ledд: [1 utfor, 2 orienteres, 3 utfor, 4 kontroll].
    await settLeddKlassifisering(s.dokumentflytId, 2, "orienteres");
    // Fram til Ledд 3 (utfører). Send 1→? : nesteLedd hopper orienteres(2) → 3 direkte.
    await send(s.A_registrator, s.checklistId);
    const mellom = await faktaFor(s.checklistId);
    expect(mellom.aktivPosisjon).toBe(3);             // Send hopper orienteres FRAMOVER også
    expect(mellom.recipientUserId).toBe(s.C_utforer);

    // C besvarer: forrigeBallLedd(3) skal HOPPE orienteres(2) → Ledд 1 (A).
    await createTestCaller(s.C_utforer).sjekkliste.endreStatus({
      id: s.checklistId, nyStatus: "responded", kommentar: "retur",
    });
    const etter = await faktaFor(s.checklistId);
    expect(etter.aktivPosisjon).toBe(1);              // hoppet over orienteres-ledд 2
    expect(etter.recipientUserId).toBe(s.A_registrator);
    expect(etter.retning).toBe("tilbake");
  });

  it("Trekk tilbake (received→draft) = avsenderleddet (§2.4), IKKE ball-holderen; lander på avsenderledд + retning tilbake", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId); // A (Ledд 1) sender → ball @2 (B, mottaker)

    // § 2.4: ball-holder B (Ledд 2) er IKKE avsenderleddet → kan ikke trekke tilbake.
    const negativ = await feilkode(() =>
      createTestCaller(s.B_bestiller).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "draft" }),
    );
    expect(negativ).toBe("FORBIDDEN");

    // Avsenderleddet A (Ledд 1 = forrigeBallLedд(2)) trekker tilbake → draft, LANDER på ledд 1.
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "draft" });
    const f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(1);  // § 2.4: lander på avsenderleddet (A), IKKE @2
    expect(f.retning).toBe("tilbake"); // trekk-tilbake = retning tilbake
    expect(f.terminal).toBeNull();
    expect(f.sendt).toBe(false);      // Trekk tilbake nullstiller sendt-fakta
    expect(f.status).toBe("draft");   // avledet fra (!sendt)
  });

  it("§ 2.4 REGRESJON (distinkt-person): gjenåpne approved@4 av registrator (Ledд 1) → lander på 1, IKKE 4", async () => {
    const s = await nyttScenario();
    await send(s.A_registrator, s.checklistId); // →2
    await send(s.B_bestiller, s.checklistId);   // →3
    await send(s.C_utforer, s.checklistId);     // →4
    await createTestCaller(s.D_godkjenner).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "approved" });
    const term = await faktaFor(s.checklistId);
    expect(term.terminal).toBe("godkjent");
    expect(term.aktivPosisjon).toBe(4);

    // Registrator A (Ledд 1, medlem — § 2.4 gjenåpne-rett) gjenåpner. Landing = åpnerens eget ledд.
    // Med DISTINKTE personer (A ≠ D) lander det på 1, ikke terminal-posisjon 4 (den systematiske buggen).
    await createTestCaller(s.A_registrator).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "draft" });
    const f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(1);  // §2.4 regel 1: åpnerens eget ledд — IKKE 4
    expect(f.terminal).toBeNull();
    // Pilot-fiks D + #11 (bevis-09): et gjenåpnet dok HAR forlatt ledд 1 → sendt=true → «Hos 1»,
    // IKKE «Utkast» (var tidligere sendt=false/draft = KB2-010-buggen). aktivPosisjon uendret av D.
    expect(f.sendt).toBe(true);
    expect(f.status).toBe("received");
  });

  it("Bestiller sist (Fase 3.6-fixture): Send-kjede når siste ledд; nesteLedd(siste)=null ⇒ Godkjenn og fullfør (E2 no-op)", async () => {
    const s = await seedBestillerSist();
    oppryddingBS.push(s);
    // Send-kjede 1→2→3 (bestiller sist er siste ledд).
    await send(s.reg, s.checklistId);       // 1→2 (utfører)
    let f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(2);
    expect(f.recipientUserId).toBe(s.utforer);

    await send(s.utforer, s.checklistId);   // 2→3 (bestiller sist)
    f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(3);
    expect(f.recipientUserId).toBe(s.bestillerSist);

    // Send fra SISTE ledд (3): nesteLedd(3)=null → E2 no-op-flytt (posisjon + mottaker uendret,
    // INGEN auto-terminal). «Godkjenn og fullfør» er en egen approved-handling.
    await send(s.bestillerSist, s.checklistId);
    f = await faktaFor(s.checklistId);
    expect(f.aktivPosisjon).toBe(3);        // uendret (ingen ledд etter)
    expect(f.terminal).toBeNull();          // ingen auto-terminal fra Send (E2)
    expect(f.recipientUserId).toBe(s.bestillerSist);

    // Godkjenn og fullfør = approved fra siste ledд → terminal.
    await createTestCaller(s.bestillerSist).sjekkliste.endreStatus({ id: s.checklistId, nyStatus: "approved" });
    f = await faktaFor(s.checklistId);
    expect(f.terminal).toBe("godkjent");
    expect(f.status).toBe("approved");
  });
});
