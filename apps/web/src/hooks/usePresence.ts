"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { usePresenceKontekst, type AktivBruker } from "@/kontekst/presence-kontekst";

/**
 * Hook for å spore og vise hvem som redigerer et dokument.
 * Sender join ved mount, leave ved unmount.
 * Filtrerer ut innlogget bruker fra listen.
 */
export function usePresence(
  documentId: string | undefined,
  documentType: "sjekkliste" | "oppgave",
): { andreRedaktorer: AktivBruker[]; antall: number } {
  const { joinDocument, leaveDocument, getActiveUsers } = usePresenceKontekst();
  const { data: session } = useSession();
  const params = useParams<{ prosjektId: string }>();
  const projectId = params?.prosjektId;

  useEffect(() => {
    if (!documentId || !projectId) return;

    joinDocument(documentId, documentType, projectId);

    return () => {
      leaveDocument(documentId, documentType);
    };
  }, [documentId, documentType, projectId, joinDocument, leaveDocument]);

  if (!documentId) return { andreRedaktorer: [], antall: 0 };

  const alleAktive = getActiveUsers(documentId, documentType);
  const egenId = session?.user?.id;
  const andreRedaktorer = egenId
    ? alleAktive.filter((u) => u.userId !== egenId)
    : alleAktive;

  return { andreRedaktorer, antall: andreRedaktorer.length };
}
