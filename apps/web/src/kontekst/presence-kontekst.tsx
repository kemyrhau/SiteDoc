"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export interface AktivBruker {
  userId: string;
  navn: string;
  tilkobletTid: string;
}

interface PresenceKontekstType {
  joinDocument: (docId: string, docType: "sjekkliste" | "oppgave", projectId: string) => void;
  leaveDocument: (docId: string, docType: "sjekkliste" | "oppgave") => void;
  getActiveUsers: (docId: string, docType: "sjekkliste" | "oppgave") => AktivBruker[];
  erTilkoblet: boolean;
}

const PresenceKontekst = createContext<PresenceKontekstType | null>(null);

function hentWsUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;

  // test.sitedoc.no → api-test.sitedoc.no, sitedoc.no → api.sitedoc.no
  if (host.includes("sitedoc.no")) {
    const wsHost = host.startsWith("test.")
      ? host.replace("test.", "api-test.")
      : `api.${host}`;
    return `${protocol}//${wsHost}/ws`;
  }
  // Lokalt: bruk API-port direkte
  return `${protocol}//${window.location.hostname}:${process.env.NEXT_PUBLIC_API_PORT ?? "3001"}/ws`;
}

function hentSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie;
  const match = cookies.match(/(?:__Secure-)?authjs\.session-token=([^;]+)/);
  return match?.[1] ?? null;
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const [erTilkoblet, setErTilkoblet] = useState(false);

  // Presence-state: `${type}:${id}` → AktivBruker[]
  const presenceRef = useRef<Map<string, AktivBruker[]>>(new Map());
  const [versjon, setVersjon] = useState(0); // Trigger re-render

  // Pending joins (sendes etter tilkobling)
  const ventende = useRef<Array<{ docId: string; docType: string; projectId: string }>>([]);

  // Heartbeat-interval
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  // Reconnect-state
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelay = useRef(1000);
  const skalKoble = useRef(false);

  const kobleOpp = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const token = hentSessionToken();
    if (!token) return;

    const url = hentWsUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(`${url}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setErTilkoblet(true);
        reconnectDelay.current = 1000; // Reset backoff

        // Send ventende joins
        for (const v of ventende.current) {
          ws.send(JSON.stringify({
            type: "join",
            documentId: v.docId,
            documentType: v.docType,
            projectId: v.projectId,
          }));
        }

        // Start heartbeat
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "presence" && data.documentId && data.documentType) {
            const key = `${data.documentType}:${data.documentId}`;
            presenceRef.current.set(key, data.users ?? []);
            setVersjon((v) => v + 1);
          }
        } catch {
          // Ignorer ugyldig JSON
        }
      };

      ws.onclose = () => {
        setErTilkoblet(false);
        clearInterval(heartbeatRef.current);
        wsRef.current = null;

        // Auto-reconnect med eksponentiell backoff
        if (skalKoble.current) {
          reconnectTimeout.current = setTimeout(() => {
            kobleOpp();
          }, reconnectDelay.current);
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        }
      };

      ws.onerror = () => {
        // onclose kjøres automatisk etter error
      };
    } catch {
      // WebSocket-konstruktør feilet
    }
  }, []);

  // Koble til/fra basert på auth-status
  useEffect(() => {
    if (status === "authenticated") {
      skalKoble.current = true;
      kobleOpp();
    }

    return () => {
      skalKoble.current = false;
      clearTimeout(reconnectTimeout.current);
      clearInterval(heartbeatRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [status, kobleOpp]);

  const joinDocument = useCallback((docId: string, docType: "sjekkliste" | "oppgave", projectId: string) => {
    // Legg til i ventende-liste (for reconnect)
    ventende.current = ventende.current.filter(
      (v) => !(v.docId === docId && v.docType === docType),
    );
    ventende.current.push({ docId, docType, projectId });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "join",
        documentId: docId,
        documentType: docType,
        projectId,
      }));
    }
  }, []);

  const leaveDocument = useCallback((docId: string, docType: "sjekkliste" | "oppgave") => {
    // Fjern fra ventende-liste
    ventende.current = ventende.current.filter(
      (v) => !(v.docId === docId && v.docType === docType),
    );

    // Rydd opp presence-state
    const key = `${docType}:${docId}`;
    presenceRef.current.delete(key);
    setVersjon((v) => v + 1);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "leave",
        documentId: docId,
        documentType: docType,
      }));
    }
  }, []);

  const getActiveUsers = useCallback((docId: string, docType: "sjekkliste" | "oppgave") => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _v = versjon; // Sikrer at komponent re-renderer
    const key = `${docType}:${docId}`;
    return presenceRef.current.get(key) ?? [];
  }, [versjon]);

  return (
    <PresenceKontekst.Provider value={{ joinDocument, leaveDocument, getActiveUsers, erTilkoblet }}>
      {children}
    </PresenceKontekst.Provider>
  );
}

export function usePresenceKontekst(): PresenceKontekstType {
  const ctx = useContext(PresenceKontekst);
  if (!ctx) {
    throw new Error("usePresenceKontekst må brukes innenfor PresenceProvider");
  }
  return ctx;
}
