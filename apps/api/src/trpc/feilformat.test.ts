import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Prisma } from "@sitedoc/db";
import { router, publicProcedure } from "./trpc";
import { formaterFeil, loggTrpcFeil, FEILTEKST } from "./feilformat";
import type { Context } from "./context";

/**
 * ERRFMT (orkestrator 2026-11-11): rå Prisma-tekst skal aldri nå brukeren.
 * Rød før fiksen: P2025 kom ut som INTERNAL/500 med «No Checklist found»/«Invalid `prisma…`».
 * Integrasjonstestene går gjennom EKTE `router`/`publicProcedure` fra trpc.ts og
 * `fetchRequestHandler`, så de blir røde om formatteren kobles fra i trpc.ts.
 */

const RÅ_P2025 =
  "Invalid `prisma.checklist.findUniqueOrThrow()` invocation:\n\nNo Checklist found";

function prismaFeil(code: string, melding = `Rå Prisma-tekst for ${code} i tabellen \`Checklist\``) {
  return new Prisma.PrismaClientKnownRequestError(melding, {
    code,
    clientVersion: "6",
    meta: { modelName: "Checklist" },
  });
}

/** Simulerer en annen generert klient (Timer/Varelager): samme navn, annen klasse. */
class AnnenKlientFeil extends Error {
  code = "P2025";
  constructor() {
    super("No Vareforbruk found");
    this.name = "PrismaClientKnownRequestError";
  }
}

const appRouter = router({
  p2025: publicProcedure.query(() => {
    throw prismaFeil("P2025", RÅ_P2025);
  }),
  p2002: publicProcedure.mutation(() => {
    throw prismaFeil("P2002", "Unique constraint failed on the fields: (`name`)");
  }),
  p2003: publicProcedure.mutation(() => {
    throw prismaFeil("P2003", "Foreign key constraint violated on the constraint: `Checklist_templateId_fkey`");
  }),
  annenKlient: publicProcedure.query(() => {
    throw new AnnenKlientFeil();
  }),
  validering: publicProcedure.query(() => {
    throw new Prisma.PrismaClientValidationError("Invalid `prisma.task.findMany()` invocation: Unknown arg", {
      clientVersion: "6",
    });
  }),
  ukjent: publicProcedure.query(() => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432 /var/lib/hemmelig");
  }),
  egen: publicProcedure.query(() => {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tegningen mangler originalfil" });
  }),
  egenIntern: publicProcedure.query(() => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Eksporten feilet — prøv igjen senere" });
  }),
  egenMedÅrsak: publicProcedure.query(() => {
    throw new TRPCError({ code: "CONFLICT", message: "Dagsseddelen er allerede godkjent", cause: new Error("rå") });
  }),
});

async function kall(sti: string, metode: "GET" | "POST" = "GET", nodeEnv = "production") {
  const forrige = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  const log = { warn: vi.fn(), error: vi.fn() };
  try {
    const res = await fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request(`http://x/trpc/${sti}${metode === "GET" ? "?input=%7B%7D" : ""}`, {
        method: metode,
        body: metode === "POST" ? "{}" : undefined,
        headers: metode === "POST" ? { "content-type": "application/json" } : undefined,
      }),
      router: appRouter,
      createContext: () => ({}) as Context,
      onError: ({ error, path }) => loggTrpcFeil(log, error, path),
    });
    const body = (await res.json()) as {
      error: { message: string; code: number; data: { code: string; httpStatus: number; stack?: string; feilKode?: string } };
    };
    return { status: res.status, feil: body.error, log };
  } finally {
    process.env.NODE_ENV = forrige;
  }
}

describe("ERRFMT — Prisma-feil gjennom ekte tRPC-oppsett", () => {
  it("🔴 P2025 → NOT_FOUND/404, ingen Prisma-tekst, original logget", async () => {
    const { status, feil, log } = await kall("p2025");
    expect(status).toBe(404);
    expect(feil.data.code).toBe("NOT_FOUND");
    expect(feil.data.feilKode).toBe("IKKE_FUNNET");
    expect(feil.message).toBe(FEILTEKST.IKKE_FUNNET);
    expect(JSON.stringify(feil)).not.toMatch(/prisma|checklist|findUnique|invocation/i);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const obj = log.warn.mock.calls[0]?.[0];
    expect(obj.err.message).toBe(RÅ_P2025);
    expect(obj).toMatchObject({ prismaKode: "P2025", modell: "Checklist", path: "p2025" });
  });

  it("🔴 P2025 i dev er også oversatt (Prisma-tekst når aldri brukerens melding)", async () => {
    const { status, feil } = await kall("p2025", "GET", "development");
    expect(status).toBe(404);
    expect(feil.message).toBe(FEILTEKST.IKKE_FUNNET);
  });

  it("🔴 P2002 → CONFLICT/409 med nøytral tekst", async () => {
    const { status, feil } = await kall("p2002", "POST");
    expect(status).toBe(409);
    expect(feil.data.code).toBe("CONFLICT");
    expect(feil.message).toBe(FEILTEKST.FINNES_ALLEREDE);
    expect(JSON.stringify(feil)).not.toMatch(/prisma|constraint|unique/i);
  });

  it("🔴 P2003 → CONFLICT/409 med tekst som passer både slett og opprett", async () => {
    const { status, feil } = await kall("p2003", "POST");
    expect(status).toBe(409);
    expect(feil.data.feilKode).toBe("HENGER_SAMMEN");
    expect(feil.message).toBe(FEILTEKST.HENGER_SAMMEN);
    expect(JSON.stringify(feil)).not.toMatch(/prisma|foreign|fkey|constraint/i);
  });

  it("🔴 Prisma-feil fra annen generert klient (Timer/Varelager) kjennes igjen på navn", async () => {
    const { status, feil } = await kall("annenKlient");
    expect(status).toBe(404);
    expect(feil.message).not.toMatch(/Vareforbruk/);
  });

  it("🔴 PrismaClientValidationError (spørringstekst) → generisk INTERNAL/500", async () => {
    const { status, feil, log } = await kall("validering");
    expect(status).toBe(500);
    expect(feil.message).toBe(FEILTEKST.INTERN);
    expect(JSON.stringify(feil)).not.toMatch(/prisma|findMany|invocation/i);
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});

describe("ERRFMT — ukjente feil", () => {
  it("🔴 prod: generisk melding, ingen stack, original logget", async () => {
    const { status, feil, log } = await kall("ukjent");
    expect(status).toBe(500);
    expect(feil.message).toBe(FEILTEKST.INTERN);
    expect(feil.data.stack).toBeUndefined();
    expect(JSON.stringify(feil)).not.toMatch(/ECONNREFUSED|hemmelig/);
    expect(log.error.mock.calls[0]?.[0].err.message).toMatch(/ECONNREFUSED/);
  });

  it("dev: beholder detaljer for feilsøking", async () => {
    const { feil } = await kall("ukjent", "GET", "development");
    expect(feil.message).toMatch(/ECONNREFUSED/);
    expect(feil.data.stack).toBeDefined();
  });
});

describe("ERRFMT — egne TRPCError slipper uendret", () => {
  it("NOT_FOUND med egen melding — uendret, ingen feilKode, ikke logget", async () => {
    const { status, feil, log } = await kall("egen");
    expect(status).toBe(404);
    expect(feil.message).toBe("Tegningen mangler originalfil");
    expect(feil.data.feilKode).toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("INTERNAL med egen melding — meldingen beholdes også i prod", async () => {
    const { status, feil } = await kall("egenIntern");
    expect(status).toBe(500);
    expect(feil.message).toBe("Eksporten feilet — prøv igjen senere");
  });

  it("egen feil med cause — egen melding beholdes", async () => {
    const { status, feil } = await kall("egenMedÅrsak");
    expect(status).toBe(409);
    expect(feil.message).toBe("Dagsseddelen er allerede godkjent");
  });
});

describe("formaterFeil — ren funksjon", () => {
  const shape = {
    message: "x",
    code: -32603 as const,
    data: { code: "INTERNAL_SERVER_ERROR" as const, httpStatus: 500, path: "a.b", stack: "s" },
  };

  it("Zod/BAD_REQUEST med cause slipper uendret (input-validering)", () => {
    const zodLik = new Error('[{"code":"invalid_type"}]');
    const error = new TRPCError({ code: "BAD_REQUEST", cause: zodLik });
    const bad = { ...shape, message: error.message, code: -32600 as const, data: { ...shape.data, code: "BAD_REQUEST" as const, httpStatus: 400 } };
    expect(formaterFeil({ shape: bad, error }, true)).toBe(bad);
  });

  it("path beholdes ved oversettelse", () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: prismaFeil("P2025") });
    expect(formaterFeil({ shape, error }, true).data.path).toBe("a.b");
  });
});
