import type { FastifyInstance } from "fastify";

export async function healthRoute(server: FastifyInstance) {
  server.get("/health", async () => {
    return { status: "ok", tidspunkt: new Date().toISOString() };
  });
}
