/**
 * Flytmodell Fase 5a — test-harness (tRPC-caller mot ekte DB).
 *
 * Bygger en `Context` for `appRouter.createCaller(ctx)` slik at integrasjonstesten
 * kan kjøre `endreStatus` (ruting + authz + fakta + avledStatus) gjennom HELE tRPC-
 * laget, ikke bare ren-funksjon. Én caller per handlende person (varier `userId`).
 *
 * KUN test-kode. Ingen produksjonskode røres. Middleware-hensyn:
 *  - `mobilTokenRotasjon` early-returner (tokenKilde=null, ikke "bearer").
 *  - rate-limit-middleware kjører på mutations (in-memory, ufarlig); logger kun ved
 *    treff → `req.log` er stubbet med no-ops.
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { lagContextStamme } from "../trpc/context";
import { appRouter } from "../trpc/router";

/** Minimal Fastify-request-stubb: kun `.log` + `.headers` berøres av middleware. */
function stubReq(): FastifyRequest {
  const noop = () => undefined;
  return {
    headers: {},
    log: { info: noop, warn: noop, error: noop, debug: noop, trace: noop, fatal: noop },
  } as unknown as FastifyRequest;
}

/** Bygg en autentisert Context for en gitt bruker (som om innlogget). */
export function buildTestContext(userId: string) {
  return {
    ...lagContextStamme({
      userId,
      actualUserId: userId,
      imperseringAktiv: false,
      sessionToken: null,
      tokenKilde: null,
    }),
    req: stubReq(),
    res: {} as unknown as FastifyReply,
  };
}

/** tRPC-caller som handler SOM `userId` (ekte authz + ruting kjøres). */
export function createTestCaller(userId: string): ReturnType<typeof appRouter.createCaller> {
  return appRouter.createCaller(buildTestContext(userId));
}
