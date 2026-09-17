import { describe, it, expect, vi } from "vitest";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { sendPush } from "./pushVarsel";

/**
 * Enhetstest for sendetjenesten (pushvarsel runde A, krav 3). Ingen DB, ingen ekte Expo:
 * en falsk Expo returnerer tickets vi styrer, og en prisma-stub fanger opp rydding + logg.
 *
 * Beviser: ok → sendt · DeviceNotRegistered → token ryddet · andre feil → IKKE ryddet ·
 * ugyldig format → aldri sendt · aktør-kontekst → activity_log-rad (krav 5).
 */

const TOK_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const TOK_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";

// En Expo-dobbel: chunker som ekte (én chunk her), returnerer forhåndssatte tickets i rekkefølge.
function fakeExpo(tickets: ExpoPushTicket[]): Expo {
  return {
    chunkPushNotifications: (m: ExpoPushMessage[]) => (m.length ? [m] : []),
    sendPushNotificationsAsync: vi.fn(async () => tickets),
  } as unknown as Expo;
}

function fakePrisma(deleteCount = 0) {
  const deleteMany = vi.fn(async (_arg: { where: { token: { in: string[] } } }) => ({ count: deleteCount }));
  const create = vi.fn(async (_arg: { data: Record<string, unknown> }) => ({ id: "x" }));
  return {
    prisma: { pushToken: { deleteMany }, activity: { create } } as never,
    deleteMany,
    create,
  };
}

describe("sendPush", () => {
  it("teller ok-tickets som sendt, uten å rydde noe", async () => {
    const { prisma, deleteMany } = fakePrisma();
    const expo = fakeExpo([
      { status: "ok", id: "r1" },
      { status: "ok", id: "r2" },
    ]);
    const res = await sendPush(
      { tokens: [TOK_A, TOK_B], tittel: "T", kropp: "K" },
      { prisma, expo },
    );
    expect(res.sendt).toBe(2);
    expect(res.feilet).toHaveLength(0);
    expect(res.ryddet).toBe(0);
    expect(deleteMany).not.toHaveBeenCalled(); // ingen døde tokens → ingen rydde-spørring
  });

  it("rydder KUN DeviceNotRegistered-tokens, ikke forbigående feil", async () => {
    const { prisma, deleteMany } = fakePrisma(1);
    const expo = fakeExpo([
      { status: "error", message: "død", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "rate", details: { error: "MessageRateExceeded" } },
    ]);
    const res = await sendPush(
      { tokens: [TOK_A, TOK_B], tittel: "T", kropp: "K" },
      { prisma, expo },
    );
    expect(res.sendt).toBe(0);
    expect(res.feilet).toEqual([
      { token: TOK_A, feil: "DeviceNotRegistered" },
      { token: TOK_B, feil: "MessageRateExceeded" },
    ]);
    // kun det døde tokenet ryddes
    expect(deleteMany).toHaveBeenCalledWith({ where: { token: { in: [TOK_A] } } });
    expect(res.ryddet).toBe(1);
  });

  it("markerer ugyldig-formaterte tokens som feil uten å sende dem", async () => {
    const { prisma } = fakePrisma();
    const send = vi.fn(async (_m: ExpoPushMessage[]) => [{ status: "ok", id: "r1" }] as ExpoPushTicket[]);
    const expo = {
      chunkPushNotifications: (m: ExpoPushMessage[]) => (m.length ? [m] : []),
      sendPushNotificationsAsync: send,
    } as unknown as Expo;
    const res = await sendPush(
      { tokens: ["ikke-et-token", TOK_A], tittel: "T", kropp: "K" },
      { prisma, expo },
    );
    expect(res.feilet).toContainEqual({ token: "ikke-et-token", feil: "UgyldigFormat" });
    expect(res.sendt).toBe(1);
    // kun det gyldige tokenet nådde Expo
    expect(send).toHaveBeenCalledTimes(1);
    const sendteMeldinger = send.mock.calls[0]![0] as ExpoPushMessage[];
    expect(sendteMeldinger).toHaveLength(1);
    expect(sendteMeldinger[0]!.to).toBe(TOK_A);
  });

  it("skriver en activity_log-rad når aktør-kontekst er gitt (krav 5)", async () => {
    const { prisma, create } = fakePrisma();
    const expo = fakeExpo([{ status: "ok", id: "r1" }]);
    await sendPush(
      { tokens: [TOK_A], tittel: "Møte 08:00", kropp: "K", logg: { actorUserId: "u1", organizationId: "o1" } },
      { prisma, expo },
    );
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(arg.data.action).toBe("push.sendt");
    expect(arg.data.targetType).toBe("push");
    expect(arg.data).toMatchObject({ actorUserId: "u1", organizationId: "o1" });
    expect(arg.data.payload).toMatchObject({ antallSendt: 1, antallMottakere: 1, antallFeilet: 0 });
  });

  it("skriver INGEN logg uten aktør-kontekst (tjenesten forblir tynn)", async () => {
    const { prisma, create } = fakePrisma();
    const expo = fakeExpo([{ status: "ok", id: "r1" }]);
    await sendPush({ tokens: [TOK_A], tittel: "T", kropp: "K" }, { prisma, expo });
    expect(create).not.toHaveBeenCalled();
  });
});
