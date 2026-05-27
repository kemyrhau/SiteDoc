import { join } from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { healthRoute } from "./routes/health";
import { uploadRoute } from "./routes/upload";
import { prosesserRoute } from "./routes/prosesser";
import { devLoginRoute, erDevLoginAktiv } from "./routes/dev-login";
import { registrerWebSocket } from "./routes/ws";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

const server = Fastify({
  // Fastify mottar requests via Cloudflare Tunnel → cloudflared. cloudflared
  // proxy-er ikke via 127.0.0.1 i prod/test pga WSL2 Mirror Mode — den
  // treffer Fastify via Windows-vertens IP (193.90.181.205). Eksplisitt
  // allowlist ville måtte oppdateres ved infra-endringer, så vi stoler på
  // X-Forwarded-For uansett. Trygt fordi Fastify ALDRI eksponeres direkte —
  // alltid bak cloudflared. Operasjonell merknad: ved fremtidig direkte-
  // eksponering (Tailscale, midlertidig debug) må trustProxy strammes igjen.
  trustProxy: true,
  logger: {
    redact: ["req.headers.authorization", "req.headers.cookie"],
    // Logg ekte klient-IP fra cf-connecting-ip (satt av cloudflared, blokkert
    // mot spoofing av Cloudflare). req.ip viser server-WAN-IP gjennom WSL2
    // Mirror Mode + cloudflared, ikke faktisk klient. Speiler hentKlientIp i
    // utils/rateLimiter.ts — rate-limit og logger må enes om kilde.
    serializers: {
      req: (req) => {
        const cf = req.headers?.["cf-connecting-ip"];
        const klientIp = typeof cf === "string" && cf.length > 0 ? cf : req.ip;
        return {
          method: req.method,
          url: req.url,
          host: req.headers?.host,
          remoteAddress: klientIp,
          remotePort: req.socket?.remotePort,
        };
      },
    },
  },
});

async function start() {
  const TILLATTE_ORIGINS = new Set([
    "https://sitedoc.no",
    "https://test.sitedoc.no",
    "http://localhost:3100",
    "http://localhost:3300",
    "http://localhost:3000",
  ]);

  await server.register(cors, {
    origin: (origin, cb) => {
      // Ingen Origin-header (f.eks. server-til-server, curl) → tillat
      if (!origin) return cb(null, true);
      if (TILLATTE_ORIGINS.has(origin)) return cb(null, true);
      return cb(new Error("Ikke tillatt av CORS"), false);
    },
    credentials: true,
  });

  // WebSocket for sanntids presence
  await server.register(websocket);
  await registrerWebSocket(server);

  // Multipart filopplasting (maks 500 MB)
  await server.register(multipart, {
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  // Server opplastede filer
  await server.register(fastifyStatic, {
    root: join(process.cwd(), "uploads"),
    prefix: "/uploads/",
    setHeaders: (res) => {
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  });

  // Helsesjekk
  await server.register(healthRoute);

  // Filopplasting
  await server.register(uploadRoute);

  // FTD dokumentprosessering
  await server.register(prosesserRoute);

  // Dev-bypass-innlogging — KUN i dev eller når eksplisitt enabled på test
  if (erDevLoginAktiv()) {
    await server.register(devLoginRoute);
    server.log.info("[DEV-LOGIN] Aktiv — POST /dev-login svarer for test-bruker");
  }

  // tRPC-endepunkt via fetch-adapter
  server.all("/trpc/*", async (req, res) => {
    const url = new URL(req.url, `http://${req.hostname}`);

    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
      }),
      router: appRouter,
      createContext: () => createContext({ req, res }),
    });

    const body = await response.text();
    res
      .status(response.status)
      .headers(Object.fromEntries(response.headers.entries()))
      .send(body);
  });

  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
    server.log.info(`SiteDoc API kjører på http://${host}:${port}`);

    // Recovery: sett stuck embedding-chunks tilbake til pending ved oppstart
    try {
      const { prisma } = await import("@sitedoc/db");
      const stuck = await prisma.$executeRaw`UPDATE ftd_document_chunks SET embedding_state = 'pending' WHERE embedding_state = 'processing'`;
      if (stuck > 0) {
        server.log.info(`Embedding recovery: ${stuck} stuck chunks satt tilbake til pending`);
      }

      // Start oversettelsesløkke (prosesserer FtdTranslationJob-køen)
      const { startOversettelsesløkke } = await import("./services/oversettelse-service");
      startOversettelsesløkke(prisma);
    } catch (_e) {
      // Ikke kritisk — ignorer hvis tabellen ikke finnes ennå
    }

    // Start Vegvesen-worker (prosesserer VegvesenKo-køen for manuell + auto-oppdatering)
    try {
      const { prismaMaskin } = await import("@sitedoc/db-maskin");
      const { startVegvesenWorker } = await import("./services/maskin");
      startVegvesenWorker(prismaMaskin);
    } catch (err) {
      server.log.warn({ err }, "Kunne ikke starte Vegvesen-worker — fortsetter uten");
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
