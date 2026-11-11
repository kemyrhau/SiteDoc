import type { TRPCDefaultErrorShape, TRPCError, TRPC_ERROR_CODE_KEY } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";

/**
 * ERRFMT (orkestrator 2026-11-11) — rå Prisma-tekst skal aldri nå brukeren.
 *
 * tRPC sender `error.message` uendret til klienten. En `findUniqueOrThrow` som ikke
 * finner noe ga derfor «No Checklist found» eller «Invalid `prisma.x.findUniqueOrThrow()`
 * invocation …» rett på skjermen, som INTERNAL/500. Denne formatteren er det ENE stedet
 * som oversetter — de ~246 kallstedene røres ikke.
 *
 * Hvorfor formatter og ikke middleware (målt i @trpc/server 11.10.0): HTTP-statusen leses
 * fra `shape.data.httpStatus` ETTER formatteren (`getHTTPStatusCode`), så formatteren
 * setter kode og status alene. Den fanger også feil fra `createContext` (Prisma-oppslag av
 * sesjonen), som en middleware aldri ser. `createCaller` går utenom — kun server-internt.
 *
 * Prisma-feil kjennes igjen på `name`, ikke `instanceof`: Timer/Varelager har egne
 * genererte klienter (`node_modules/.prisma/*-client`) med egne feilklasser.
 */

/** Stabil kode klienten kan slå opp i i18n (fase 2) og skille fra tRPCs egne NOT_FOUND. */
export type FeilKode = "IKKE_FUNNET" | "FINNES_ALLEREDE" | "HENGER_SAMMEN" | "INTERN";

export const FEILTEKST: Record<FeilKode, string> = {
  IKKE_FUNNET: "Fant ikke det du ba om. Det kan være slettet.",
  FINNES_ALLEREDE: "Dette finnes allerede.",
  // P2003 kommer både ved sletting med barn og ved opprettelse mot noe som mangler.
  HENGER_SAMMEN: "Endringen kan ikke gjøres fordi den henger sammen med andre data.",
  INTERN: "Noe gikk galt. Prøv igjen.",
};

const PRISMA_KODER: Record<string, { feilKode: FeilKode; code: TRPC_ERROR_CODE_KEY; httpStatus: number }> = {
  P2025: { feilKode: "IKKE_FUNNET", code: "NOT_FOUND", httpStatus: 404 },
  P2002: { feilKode: "FINNES_ALLEREDE", code: "CONFLICT", httpStatus: 409 },
  P2003: { feilKode: "HENGER_SAMMEN", code: "CONFLICT", httpStatus: 409 },
};

const INTERN = { feilKode: "INTERN" as const, code: "INTERNAL_SERVER_ERROR" as const, httpStatus: 500 };

type PrismaFeil = Error & { code?: unknown; meta?: { modelName?: unknown } };

function somPrismaFeil(e: unknown): PrismaFeil | null {
  return e instanceof Error && e.name.startsWith("PrismaClient") ? (e as PrismaFeil) : null;
}

export type FeilKlassifisering =
  | { type: "egen" }
  | { type: "prisma"; feil: PrismaFeil; kode: string | null; mapping: (typeof PRISMA_KODER)[string] | typeof INTERN }
  | { type: "ukjent" };

/**
 * - `prisma`: årsaken er en Prisma-feil (uansett hvilken tRPC-kode den ble pakket i).
 * - `ukjent`: INTERNAL uten egen melding — tRPC pakket en vilkårlig feil, så meldingen ER
 *   den rå årsaksteksten (`message === cause.message`).
 * - `egen`: alt annet — vår egen `TRPCError`, også BAD_REQUEST fra Zod. Slipper uendret.
 */
export function klassifiserFeil(error: TRPCError): FeilKlassifisering {
  const prisma = somPrismaFeil(error.cause);
  if (prisma) {
    const kode = typeof prisma.code === "string" ? prisma.code : null;
    return { type: "prisma", feil: prisma, kode, mapping: (kode && PRISMA_KODER[kode]) || INTERN };
  }
  if (error.code === "INTERNAL_SERVER_ERROR" && error.cause && error.message === error.cause.message) {
    return { type: "ukjent" };
  }
  return { type: "egen" };
}

export type FormatertFeil = TRPCDefaultErrorShape & {
  data: TRPCDefaultErrorShape["data"] & { feilKode?: FeilKode };
};

export function formaterFeil(
  { shape, error }: { shape: TRPCDefaultErrorShape; error: TRPCError },
  erProd: boolean = process.env.NODE_ENV === "production",
): FormatertFeil {
  const k = klassifiserFeil(error);
  if (k.type === "egen") return shape;

  const mapping = k.type === "prisma" ? k.mapping : INTERN;
  // Ukjent feil i dev beholder detaljene (krav 3); Prisma-tekst når aldri brukeren.
  if (k.type === "ukjent" && !erProd) return { ...shape, data: { ...shape.data, feilKode: "INTERN" } };

  const data: FormatertFeil["data"] = {
    ...shape.data,
    code: mapping.code,
    httpStatus: mapping.httpStatus,
    feilKode: mapping.feilKode,
  };
  if (erProd) delete data.stack;
  return { ...shape, message: FEILTEKST[mapping.feilKode], code: TRPC_ERROR_CODES_BY_KEY[mapping.code], data };
}

export interface FeilLogger {
  warn: (obj: object, msg: string) => void;
  error: (obj: object, msg: string) => void;
}

/** Kalles fra `onError` i server.ts (Fastify) og web-ruten `app/api/trpc/[...trpc]/route.ts`. Originalen logges — brukeren ser bare den nøytrale teksten. */
export function loggTrpcFeil(log: FeilLogger, error: TRPCError, path: string | undefined): void {
  const k = klassifiserFeil(error);
  if (k.type === "prisma" && k.mapping !== INTERN) {
    log.warn(
      { err: k.feil, prismaKode: k.kode, modell: k.feil.meta?.modelName, path },
      `tRPC ${path ?? "?"}: Prisma ${k.kode} oversatt til ${k.mapping.code}`,
    );
  } else if (k.type !== "egen" || error.code === "INTERNAL_SERVER_ERROR") {
    log.error({ err: error.cause ?? error, path }, `tRPC ${path ?? "?"}: intern feil`);
  }
}
