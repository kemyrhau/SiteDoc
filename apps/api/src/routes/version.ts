import type { FastifyInstance } from "fastify";

// Bygg-stempel: eksponerer hvilken commit + byggtid som kjører. Offentlig og
// ufarlig (kun sha + tid + node-versjon — ALDRI env-dump/secrets). Motivasjon:
// 2-sekunders `curl`-sjekk «er fiksen deployet?» under piloten. GIT_SHA/BUILD_TID
// bakes inn i imaget via build-arg (docker/Dockerfile.api). Mangler de (lokal dev
// uten build-arg) → «dev»/«ukjent», ikke krasj.
export async function versionRoute(server: FastifyInstance) {
  server.get("/version", async () => {
    return {
      gitSha: process.env.GIT_SHA || "dev",
      byggTid: process.env.BUILD_TID || "ukjent",
      node: process.version,
    };
  });
}
