import Fastify from "fastify";
import cors from "@fastify/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { healthRoute } from "./routes/health";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

const server = Fastify({
  logger: true,
});

async function start() {
  await server.register(cors, {
    origin: true,
  });

  // Helsesjekk
  await server.register(healthRoute);

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
    server.log.info(`SiteFlow API kjører på http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
