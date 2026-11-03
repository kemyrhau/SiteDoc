/**
 * Treff-rad fra `aiSok.sok` / `ftdSok.sokDokumenter` slik mobilsøket leser den. Lokal form (cast fra tRPC-svaret)
 * for å unngå TS2589 på de dype router-typene.
 */
export interface MappeTreff {
  id: string;
  documentId: string;
  filename: string;
  chunkText: string;
  chunkIndex: number | null;
  pageNumber: number | null;
  sectionTitle: string | null;
  utdrag?: string | null;
  semantiskSetning?: string | null;
  metode?: "tekst" | "semantisk" | "begge";
  antallIDok?: number;
}
