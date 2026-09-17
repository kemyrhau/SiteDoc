import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { prismaMaskin } from "@sitedoc/db-maskin";
import { maskinRouter } from "./index";
import { beregnServiceVarsel } from "../../services/maskin";

/**
 * Service pr. timetall — «stille tomhet» krav (c), ordre 2026-09-18.
 *
 * SETT RØD FØRST: fjern fremskrivings-linja i service.ts (nesteServiceTimer = ...)
 * og denne testen faller — Equipment.nesteServiceTimer blir NULL, og en maskin som
 * HAR intervall + driftstimer over terskelen gir da INGEN varsel. Det er nettopp
 * det systemet skal fange: en tom kolonne der det skal stå verdi.
 *
 * Går gjennom prosedyren (createCaller), ikke rett mot DB. Mål-DB: localhost/CI.
 */

const ids = {
  adminUserId: "",
  orgId: "",
  equipmentId: "",
};

function ctx(userId: string) {
  return {
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    prismaMaskin,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeAll(async () => {
  const admin = await prisma.user.create({
    data: {
      email: "service-timetall-admin@sitedoc.test",
      name: "Service-timetall admin",
      role: "sitedoc_admin",
    },
  });
  ids.adminUserId = admin.id;

  const org = await prisma.organization.create({
    data: { name: "Test-firma service-timetall" },
  });
  ids.orgId = org.id;

  // Maskin med intervall satt (250 t) og en startavlesning på 900 driftstimer.
  const eq = await prismaMaskin.equipment.create({
    data: {
      organizationId: org.id,
      kategori: "anleggsmaskin",
      type: "gravemaskin",
      driftstimer: 900,
      serviceIntervallTimer: 250,
    },
  });
  ids.equipmentId = eq.id;
});

afterAll(async () => {
  await prismaMaskin.serviceRecord.deleteMany({ where: { equipmentId: ids.equipmentId } });
  await prismaMaskin.equipment.deleteMany({ where: { organizationId: ids.orgId } });
  await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  await prisma.user.deleteMany({ where: { id: ids.adminUserId } });
});

describe("registrerService — fremskriving + varsel (krav c)", () => {
  it("framskriver neste service til Equipment og gir forfalt-varsel når driftstimer passerer den", async () => {
    const caller = maskinRouter.createCaller(ctx(ids.adminUserId));

    // Registrer service avlest ved 1000 driftstimer → neste = 1000 + 250 = 1250.
    const record = await caller.service.registrerService({
      equipmentId: ids.equipmentId,
      dato: "2026-09-18",
      timer: 1000,
      beskrivelse: "Oljeskift og filter",
      utfortAv: "Verksted AS",
    });

    // Record bærer historikken.
    expect(record.nesteServiceTimer).toBe(1250);

    // Equipment bærer gjeldende tilstand (denormalisert) + bumpet driftstimer.
    const eq = await prismaMaskin.equipment.findUniqueOrThrow({
      where: { id: ids.equipmentId },
    });
    expect(eq.nesteServiceTimer).toBe(1250); // ← NULL hvis fremskrivingen fjernes → testen faller
    expect(eq.driftstimer).toBe(1000);

    // En maskin som HAR intervall og driftstimer OVER terskelen MÅ gi varsel.
    // Simuler at maskinen har gått videre til 1300 driftstimer.
    await prismaMaskin.equipment.update({
      where: { id: ids.equipmentId },
      data: { driftstimer: 1300 },
    });
    const oppdatert = await prismaMaskin.equipment.findUniqueOrThrow({
      where: { id: ids.equipmentId },
    });
    const varsel = beregnServiceVarsel(
      oppdatert.driftstimer,
      oppdatert.nesteServiceTimer,
    );
    expect(varsel).not.toBeNull();
    expect(varsel?.status).toBe("forfalt");
  });

  it("CHECK-constraint avviser meningsløst intervall (0)", async () => {
    await expect(
      prismaMaskin.equipment.create({
        data: {
          organizationId: ids.orgId,
          kategori: "anleggsmaskin",
          type: "hjullaster",
          serviceIntervallTimer: 0,
        },
      }),
    ).rejects.toThrow();
  });
});
