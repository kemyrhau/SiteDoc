import { initTRPC, TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import type { Context } from "./context";
import { sjekkRateLimitDetalj } from "../utils/rateLimiter";
import { signerFilSti } from "../utils/hmac";

const t = initTRPC.context<Context>().create();

/**
 * S1 Fase 1 — sentral signering av sensitive fil-URL-er i alle tRPC-svar.
 *
 * Sensitive filer bor under `/uploads/privat/` og serveres signatur-KUN. Denne
 * middlewaren går gjennom responsdata og bytter enhver `/uploads/privat/...`-
 * streng (fileUrl, JSON-vedlegg-url, etc.) med en kortlevd signert variant.
 * authz har allerede skjedd (raden ble kun returnert til noen med tilgang), så
 * signeringen er trygg her — én kilde, ingen per-rute-touch.
 *
 * Non-privat `/uploads/*` røres ikke i Fase 1 (fortsatt åpen; global gate i 1b).
 * Kun rene objekter/arrays traverseres; Date/Buffer og andre klasse-instanser
 * hoppes over.
 */
const PRIVAT_PREFIKS = "/uploads/privat/";

function signerFilerDypt(node: unknown, dybde: number): void {
  if (dybde > 8 || node === null || typeof node !== "object") return;
  if (node instanceof Date || Buffer.isBuffer(node)) return;

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === "string" && v.startsWith(PRIVAT_PREFIKS)) {
        node[i] = signerFilSti(v);
      } else if (v !== null && typeof v === "object") {
        signerFilerDypt(v, dybde + 1);
      }
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === "string" && v.startsWith(PRIVAT_PREFIKS)) {
      obj[key] = signerFilSti(v);
    } else if (v !== null && typeof v === "object") {
      signerFilerDypt(v, dybde + 1);
    }
  }
}

const filSignering = t.middleware(async ({ next }) => {
  const resultat = await next();
  if (resultat.ok) {
    signerFilerDypt(resultat.data, 0);
  }
  return resultat;
});

// H1 mobil-token-rotasjon: roter Session.sessionToken hvis lastRotatedAt
// er eldre enn dette antall millisekunder. 7 dager = audit-anbefaling.
const TOKEN_ROTASJON_TERSKEL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_LEVETID_MS = 30 * 24 * 60 * 60 * 1000;

export const router = t.router;

// Base-prosedyre med sentral fil-signering (S1 Fase 1) — alle svar går gjennom
// den, så sensitive `/uploads/privat/`-URL-er signeres på ett sted.
const baseProcedure = t.procedure.use(filSignering);

export const publicProcedure = baseProcedure;

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
 * H1 mobil-token-rotasjon (sikkerhets-audit 2026-05-27).
 *
 * Kjører på protectedProcedure ETTER handler. Roterer Session.sessionToken
 * hvis ALLE betingelser er sanne:
 * - tokenKilde === "bearer" (mobil; web-cookie eies av Auth.js)
 * - type === "mutation" (queries roterer ikke — for hyppig)
 * - ctx.sessionToken er satt
 * - session.lastRotatedAt < now - 7 dager
 *
 * Race-vern: UPDATE-statement har `WHERE session_token = oldToken` slik at
 * parallelle mutations som begge prøver å rotere, kun én lykkes (idempotent).
 *
 * Nytt token formidles til klient via X-Session-Token respons-header (satt
 * av responseMeta i server.ts).
 */
const mobilTokenRotasjon = t.middleware(async ({ ctx, type, next }) => {
  const resultat = await next();

  if (type !== "mutation") return resultat;
  if (ctx.tokenKilde !== "bearer") return resultat;
  if (!ctx.sessionToken) return resultat;

  try {
    const session = await ctx.prisma.session.findUnique({
      where: { sessionToken: ctx.sessionToken },
      select: { id: true, lastRotatedAt: true },
    });

    if (!session) return resultat;

    const alder = Date.now() - session.lastRotatedAt.getTime();
    if (alder < TOKEN_ROTASJON_TERSKEL_MS) return resultat;

    const nyttToken = randomBytes(32).toString("hex");
    const nyExpires = new Date(Date.now() + TOKEN_LEVETID_MS);

    const oppdatert = await ctx.prisma.session.updateMany({
      where: { id: session.id, sessionToken: ctx.sessionToken },
      data: {
        sessionToken: nyttToken,
        lastRotatedAt: new Date(),
        expires: nyExpires,
      },
    });

    if (oppdatert.count === 1) {
      ctx.nyttSessionTokenForRespons.value = nyttToken;
    }
    // count === 0: parallell mutation rotert allerede — ignorer stille
  } catch (err) {
    // Rotasjons-feil skal aldri velte den faktiske handler-responsen
    ctx.req.log.warn({ err }, "mobil-token-rotasjon feilet");
  }

  return resultat;
});

/**
 * Beskyttet prosedyre — krever bruker-ID i kontekst.
 * Inkluderer standard rate-limit (100 mutations/min per userId) som
 * automatisk hopper over queries. Brukes for alle endepunkter som
 * krever innlogging.
 */
export const protectedProcedure = baseProcedure
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
  .use(standardRateLimit)
  .use(mobilTokenRotasjon);

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
