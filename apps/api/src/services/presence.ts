/**
 * In-memory presence store for sanntidsvarsling.
 * Sporer hvilke brukere som redigerer hvilke dokumenter.
 * Transient — forsvinner ved server-restart.
 */

export interface AktivBruker {
  userId: string;
  navn: string;
  tilkobletTid: Date;
}

interface DokumentPresence {
  documentId: string;
  projectId: string;
  documentType: "sjekkliste" | "oppgave";
  brukere: Map<string, AktivBruker>; // userId → AktivBruker
}

// key: `${documentType}:${documentId}`
const store = new Map<string, DokumentPresence>();

// userId → Set<documentKey> — for rask opprydding ved disconnect
const brukerDokumenter = new Map<string, Set<string>>();

function lagNøkkel(documentType: string, documentId: string): string {
  return `${documentType}:${documentId}`;
}

export function joinDokument(
  documentId: string,
  documentType: "sjekkliste" | "oppgave",
  projectId: string,
  bruker: AktivBruker,
): AktivBruker[] {
  const key = lagNøkkel(documentType, documentId);

  let doc = store.get(key);
  if (!doc) {
    doc = { documentId, projectId, documentType, brukere: new Map() };
    store.set(key, doc);
  }

  doc.brukere.set(bruker.userId, bruker);

  // Oppdater bruker→dokument-mapping
  let docs = brukerDokumenter.get(bruker.userId);
  if (!docs) {
    docs = new Set();
    brukerDokumenter.set(bruker.userId, docs);
  }
  docs.add(key);

  return Array.from(doc.brukere.values());
}

export function leaveDokument(
  documentId: string,
  documentType: "sjekkliste" | "oppgave",
  userId: string,
): AktivBruker[] {
  const key = lagNøkkel(documentType, documentId);
  const doc = store.get(key);
  if (!doc) return [];

  doc.brukere.delete(userId);

  // Rydd opp tom dokument-entry
  if (doc.brukere.size === 0) {
    store.delete(key);
  }

  // Oppdater bruker→dokument-mapping
  const docs = brukerDokumenter.get(userId);
  if (docs) {
    docs.delete(key);
    if (docs.size === 0) brukerDokumenter.delete(userId);
  }

  return doc.brukere.size > 0 ? Array.from(doc.brukere.values()) : [];
}

export function hentPresence(
  documentId: string,
  documentType: "sjekkliste" | "oppgave",
): AktivBruker[] {
  const key = lagNøkkel(documentType, documentId);
  const doc = store.get(key);
  return doc ? Array.from(doc.brukere.values()) : [];
}

/**
 * Fjern bruker fra alle dokumenter (ved disconnect).
 * Returnerer liste over berørte dokument-nøkler for broadcast.
 */
export function fjernBruker(userId: string): Array<{
  key: string;
  documentId: string;
  documentType: string;
  brukere: AktivBruker[];
}> {
  const docs = brukerDokumenter.get(userId);
  if (!docs) return [];

  const berørte: Array<{
    key: string;
    documentId: string;
    documentType: string;
    brukere: AktivBruker[];
  }> = [];

  for (const key of docs) {
    const doc = store.get(key);
    if (!doc) continue;

    doc.brukere.delete(userId);

    berørte.push({
      key,
      documentId: doc.documentId,
      documentType: doc.documentType,
      brukere: Array.from(doc.brukere.values()),
    });

    if (doc.brukere.size === 0) {
      store.delete(key);
    }
  }

  brukerDokumenter.delete(userId);
  return berørte;
}
