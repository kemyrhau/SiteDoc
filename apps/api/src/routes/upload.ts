import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { createWriteStream } from "fs";
import { mkdir, open, unlink } from "fs/promises";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { prisma } from "@sitedoc/db";
import { sjekkRateLimit, hentKlientIp } from "../utils/rateLimiter";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const PRIVAT_DIR = join(UPLOADS_DIR, "privat");

/**
 * Magic-bytes-sniffing (S1 Fase 1) — forsvar på toppen av extension-blokklista.
 * Blokkerer kjørbare filer selv om filendelsen er forkledd. Leser kun de første
 * bytene av den skrevne filen.
 */
async function erKjorbarMagic(filsti: string): Promise<boolean> {
  let fh: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fh = await open(filsti, "r");
    const buf = Buffer.alloc(8);
    const { bytesRead } = await fh.read(buf, 0, 8, 0);
    if (bytesRead < 2) return false;

    // Windows PE/DOS ("MZ")
    if (buf[0] === 0x4d && buf[1] === 0x5a) return true;
    // Shebang-skript ("#!")
    if (buf[0] === 0x23 && buf[1] === 0x21) return true;
    if (bytesRead >= 4) {
      // ELF (Linux) "\x7fELF"
      if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;
      // Mach-O (macOS) — feed-face-variantene (32/64-bit, begge endianness) + fat
      const m = buf.readUInt32BE(0);
      if (
        m === 0xfeedface || m === 0xfeedfacf || // BE 32/64
        m === 0xcefaedfe || m === 0xcffaedfe || // LE 32/64
        m === 0xcafebabe || m === 0xbebafeca    // universal (fat)
      ) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    await fh?.close();
  }
}

// Blokkerte filtyper — potensielt farlige kjørbare filer
const BLOKKERTE_TYPER = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".sh", ".bash", ".csh", ".ksh",
  ".vbs", ".vbe", ".js", ".jse", ".ws", ".wsf", ".wsc", ".wsh",
  ".ps1", ".psm1", ".psd1",
  ".reg", ".inf", ".lnk",
  ".dll", ".sys", ".drv",
]);

export async function uploadRoute(server: FastifyInstance) {
  // Sørg for at uploads-mappene eksisterer (inkl. privat for sensitive filer)
  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(PRIVAT_DIR, { recursive: true });

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

    const ip = hentKlientIp(req);
    if (!sjekkRateLimit("upload", ip, 30, 60 * 1000)) {
      return reply.status(429).send({ error: "For mange opplastinger. Prøv igjen senere." });
    }

    const data = await req.file();

    if (!data) {
      return reply.status(400).send({ error: "Ingen fil mottatt" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ext || BLOKKERTE_TYPER.has(ext)) {
      return reply.status(400).send({
        error: `Ugyldig filtype: ${ext || "(ingen)"}. Kjørbare filer er ikke tillatt.`,
      });
    }

    // Sensitive filer (kompetanse-sertifikat / timer-kvittering+utlegg /
    // maskin-service) skrives til uploads/privat/ og serveres signatur-KUN.
    // Klienten oppgir ?privat=1. (S1 Fase 1)
    const privat = (req.query as { privat?: string })?.privat === "1";

    const uuid = randomUUID();
    const filnavn = `${uuid}${ext}`;
    const filsti = join(privat ? PRIVAT_DIR : UPLOADS_DIR, filnavn);

    await pipeline(data.file, createWriteStream(filsti));

    // Sjekk om filen ble avbrutt (overskred størrelsesgrense)
    if (data.file.truncated) {
      await unlink(filsti);
      return reply.status(413).send({ error: "Filen er for stor (maks 500 MB)" });
    }

    // Magic-bytes-sniffing: blokkér kjørbare filer med forkledd filendelse.
    if (await erKjorbarMagic(filsti)) {
      await unlink(filsti);
      return reply.status(400).send({
        error: "Filinnholdet er en kjørbar fil og kan ikke lastes opp.",
      });
    }

    return reply.send({
      fileUrl: `/uploads/${privat ? "privat/" : ""}${filnavn}`,
      fileName: data.filename,
      fileType: ext.replace(".", ""),
      fileSize: data.file.bytesRead,
    });
  });
}
