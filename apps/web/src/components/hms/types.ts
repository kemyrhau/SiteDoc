// Delte typer for HMS-visning (prosjekt-nivå + firma-nivå).

import type { FlytMedlem } from "@/lib/flyt-ledd";

export interface DokumentRad {
  id: string;
  title: string;
  number: number | null;
  status: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown> | null;
  template: {
    id: string;
    prefix: string | null;
    name: string;
    subdomain: string | null;
    objects?: Array<{ id: string; label: string; type: string }>;
    project?: { id: string; name: string } | null;
  };
  bestiller?: { name: string | null } | null;
  // For HMS-avvik (Task) — reserve for eldre rader uten egen byggeplass (ORDRE 28)
  drawing?: { byggeplass?: { id: string; name: string } | null } | null;
  // Egen byggeplass: SJA (Checklist) og avvik/RUH (Task, ORDRE 28) — leses først
  byggeplass?: { id: string; name: string } | null;
  // Flyt-posisjon (Ordre 2.3) — «Hos»-kolonnen leser aktivt ledd + medlemmer via
  // delt utledning (FlytIndikator/perspektivEtikett). Utelates i firma-aggregatet.
  aktivPosisjon?: number | null;
  dokumentflyt?: { id: string; name: string | null; medlemmer: FlytMedlem[] } | null;
  // Signaturliste-chip («X av Y signert») bæres IKKE her — den hentes flatt via
  // signatur.hentChips og sendes SjaTabell som eget oppslag (TS2589-unngåelse, se
  // hms.ts § SIGNATUR_CHIP). Nøkkelen er checklist-id (= DokumentRad.id for SJA).
}
