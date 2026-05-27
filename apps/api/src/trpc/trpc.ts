import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { sjekkRateLimitDetalj } from "../utils/rateLimiter";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Lager en rate-limit-middleware som kun aktiveres på mutations.
 * Queries hopper over (read-only, typisk høyfrekvent og trygg).
 * Logger throttle-hendelser via Fastify request-logger.
 */
function lagRateLimitMiddleware(bucket: string, max: number, windowMs = 60_000) {
  return t.middleware(async ({ ctx, next, path, type }) => {
    if (type !== "mutation") return next();
    if (!ctx.userId) return next(); // Beskyttet av auth-sjekk i prosedyre-laget
    const result = sjekkRateLimitDetalj(bucket, ctx.userId, max, windowMs);
    if (!result.ok) {
      ctx.req.log.info(
        { bucket, userId: ctx.userId, path, retryAfterSeconds: result.retryAfterSeconds },
        "rate-limit hit",
      );
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `For mange forespørsler. Prøv igjen om ${result.retryAfterSeconds}s.`,
      });
    }
    return next();
  });
}

const standardRateLimit = lagRateLimitMiddleware("standard", 100);
const inviteRateLimit = lagRateLimitMiddleware("invite", 10);
const opprettProsjektRateLimit = lagRateLimitMiddleware("opprett-prosjekt", 20);

/**
 * Beskyttet prosedyre — krever bruker-ID i kontekst.
 * Inkluderer standard rate-limit (100 mutations/min per userId) som
 * automatisk hopper over queries. Brukes for alle endepunkter som
 * krever innlogging.
 */
export const protectedProcedure = t.procedure
  .use(async ({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Du må være innlogget for å utføre denne handlingen",
      });
    }
    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    });
  })
  .use(standardRateLimit);

/**
 * Invite-prosedyre — strammere limit for e-post-sending (10/min per userId).
 * Brukes for medlem.inviter og lignende mutations som kan misbrukes til
 * e-postspam. Standard rate-limit (100/min) gjelder også.
 */
export const inviteProcedure = protectedProcedure.use(inviteRateLimit);

/**
 * Opprett-prosjekt-prosedyre — moderat limit (20/min per userId) for
 * mutations som oppretter store entiteter (prosjekt med default-faggrupper,
 * dokumentflyter, maler, byggeplasser). Standard rate-limit gjelder også.
 */
export const opprettProsjektProcedure = protectedProcedure.use(opprettProsjektRateLimit);
