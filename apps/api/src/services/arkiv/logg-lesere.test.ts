import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@sitedoc/db";
import { lesHendelseslogg, lesEndringslogg } from "./logg-lesere";

/**
 * Leser-mapping. Leserne tar `prisma` som parameter (dependency-injected) →
 * ingen modul-mock; vi mater en fake med akkurat metodene som brukes.
 */

describe("lesHendelseslogg", () => {
  it("mapper DocumentTransfer → HendelseRad med avledet handling + mottakernavn", async () => {
    const prisma = {
      documentTransfer: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-10T10:00:00.000Z"),
            sender: { name: "Ola" },
            recipientUser: { name: "Kari" },
            recipientGroup: null,
            recipientEnterpriseName: null,
            senderRolle: "bestiller",
            fromStatus: "draft",
            toStatus: "sent",
            comment: "vær så god",
            dokumentflytName: "Standardflyt",
          },
        ]),
      },
    } as unknown as PrismaClient;

    const rader = await lesHendelseslogg(prisma, { checklistId: "c1" });
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({
      aktor: "Ola",
      aktorRolle: "bestiller",
      handling: "Sendt",
      til: "Kari",
      flyt: "Standardflyt",
      kommentar: "vær så god",
      kilde: "transfer",
      antallFeltendringer: 0,
    });
  });

  it("faller til gruppenavn, så firma-snapshot, når bruker-mottaker mangler", async () => {
    const prisma = {
      documentTransfer: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-10T10:00:00.000Z"),
            sender: { name: "Ola" },
            recipientUser: null,
            recipientGroup: { name: "HE-Ansatte" },
            recipientEnterpriseName: "Firma AS",
            senderRolle: null,
            fromStatus: "sent",
            toStatus: "received",
            comment: null,
            dokumentflytName: null,
          },
        ]),
      },
    } as unknown as PrismaClient;

    const rader = await lesHendelseslogg(prisma, { checklistId: "c1" });
    expect(rader[0]!.til).toBe("HE-Ansatte");
    expect(rader[0]!.handling).toBe("Mottatt");
  });

  it("oppgave: fletter inn TaskComment som kilde 'kommentar', sortert kronologisk", async () => {
    const prisma = {
      documentTransfer: {
        findMany: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-08-10T10:00:00.000Z"),
            sender: { name: "Ola" },
            recipientUser: { name: "Kari" },
            recipientGroup: null,
            recipientEnterpriseName: null,
            senderRolle: null,
            fromStatus: "draft",
            toStatus: "sent",
            comment: null,
            dokumentflytName: null,
          },
        ]),
      },
      taskComment: {
        findMany: vi.fn().mockResolvedValue([
          { createdAt: new Date("2026-08-10T09:00:00.000Z"), user: { name: "Per" }, content: "notat før" },
          { createdAt: new Date("2026-08-10T11:00:00.000Z"), user: { name: "Per" }, content: "notat etter" },
        ]),
      },
    } as unknown as PrismaClient;

    const rader = await lesHendelseslogg(prisma, { taskId: "t1" });
    expect(rader.map((r) => r.tidspunkt)).toEqual([
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T10:00:00.000Z",
      "2026-08-10T11:00:00.000Z",
    ]);
    expect(rader[0]).toMatchObject({ kilde: "kommentar", handling: "Kommentar", aktor: "Per" });
    expect(rader[1]!.kilde).toBe("transfer");
  });
});

describe("lesEndringslogg — gatet på enableChangeLog", () => {
  it("enableChangeLog=false → [] uten å spørre DB", async () => {
    const findMany = vi.fn();
    const prisma = { checklistChangeLog: { findMany } } as unknown as PrismaClient;
    const ut = await lesEndringslogg(prisma, { checklistId: "c1" }, false);
    expect(ut).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("enableChangeLog=true → mapper feltdiff til RåEndring", async () => {
    const prisma = {
      checklistChangeLog: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: "u1",
            user: { name: "Ola" },
            createdAt: new Date("2026-08-10T10:00:00.000Z"),
            fieldLabel: "Målt verdi",
            oldValue: "3",
            newValue: "5",
          },
        ]),
      },
    } as unknown as PrismaClient;

    const ut = await lesEndringslogg(prisma, { checklistId: "c1" }, true);
    expect(ut[0]).toEqual({
      userId: "u1",
      aktor: "Ola",
      tidspunkt: "2026-08-10T10:00:00.000Z",
      felt: "Målt verdi",
      fraVerdi: "3",
      tilVerdi: "5",
    });
  });
});
