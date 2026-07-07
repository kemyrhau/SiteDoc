import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "crypto";
import { prisma } from "@sitedoc/db";

/**
 * Dev-bypass-innlogging for mobil-simulator + agent-testing. Plain Fastify-route.
 *
 * Aktiv kun når (fail-secure whitelist):
 *   - NODE_ENV === "development"          (lokal `pnpm dev`)
 *   - ELLER ENABLE_DEV_LOGIN === "true"   (eksplisitt opt-in på test-server)
 * Prod (NODE_ENV=production, uten ENABLE_DEV_LOGIN) monterer aldri routen → 404.
 * Det er den avgjørende grensen: ingen credential-vei til en prod-sesjon finnes.
 *
 * Nivå B-herding (agent-testing):
 *   - Epost må stå i WHITELIST (ingen vilkårlig bruker).
 *   - På test-server (ENABLE_DEV_LOGIN) kreves `x-dev-login-secret`-header lik
 *     env `DEV_LOGIN_SECRET` → hindrer åpen session-minting på test-nettet.
 *     Fail-secure: mangler secret i env, nektes alle kall.
 *   - Lokal `NODE_ENV=development` (localhost) krever ikke secret.
 *
 * Plassert på Fastify (api) framfor Next (web): mobilen treffer allerede
 * api-test.sitedoc.no, og test.sitedoc.no har WAF-regler som blokkerer Expo.
 */

const WHITELIST = new Set([
  "test-admin@sitedoc.test", // sitedoc_admin
  "test-firma@sitedoc.test", // company_admin
  "test-arbeider@sitedoc.test", // user uten manage_field
  "kemyrhau@gmail.com", // legacy dev-bruker (bakoverkompat)
]);

const STANDARD_EPOST = "test-admin@sitedoc.test";

export function erDevLoginAktiv(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.ENABLE_DEV_LOGIN === "true") return true;
  return false;
}

function secretOk(req: FastifyRequest): boolean {
  // Lokal dev (localhost): ingen secret nødvendig.
  if (process.env.NODE_ENV === "development") return true;
  // Test-server: krev secret. Fail-secure hvis env-secret mangler.
  const forventet = process.env.DEV_LOGIN_SECRET;
  if (!forventet) return false;
  const gitt = req.headers["x-dev-login-secret"];
  return typeof gitt === "string" && gitt === forventet;
}

export async function devLoginRoute(server: FastifyInstance) {
  // GET — diagnose (avslører ikke secret eller om den er satt)
  server.get("/dev-login", async (_req, reply) => {
    return reply.send({
      aktiv: true,
      brukere: [...WHITELIST],
      melding: "POST { email } med x-dev-login-secret-header for session-token",
    });
  });

  // POST — bytt mot session-token for whitelistet testbruker
  server.post("/dev-login", async (req, reply) => {
    if (!secretOk(req)) {
      return reply.status(401).send({ error: "DEV_LOGIN_SECRET_MANGLER_ELLER_FEIL" });
    }

    const body = (req.body ?? {}) as { email?: string };
    const email = body.email ?? STANDARD_EPOST;
    if (!WHITELIST.has(email)) {
      return reply.status(403).send({
        error: "EPOST_IKKE_WHITELISTET",
        melding: `${email} er ikke en godkjent testbruker.`,
      });
    }

    const bruker = await prisma.user.findFirst({
      where: { email, canLogin: true },
      orderBy: { createdAt: "asc" },
    });
    if (!bruker) {
      return reply.status(404).send({
        error: "TEST_BRUKER_MANGLER",
        melding: `Test-bruker ${email} finnes ikke. Kjør seed-testbrukere.ts mot denne DB-en.`,
      });
    }

    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    await prisma.session.create({ data: { sessionToken, userId: bruker.id, expires } });

    return reply.send({
      sessionToken,
      user: { id: bruker.id, name: bruker.name, email: bruker.email, image: bruker.image, role: bruker.role },
    });
  });
}
