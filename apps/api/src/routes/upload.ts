import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { prisma } from "@sitedoc/db";
import { sjekkRateLimit } from "../utils/rateLimiter";

const UPLOADS_DIR = join(process.cwd(), "uploads");

const TILLATTE_TYPER = new Set([
  ".pdf",
  ".dwg",
  ".dxf",
  ".ifc",
  ".png",
  ".jpg",
  ".jpeg",
  ".las",
  ".laz",
  ".e57",
  ".ply",
]);

export async function uploadRoute(server: FastifyInstance) {
  // Sørg for at uploads-mappen eksisterer
  await mkdir(UPLOADS_DIR, { recursive: true });

  server.post("/upload", async (req, reply) => {
    // Autentisering: verifiser sesjonstoken fra cookie eller Authorization-header
    const cookieHeader = req.headers.cookie ?? "";
    const sessionTokenMatch = cookieHeader.match(
      /(?:__Secure-)?authjs\.session-token=([^;]+)/,
    );
    const sessionToken =
      sessionTokenMatch?.[1] ??
      req.headers.authorization?.replace("Bearer ", "") ??
      null;

    if (!sessionToken) {
      return reply.status(401).send({ error: "Autentisering kreves" });
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      select: { userId: true, expires: true },
    });

    if (!session || session.expires <= new Date()) {
      return reply.status(401).send({ error: "Autentisering kreves" });
    }

    const ip = req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? "unknown";
    if (!sjekkRateLimit("upload", ip, 30, 60 * 1000)) {
      return reply.status(429).send({ error: "For mange opplastinger. Prøv igjen senere." });
    }

    const data = await req.file();

    if (!data) {
      return reply.status(400).send({ error: "Ingen fil mottatt" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!TILLATTE_TYPER.has(ext)) {
      return reply.status(400).send({
        error: `Ugyldig filtype: ${ext}. Tillatte typer: ${[...TILLATTE_TYPER].join(", ")}`,
      });
    }

    const uuid = randomUUID();
    const filnavn = `${uuid}${ext}`;
    const filsti = join(UPLOADS_DIR, filnavn);

    await pipeline(data.file, createWriteStream(filsti));

    // Sjekk om filen ble avbrutt (overskred størrelsesgrense)
    if (data.file.truncated) {
      const { unlink } = await import("fs/promises");
      await unlink(filsti);
      return reply.status(413).send({ error: "Filen er for stor (maks 500 MB)" });
    }

    return reply.send({
      fileUrl: `/uploads/${filnavn}`,
      fileName: data.filename,
      fileType: ext.replace(".", ""),
      fileSize: data.file.bytesRead,
    });
  });
}
