import { join } from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { healthRoute } from "./routes/health";
import { uploadRoute } from "./routes/upload";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

const server = Fastify({
  logger: true,
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

  // Multipart filopplasting (maks 100 MB)
  await server.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 },
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
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
