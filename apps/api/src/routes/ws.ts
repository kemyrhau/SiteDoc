/**
 * WebSocket-endepunkt for sanntids presence-varsling.
 * Viser hvem som redigerer hvilket dokument.
 */

import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { prisma } from "@sitedoc/db";
import {
  joinDokument,
  leaveDokument,
  fjernBruker,
  type AktivBruker,
} from "../services/presence";

// Alle tilkoblede klienter: ws → { userId, navn }
const klienter = new Map<WebSocket, { userId: string; navn: string }>();

// Dokumentmedlemskap: documentKey → Set<WebSocket>
const dokumentKlienter = new Map<string, Set<WebSocket>>();

const HEARTBEAT_TIMEOUT = 60_000; // 60s uten heartbeat → disconnect

function lagNøkkel(documentType: string, documentId: string): string {
  return `${documentType}:${documentId}`;
}

function broadcast(documentKey: string, melding: unknown, ekskluder?: WebSocket) {
  const klientSet = dokumentKlienter.get(documentKey);
  if (!klientSet) return;

  const json = JSON.stringify(melding);
  for (const ws of klientSet) {
    if (ws !== ekskluder && ws.readyState === 1) {
      ws.send(json);
    }
  }
}

async function validerToken(token: string): Promise<{ userId: string; navn: string } | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: {
        userId: true,
        expires: true,
        user: { select: { name: true } },
      },
    });

    if (!session || session.expires <= new Date()) return null;

    return {
      userId: session.userId,
      navn: session.user.name ?? "Ukjent",
    };
  } catch {
    return null;
  }
}

export async function registrerWebSocket(server: FastifyInstance) {
  server.get("/ws", { websocket: true }, (socket, req) => {
    const ws = socket as unknown as WebSocket;

    // Auth via query parameter
    const url = new URL(req.url ?? "", `http://${req.hostname}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ type: "error", message: "Mangler token" }));
      ws.close(4001, "Mangler token");
      return;
    }

    // Heartbeat-timer
    let heartbeatTimer: ReturnType<typeof setTimeout>;

    function resetHeartbeat() {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => {
        ws.close(4002, "Heartbeat timeout");
      }, HEARTBEAT_TIMEOUT);
    }

    // Asynkron autentisering
    validerToken(token).then((bruker) => {
      if (!bruker) {
        ws.send(JSON.stringify({ type: "error", message: "Ugyldig token" }));
        ws.close(4001, "Ugyldig token");
        return;
      }

      klienter.set(ws, bruker);
      resetHeartbeat();

      ws.send(JSON.stringify({ type: "connected", userId: bruker.userId }));

      ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
        resetHeartbeat();

        let melding: {
          type: string;
          documentId?: string;
          documentType?: "sjekkliste" | "oppgave";
          projectId?: string;
        };

        try {
          melding = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (melding.type === "heartbeat") {
          return;
        }

        if (melding.type === "join" && melding.documentId && melding.documentType && melding.projectId) {
          const key = lagNøkkel(melding.documentType, melding.documentId);

          // Legg til i dokumentklienter
          let klientSet = dokumentKlienter.get(key);
          if (!klientSet) {
            klientSet = new Set();
            dokumentKlienter.set(key, klientSet);
          }
          klientSet.add(ws);

          // Oppdater presence store
          const brukere = joinDokument(
            melding.documentId,
            melding.documentType,
            melding.projectId,
            { userId: bruker.userId, navn: bruker.navn, tilkobletTid: new Date() },
          );

          // Broadcast til alle i dokumentet (inkludert avsender)
          const presenceMelding = {
            type: "presence",
            documentId: melding.documentId,
            documentType: melding.documentType,
            users: brukere,
          };

          // Send til alle inkludert den som joinet (for å se komplett liste)
          const json = JSON.stringify(presenceMelding);
          for (const client of klientSet) {
            if (client.readyState === 1) client.send(json);
          }
          return;
        }

        if (melding.type === "leave" && melding.documentId && melding.documentType) {
          const key = lagNøkkel(melding.documentType, melding.documentId);

          // Fjern fra dokumentklienter
          const klientSet = dokumentKlienter.get(key);
          if (klientSet) {
            klientSet.delete(ws);
            if (klientSet.size === 0) dokumentKlienter.delete(key);
          }

          // Oppdater presence store
          const brukere = leaveDokument(melding.documentId, melding.documentType, bruker.userId);

          // Broadcast oppdatert presence
          broadcast(key, {
            type: "presence",
            documentId: melding.documentId,
            documentType: melding.documentType,
            users: brukere,
          });
          return;
        }
      });

      ws.on("close", () => {
        clearTimeout(heartbeatTimer);
        klienter.delete(ws);

        // Fjern fra alle dokumenter
        const berørte = fjernBruker(bruker.userId);

        for (const { key, documentId, documentType, brukere } of berørte) {
          // Fjern fra dokumentklienter
          const klientSet = dokumentKlienter.get(key);
          if (klientSet) {
            klientSet.delete(ws);
            if (klientSet.size === 0) dokumentKlienter.delete(key);
          }

          // Broadcast oppdatert presence
          broadcast(key, {
            type: "presence",
            documentId,
            documentType,
            users: brukere,
          });
        }
      });
    });
  });
}
