import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import Fastify from "fastify";
import compress from "@fastify/compress";
import fastifyStatic from "@fastify/static";

/**
 * RETUR 5 (Kontrollør-gate `e08784f0`): default-regexen i `@fastify/compress`
 * komprimerer IKKE `image/vnd.dxf` (ingen `compressible`-flagg i mime-db for
 * typen `.dxf` mapper til). Denne testen bygger en isolert Fastify-instans med
 * EKSAKT samme `compress`-registrering som `server.ts` (customTypes-regexen
 * kopiert, ikke importert — server.ts har ingen eksportert byggefunksjon) og
 * en `@fastify/static`-rute som serverer en ekte `.dxf`-fil, slik at typen
 * kommer fra `mime`-oppslag akkurat som i prod — ikke en hardkodet header.
 *
 * Verifiserer også at `text/event-stream` (SSE) fortsatt er unntatt, og at en
 * allerede komprimert type (`image/png`) ikke rammes — ingen regresjon på de
 * to andre tingene Kontrollør målte som trygge.
 */
const uploadsDir = mkdtempSync(join(tmpdir(), "sitedoc-dxf-komprimering-"));
// Komprimerbar ASCII-tekst, over 1024 B-terskelen til @fastify/compress.
writeFileSync(join(uploadsDir, "stor.dxf"), "0\nSECTION\n2\nHEADER\n".repeat(200));

async function byggTestserver() {
  const server = Fastify();
  await server.register(compress, {
    global: true,
    encodings: ["br", "gzip"],
    customTypes:
      /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)|^image\/vnd\.dxf(?:;|$)/u,
  });
  await server.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/" });
  server.get("/sse", async (_req, reply) => {
    reply.header("Content-Type", "text/event-stream");
    return reply.send("data: hei\n\n");
  });
  server.get("/bilde.png", async (_req, reply) => {
    reply.header("Content-Type", "image/png");
    // Komprimerbar innhold (repeterende bytes) — om compress rørte typen, ville
    // den likevel fått content-encoding. Testen beviser at TYPEN stopper det.
    return reply.send(Buffer.alloc(2000, 0));
  });
  await server.ready();
  return server;
}

afterAll(() => {
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe("komprimering av /uploads/*.dxf (RETUR 5)", () => {
  it("en .dxf-respons får content-encoding når klienten godtar br/gzip", async () => {
    const server = await byggTestserver();
    const res = await server.inject({
      method: "GET",
      url: "/uploads/stor.dxf",
      headers: { "accept-encoding": "br, gzip" },
    });
    expect(res.headers["content-type"]).toContain("image/vnd.dxf");
    expect(res.headers["content-encoding"]).toBeDefined();
    await server.close();
  });

  it("text/event-stream (SSE) komprimeres ALDRI, selv med customTypes", async () => {
    const server = await byggTestserver();
    const res = await server.inject({
      method: "GET",
      url: "/sse",
      headers: { "accept-encoding": "br, gzip" },
    });
    expect(res.headers["content-encoding"]).toBeUndefined();
    await server.close();
  });

  it("image/png (alt komprimert format) rammes ikke av DXF-utvidelsen", async () => {
    const server = await byggTestserver();
    const res = await server.inject({
      method: "GET",
      url: "/bilde.png",
      headers: { "accept-encoding": "br, gzip" },
    });
    expect(res.headers["content-encoding"]).toBeUndefined();
    await server.close();
  });
});
